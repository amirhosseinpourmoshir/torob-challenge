import csv
import hashlib
import json
import math
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.utils import timezone
from psycopg.types.json import Jsonb

from catalog.models import DatasetImport, Shop, Product, Offer
from catalog.normalization import normalize_search

SCHEMAS = {
    'shops': {'address', 'category_names', 'contacts', 'instagram', 'lat', 'location_label', 'lon', 'name', 'payment_options', 'shop_id', 'supports_fast_delivery', 'website_url', 'weekly_hours'},
    'products': {'brand_name', 'category_name', 'image_urls', 'model', 'persian_title', 'product_id', 'specs'},
    'offers': {'description', 'last_price_changed_at', 'offer_id', 'price_toman', 'product_id', 'seller_title', 'shop_id', 'warranty'},
}
JSON_FIELDS = {'category_names': list, 'contacts': list, 'instagram': dict, 'payment_options': list,
               'weekly_hours': dict, 'image_urls': list, 'specs': list, 'warranty': dict}


def decode_row(row):
    result = {}
    for key, value in row.items():
        if value is None:
            raise ValueError('Missing CSV cell')
        if value == 'null':
            result[key] = None
        elif key in JSON_FIELDS:
            parsed = json.loads(value)
            if not isinstance(parsed, JSON_FIELDS[key]):
                raise ValueError(f'{key} must be {JSON_FIELDS[key].__name__}')
            result[key] = parsed
        elif key in ('lat', 'lon'):
            result[key] = float(value)
            if not math.isfinite(result[key]):
                raise ValueError(f'{key} must be finite')
        elif key == 'price_toman':
            result[key] = int(value)
            if result[key] < 0:
                raise ValueError('price_toman must be nonnegative')
        elif key == 'supports_fast_delivery':
            if value not in ('true', 'false'):
                raise ValueError('supports_fast_delivery must be true/false/null')
            result[key] = value == 'true'
        else:
            result[key] = value
    return result


def upsert(cursor, table, fields, expressions, stage, import_id):
    columns = ', '.join(fields + ['source_data', 'dataset_import_id'])
    values = ', '.join(expressions + ['payload', '%s'])
    updates = ', '.join(f'{field}=EXCLUDED.{field}' for field in fields[1:] + ['source_data', 'dataset_import_id'])
    cursor.execute(f'INSERT INTO {table} ({columns}) SELECT {values} FROM {stage} ON CONFLICT (id) DO UPDATE SET {updates}', [import_id])


class Command(BaseCommand):
    help = 'Validate and atomically import the complete Torob CSV dataset into PostgreSQL.'

    def add_arguments(self, parser):
        parser.add_argument('--path', default='/dataset')
        parser.add_argument('--force', action='store_true', help='Reapply identical files using upsert, without duplicating rows.')

    def handle(self, *args, **options):
        directory = Path(options['path'])
        manifest = {}
        for name in SCHEMAS:
            path = directory / f'{name}.csv'
            if not path.is_file():
                raise CommandError(f'Missing file: {path}')
            with path.open('rb') as stream:
                digest = hashlib.file_digest(stream, 'sha256').hexdigest()
            manifest[name] = {'sha256': digest, 'bytes': path.stat().st_size}
        if connection.vendor != 'postgresql':
            raise CommandError('This import requires PostgreSQL.')
        try:
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute('SELECT pg_try_advisory_xact_lock(86742026)')
                    if not cursor.fetchone()[0]:
                        raise CommandError('Another dataset import is already running.')
                    previous = DatasetImport.objects.filter(completed_at__isnull=False, manifest=manifest, schema_version=1).order_by('-id').first()
                    actual = {'shops': Shop.objects.count(), 'products': Product.objects.count(), 'offers': Offer.objects.count()}
                    if previous and not options['force'] and all(actual[k] == previous.counts[k] for k in actual):
                        self.stdout.write(self.style.SUCCESS(f'Already imported; no changes. {json.dumps(actual)}'))
                        return
                    counts = {}
                    for name in SCHEMAS:
                        cursor.execute(f'CREATE TEMP TABLE stage_{name} (id text PRIMARY KEY, payload jsonb NOT NULL, search_text text NOT NULL) ON COMMIT DROP')
                        with (directory / f'{name}.csv').open(encoding='utf-8-sig', newline='') as stream:
                            reader = csv.DictReader(stream)
                            if set(reader.fieldnames or []) != SCHEMAS[name]:
                                raise CommandError(f'Unexpected columns in {name}.csv: {reader.fieldnames}')
                            count = 0
                            with cursor.copy(f'COPY stage_{name} (id, payload, search_text) FROM STDIN') as copy:
                                for line, raw in enumerate(reader, 2):
                                    try:
                                        if None in raw:
                                            raise ValueError('Extra CSV columns')
                                        row = decode_row(raw)
                                        key = row[{'shops': 'shop_id', 'products': 'product_id', 'offers': 'offer_id'}[name]]
                                        if not key or not key.startswith({'shops': 'shop_', 'products': 'product_', 'offers': 'offer_'}[name]):
                                            raise ValueError('Invalid source ID')
                                        if name == 'shops':
                                            if not (-90 <= row['lat'] <= 90 and -180 <= row['lon'] <= 180):
                                                raise ValueError('Invalid coordinates')
                                            text = ' '.join(str(row.get(k) or '') for k in ['name', 'address', 'location_label']) + ' ' + ' '.join(row['category_names'])
                                        elif name == 'products':
                                            text = ' '.join(str(row.get(k) or '') for k in ['persian_title', 'brand_name', 'model', 'category_name'])
                                            text += ' ' + ' '.join(str(spec.get('value') or '') for spec in row['specs'])
                                        else:
                                            text = ''
                                        copy.write_row((key, Jsonb(row), normalize_search(text)))
                                        count += 1
                                    except (ValueError, TypeError, KeyError) as exc:
                                        raise CommandError(f'{name}.csv record {line}: {exc}') from exc
                            counts[name] = count
                            cursor.execute(f'ANALYZE stage_{name}')
                            self.stdout.write(f'Read and validated {name}: {count:,}', ending='\n')
                            self.stdout.flush()
                    for key, stage in [('shop_id', 'shops'), ('product_id', 'products')]:
                        cursor.execute(f"SELECT count(*) FROM stage_offers o LEFT JOIN stage_{stage} p ON p.id=o.payload->>'{key}' WHERE p.id IS NULL")
                        if cursor.fetchone()[0]:
                            raise CommandError(f'Orphan offer {key} references; import rolled back.')
                    run = DatasetImport.objects.create(manifest=manifest, counts=counts)
                    cursor.execute("INSERT INTO catalog_category (name) SELECT DISTINCT payload->>'category_name' FROM stage_products UNION SELECT DISTINCT jsonb_array_elements_text(payload->'category_names') FROM stage_shops ON CONFLICT DO NOTHING")
                    upsert(cursor, 'catalog_shop', ['id','name','address','location_label','latitude','longitude','website_url','instagram','supports_fast_delivery','name_is_synthetic','contacts_are_synthetic','weekly_hours','search_text'],
                           ['id',"payload->>'name'","payload->>'address'","payload->>'location_label'","(payload->>'lat')::double precision","(payload->>'lon')::double precision","payload->>'website_url'","NULLIF(payload->'instagram','null'::jsonb)","(payload->>'supports_fast_delivery')::boolean","(payload->>'website_url' IS NULL AND (payload->'instagram' IS NULL OR payload->'instagram'='null'::jsonb))",'true',"payload->'weekly_hours'",'search_text'], 'stage_shops', run.id)
                    upsert(cursor, 'catalog_product', ['id','persian_title','brand_name','model','category_id','image_urls','specs','search_text'],
                           ['id',"payload->>'persian_title'","payload->>'brand_name'","payload->>'model'","payload->>'category_name'","payload->'image_urls'","payload->'specs'",'search_text'], 'stage_products', run.id)
                    self.stdout.write('Products and shops stored. Linking offers and shop details...')
                    self.stdout.flush()
                    # Availability is not inferred from an offer, and existing verified state is preserved on updates.
                    fields = ['id','product_id','shop_id','seller_title','description','price_toman','last_price_changed_at','warranty','source_data','dataset_import_id','availability_status','availability_verified_at']
                    expressions = ['id',"payload->>'product_id'","payload->>'shop_id'","payload->>'seller_title'","COALESCE(payload->>'description','')","(payload->>'price_toman')::bigint","(payload->>'last_price_changed_at')::timestamptz","NULLIF(payload->'warranty','null'::jsonb)",'payload','%s',"'unverified'",'NULL']
                    updates = ', '.join(f'{field}=EXCLUDED.{field}' for field in fields[1:-2])
                    cursor.execute(f"INSERT INTO catalog_offer ({', '.join(fields)}) SELECT {', '.join(expressions)} FROM stage_offers ON CONFLICT (id) DO UPDATE SET {updates}", [run.id])
                    for table in ['catalog_shopcategory','catalog_shopcontact','catalog_paymentoption','catalog_openingday']:
                        cursor.execute(f'DELETE FROM {table} WHERE shop_id IN (SELECT id FROM stage_shops)')
                    cursor.execute("INSERT INTO catalog_shopcategory (shop_id,category_id) SELECT DISTINCT id,jsonb_array_elements_text(payload->'category_names') FROM stage_shops")
                    cursor.execute("INSERT INTO catalog_shopcontact (shop_id,position,channel,details,is_synthetic,is_publishable) SELECT s.id,c.n-1,c.v->>'channel',c.v,true,false FROM stage_shops s CROSS JOIN LATERAL jsonb_array_elements(s.payload->'contacts') WITH ORDINALITY c(v,n)")
                    cursor.execute("INSERT INTO catalog_paymentoption (shop_id,position,provider_name,channel,min_price_toman,max_price_toman,category_names,source_data) SELECT s.id,p.n-1,p.v->>'provider_name',p.v->>'channel',(p.v->>'min_price_toman')::bigint,(p.v->>'max_price_toman')::bigint,p.v->'category_names',p.v FROM stage_shops s CROSS JOIN LATERAL jsonb_array_elements(s.payload->'payment_options') WITH ORDINALITY p(v,n)")
                    cursor.execute("INSERT INTO catalog_openingday (shop_id,weekday,status,shifts) SELECT s.id,h.key,h.value->>'status',h.value->'shifts' FROM stage_shops s CROSS JOIN LATERAL jsonb_each(s.payload->'weekly_hours') h")
                    quality = {}
                    for label, sql in {
                        'unknown_prices': 'SELECT count(*) FROM catalog_offer WHERE price_toman IS NULL',
                        'unknown_price_dates': 'SELECT count(*) FROM catalog_offer WHERE last_price_changed_at IS NULL',
                        'unknown_product_titles': "SELECT count(*) FROM catalog_product WHERE persian_title IS NULL OR btrim(persian_title)=''",
                        'synthetic_shop_names': 'SELECT count(*) FROM catalog_shop WHERE name_is_synthetic',
                        'synthetic_contacts': 'SELECT count(*) FROM catalog_shopcontact WHERE is_synthetic',
                        'unverified_offers': "SELECT count(*) FROM catalog_offer WHERE availability_status='unverified'",
                    }.items():
                        cursor.execute(sql); quality[label] = cursor.fetchone()[0]
                    run.quality = quality
                    run.completed_at = timezone.now()
                    run.save(update_fields=['quality','completed_at'])
                    for table in ['catalog_shop','catalog_product','catalog_offer','catalog_shopcategory','catalog_paymentoption','catalog_openingday']:
                        cursor.execute(f'ANALYZE {table}')
                    for name in SCHEMAS:
                        cursor.execute(f'DROP TABLE stage_{name}')
            self.stdout.write(self.style.SUCCESS(f'Import {run.id} committed. Counts: {json.dumps(counts)}; quality: {json.dumps(quality)}'))
        except CommandError:
            raise
        except Exception as exc:
            raise CommandError(f'Import failed; transaction rolled back: {exc}') from exc
