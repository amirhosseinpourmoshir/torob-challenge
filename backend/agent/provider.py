"""BoxAPI chat-completions adapter. Secrets never enter graph state or traces."""
import ipaddress
import json
import socket
import hashlib
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, build_opener
from django.views.decorators.debug import sensitive_variables
from django.core.cache import cache
from core.ai_config import resolve_model, validate_url
from core.panel import NoRedirect


class ProviderError(Exception):
    pass


@sensitive_variables()
def chat(messages, tools=None, *, max_tokens=2400, force_json=False, config=None):
    config = config or resolve_model()
    if not config['api_key'] or not config['base_url']:
        raise ProviderError('اتصال دستیار هنوز تنظیم نشده؛ تنظیمات پنل رو بررسی کن.')
    base = validate_url(config['base_url'])
    for result in socket.getaddrinfo(urlsplit(base).hostname, 443, type=socket.SOCK_STREAM):
        if not ipaddress.ip_address(result[4][0]).is_global:
            raise ProviderError('آدرس سرویس باید عمومی باشد.')
    payload = {'model': config['model'], 'messages': messages, 'max_completion_tokens': max_tokens}
    if tools:
        payload.update(tools=tools, tool_choice='auto', parallel_tool_calls=False)
    capability_key = 'agent-provider-tools:' + hashlib.sha256(f"{base}:{config['model']}".encode()).hexdigest()
    if tools and cache.get(capability_key) == 'reasoning_none':
        payload['reasoning_effort'] = 'none'
    if force_json:
        payload['response_format'] = {'type': 'json_object'}
    def send(data):
        request = Request(base + '/chat/completions', data=json.dumps(data, ensure_ascii=False).encode(), headers={'Authorization': 'Bearer ' + config['api_key'], 'Content-Type': 'application/json'}, method='POST')
        with build_opener(NoRedirect()).open(request, timeout=min(config['timeout_seconds'], 90)) as response:
            return json.loads(response.read(2_000_000))
    try:
        try:
            result = send(payload)
        except HTTPError as error:
            # Some compatible providers reject optional OpenAI parameters.
            if error.code != 400:
                raise
            detail = error.read(8192).decode(errors='replace')
            if tools and 'reasoning_effort' in detail and 'none' in detail:
                payload['reasoning_effort'] = 'none'
                cache.set(capability_key, 'reasoning_none', 86400)
            payload.pop('parallel_tool_calls', None)
            payload.pop('response_format', None)
            result = send(payload)
        message = result['choices'][0]['message']
        if not isinstance(message, dict):
            raise ValueError()
        return {'message': message, 'model': config['model'], 'usage': result.get('usage', {})}
    except HTTPError as error:
        raise ProviderError({401: 'کلید اتصال پذیرفته نشد؛ تنظیمات پنل رو بررسی کن.', 403: 'مدل انتخاب‌شده برای این کلید در دسترس نیست.', 429: 'سرویس فعلاً محدود شده؛ کمی بعد دوباره امتحان کن.'}.get(error.code, 'سرویس پاسخ نداد؛ می‌تونیم دوباره امتحان کنیم.')) from None
    except (URLError, TimeoutError, OSError):
        raise ProviderError('دریافت پاسخ طول کشید؛ دوباره امتحان کنیم؟') from None
    except (ValueError, KeyError, IndexError, TypeError):
        raise ProviderError('پاسخ سرویس کامل نبود؛ دوباره امتحان کنیم؟') from None


def json_content(content):
    if not isinstance(content, str):
        raise ValueError('پاسخ متنی دریافت نشد.')
    value = content.strip()
    if value.startswith('```'):
        value = value.split('\n', 1)[-1].rsplit('```', 1)[0]
    standalone = {'quick_replies', 'clarification', 'budget', 'preferences', 'empty', 'checklist', 'clock', 'calendar', 'visit'}
    try:
        data = json.loads(value)
    except json.JSONDecodeError:
        # Compatible models sometimes prepend prose to their structured answer.
        decoder = json.JSONDecoder()
        data = None
        for index, character in enumerate(value):
            if character != '{':
                continue
            try:
                candidate, _ = decoder.raw_decode(value[index:])
            except json.JSONDecodeError:
                continue
            if isinstance(candidate, dict) and any(key in candidate for key in ('text', 'blocks', 'translations')):
                data = candidate
                if 'blocks' in data and 'text' not in data:
                    data['text'] = value[:index].strip().removesuffix('```json').removesuffix('```').strip()
                break
            if isinstance(candidate, dict) and candidate.get('type') in standalone:
                data = {'text': value[:index].strip().removesuffix('```json').removesuffix('```').strip(), 'blocks': [candidate]}
                break
    if not isinstance(data, dict):
        raise ValueError('پاسخ ساخت‌یافته نبود.')
    if data.get('type') in standalone:
        data = {'text': '', 'blocks': [data]}
    return data
