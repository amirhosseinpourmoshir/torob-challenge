"""Read-only, bounded catalog tools for a future agent. No external calls or SQL from an LLM."""
import math
from django.db.models import F, Value
from django.db.models.functions import ACos, Cos, Greatest, Least, Radians, Sin

from .models import Offer, Product
from .normalization import normalize_search


def page_size(limit):
    return max(1, min(int(limit), 100))


def product_data(product):
    return {
        'product_id': product.id, 'title': product.persian_title,
        'category': product.category_id, 'brand': product.brand_name, 'model': product.model,
        'image_urls': product.image_urls, 'specs': product.specs,
        'source': 'torob_challenge_dataset',
    }


def search_products(query, *, category=None, brand=None, limit=20, offset=0):
    """AND token matching, with Persian yeh/kaf, diacritics, and digit normalization."""
    text = normalize_search(str(query)[:300])
    if not text:
        return []
    products = Product.objects.all()
    for word in text.split()[:12]:
        products = products.filter(search_text__contains=word)
    if category:
        products = products.filter(category_id=category)
    if brand:
        products = products.filter(brand_name=brand)
    offset = max(0, min(int(offset), 10000))
    return [product_data(p) for p in products.order_by('id')[offset:offset + page_size(limit)]]


def product_details(product_id):
    return product_data(Product.objects.get(pk=product_id))


def find_sellers(product_id, *, min_price=None, max_price=None, latitude=None,
                 longitude=None, radius_km=None, payment_provider=None,
                 in_person_credit=False, fast_delivery=None, sort='price', limit=20):
    """An offer proves a listing, never confirmed stock. Distances are straight-line km."""
    offers = Offer.objects.filter(product_id=product_id).select_related('shop').prefetch_related('shop__payment_options', 'shop__opening_days')
    if min_price is not None:
        offers = offers.filter(price_toman__gte=int(min_price))
    if max_price is not None:
        offers = offers.filter(price_toman__lte=int(max_price))
    if fast_delivery is not None:
        offers = offers.filter(shop__supports_fast_delivery=bool(fast_delivery))
    if payment_provider or in_person_credit:
        payment_filter = {}
        if payment_provider:
            payment_filter['provider_name'] = payment_provider
        if in_person_credit:
            payment_filter['channel'] = 'in_person'
        # Same option must satisfy both provider and channel.
        from .models import PaymentOption
        offers = offers.filter(shop_id__in=PaymentOption.objects.filter(**payment_filter).values('shop_id'))
    has_location = latitude is not None and longitude is not None
    if (latitude is None) != (longitude is None):
        raise ValueError('Both latitude and longitude are required.')
    if has_location:
        lat, lon = float(latitude), float(longitude)
        if not (math.isfinite(lat) and math.isfinite(lon) and -90 <= lat <= 90 and -180 <= lon <= 180):
            raise ValueError('Invalid coordinates.')
        cosine = Sin(Radians(Value(lat))) * Sin(Radians(F('shop__latitude'))) + Cos(Radians(Value(lat))) * Cos(Radians(F('shop__latitude'))) * Cos(Radians(F('shop__longitude')) - Radians(Value(lon)))
        offers = offers.annotate(distance_km=Value(6371.0088) * ACos(Least(Value(1.0), Greatest(Value(-1.0), cosine))))
        if radius_km is not None:
            radius = float(radius_km)
            if not math.isfinite(radius) or radius <= 0:
                raise ValueError('radius_km must be positive.')
            offers = offers.filter(distance_km__lte=radius)
    elif radius_km is not None or sort == 'distance':
        raise ValueError('Distance filtering/sorting requires coordinates.')
    if sort not in ('price', 'distance'):
        raise ValueError('sort must be price or distance.')
    order = [F('price_toman').asc(nulls_last=True), 'id'] if sort == 'price' else ['distance_km', F('price_toman').asc(nulls_last=True), 'id']
    result = []
    for offer in offers.order_by(*order)[:page_size(limit)]:
        shop = offer.shop
        result.append({
            'offer_id': offer.id, 'product_id': offer.product_id,
            'seller_title': offer.seller_title, 'description': offer.description,
            'price_toman': offer.price_toman, 'currency': 'تومان',
            'price_last_changed_at': offer.last_price_changed_at.isoformat() if offer.last_price_changed_at else None,
            'price_is_live_verified': False,
            'availability_status': offer.availability_status,
            'availability_verified_at': offer.availability_verified_at.isoformat() if offer.availability_verified_at else None,
            'warranty': offer.warranty,
            'distance_km': round(offer.distance_km, 3) if has_location else None,
            'distance_type': 'straight_line' if has_location else None,
            'shop': {
                'shop_id': shop.id, 'name': shop.name, 'name_is_synthetic': shop.name_is_synthetic,
                'address': shop.address, 'location_label': shop.location_label,
                'latitude': shop.latitude, 'longitude': shop.longitude,
                'website_url': shop.website_url, 'instagram': shop.instagram,
                'supports_fast_delivery': shop.supports_fast_delivery,
                'weekly_hours': shop.weekly_hours, 'hours_are_live_verified': False,
                'payment_options': [p.source_data for p in shop.payment_options.all()],
                'payment_options_are_declared': True,
                'contacts_available_for_real_outreach': False,
            },
            'source': 'torob_challenge_dataset',
        })
    return result
