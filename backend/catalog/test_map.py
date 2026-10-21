from django.core.cache import cache
from django.test import TestCase
from core.models import SavedAddress
from .models import Category, DatasetImport, Shop
from .normalization import normalize_search
from .map_views import MAX_MARKERS


class ShopMapTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        dataset = DatasetImport.objects.create()
        category = Category.objects.create(name='گوشی موبایل')
        for i in range(90):
            shop = Shop.objects.create(id=f'shop_{i:03}', name=f'فروشگاه {i}', address='تهران، نشانی دیتاست', latitude=35.70 + i * .0002, longitude=51.40 + i * .0002, search_text=normalize_search(f'فروشگاه {i} گوشی موبایل'), source_data={}, dataset_import=dataset)
            shop.categories.add(category)
        cls.near_id = 'shop_000'

    def setUp(self):
        cache.clear()

    def url(self, **params):
        from urllib.parse import urlencode
        args = dict(west=51.38, south=35.68, east=51.45, north=35.74, zoom=18)
        args.update(params)
        return '/api/shops/map/?' + urlencode(args)

    def origin(self, latitude=35.70, longitude=51.40):
        import uuid
        key = str(uuid.uuid4())
        session = self.client.session
        session['address_owner'] = key
        session.save()
        return SavedAddress.objects.create(owner_key=key, label='مبدأ', full_address='تهران، آدرس انتخابی تست', plaque='۱', latitude=latitude, longitude=longitude, is_active=True)

    def test_zoom_out_returns_no_shops_without_database_query(self):
        with self.assertNumQueries(0):
            response = self.client.get(self.url(zoom=13))
        self.assertTrue(response.json()['zoom_required'])
        self.assertEqual(response.json()['shops'], [])

    def test_viewport_cap_bounds_and_no_fake_contacts(self):
        data = self.client.get(self.url()).json()
        self.assertEqual(len(data['shops']), MAX_MARKERS)
        self.assertTrue(data['limited'])
        shop = data['shops'][0]
        self.assertTrue(shop['name_is_synthetic'])
        self.assertEqual(shop['category'], 'digital')
        self.assertNotIn('contacts', shop)
        self.assertIsNone(shop['distance_m'])
        self.assertEqual(self.client.get(self.url(west=51.50, east=51.51)).json()['shops'], [])

    def test_invalid_bounds_and_nonfinite_numbers(self):
        for params in [dict(west='NaN'), dict(zoom='Infinity'), dict(east=51), dict(north=90), dict(category='invalid')]:
            self.assertEqual(self.client.get(self.url(**params)).status_code, 400)

    def test_search_requires_active_address_and_orders_by_real_distance(self):
        self.assertEqual(self.client.get('/api/shops/search/', {'q': 'موبایل'}).status_code, 400)
        self.origin()
        data = self.client.get('/api/shops/search/', {'q': 'موبايل'}).json()
        self.assertEqual(data['shops'][0]['id'], self.near_id)
        self.assertLessEqual(data['shops'][0]['distance_m'], 1)
        distances = [s['distance_m'] for s in data['shops']]
        self.assertEqual(distances, sorted(distances))
        self.assertEqual(data['distance_kind'], 'straight_line')
        self.assertEqual(len(distances), 8)
        # An address belonging to another session cannot change the origin.
        self.assertEqual(self.client.get('/api/shops/search/', {'q': 'موبایل', 'lat': '35.8', 'lon': '51.6'}).json()['shops'][0]['id'], self.near_id)

    def test_category_and_saved_ids_filters(self):
        self.assertEqual(self.client.get(self.url(category='fashion')).json()['shops'], [])
        self.assertEqual(len(self.client.get(self.url(ids=self.near_id)).json()['shops']), 1)
        self.assertEqual(self.client.get(self.url(ids='')).json()['shops'], [])
        self.origin()
        data = self.client.get('/api/shops/search/', {'q': 'موبایل', 'ids': 'shop_089'}).json()
        self.assertEqual(data['shops'][0]['id'], 'shop_089')
        self.assertGreater(data['shops'][0]['distance_m'], 2000)
