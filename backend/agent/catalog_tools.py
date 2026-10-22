import json
import math
import re
from collections import Counter
from datetime import datetime, timedelta
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo
import jdatetime
from django.core.cache import cache
from django.db.models import Exists, OuterRef, Q, Min, F, Func, JSONField, Count, Avg, Subquery
from django.utils import timezone
from catalog.models import Product, Offer, Shop, PaymentOption, Category
from catalog.map_views import distance, BOUNDS, category_group, GROUPS
from catalog.normalization import normalize_search
from .localization import translated_label, query_variants
from .product_quality import REPLICA, PART, AIRPODS, assess_product, price_context


def public_link(value, instagram=False):
    if not isinstance(value, str):
        return None
    try:
        url = urlsplit(value)
        if url.scheme != 'https' or not url.hostname or url.username or url.password or url.query or url.fragment:
            return None
        if instagram and url.hostname.lower() not in ('instagram.com', 'www.instagram.com'):
            return None
        return value
    except ValueError:
        return None


def time_context():
    now = timezone.now().astimezone(ZoneInfo('Asia/Tehran'))
    jalali = jdatetime.datetime.fromgregorian(datetime=now)
    return {'timezone': 'Asia/Tehran', 'date_iso': now.date().isoformat(), 'jalali_date': jalali.strftime('%Y/%m/%d'), 'time': now.strftime('%H:%M'), 'weekday': now.strftime('%a').lower()}


def eligible_offers(context, *, credit_only=None, provider=None, max_price=None, min_price=None, original_only=None):
    preferences = context.get('preferences', {})
    credit = preferences.get('credit_only', False) if credit_only is None else credit_only
    provider = provider or preferences.get('provider')
    maximum = preferences.get('max_price') if max_price is None else max_price
    minimum = preferences.get('min_price') if min_price is None else min_price
    qs = Offer.objects.filter(shop__longitude__range=(BOUNDS[0], BOUNDS[2]), shop__latitude__range=(BOUNDS[1], BOUNDS[3]))
    if original_only if original_only is not None else preferences.get('original_only', False):
        qs = qs.exclude(product__persian_title__iregex=REPLICA).exclude(product__specs__iregex=REPLICA)
    if maximum is not None:
        qs = qs.filter(price_toman__lte=maximum)
    if minimum is not None:
        qs = qs.filter(price_toman__gte=minimum)
    if credit or provider:
        # Every constraint applies to the very same payment option and offer.
        options = PaymentOption.objects.filter(shop_id=OuterRef('shop_id'), channel='in_person')
        if provider:
            options = options.filter(provider_name=provider)
        options = options.filter(Q(min_price_toman__isnull=True) | Q(min_price_toman__lte=OuterRef('price_toman'))).filter(Q(max_price_toman__isnull=True) | Q(max_price_toman__gte=OuterRef('price_toman')))
        category_array = Func(OuterRef('product__category_id'), function='jsonb_build_array', output_field=JSONField())
        options = options.filter(Q(category_names=[]) | Q(category_names__contains=category_array))
        qs = qs.annotate(credit_eligible=Exists(options)).filter(credit_eligible=True)
    return qs


def product_ui(product, price=None, count=None):
    specs = {}
    for item in product.specs[:40] if isinstance(product.specs, list) else []:
        if isinstance(item, dict) and item.get('key') and item.get('value') is not None:
            value = item['value']
            specs[translated_label(item['key'])] = str(value)[:220] if not isinstance(value, (dict, list)) else json.dumps(value, ensure_ascii=False)[:220]
    images = [value for value in product.image_urls if isinstance(value, str) and public_link(value)] if isinstance(product.image_urls, list) else []
    quality = assess_product(product, price)
    result = {'id': product.pk, 'title': product.persian_title or product.model or product.category_id,
            'category': translated_label(product.category_id), 'image': images[0] if images else '',
            'price': price, 'offerCount': count if count is not None else 0,
            'highlights': [f'{key}: {value}' for key, value in list(specs.items())[:3]], 'specs': specs,
            '_images': images[:12], '_brand': product.brand_name, '_model': product.model, '_quality': quality}
    if quality['kind'] != 'unverified':
        result['badge'] = quality['label']
    return result


def search_products(context, query, limit=6, sort='budget_fit', **filters):
    normalized_query = normalize_search(query)
    airpods = bool(re.search(AIRPODS, normalized_query))
    apple = bool(re.search(r'اپل|apple', normalized_query))
    if airpods and apple and 'original_only' not in filters:
        context.setdefault('preferences', {})['original_only'] = True
    offers = eligible_offers(context, **filters)
    candidates = Product.objects.filter(pk__in=Subquery(offers.values('product_id')))
    normalized_query = normalize_search(query)
    # Do not sell a case/cable when the buyer asked for the device itself.
    if not re.search(r'کاور|کیف|قاب|کابل|باتری|تعمیر|قطعه|گلس|شارژر|لوازم جانبی', normalized_query):
        if re.search(r'هدفون|هدست|هندزفری|ایرباد|' + AIRPODS, normalized_query):
            candidates = candidates.filter(category_id='هدفون، هدست و هندزفری')
            candidates = candidates.exclude(persian_title__iregex=PART)
        elif re.search(r'گوشی|موبایل|آیفون|ایفون', normalized_query):
            candidates = candidates.filter(category_id__startswith='گوشی')
        elif 'لپ تاپ' in normalized_query:
            candidates = candidates.exclude(category_id__iregex='کیف|کاور|لوازم|قطعات')
    predicate = Q()
    for variant in query_variants(query):
        words = variant.split()[:8]
        if not words:
            continue
        part = Q()
        for word in words:
            part &= Q(search_text__contains=word)
        predicate |= part
    if airpods and not re.search(r'کیس|کاور|قاب|تک گوش|شارژر|کابل', normalized_query):
        predicate = Q(persian_title__iregex=AIRPODS) | Q(model__iregex=AIRPODS)
        extra = re.sub(AIRPODS + r'|اپل|apple|اصل\S*|اورجینال', ' ', normalized_query)
        for word in extra.split():
            if word.isdigit():
                digits = ''.join('[' + char + '۰۱۲۳۴۵۶۷۸۹'[int(char)] + '٠١٢٣٤٥٦٧٨٩'[int(char)] + ']' for char in word)
                pattern = r'(^|[^0-9۰-۹٠-٩])' + digits + r'([^0-9۰-۹٠-٩]|$)'
            else:
                pattern = r'pro|پرو' if word in ('pro', 'پرو') else re.escape(word)
            # Model numbers in battery/specification text are not generations.
            predicate &= Q(persian_title__iregex=pattern) | (Q(persian_title='') & Q(model__iregex=pattern))
        if re.search(r'\d', extra) and not re.search(r'pro|پرو', extra):
            candidates = candidates.exclude(persian_title__iregex=r'pro|پرو|max|مکس')
        if apple:
            candidates = candidates.filter(Q(brand_name__iregex=r'اپل|apple') | Q(persian_title__iregex=r'اپل|apple'))
    if not predicate:
        return {'products': [], 'note': 'نام دسته یا مدل را مشخص کن.'}
    stats = offers.filter(product_id=OuterRef('pk')).values('product_id').annotate(low=Min('price_toman'), count=Count('pk'))
    maximum = filters.get('max_price', context.get('preferences', {}).get('max_price'))
    order = F('low_price').desc(nulls_last=True) if maximum is not None and sort == 'budget_fit' else F('low_price').asc(nulls_last=True)
    qs = candidates.filter(predicate).annotate(low_price=Subquery(stats.values('low')[:1]), seller_count=Subquery(stats.values('count')[:1])).order_by(order, 'id')
    rows, flagged = [], []
    for product in qs[:limit * 4]:
        row = product_ui(product, product.low_price, product.seller_count)
        if context.get('preferences', {}).get('original_only') or filters.get('original_only'):
            if row['_quality']['kind'] != 'unverified':
                flagged.append({'title': row['title'], 'price': row['price'], **row['_quality']})
                continue
        rows.append(row)
        if len(rows) >= limit:
            break
    return {'products': rows, 'flagged': flagged[:6], 'market_context': price_context(query) if airpods and apple else None, 'constraints': {**context.get('preferences', {}), **filters}, 'price_is_live_verified': False, 'authenticity_is_verified': False}


def product_details(context, product_id):
    product = Product.objects.get(pk=product_id)
    stats = eligible_offers(context).filter(product=product).aggregate(low=Min('price_toman'), count=Count('pk'))
    return {'products': [product_ui(product, stats['low'], stats['count'])], 'price_is_live_verified': False}


def hours_info(shop):
    now = timezone.now().astimezone(ZoneInfo('Asia/Tehran'))
    current = now.strftime('%a').lower()
    day = shop.weekly_hours.get(current, {}) if isinstance(shop.weekly_hours, dict) else {}
    shifts = day.get('shifts') or []
    status = day.get('status', 'unknown')
    labels, open_now = [], False
    for shift in shifts[:4]:
        try:
            start, end = shift['start_time'][:5], shift['end_time'][:5]
            datetime.strptime(start, '%H:%M'); datetime.strptime(end, '%H:%M')
            if start == end == '00:00':
                continue
            labels.append(f'{start} تا {end}'.translate(str.maketrans('0123456789', '۰۱۲۳۴۵۶۷۸۹')))
            time = now.strftime('%H:%M')
            open_now |= start <= time < end if start <= end else time >= start
        except (ValueError, KeyError, TypeError):
            continue
    # Account for the previous day's overnight shift.
    previous = shop.weekly_hours.get((now - timedelta(days=1)).strftime('%a').lower(), {}) if isinstance(shop.weekly_hours, dict) else {}
    for shift in previous.get('shifts', []) or []:
        start, end = str(shift.get('start_time', ''))[:5], str(shift.get('end_time', ''))[:5]
        if start > end and now.strftime('%H:%M') < end:
            open_now = True
    if status == 'closed' and not open_now:
        return {'label': 'امروز بسته ثبت شده', 'open_by_schedule': False, 'verified_live': False}
    return {'label': '، '.join(labels) or 'ساعت کاری ثبت نشده', 'open_by_schedule': open_now if labels or open_now else None, 'verified_live': False}


def shop_ui(shop, context, price=None, availability='unverified'):
    origin = context.get('origin')
    meters = None
    if origin:
        lat1, lon1, lat2, lon2 = map(math.radians, [origin['latitude'], origin['longitude'], shop.latitude, shop.longitude])
        cosine = math.sin(lat1) * math.sin(lat2) + math.cos(lat1) * math.cos(lat2) * math.cos(lon2 - lon1)
        meters = round(6371008.8 * math.acos(max(-1, min(1, cosine))))
    instagram = shop.instagram.get('profile_url') if isinstance(shop.instagram, dict) else None
    hours = hours_info(shop)
    options = list(shop.payment_options.all())
    credit = any(option.channel == 'in_person' for option in options)
    address = shop.address or ''
    inside = '، '.join(re.findall(r'(?:طبقه|واحد|پلاک|ورودی|بلوک|راهرو)[^،,؛]{0,60}', address))
    result = {'id': shop.pk, 'name': shop.name, 'address': address, 'neighborhood': shop.location_label or 'تهران', 'insideAddress': inside, 'price': price, 'distanceMeters': meters, 'distanceKind': 'straight_line', 'availability': availability if availability in ('confirmed', 'unavailable') else 'unverified', 'hoursLabel': hours['label'], 'credit': credit,
              '_coordinates': [shop.longitude, shop.latitude], '_name_is_synthetic': shop.name_is_synthetic, '_hours': hours, '_payment_options': [{'provider': p.provider_name, 'channel': p.channel, 'min': p.min_price_toman, 'max': p.max_price_toman, 'categories': p.category_names} for p in options[:8]]}
    groups = Counter(category_group(category.name) for category in shop.categories.all())
    group = groups.most_common(1)[0][0] if groups else 'other'
    result.update(_map_category=group, _map_type=GROUPS[group][0])
    if public_link(instagram, True):
        result['instagramUrl'] = instagram
    if public_link(shop.website_url):
        result['websiteUrl'] = shop.website_url
    return result


def find_sellers(context, product_id, sort='price', radius_km=None, limit=6, exclude_shop_ids=None, open_now=False, **filters):
    qs = eligible_offers(context, **filters).filter(product_id=product_id).select_related('shop', 'product').prefetch_related('shop__payment_options', 'shop__categories')
    if exclude_shop_ids:
        qs = qs.exclude(shop_id__in=exclude_shop_ids)
    origin = context.get('origin')
    if origin:
        from django.db.models.functions import ACos, Radians, Sin, Cos, Least, Greatest
        from django.db.models import Value
        cosine = Sin(Radians(Value(origin['latitude']))) * Sin(Radians(F('shop__latitude'))) + Cos(Radians(Value(origin['latitude']))) * Cos(Radians(F('shop__latitude'))) * Cos(Radians(F('shop__longitude')) - Radians(Value(origin['longitude'])))
        qs = qs.annotate(distance_m=Value(6371008.8) * ACos(Least(Value(1.0), Greatest(Value(-1.0), cosine))))
        if radius_km:
            qs = qs.filter(distance_m__lte=radius_km * 1000)
    elif radius_km or sort == 'distance':
        return {'shops': [], 'needs_location': True, 'note': 'برای نزدیک‌ترین فروشگاه، آدرس فعال را از هدر انتخاب کن.'}
    qs = qs.order_by(*(['distance_m'] if sort == 'distance' else []), F('price_toman').asc(nulls_last=True), 'id')
    rows, seen = [], set()
    for offer in qs[:max(limit * 8, 40)]:
        if offer.shop_id in seen:
            continue
        shop = shop_ui(offer.shop, context, offer.price_toman, offer.availability_status)
        shop['credit'] = any(
            option.channel == 'in_person'
            and offer.price_toman is not None
            and (option.min_price_toman is None or offer.price_toman >= option.min_price_toman)
            and (option.max_price_toman is None or offer.price_toman <= option.max_price_toman)
            and (not option.category_names or offer.product.category_id in option.category_names)
            for option in offer.shop.payment_options.all()
        )
        if open_now and shop['_hours']['open_by_schedule'] is not True:
            continue
        seen.add(offer.shop_id)
        if offer.last_price_changed_at:
            shop['updatedAt'] = offer.last_price_changed_at.isoformat()
        rows.append(shop)
        if len(rows) == limit:
            break
    return {'shops': rows, 'product_id': product_id, 'price_is_live_verified': False, 'distance_kind': 'straight_line', 'credit_filtered': filters.get('credit_only', context.get('preferences', {}).get('credit_only', False))}


def store_details(context, shop_id):
    shop = Shop.objects.prefetch_related('payment_options', 'categories').get(pk=shop_id)
    return {**store_products(context, shop_id=shop_id, limit=3), 'shops': [shop_ui(shop, context)], 'name_is_synthetic': shop.name_is_synthetic, 'contacts_publishable': shop.contacts.filter(is_publishable=True, is_synthetic=False).exists()}


def store_products(context, shop_id=None, query='', category='', limit=6, offset=0):
    shop_id = shop_id or context.get('selected_shop_id')
    if not shop_id:
        return {'needs_shop': True, 'products': [], 'note': 'منظورت کدوم فروشگاهه؟ یک فروشگاه روی نقشه انتخاب کن یا اسمش رو بگو.'}
    shop = Shop.objects.get(pk=shop_id, longitude__range=(BOUNDS[0], BOUNDS[2]), latitude__range=(BOUNDS[1], BOUNDS[3]))
    all_offers = Offer.objects.filter(shop_id=shop_id)
    offers = eligible_offers(context).filter(shop_id=shop_id)
    if category:
        offers = offers.filter(product__category_id__icontains=category)
    for word in normalize_search(query).split()[:8]:
        offers = offers.filter(product__search_text__contains=word)
    stats = offers.filter(product_id=OuterRef('pk')).values('product_id').annotate(low=Min('price_toman'), count=Count('pk'))
    products = Product.objects.filter(pk__in=offers.values('product_id')).annotate(low_price=Subquery(stats.values('low')[:1]), seller_count=Subquery(stats.values('count')[:1])).order_by(F('low_price').asc(nulls_last=True), 'pk')
    rows = [product_ui(product, product.low_price, 1) for product in products[offset:offset + limit]]
    total = products.count()
    return {'products': rows, 'catalog': {'shop_id': shop.pk, 'shop_name': shop.name, 'total_products': all_offers.values('product_id').distinct().count(), 'total_offers': all_offers.count(), 'matching_products': total, 'categories': list(all_offers.values('product__category_id').annotate(products=Count('product_id', distinct=True)).order_by('-products')[:12]), 'has_more': offset + len(rows) < total, 'next_offset': offset + len(rows), 'discounts_available': False}, 'constraints': context.get('preferences', {}), 'note': 'این قیمت‌ها پیشنهاد فروش همین فروشگاه‌اند. قیمت قبل از تخفیف یا درصد تخفیف قابل اتکا در داده نیست؛ تخفیف نساز. قیمت و موجودی زنده تأیید نشده. دسته‌های بالا همهٔ فروشگاه را توصیف می‌کنند؛ محصولات زیر با فیلترهای فعلی‌اند.'}


def nearby_shops(context, query='', neighborhood='', limit=6):
    if not context.get('origin'):
        return {'shops': [], 'needs_location': True}
    origin = context['origin']
    qs = Shop.objects.filter(longitude__range=(BOUNDS[0], BOUNDS[2]), latitude__range=(BOUNDS[1], BOUNDS[3])).prefetch_related('payment_options', 'categories')
    for word in normalize_search(query).split()[:5]:
        qs = qs.filter(search_text__contains=word)
    if neighborhood:
        qs = qs.filter(location_label__contains=neighborhood)
    if context.get('preferences', {}).get('credit_only'):
        qs = qs.filter(pk__in=PaymentOption.objects.filter(channel='in_person').values('shop_id'))
    rows = qs.annotate(near=distance(origin['latitude'], origin['longitude'])).order_by('near', 'id')[:limit]
    return {'shops': [shop_ui(shop, context) for shop in rows], 'note': 'فروشگاه مرتبط با دسته است؛ وجود محصول خاص را ثابت نمی‌کند.'}


def neighborhood_info(query):
    qs = Shop.objects.exclude(location_label__isnull=True)
    if query:
        qs = qs.filter(location_label__icontains=query)
    return {'neighborhoods': list(qs.values('location_label').annotate(shops=Count('id'), latitude=Avg('latitude'), longitude=Avg('longitude')).order_by('-shops')[:10]), 'coverage': 'فقط مناطق موجود در دیتاست تهران، نه تمام محله‌های شهر'}


def prepare_contact(context, shop_id, questions=None):
    shop = Shop.objects.prefetch_related('payment_options', 'categories').get(pk=shop_id)
    info = shop_ui(shop, context)
    questions = questions or ['این محصول موجوده؟', 'قیمت امروز چقدره؟', 'امروز تا چه ساعتی باز هستید؟']
    draft = 'سلام، وقتتون بخیر. برای خرید حضوری می‌خواستم بپرسم:\n' + '\n'.join(f'ـ {q}' for q in questions[:6]) + '\nممنون از راهنمایی‌تون.'
    return {'shops': [info], 'contact': {'shopId': shop.pk, 'shopName': shop.name, 'questions': questions[:6], 'draft': draft, **{key: info[key] for key in ('instagramUrl', 'websiteUrl') if key in info}}, 'status': 'draft_only', 'can_send_automatically': False, 'has_official_link': bool(info.get('instagramUrl') or info.get('websiteUrl'))}
