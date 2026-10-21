import csv
import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, SimpleTestCase

from .management.commands.import_torob import SCHEMAS
from .models import DatasetImport, Offer, Product, Shop, ShopContact
from .normalization import normalize_search
from .services import find_sellers, search_products


class NormalizationTests(SimpleTestCase):
    def test_persian_variants(self):
        self.assertEqual(normalize_search('كیفِ سامسونگ ۱۲۳'), 'کیف سامسونگ 123')
        self.assertEqual(normalize_search('هدفون\u200cبی‌سیم'), 'هدفون بی سیم')


class ImportTests(TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.rows = {
            'shops': [{
                'shop_id': 'shop_test', 'name': 'فروشگاه نمونه', 'address': 'تهران، واحد ۱۲',
                'category_names': ['هدفون'], 'contacts': [{'channel': 'phone', 'display_number': 'جعلی'}],
                'instagram': None, 'lat': 35.71, 'lon': 51.41, 'location_label': 'ولیعصر',
                'payment_options': [{'provider_name': 'ترب‌پی', 'channel': 'unknown', 'min_price_toman': None, 'max_price_toman': 0, 'category_names': []}],
                'supports_fast_delivery': None, 'website_url': None,
                'weekly_hours': {'fri': {'status': 'closed', 'shifts': [{'start_time': '00:00:00', 'end_time': '00:00:00'}]}},
            }],
            'products': [{ 'product_id': 'product_test', 'persian_title': 'هدفون سونی ۱۲', 'brand_name': 'سونی',
                'category_name': 'هدفون', 'model': None, 'image_urls': ['https://example.com/image.png'],
                'specs': [{'key': 'رنگ', 'value': 'مشکی', 'section': 'عمومی'}]}],
            'offers': [{ 'offer_id': 'offer_test', 'product_id': 'product_test', 'shop_id': 'shop_test',
                'seller_title': 'هدفون', 'description': '', 'price_toman': None,
                'last_price_changed_at': '2026-09-14T08:57:27.401253+00:00',
                'warranty': {'provider': 'تست', 'period_months': None, 'description': None}}],
        }
        self.write_files()

    def write_files(self):
        for name, rows in self.rows.items():
            with (self.directory / f'{name}.csv').open('w', encoding='utf-8', newline='') as stream:
                writer = csv.DictWriter(stream, fieldnames=sorted(SCHEMAS[name]))
                writer.writeheader()
                for row in rows:
                    writer.writerow({k: json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list, bool)) or v is None else str(v) for k, v in row.items()})

    def run_import(self, **kwargs):
        call_command('import_torob', path=str(self.directory), stdout=io.StringIO(), **kwargs)

    def test_import_preserves_unknowns_relations_and_safety(self):
        self.run_import()
        offer = Offer.objects.select_related('shop', 'product').get()
        self.assertIsNone(offer.price_toman)
        self.assertIsNone(offer.shop.supports_fast_delivery)
        self.assertEqual(offer.availability_status, 'unverified')
        self.assertEqual(offer.product.specs, self.rows['products'][0]['specs'])
        self.assertEqual(offer.shop.opening_days.get().status, 'closed')
        self.assertTrue(offer.shop.name_is_synthetic)
        self.assertFalse(ShopContact.objects.get().is_publishable)
        self.assertEqual(offer.shop.categories.get().name, 'هدفون')
        self.assertEqual(offer.last_price_changed_at.isoformat(), '2026-09-14T08:57:27.401253+00:00')
        self.assertEqual(search_products('هدفون سوني 12')[0]['product_id'], 'product_test')
        sellers = find_sellers('product_test', latitude=35.71, longitude=51.41, radius_km=1)
        self.assertLess(sellers[0]['distance_km'], .01)
        self.assertFalse(sellers[0]['shop']['contacts_available_for_real_outreach'])
        self.assertNotIn('contacts', sellers[0]['shop'])
        self.assertEqual(find_sellers('product_test', max_price=100000), [])
        self.assertEqual(find_sellers('product_test', in_person_credit=True), [])

    def test_idempotent_upsert_preserves_verified_state(self):
        self.run_import()
        self.run_import()
        self.assertEqual(DatasetImport.objects.count(), 1)
        Offer.objects.update(availability_status='confirmed')
        self.run_import(force=True)
        self.assertEqual(Offer.objects.count(), 1)
        self.assertEqual(ShopContact.objects.count(), 1)
        self.assertEqual(Offer.objects.get().availability_status, 'confirmed')

    def test_orphan_reference_rolls_back_entire_import(self):
        self.rows['offers'][0]['shop_id'] = 'shop_missing'
        self.write_files()
        with self.assertRaises(CommandError):
            self.run_import()
        self.assertEqual(Shop.objects.count(), 0)
        self.assertEqual(Product.objects.count(), 0)
        self.assertEqual(DatasetImport.objects.count(), 0)

    def test_zero_price_is_not_missing(self):
        self.rows['offers'][0]['price_toman'] = 0
        self.rows['shops'][0]['payment_options'][0]['channel'] = 'in_person'
        self.write_files()
        self.run_import()
        self.assertEqual(find_sellers('product_test', max_price=1, in_person_credit=True)[0]['price_toman'], 0)
