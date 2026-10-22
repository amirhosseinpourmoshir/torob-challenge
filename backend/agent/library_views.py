"""Session-owned bookmarks and read-only shopping sheets, independent of chat."""
import json
from django.db import transaction, connection
from django.db.models import Min, Count, OuterRef, Subquery
from django.middleware.csrf import get_token
from django.views.decorators.http import require_GET, require_POST, require_http_methods
from catalog.models import Product, Shop
from core.addresses import owner, body
from core.models import SavedAddress
from .models import SavedProduct, Conversation
from .catalog_tools import product_details, find_sellers, eligible_offers, store_products, shop_ui, prepare_contact
from .localization import translated_label
from .presentation import clean
from .views import private_response
from catalog.models import Offer
from catalog.map_views import BOUNDS


@require_POST
def shop_inquiry(request, shop_id):
    try:
        Shop.objects.get(pk=shop_id, longitude__range=(BOUNDS[0], BOUNDS[2]), latitude__range=(BOUNDS[1], BOUNDS[3]))
        data = body(request)
        product_id = data.get('product_id')
        if product_id is not None and (not isinstance(product_id, str) or not Offer.objects.filter(shop_id=shop_id, product_id=product_id).exists()):
            return private_response({'error': 'این کالا در ویترین فروشگاه پیدا نشد.'}, 400)
        product = Product.objects.get(pk=product_id) if product_id else None
        questions = [f'قیمت و موجودی امروزِ {product.persian_title or product.model} چقدره؟' if product else 'قیمت و موجودی کالای موردنظر رو تأیید می‌کنید؟', 'کالا نو و کامل است؟ شرایط گارانتی و خرید اعتباری چیه؟', 'چه ساعتی برای مراجعه حضوری مناسب است؟']
        result = prepare_contact(context_for(request), shop_id, questions)
        return private_response({'contact': result['contact'], 'status': 'draft_only', 'can_send_automatically': False})
    except (Shop.DoesNotExist, Product.DoesNotExist):
        return private_response({'error': 'فروشگاه یا محصول پیدا نشد.'}, 404)
    except (ValueError, TypeError):
        return private_response({'error': 'انتخابت کامل نرسید؛ دوباره امتحان کن.'}, 400)


def context_for(request):
    key = owner(request)
    address = SavedAddress.objects.filter(owner_key=key, is_active=True).first()
    preferences = Conversation.objects.filter(owner_key=key).order_by('-created_at').values_list('state__preferences', flat=True).first() or {}
    return {'origin': {'latitude': address.latitude, 'longitude': address.longitude} if address else None, 'preferences': preferences}


def product_summary(product):
    images = product.image_urls if isinstance(product.image_urls, list) else []
    entries = product.specs if isinstance(product.specs, list) else []
    specs = {translated_label(item['key']): str(item['value'])[:220] for item in entries[:6] if isinstance(item, dict) and item.get('key') and item.get('value') is not None}
    return {'id': product.pk, 'title': product.persian_title or product.model or product.category_id, 'category': translated_label(product.category_id), 'image': images[0] if images else '', 'price': getattr(product, 'lowest', None), 'offerCount': getattr(product, 'offer_count', 0), 'specs': specs, 'highlights': [f'{key}: {value}' for key, value in list(specs.items())[:2]]}


def priced_products(ids, context=None):
    stats = eligible_offers(context or {}).filter(product_id=OuterRef('pk')).values('product_id').annotate(low=Min('price_toman'), count=Count('shop_id', distinct=True))
    return Product.objects.filter(pk__in=ids).annotate(lowest=Subquery(stats.values('low')[:1]), offer_count=Subquery(stats.values('count')[:1]))


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
    section = request.GET.get('section', 'all')
    if section not in ('all', 'details', 'similar', 'stores'):
        return private_response({'error': 'بخش انتخاب‌شده معتبر نیست.'}, 400)
    try:
        product = Product.objects.get(pk=product_id)
    except Product.DoesNotExist:
        return private_response({'error': 'این محصول پیدا نشد.'}, 404)
    context = context_for(request)
    details = product_details(context, product_id)['products'][0]
    specs = product.specs if isinstance(product.specs, list) else []
    specifications = [{'label': translated_label(item.get('key', '')), 'value': str(item.get('value', '')) if not isinstance(item.get('value'), (dict, list)) else json.dumps(item['value'], ensure_ascii=False), 'section': translated_label(item.get('section') or 'مشخصات محصول')} for item in specs if isinstance(item, dict) and item.get('key') and item.get('value') is not None] if section in ('all', 'details') else []
    similar = []
    if section in ('all', 'similar'):
        maximum = details.get('price')
        candidates = priced_products(Product.objects.filter(category_id=product.category_id).exclude(pk=product_id).values('pk'), context).filter(offer_count__gt=0)
        if maximum is not None:
            from django.db.models import F, Value
            from django.db.models.functions import Abs
            candidates = candidates.annotate(price_gap=Abs(F('lowest') - Value(maximum))).order_by('price_gap', 'pk')
        else:
            candidates = candidates.order_by('lowest', 'pk')
        similar = [product_summary(row) for row in candidates[:6]]
    shops = find_sellers(context, product_id, sort='distance' if context.get('origin') else 'price', limit=8)['shops'] if section in ('all', 'stores') else []
    maps = [{'id': shop['id'], 'name': shop['name'], 'address': shop['address'], 'coordinates': shop['_coordinates'], 'category': shop.get('_map_category', 'other'), 'type': shop.get('_map_type', 'فروشگاه'), 'distance_m': shop.get('distanceMeters')} for shop in shops]
    return private_response({'product': clean(details), 'specifications': specifications, 'similar': similar, 'offers': [clean(shop) for shop in shops], 'map_shops': maps, 'criteria': context['preferences'], 'similar_basis': 'دستهٔ یکسان و نزدیکی قیمت ثبت‌شده؛ به معنی کیفیت یا امکانات یکسان نیست.'})


@require_GET
def shop_sheet(request, shop_id):
    try:
        offset = int(request.GET.get('offset', 0))
        query, category = request.GET.get('q', ''), request.GET.get('category', '')
        if not 0 <= offset <= 1000 or len(query) > 160 or len(category) > 160:
            raise ValueError()
        context = context_for(request)
        result = store_products(context, shop_id, query, category, limit=6, offset=offset)
        shop = Shop.objects.prefetch_related('categories', 'payment_options').get(pk=shop_id)
        return private_response({'shop': clean(shop_ui(shop, context)), 'catalog': result['catalog'], 'products': [clean(product) for product in result['products']], 'note': result['note']})
    except (ValueError, TypeError):
        return private_response({'error': 'جست‌وجو یا شمارهٔ صفحه معتبر نیست.'}, 400)
    except Shop.DoesNotExist:
        return private_response({'error': 'این فروشگاه پیدا نشد.'}, 404)
