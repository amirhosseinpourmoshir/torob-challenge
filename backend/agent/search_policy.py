"""Shared catalogue intent rules: device families, brands and exact model tokens."""
import re
from django.db.models import Q
from catalog.normalization import normalize_search
from .localization import query_variants

ACCESSORIES = r'کاور|کیف|قاب|کابل|باتری|تعمیر|قطعه|گلس|شارژر|لوازم جانبی|بند ساعت|تک\s*گوش|کیس'
FAMILIES = (
    (r'هدفون|هدست|هندزفری|ایرباد|ایر\s*پاد|air\s*pods?|headphones?|earbuds?', r'هدفون، هدست و هندزفری'),
    (r'گوشی|موبایل|آیفون|ایفون|iphone|smartphone', r'^گوشی'),
    (r'لپ\s*تاپ|لپتاپ|laptop|مک\s*بوک|macbook', r'لپ.*تاپ'),
    (r'تبلت|آیپد|ایپد|ipad|tablet', r'تبلت'),
    (r'تلویزیون|television', r'تلویزیون'),
    (r'دوربین|camera', r'دوربین'),
    (r'کنسول|پلی\s*استیشن|playstation|ایکس\s*باکس|xbox', r'کنسول'),
    (r'ساعت هوشمند|smartwatch', r'ساعت هوشمند'),
    (r'کتانی|کتونی|کفش|sneakers?', r'کفش|کتانی'),
)
BRANDS = (
    r'اپل|apple', r'سامسونگ|samsung', r'شیائومی|xiaomi', r'سونی|sony',
    r'انکر|anker', r'لنوو|lenovo', r'ایسوس|asus', r'اچ پی|hp',
    r'هواوی|huawei', r'نوکیا|nokia', r'نایک|nike', r'آدیداس|ادیداس|adidas',
    r'ال جی|lg', r'کانن|canon', r'نیکون|nikon', r'بوش|bosch',
)


def title_match(pattern):
    return Q(persian_title__iregex=pattern) | (Q(persian_title='') & Q(model__iregex=pattern))


def token_pattern(word):
    if word.isdigit():
        digits = ''.join('[' + char + '۰۱۲۳۴۵۶۷۸۹'[int(char)] + '٠١٢٣٤٥٦٧٨٩'[int(char)] + ']' for char in word)
        return r'(^|[^0-9۰-۹٠-٩])' + digits + r'([^0-9۰-۹٠-٩]|$)'
    return {'ایرپاد': r'ایر\s*پاد|air\s*pods?', 'airpods': r'ایر\s*پاد|air\s*pods?', 'آیفون': r'آیفون|ایفون|iphone', 'ایفون': r'آیفون|ایفون|iphone', 'iphone': r'آیفون|ایفون|iphone', 'pro': r'pro|پرو', 'پرو': r'pro|پرو', 'max': r'max|مکس', 'مکس': r'max|مکس'}.get(word, re.escape(word))


def apply_search_intent(candidates, query):
    text = normalize_search(query)
    accessory = bool(re.search(ACCESSORIES, text))
    family = next(((pattern, category) for pattern, category in FAMILIES if re.search(pattern, text)), None)
    brand = next((pattern for pattern in BRANDS if re.search(r'(?<!\w)(?:' + pattern + r')(?!\w)', text)), None)
    if family and not accessory:
        pattern, category = family
        candidates = candidates.filter(category__name__iregex=category).exclude(category__name__iregex=r'لوازم|قطعات|کاور|کیف|تعمیر')
        candidates = candidates.exclude(persian_title__iregex=r'^\s*(?:' + ACCESSORIES + r')|تک\s*گوش|گوش\s*(?:چپ|راست)')
        remainder = re.sub(r'اصل\S*|اورجینال|original', ' ', text)
        # Preserve distinctive family model names (iPhone, AirPods, MacBook...).
        generic = r'هدفون|هدست|هندزفری|ایرباد|headphones?|earbuds?|گوشی|موبایل|smartphone|لپ\s*تاپ|لپتاپ|laptop|تبلت|tablet|تلویزیون|television|دوربین|camera|کنسول|ساعت هوشمند|smartwatch|کتانی|کتونی|کفش|sneakers?'
        remainder = re.sub(generic, ' ', remainder)
        predicate = Q()
        if brand:
            candidates = candidates.filter(Q(brand_name__iregex=brand) | title_match(brand))
            remainder = re.sub(brand, ' ', remainder)
        for word in remainder.split()[:8]:
            predicate &= title_match(token_pattern(word))
        if any(word.isdigit() for word in remainder.split()) and not re.search(r'pro|پرو|max|مکس|ultra|اولترا|plus|پلاس', remainder):
            candidates = candidates.exclude(persian_title__iregex=r'\mpro\M|پرو|\mmax\M|مکس|اولترا|ultra|پلاس|plus')
        return candidates, predicate, bool(brand or re.search(r'اصل|original|اورجینال', text))
    predicate = Q()
    for variant in query_variants(query):
        part = Q()
        for word in variant.split()[:8]:
            part &= title_match(token_pattern(word))
        predicate |= part
    return candidates, predicate, bool(re.search(r'اصل|original|اورجینال', text))
