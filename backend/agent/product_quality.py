import json
import re
from datetime import date
from functools import lru_cache
from pathlib import Path
from django.utils import timezone
from django.core.cache import cache
from catalog.normalization import normalize_search

REPLICA = r'های\s*کپی|هایکپی|کپی\s*اصل|غیر\s*اصل|غیراصل|طرح\s*(?:اصل|برند|اپل)|مستر\s*کوالیتی|high\s*copy|replica|fake|فیک'
PART = r'تک\s*گوش|گوش\s*(?:چپ|راست)|گوشی\s*سمت|^\s*(?:کیس|باکس|کاور|قاب|شارژر|سرشارژر|کابل|باتری)\b|فقط\s*(?:کیس|محفظه)|replacement\s*(?:case|earbud)|charging\s*case\s*only'


@lru_cache(maxsize=1)
def references():
    return json.loads((Path(__file__).parent / 'price-references.json').read_text(encoding='utf-8'))


def matching_references(text, metadata=None):
    text, metadata = normalize_search(text), normalize_search(metadata or text)
    return [row for row in references() if re.search(row['match_pattern'], text) and not re.search(row.get('exclude_pattern') or r'(?!)', text) and (not row.get('condition_pattern') or re.search(row['condition_pattern'], metadata))]


def variant_for(text):
    rows = matching_references(text)
    return rows[0]['variant'] if rows else None


def price_context(query):
    text = normalize_search(query)
    exact = matching_references(text)
    matched = exact or ([row for row in references() if re.search(row.get('family_pattern') or r'(?!)', text)] if not re.search(r'\d|max|مکس', text) else [])
    today = timezone.localdate()
    rows = [{**{key: value for key, value in row.items() if not key.endswith('_pattern')}, 'stale': not 0 <= (today - date.fromisoformat(row['observed_at'])).days <= 7} for row in matched]
    return {'references': rows, 'live_verified': False, 'exact_model_match': bool(exact), 'note': 'قیمت منبع در تاریخ مشاهده است، نه قیمت قطعی بازار یا تضمین اصالت. مدل فاقد مرجع قیمت حدسی ندارد؛ مرجع قدیمی‌تر از هفت روز برای آستانه عددی استفاده نمی‌شود.'}


def peer_prices(product_id):
    from catalog.models import Offer
    key = 'agent-price-peers:' + str(product_id)
    rows = cache.get(key)
    if rows is None:
        rows = list(Offer.objects.filter(product_id=product_id, price_toman__gt=0).order_by('price_toman').values_list('price_toman', flat=True)[:100])
        cache.set(key, rows, 300)
    return rows


def assess_product(product, price):
    title = product.persian_title or product.model or ''
    metadata = title + ' ' + str(product.model or '') + ' ' + json.dumps(product.specs, ensure_ascii=False)
    if re.search(REPLICA, normalize_search(metadata), re.I):
        return {'kind': 'replica_declared', 'label': 'عنوان یا مشخصات، طرح/غیراصل را اعلام می‌کند', 'reason': 'در متن ثبت‌شده نشانهٔ کپی یا طرح اصلی وجود دارد؛ به‌عنوان کالای اصل پیشنهاد نشود.'}
    if re.search(PART, normalize_search(title), re.I):
        return {'kind': 'part', 'label': 'قطعه یا لوازم جانبی', 'reason': 'این مورد قطعه یا لوازم جانبی است؛ به‌جای کالای کامل پیشنهاد نشود.'}
    if re.search(r'کارکرده|استوک|دست\s*دوم|used|refurbished', normalize_search(title), re.I):
        return {'kind': 'condition_declared', 'label': 'استوک یا کارکرده؛ طبق عنوان فروشنده', 'reason': 'قیمت کالای کارکرده با مرجع کالای نو سنجیده نمی‌شود. سلامت و اصالت را از فروشنده تأیید کن.'}
    today = timezone.localdate()
    sources = [row for row in matching_references(title, metadata) if 0 <= (today - date.fromisoformat(row['observed_at'])).days <= 7]
    if price is not None and sources and price < min(row['price_toman'] for row in sources) * .5:
        return {'kind': 'price_outlier', 'label': 'قیمت نیازمند بررسی اصالت و شرایط', 'reason': 'قیمت کمتر از نصف نمونهٔ مرجع همین مدل است؛ قطعه، کارکرده، خطای قیمت یا غیراصل ممکن است. این اختلاف اثبات فیک بودن نیست.', 'references': sources}
    peers = peer_prices(product.pk) if price is not None else []
    if len(peers) >= 3:
        middle = len(peers) // 2
        median = peers[middle] if len(peers) % 2 else (peers[middle - 1] + peers[middle]) / 2
        if price < median * .35:
            return {'kind': 'price_outlier', 'label': 'اختلاف زیاد با قیمت‌های همین کالا', 'reason': 'کمترین قیمت کمتر از ۳۵ درصد میانهٔ پیشنهادهای ثبت‌شدهٔ همین شناسهٔ کالا است. قیمت قدیمی، تفاوت شرایط یا خطای ثبت ممکن است؛ اصالت از این عدد تعیین نمی‌شود.', 'dataset_median_toman': median, 'sample_count': len(peers), 'live_verified': False}
    return {'kind': 'unverified', 'label': '', 'reason': 'اصالت و موجودی زنده تأیید نشده است.'}
