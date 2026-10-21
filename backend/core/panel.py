import ipaddress
import json
import socket
import time
from functools import wraps
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.core.cache import cache
from django.db import transaction
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.debug import sensitive_variables, sensitive_post_parameters
from django.views.decorators.http import require_GET, require_POST, require_http_methods
from .addresses import body
from .ai_config import cipher, endpoint_for, resolve_connection, seed_profiles, validate_url
from .panel_models import AIConnection, AIModelProfile, MODEL_IDS, CHAT, EMBEDDINGS


def api(view):
    @wraps(view)
    @sensitive_variables()
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated or not request.user.is_active or not request.user.is_superuser:
            return JsonResponse({'error': 'برای ادامه با حساب مدیریت وارد شو.'}, status=403)
        try:
            response = view(request, *args, **kwargs)
        except (ValueError, TypeError) as error:
            response = JsonResponse({'error': str(error) if isinstance(error, ValueError) else 'اطلاعات واردشده را بررسی کن.'}, status=400)
        response['Cache-Control'] = 'no-store'
        return response
    return wrapped


def session_response(request):
    response = JsonResponse({'authenticated': request.user.is_authenticated and request.user.is_active and request.user.is_superuser, 'username': request.user.username if request.user.is_authenticated and request.user.is_superuser else '', 'csrf_token': get_token(request)})
    response['Cache-Control'] = 'no-store'
    return response


@require_GET
def session(request):
    return session_response(request)


@require_POST
@sensitive_post_parameters()
@sensitive_variables()
def sign_in(request):
    key = 'panel-login:' + request.META.get('REMOTE_ADDR', 'unknown')
    failures = cache.get(key, 0)
    if failures >= 8:
        return JsonResponse({'error': 'چند بار تلاش ناموفق داشتی؛ پانزده دقیقه دیگر امتحان کن.'}, status=429)
    try:
        data = body(request)
        username, password = data.get('username'), data.get('password')
        if not isinstance(username, str) or not isinstance(password, str) or len(username) > 150 or len(password) > 256:
            raise ValueError()
    except (ValueError, TypeError):
        return JsonResponse({'error': 'نام کاربری و رمز عبور را وارد کن.'}, status=400)
    user = authenticate(request, username=username, password=password)
    if user is None or not user.is_active or not user.is_superuser:
        cache.set(key, failures + 1, 900)
        return JsonResponse({'error': 'نام کاربری یا رمز عبور درست نیست.'}, status=403)
    cache.delete(key)
    login(request, user)
    request.session.set_expiry(8 * 60 * 60)
    return session_response(request)


@require_POST
def sign_out(request):
    address_owner = request.session.get('address_owner')
    logout(request)
    if address_owner:
        request.session['address_owner'] = address_owner
        request.session.set_expiry(365 * 24 * 60 * 60)
    return session_response(request)


def lock_connection():
    AIConnection.objects.get_or_create(pk=1)
    return AIConnection.objects.select_for_update().get(pk=1)


def profile_data(profile):
    return {'id': str(profile.pk), 'name': profile.name, 'model': profile.model, 'endpoint': profile.endpoint, 'enabled': profile.enabled, 'is_default': profile.is_default}


def state():
    row = AIConnection.objects.get(pk=1)
    effective = resolve_connection()
    # A key never leaves the backend, including its prefix/suffix.
    return {'connection': {'base_url': effective['base_url'], 'timeout_seconds': effective['timeout_seconds'], 'key_configured': bool(effective['api_key']), 'key_source': 'panel' if row.encrypted_api_key else 'env', 'url_source': 'panel' if row.base_url else 'env', 'timeout_source': 'panel' if row.timeout_seconds else 'env'},
            'defaults': {'base_url': settings.AI['BASE_URL'], 'timeout_seconds': settings.AI['TIMEOUT_SECONDS'], 'model': settings.AI['MODEL'], 'key_configured': bool(settings.AI['API_KEY'])},
            'models': [profile_data(p) for p in AIModelProfile.objects.all()], 'allowed_models': [{'id': m, 'endpoint': endpoint_for(m)} for m in MODEL_IDS], 'endpoints': [CHAT, EMBEDDINGS]}


@require_http_methods(['GET', 'PATCH'])
@api
@sensitive_variables()
def configuration(request):
    with transaction.atomic():
        row = lock_connection()
        seed_profiles()
        if request.method == 'PATCH':
            data = body(request)
            if data.get('reset_to_env') is True:
                row.base_url = ''; row.encrypted_api_key = ''; row.timeout_seconds = None
            else:
                url = data.get('base_url', '')
                if not isinstance(url, str):
                    raise ValueError('آدرس اتصال را بررسی کن.')
                row.base_url = validate_url(url.strip()) if url.strip() else ''
                timeout = data.get('timeout_seconds')
                if timeout is not None and (type(timeout) is not int or not 5 <= timeout <= 180):
                    raise ValueError('زمان انتظار باید بین ۵ تا ۱۸۰ ثانیه باشد.')
                row.timeout_seconds = timeout
                if data.get('use_env_key') is True:
                    row.encrypted_api_key = ''
                elif data.get('api_key'):
                    key = data['api_key']
                    if not isinstance(key, str) or len(key) > 4096 or any(ord(c) < 33 or ord(c) > 126 for c in key):
                        raise ValueError('کلید اتصال را بررسی کن.')
                    row.encrypted_api_key = cipher().encrypt(key.encode()).decode()
            row.save()
        return JsonResponse(state())


@require_http_methods(['POST', 'PATCH', 'DELETE'])
@api
def profiles(request, profile_id=None):
    with transaction.atomic():
        lock_connection(); seed_profiles()
        profile = AIModelProfile.objects.filter(pk=profile_id).first() if profile_id else None
        if profile_id and profile is None:
            return JsonResponse({'error': 'این مدل پیدا نشد.'}, status=404)
        if request.method == 'DELETE':
            if profile is None:
                return JsonResponse({'error': 'مدل را انتخاب کن.'}, status=400)
            if profile.is_default:
                return JsonResponse({'error': 'اول یک مدل دیگر را پیش‌فرض کن، بعد این مدل را حذف کن.'}, status=409)
            profile.delete()
        else:
            if request.method == 'PATCH' and profile is None:
                return JsonResponse({'error': 'مدل را انتخاب کن.'}, status=400)
            data = body(request)
            name = data.get('name', profile.name if profile else '')
            model = data.get('model', profile.model if profile else '')
            enabled = data.get('enabled', profile.enabled if profile else True)
            default = data.get('is_default', profile.is_default if profile else False)
            if not isinstance(name, str) or not 2 <= len(name.strip()) <= 80 or model not in MODEL_IDS or type(enabled) is not bool or type(default) is not bool:
                raise ValueError('نام و مدل را از گزینه‌های موجود انتخاب کن.')
            endpoint = endpoint_for(model)
            if 'endpoint' in data and data['endpoint'] != endpoint:
                raise ValueError('این مدل با نوع اتصال انتخاب‌شده سازگار نیست.')
            if profile and profile.is_default and (not default or not enabled or endpoint != profile.endpoint):
                raise ValueError('اول مدل دیگری را پیش‌فرض کن.')
            if default and not enabled:
                raise ValueError('مدل پیش‌فرض باید روشن باشد.')
            if default:
                AIModelProfile.objects.filter(endpoint=endpoint, is_default=True).exclude(pk=profile.pk if profile else None).update(is_default=False)
            profile = profile or AIModelProfile()
            profile.name = name.strip(); profile.model = model; profile.endpoint = endpoint; profile.enabled = enabled; profile.is_default = default
            profile.save()
        return JsonResponse(state())


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def provider_probe(connection, profile):
    base = validate_url(connection['base_url'])
    # Avoid sending credentials to local services or following a redirect.
    for result in socket.getaddrinfo(urlsplit(base).hostname, 443, type=socket.SOCK_STREAM):
        if not ipaddress.ip_address(result[4][0]).is_global:
            raise ValueError('آدرس سرویس باید عمومی و در دسترس باشد.')
    payload = {'model': profile.model}
    if profile.endpoint == CHAT:
        payload.update(messages=[{'role': 'user', 'content': 'Reply with OK.'}], max_completion_tokens=16)
    else:
        payload['input'] = 'سلام'
    req = Request(base + profile.endpoint, data=json.dumps(payload).encode(), headers={'Authorization': 'Bearer ' + connection['api_key'], 'Content-Type': 'application/json'}, method='POST')
    with build_opener(NoRedirect()).open(req, timeout=connection['timeout_seconds']) as response:
        data = json.loads(response.read(2_000_000))
    if not isinstance(data, dict) or not (isinstance(data.get('choices'), list) and data['choices'] if profile.endpoint == CHAT else isinstance(data.get('data'), list) and data['data'] and isinstance(data['data'][0].get('embedding'), list)):
        raise ValueError('سرویس پاسخ داد، اما پاسخ با این نوع مدل سازگار نبود.')


@require_POST
@api
@sensitive_variables()
def probe(request, profile_id):
    profile = AIModelProfile.objects.filter(pk=profile_id, enabled=True).first()
    if not profile:
        return JsonResponse({'error': 'یک مدل روشن را برای تست انتخاب کن.'}, status=400)
    connection = resolve_connection()
    if not connection['api_key'] or not connection['base_url']:
        raise ValueError('اول آدرس سرویس و کلید اتصال را ذخیره کن.')
    gate = 'panel-probe:' + str(request.user.pk)
    if not cache.add(gate, True, 10):
        return JsonResponse({'error': 'چند ثانیه صبر کن، بعد دوباره تست بگیر.'}, status=429)
    started = time.monotonic()
    try:
        provider_probe(connection, profile)
    except HTTPError as error:
        messages = {401: 'کلید اتصال پذیرفته نشد.', 403: 'این کلید به مدل انتخابی دسترسی ندارد.', 404: 'آدرس اتصال یا مدل پیدا نشد.', 429: 'محدودیت درخواست یا اعتبار سرویس را بررسی کن.'}
        return JsonResponse({'error': messages.get(error.code, 'سرویس درخواست تست را نپذیرفت.'), 'provider_status': error.code}, status=502)
    except (URLError, TimeoutError, OSError):
        return JsonResponse({'error': 'پاسخی از سرویس نرسید؛ آدرس و اتصال را بررسی کن.'}, status=502)
    except (json.JSONDecodeError, UnicodeError, AttributeError):
        return JsonResponse({'error': 'پاسخ سرویس قابل خواندن نبود.'}, status=502)
    return JsonResponse({'ok': True, 'latency_ms': round((time.monotonic() - started) * 1000), 'model': profile.model, 'endpoint': profile.endpoint})
