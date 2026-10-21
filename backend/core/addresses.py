import json
import math
import uuid
from datetime import timedelta
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import URLError

from django.conf import settings
from django.db import transaction
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.utils import timezone
from django.views.decorators.http import require_GET, require_http_methods, require_POST
from .models import SavedAddress, GeocodeCache, GeocodeGate

BOUNDS = (51.08, 35.53, 51.65, 35.84)


def coordinates(lat, lon):
    if isinstance(lat, bool) or isinstance(lon, bool):
        raise ValueError('نقطهٔ انتخاب‌شده معتبر نیست.')
    try:
        lat, lon = float(lat), float(lon)
    except (ValueError, TypeError):
        raise ValueError('نقطهٔ انتخاب‌شده معتبر نیست.')
    if not (math.isfinite(lat) and math.isfinite(lon) and BOUNDS[0] <= lon <= BOUNDS[2] and BOUNDS[1] <= lat <= BOUNDS[3]):
        raise ValueError('فعلاً فقط می‌توانی در محدودهٔ تهران آدرس ثبت کنی.')
    return lat, lon


def owner(request):
    key = request.session.get('address_owner')
    if not key:
        key = str(uuid.uuid4())
        request.session['address_owner'] = key
        request.session.set_expiry(365 * 24 * 60 * 60)
    return key


def body(request):
    if len(request.body) > 8192:
        raise ValueError('اطلاعات آدرس بیش از اندازه طولانی است.')
    try:
        data = json.loads(request.body)
    except (ValueError, UnicodeDecodeError):
        raise ValueError('اطلاعات ارسالی معتبر نیست.')
    if not isinstance(data, dict):
        raise ValueError('اطلاعات ارسالی معتبر نیست.')
    return data


def validated(data):
    result = {}
    for field, minimum, maximum, label in [('label', 2, 60, 'نام مختصر'), ('full_address', 10, 1000, 'آدرس کامل'), ('plaque', 1, 20, 'پلاک'), ('unit', 0, 20, 'واحد')]:
        value = data.get(field, '')
        if not isinstance(value, str) or not minimum <= len(value.strip()) <= maximum:
            raise ValueError(f'{label} را به‌درستی وارد کن (حداکثر {maximum} نویسه).')
        result[field] = value.strip()
    result['latitude'], result['longitude'] = coordinates(data.get('latitude'), data.get('longitude'))
    return result


def serialize(address):
    return {field: getattr(address, field) for field in ['label', 'full_address', 'plaque', 'unit', 'latitude', 'longitude', 'is_active']} | {'id': str(address.id)}


@require_http_methods(['GET', 'POST'])
def addresses(request):
    key = owner(request)
    if request.method == 'GET':
        response = JsonResponse({'addresses': [serialize(a) for a in SavedAddress.objects.filter(owner_key=key)], 'csrf_token': get_token(request)})
    else:
        try:
            data = validated(body(request))
        except ValueError as exc:
            return JsonResponse({'error': str(exc)}, status=400)
        with transaction.atomic():
            # Serialize mutations per anonymous owner across concurrent requests.
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))', [key])
            if SavedAddress.objects.filter(owner_key=key).count() >= 10:
                return JsonResponse({'error': 'حداکثر ۱۰ آدرس می‌توانی ذخیره کنی.'}, status=400)
            SavedAddress.objects.filter(owner_key=key, is_active=True).update(is_active=False)
            address = SavedAddress.objects.create(owner_key=key, is_active=True, **data)
        response = JsonResponse({'address': serialize(address)}, status=201)
    response['Cache-Control'] = 'no-store'
    return response


@require_http_methods(['PATCH', 'DELETE'])
def address_detail(request, address_id):
    key = owner(request)
    try:
        data = validated(body(request)) if request.method == 'PATCH' else None
    except ValueError as exc:
        return JsonResponse({'error': str(exc)}, status=400)
    with transaction.atomic():
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))', [key])
        address = SavedAddress.objects.filter(owner_key=key, pk=address_id).first()
        if not address:
            return JsonResponse({'error': 'این آدرس پیدا نشد.'}, status=404)
        if request.method == 'PATCH':
            for field, value in data.items():
                setattr(address, field, value)
            address.save()
        else:
            active = address.is_active
            address.delete()
            if active:
                replacement = SavedAddress.objects.filter(owner_key=key).first()
                if replacement:
                    replacement.is_active = True
                    replacement.save(update_fields=['is_active'])
    return JsonResponse({'address': serialize(address)} if data else {'deleted': True})


@require_POST
def activate_address(request, address_id):
    key = owner(request)
    with transaction.atomic():
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))', [key])
        address = SavedAddress.objects.filter(owner_key=key, pk=address_id).first()
        if not address:
            return JsonResponse({'error': 'این آدرس پیدا نشد.'}, status=404)
        SavedAddress.objects.filter(owner_key=key, is_active=True).update(is_active=False)
        address.is_active = True
        address.save(update_fields=['is_active'])
    return JsonResponse({'address': serialize(address)})


def fetch_reverse(lat, lon):
    url = settings.GEOCODER_BASE_URL.rstrip('/') + '/reverse?' + urlencode({'lat': lat, 'lon': lon, 'limit': 1})
    req = Request(url, headers={'User-Agent': settings.GEOCODER_USER_AGENT, 'Accept-Language': 'fa', 'Accept': 'application/json'})
    with urlopen(req, timeout=8) as response:
        payload = json.load(response)
    features = payload.get('features', [])
    if not features:
        return {'address': '', 'found': False, 'source': 'photon'}
    props = features[0].get('properties', {})
    parts = ['تهران']
    fields = ['district', 'locality', 'street']
    if not props.get('street') and props.get('osm_key') in ('highway', 'place'):
        fields.append('name')
    for field in fields:
        text = props.get(field)
        # Never fall back to Latin text for Persian address suggestions.
        if isinstance(text, str) and any('\u0600' <= c <= '\u06ff' for c in text) and not any(c.isascii() and c.isalpha() for c in text) and text not in parts:
            parts.append(text)
    return {'address': '، '.join(parts) if len(parts) > 1 else '', 'found': len(parts) > 1, 'source': 'photon'}


@require_GET
def reverse_geocode(request):
    try:
        lat, lon = coordinates(request.GET.get('lat'), request.GET.get('lon'))
    except ValueError as exc:
        return JsonResponse({'error': str(exc)}, status=400)
    cache_key = f'photon-v2:{lat:.5f}:{lon:.5f}'
    now = timezone.now()
    cached = GeocodeCache.objects.filter(pk=cache_key, expires_at__gt=now).first()
    if cached:
        return JsonResponse(cached.result)
    with transaction.atomic():
        gate = GeocodeGate.objects.select_for_update().get(pk=1)
        if gate.next_allowed_at > now:
            response = JsonResponse({'error': 'یک لحظه صبر کن و دوباره دریافت نشانی را بزن.'}, status=429)
            response['Retry-After'] = '2'
            return response
        gate.next_allowed_at = now + timedelta(seconds=1.1)
        gate.save(update_fields=['next_allowed_at'])
    try:
        result = fetch_reverse(lat, lon)
    except (URLError, TimeoutError, OSError, ValueError, KeyError, TypeError):
        return JsonResponse({'error': 'دریافت خودکار نشانی فعلاً ممکن نیست؛ آدرس را دستی بنویس یا دوباره تلاش کن.'}, status=503)
    GeocodeCache.objects.update_or_create(key=cache_key, defaults={'result': result, 'expires_at': now + timedelta(days=1)})
    return JsonResponse(result)
