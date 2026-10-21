"""Bounded viewport queries; no endpoint exports the entire shop catalogue."""
import math
import re
import hashlib
import json
from collections import Counter
from functools import wraps

from django.core.cache import cache
from django.db.models import F, Value, Window
from django.db.models.functions import ACos, Cos, Greatest, Least, Radians, Sin, Floor, RowNumber
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from core.addresses import BOUNDS
from core.models import SavedAddress
from .models import Category, Shop
from .normalization import normalize_search

MIN_ZOOM = 14
MAX_MARKERS = 72
# Classification describes the dataset categories, never verified stock.
GROUPS = {
    'digital': ('دیجیتال', 'موبایل|گوشی|تبلت|لپ تاپ|کامپیوتر|هدفون|اسپیکر|دوربین|پرینتر|هارد|مانیتور|شبکه|کنسول|شارژر'),
    'fashion': ('مد و پوشاک', 'پوشاک|لباس|کفش|کتانی|پیراهن|شلوار|مانتو|روسری|کیف|جوراب|کاپشن'),
    'home': ('خانه و زندگی', 'خانه|آشپزخانه|مبل|فرش|تخت|ظرف|پرده|چراغ|یخچال|اجاق|قاشق|سینک|دکور'),
    'beauty': ('زیبایی و سلامت', 'آرایش|پوست|مو|عطر|ادکلن|شامپو|بهداشتی|طبی|پزشکی|دندان|دارو'),
    'auto': ('خودرو و ابزار', 'خودرو|موتور سیکلت|ابزار|آچار|دریل|پیچ|سیم|لاستیک|روغن موتور'),
    'sport': ('ورزش و سفر', 'ورزش|سفر|کمپ|کوهنورد|دوچرخه|چادر مسافرتی|دمبل'),
    'food': ('خوراکی', 'خوراک|غذا|آجیل|شکلات|نوشیدنی|قهوه|چای|برنج|ادویه|میوه|پنیر'),
    'culture': ('فرهنگ و سرگرمی', 'کتاب|تحریر|موسیقی|اسباب بازی|مداد|دفتر|بازی فکری'),
    'jewelry': ('ساعت و زیورآلات', 'طلا|نقره|زیور|انگشتر|گردنبند|دستبند|ساعت مچی'),
    'other': ('فروشگاه', ''),
}


def category_group(name):
    text = normalize_search(name)
    return next((key for key, (_, pattern) in GROUPS.items() if pattern and re.search(pattern, text)), 'other')


def category_index():
    result = cache.get('shop-map-category-index-v1')
    if result is None:
        result = {key: [] for key in GROUPS}
        for name in Category.objects.values_list('name', flat=True):
            result[category_group(name)].append(name)
        cache.set('shop-map-category-index-v1', result, 300)
    return result


def api(view):
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        try:
            result = view(request, *args, **kwargs)
        except (ValueError, TypeError, OverflowError):
            result = JsonResponse({'error': 'پارامترهای جست‌وجو یا محدودهٔ نقشه معتبر نیست.'}, status=400)
        result['Cache-Control'] = 'private, no-store'
        return result
    return require_GET(wrapped)


def number(request, key):
    value = float(request.GET[key]) if key in request.GET else float('nan')
    if not math.isfinite(value):
        raise ValueError(key)
    return value


def distance(latitude, longitude):
    cosine = (Sin(Radians(Value(latitude))) * Sin(Radians(F('latitude'))) +
              Cos(Radians(Value(latitude))) * Cos(Radians(F('latitude'))) *
              Cos(Radians(F('longitude')) - Radians(Value(longitude))))
    return Value(6371008.8) * ACos(Least(Value(1.0), Greatest(Value(-1.0), cosine)))


def active_origin(request):
    key = request.session.get('address_owner')
    return SavedAddress.objects.filter(owner_key=key, is_active=True).first() if key else None


def base(request):
    qs = Shop.objects.filter(longitude__range=(BOUNDS[0], BOUNDS[2]), latitude__range=(BOUNDS[1], BOUNDS[3]))
    group = request.GET.get('category', 'all')
    if group != 'all':
        if group not in GROUPS:
            raise ValueError('category')
        qs = qs.filter(categories__name__in=category_index()[group]).distinct()
    ids = request.GET.get('ids')
    if ids is not None:
        ids = ids.split(',') if ids else []
        if len(ids) > 100 or any(len(value) > 64 for value in ids):
            raise ValueError('ids')
        qs = qs.filter(pk__in=ids)
    return qs


def serialize(shop, origin=None):
    names = sorted(c.name for c in shop.categories.all())
    counts = Counter(category_group(name) for name in names)
    group = counts.most_common(1)[0][0] if counts else 'other'
    return {
        'id': shop.pk, 'name': shop.name, 'address': shop.address,
        'coordinates': [shop.longitude, shop.latitude], 'category': group,
        'type': GROUPS[group][0], 'categories': names[:5],
        'name_is_synthetic': shop.name_is_synthetic,
        'distance_m': round(getattr(shop, 'distance_m', 0)) if origin else None,
        'distance_kind': 'straight_line',
    }


def lean(qs):
    return qs.only('id', 'name', 'address', 'latitude', 'longitude', 'name_is_synthetic').prefetch_related('categories')


@api
def viewport(request):
    zoom = number(request, 'zoom')
    if not 0 <= zoom <= 22:
        raise ValueError('zoom')
    if zoom < MIN_ZOOM:
        return JsonResponse({'shops': [], 'zoom_required': True, 'min_zoom': MIN_ZOOM, 'limited': False})
    west, south, east, north = [number(request, key) for key in ('west', 'south', 'east', 'north')]
    if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
        raise ValueError('bounds')
    if east - west > 1 or north - south > 1:
        raise ValueError('bounds too large')
    qs = base(request).filter(longitude__range=(west, east), latitude__range=(south, north))
    origin = active_origin(request)
    # One result per small geographic cell, then a hard server-side cap.
    # Zooming in shrinks cells and reveals shops previously hidden by density.
    cell = 0.0014 * (2 ** (14 - min(zoom, 19)))
    qs = qs.annotate(center_distance=distance((north + south) / 2, (west + east) / 2))
    qs = qs.annotate(cell_rank=Window(RowNumber(), partition_by=[Floor(F('latitude') / cell), Floor(F('longitude') / cell)], order_by=[F('center_distance').asc(), F('id').asc()])).filter(cell_rank=1)
    if origin:
        qs = qs.annotate(distance_m=distance(origin.latitude, origin.longitude))
    rows = list(lean(qs).order_by('center_distance', 'id')[:MAX_MARKERS + 1])
    return JsonResponse({'shops': [serialize(s, origin) for s in rows[:MAX_MARKERS]], 'limited': len(rows) > MAX_MARKERS, 'zoom_required': False, 'min_zoom': MIN_ZOOM})


@api
def search(request):
    query = normalize_search(request.GET.get('q', ''))
    if len(query) < 2 or len(query) > 120:
        raise ValueError('query')
    origin = active_origin(request)
    if not origin:
        return JsonResponse({'error': 'برای یافتن نزدیک‌ترین فروشگاه، ابتدا آدرس انتخابی را ثبت کن.'}, status=400)
    qs = base(request)
    # Cache complete, bounded results per active origin and filters. Other
    # sessions/addresses cannot reuse a distance calculated for this origin.
    signature = json.dumps([query, str(origin.pk), origin.latitude, origin.longitude,
                            request.GET.get('category', 'all'), request.GET.get('ids')], ensure_ascii=False)
    key = 'shop-live-search-v1:' + hashlib.sha256(signature.encode()).hexdigest()
    cached = cache.get(key)
    if cached is not None:
        return JsonResponse(cached)
    for word in query.split()[:8]:
        qs = qs.filter(search_text__contains=word)
    qs = lean(qs.annotate(distance_m=distance(origin.latitude, origin.longitude))).order_by('distance_m', 'id')
    result = {'shops': [serialize(s, origin) for s in qs[:8]], 'origin_id': str(origin.pk), 'distance_kind': 'straight_line'}
    cache.set(key, result, 60)
    return JsonResponse(result)
