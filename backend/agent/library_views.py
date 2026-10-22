"""Session-owned bookmarks and read-only shopping sheets, independent of chat."""
import json
from django.db import transaction, connection
from django.db.models import Min, Count, Q
from django.middleware.csrf import get_token
from django.views.decorators.http import require_GET, require_http_methods
from catalog.models import Product
from core.addresses import owner, body
from core.models import SavedAddress
from .models import SavedProduct, Conversation
from .catalog_tools import product_details, find_sellers, eligible_offers
from .localization import translated_label
from .presentation import clean
from .views import private_response
from catalog.map_views import BOUNDS

TEHRAN_OFFERS = Q(offers__shop__longitude__range=(BOUNDS[0], BOUNDS[2]), offers__shop__latitude__range=(BOUNDS[1], BOUNDS[3]))


def context_for(request):
    key = owner(request)
    address = SavedAddress.objects.filter(owner_key=key, is_active=True).first()
    preferences = Conversation.objects.filter(owner_key=key).order_by('-created_at').values_list('state__preferences', flat=True).first() or {}
    return {'origin': {'latitude': address.latitude, 'longitude': address.longitude} if address else None, 'preferences': preferences}


def product_summary(product):
    images = product.image_urls if isinstance(product.image_urls, list) else []
    return {'id': product.pk, 'title': product.persian_title or product.model or product.category_id, 'category': translated_label(product.category_id), 'image': images[0] if images else '', 'price': getattr(product, 'lowest', None), 'offerCount': getattr(product, 'offer_count', 0), 'specs': {}}


def priced_products(ids, context=None):
    offers_filter = Q(offers__in=eligible_offers(context).values('pk')) if context is not None else TEHRAN_OFFERS
    return Product.objects.filter(pk__in=ids).annotate(lowest=Min('offers__price_toman', filter=offers_filter), offer_count=Count('offers__shop_id', distinct=True, filter=offers_filter))


@require_http_methods(['GET', 'POST'])
def saved_products(request):
    key = owner(request)
    if request.method == 'POST':
        try:
            data = body(request)
            product_id, saved = data.get('product_id'), data.get('saved')
            if not isinstance(product_id, str) or len(product_id) > 100 or type(saved) is not bool:
                raise ValueError('محصول انتخاب‌شده کامل نرسید.')
            if not Product.objects.filter(pk=product_id).exists():
                return private_response({'error': 'این محصول پیدا نشد.'}, 404)
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))', [str(key)])
                if saved:
                    if SavedProduct.objects.filter(owner_key=key).count() >= 100 and not SavedProduct.objects.filter(owner_key=key, product_id=product_id).exists():
                        raise ValueError('تا صد محصول می‌تونی نگه داری؛ اول یکی رو از ذخیره‌ها بردار.')
                    SavedProduct.objects.get_or_create(owner_key=key, product_id=product_id)
                else:
                    SavedProduct.objects.filter(owner_key=key, product_id=product_id).delete()
        except (ValueError, TypeError) as error:
            return private_response({'error': str(error)}, 400)
    ids = list(SavedProduct.objects.filter(owner_key=key).values_list('product_id', flat=True)[:100])
    rows = {product.pk: product_summary(product) for product in priced_products(ids)}
    return private_response({'products': [rows[id] for id in ids if id in rows], 'csrf_token': get_token(request)})


@require_GET
def product_sheet(request, product_id):
    try:
        product = Product.objects.get(pk=product_id)
    except Product.DoesNotExist:
        return private_response({'error': 'این محصول پیدا نشد.'}, 404)
    context = context_for(request)
    details = product_details(context, product_id)['products'][0]
    specs = product.specs if isinstance(product.specs, list) else []
    specifications = [{'label': translated_label(item.get('key', '')), 'value': str(item.get('value', '')) if not isinstance(item.get('value'), (dict, list)) else json.dumps(item['value'], ensure_ascii=False), 'section': translated_label(item.get('section') or 'مشخصات محصول')} for item in specs if isinstance(item, dict) and item.get('key') and item.get('value') is not None]
    maximum = details.get('price')
    similar_offers = eligible_offers(context).filter(product__category_id=product.category_id).exclude(product_id=product_id)
    candidates = priced_products(similar_offers.values('product_id'), context)
    if maximum is not None:
        from django.db.models import F, Value
        from django.db.models.functions import Abs
        candidates = candidates.annotate(price_gap=Abs(F('lowest') - Value(maximum))).order_by('price_gap', 'pk')
    else:
        candidates = candidates.order_by('lowest', 'pk')
    shops = find_sellers(context, product_id, limit=8)['shops']
    maps = [{'id': shop['id'], 'name': shop['name'], 'address': shop['address'], 'coordinates': shop['_coordinates'], 'category': shop.get('_map_category', 'other'), 'type': shop.get('_map_type', 'فروشگاه'), 'distance_m': shop.get('distanceMeters')} for shop in shops]
    return private_response({'product': clean(details), 'specifications': specifications, 'similar': [product_summary(row) for row in candidates[:6]], 'offers': [clean(shop) for shop in shops], 'map_shops': maps, 'criteria': context['preferences'], 'similar_basis': 'دستهٔ یکسان و نزدیکی قیمت ثبت‌شده؛ به معنی کیفیت یا امکانات یکسان نیست.'})
