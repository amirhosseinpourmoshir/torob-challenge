import json
import re
from datetime import date
from functools import lru_cache
from pathlib import Path
from django.utils import timezone
from catalog.normalization import normalize_search

REPLICA = r'های\s*کپی|هایکپی|کپی|غیر\s*اصل|غیراصل|طرح\s*(?:اصل|اپل)|مستر\s*کوالیتی|high\s*copy|replica|fake'
PART = r'تک\s*گوش|گوش\s*(?:چپ|راست)|گوشی\s*سمت|^\s*(?:کیس|باکس|کاور|قاب|شارژر|سرشارژر|کابل|باتری)\b|فقط\s*(?:کیس|محفظه)|replacement\s*(?:case|earbud)|charging\s*case\s*only'
AIRPODS = r'ایر\s*پاد|air\s*pods?'


@lru_cache(maxsize=1)
def references():
    return json.loads((Path(__file__).parent / 'price-references.json').read_text(encoding='utf-8'))


def variant_for(text):
    text = normalize_search(text)
    if not re.search(AIRPODS, text):
        return None
    if re.search(r'(?:پرو|pro)\s*3', text):
        return 'airpods_pro_3'
    if re.search(r'(?:پرو|pro)\s*2', text):
        return 'airpods_pro_2'
    if re.search(r'(?:پرو|pro)\s*[12]|(?:ایر\s*پاد|air\s*pods?)\s*[235]|max|مکس', text):
        return None
    if re.search(r'(?:ایر\s*پاد|air\s*pods?)\s*4|نسل\s*(?:چهارم|4)', text):
        return 'airpods_4_anc' if re.search(r'anc|نویز\s*کنسل|نویزگیر|حذف\s*نویز', text) else 'airpods_4'
    return None


def price_context(query):
    text = normalize_search(query)
    variant = variant_for(text)
    matched = [row for row in references() if row['variant'] == variant] if variant else references() if re.search(AIRPODS, text) and not re.search(r'\d|max|مکس', text) else []
    today = timezone.localdate()
    rows = [{**row, 'stale': (today - date.fromisoformat(row['observed_at'])).days > 7} for row in matched]
    return {'references': rows, 'live_verified': False, 'exact_model_match': bool(variant), 'note': 'این‌ها قیمت اعلامی منبع در تاریخ مشاهده‌اند، نه قیمت قطعی کل بازار یا تضمین اصالت. مرجع بیش از هفت روز قدیمی برای تشخیص ناهنجاری عددی استفاده نمی‌شود. برای مدل فاقد مرجع، عدد حدس نزن.'}


def assess_product(product, price):
    title = product.persian_title or product.model or ''
    metadata = title + ' ' + str(product.model or '') + ' ' + json.dumps(product.specs, ensure_ascii=False)
    if re.search(REPLICA, normalize_search(metadata), re.I):
        return {'kind': 'replica_declared', 'label': 'عنوان یا مشخصات، طرح/غیراصل را اعلام می‌کند', 'reason': 'در متن ثبت‌شده نشانهٔ کپی یا طرح اصلی وجود دارد؛ به‌عنوان اپل اصل پیشنهاد نشود.'}
    if re.search(PART, normalize_search(title), re.I):
        return {'kind': 'part', 'label': 'قطعه یا لوازم جانبی', 'reason': 'این مورد مجموعهٔ کامل هدفون نیست.'}
    variant = variant_for(title)
    sources = [row for row in price_context(title)['references'] if not row['stale']] if variant else []
    if variant == 'airpods_pro_2' and not re.search(r'usb.?c|تایپ\s*سی|type.?c', normalize_search(metadata)):
        sources = []  # Lightning and USB-C versions need separate references.
    if price is not None and sources and price < min(row['price_toman'] for row in sources) * .5:
        return {'kind': 'price_outlier', 'label': 'قیمت نیازمند بررسی اصالت و شرایط', 'reason': 'قیمت ثبت‌شده کمتر از نصف نمونهٔ مرجع همین مدل نو و کامل است؛ احتمال قطعه، کارکرده، خطای قیمت یا غیراصل مطرح است، نه اثبات فیک بودن.', 'references': sources}
    family = [row for row in price_context('ایرپاد اپل')['references'] if not row['stale']]
    if price is not None and family and re.search(AIRPODS, normalize_search(title)) and re.search(r'اپل|apple', normalize_search(title + ' ' + str(product.brand_name or ''))) and price < min(row['price_toman'] for row in family) * .2:
        return {'kind': 'conditions_unclear', 'label': 'قیمت پایین؛ مدل و شرایط را بررسی کن', 'reason': 'قیمت بسیار کمتر از نمونه‌های نسل جدید است، اما مرجع دقیق همین مدل و شرایط نداریم. نسل قدیمی، کارکرده، قطعه، خطای قیمت یا غیراصل می‌تواند علت باشد؛ اصالت را از روی این عدد قطعی ندان و پیش از پیشنهاد به‌عنوان اصل شرایط را روشن کن.', 'references': family, 'exact_model_match': False}
    return {'kind': 'unverified', 'label': '', 'reason': 'اصالت و موجودی زنده تأیید نشده است.'}
