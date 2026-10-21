import json
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from catalog.models import DatasetImport


class Command(BaseCommand):
    help = 'Audit row counts, foreign keys, and key typed fields against stored source payloads.'

    def handle(self, *args, **options):
        run = DatasetImport.objects.filter(completed_at__isnull=False).order_by('-id').first()
        if not run:
            raise CommandError('No completed import exists.')
        report = {'import_id': run.id, 'manifest': run.manifest, 'quality': run.quality}
        with connection.cursor() as cursor:
            for name, key in [('shops', 'shop_id'), ('products', 'product_id'), ('offers', 'offer_id')]:
                table = {'shops': 'catalog_shop', 'products': 'catalog_product', 'offers': 'catalog_offer'}[name]
                cursor.execute(f'SELECT count(*) FROM {table} WHERE dataset_import_id=%s', [run.id])
                actual = cursor.fetchone()[0]
                report[name] = {'expected': run.counts[name], 'actual': actual}
                if actual != run.counts[name]:
                    raise CommandError(f'{name} count mismatch: {actual} != {run.counts[name]}')
                cursor.execute(f"SELECT count(*) FROM {table} WHERE id IS DISTINCT FROM source_data->>'{key}'")
                if cursor.fetchone()[0]:
                    raise CommandError(f'{name} source ID mismatch')
            checks = {
                'orphan_products': 'SELECT count(*) FROM catalog_offer o LEFT JOIN catalog_product p ON p.id=o.product_id WHERE p.id IS NULL',
                'orphan_shops': 'SELECT count(*) FROM catalog_offer o LEFT JOIN catalog_shop s ON s.id=o.shop_id WHERE s.id IS NULL',
                'changed_prices': "SELECT count(*) FROM catalog_offer WHERE price_toman IS DISTINCT FROM (source_data->>'price_toman')::bigint",
                'changed_price_dates': "SELECT count(*) FROM catalog_offer WHERE last_price_changed_at IS DISTINCT FROM (source_data->>'last_price_changed_at')::timestamptz",
                'changed_specifications': "SELECT count(*) FROM catalog_product WHERE specs IS DISTINCT FROM source_data->'specs'",
                'changed_images': "SELECT count(*) FROM catalog_product WHERE image_urls IS DISTINCT FROM source_data->'image_urls'",
                'changed_product_text': "SELECT count(*) FROM catalog_product WHERE persian_title IS DISTINCT FROM source_data->>'persian_title' OR brand_name IS DISTINCT FROM source_data->>'brand_name' OR model IS DISTINCT FROM source_data->>'model' OR category_id IS DISTINCT FROM source_data->>'category_name'",
                'changed_shop_text': "SELECT count(*) FROM catalog_shop WHERE name IS DISTINCT FROM source_data->>'name' OR address IS DISTINCT FROM source_data->>'address' OR location_label IS DISTINCT FROM source_data->>'location_label' OR website_url IS DISTINCT FROM source_data->>'website_url'",
                'changed_weekly_hours': "SELECT count(*) FROM catalog_shop WHERE weekly_hours IS DISTINCT FROM source_data->'weekly_hours'",
                'changed_warranties': "SELECT count(*) FROM catalog_offer WHERE warranty IS DISTINCT FROM NULLIF(source_data->'warranty','null'::jsonb)",
                'changed_coordinates': "SELECT count(*) FROM catalog_shop WHERE latitude IS DISTINCT FROM (source_data->>'lat')::double precision OR longitude IS DISTINCT FROM (source_data->>'lon')::double precision",
                'publishable_fake_contacts': 'SELECT count(*) FROM catalog_shopcontact WHERE is_synthetic AND is_publishable',
            }
            report['integrity_checks'] = {}
            for label, sql in checks.items():
                cursor.execute(sql)
                failures = cursor.fetchone()[0]
                report['integrity_checks'][label] = failures
                if failures:
                    raise CommandError(f'{label}: {failures}')
            report['related_counts'] = {}
            for table in ['catalog_category','catalog_shopcategory','catalog_shopcontact','catalog_paymentoption','catalog_openingday']:
                cursor.execute(f'SELECT count(*) FROM {table}')
                report['related_counts'][table] = cursor.fetchone()[0]
        self.stdout.write(json.dumps(report, ensure_ascii=False, indent=2))
