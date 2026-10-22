import json
import uuid
from datetime import timedelta
from django.db import transaction, IntegrityError
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.utils import timezone
from django.views.decorators.http import require_GET, require_http_methods, require_POST
from core.addresses import owner, body
from core.models import SavedAddress
from .models import Conversation, AgentTurn, WorkerHeartbeat
from .catalog_tools import time_context


def turn_data(turn):
    return {'id': str(turn.pk), 'request_id': str(turn.request_id), 'text': turn.text, 'status': turn.status, 'events': turn.events[-15:], 'response': turn.response, 'error': turn.error, 'created_at': turn.created_at.isoformat()}


def conversation_data(conversation, request):
    turns = list(conversation.turns.order_by('-created_at')[:20])[::-1]
    return {'id': str(conversation.pk), 'turns': [turn_data(turn) for turn in turns], 'csrf_token': get_token(request), 'worker_online': WorkerHeartbeat.objects.filter(seen_at__gte=timezone.now() - timedelta(seconds=40)).exists()}


def private_response(value, status=200):
    response = JsonResponse(value, status=status)
    response['Cache-Control'] = 'no-store'
    return response


@require_http_methods(['GET', 'POST'])
def conversations(request):
    key = owner(request)
    conversation = Conversation.objects.filter(owner_key=key).order_by('-created_at').first() if request.method == 'GET' else None
    if conversation is None:
        conversation = Conversation.objects.create(owner_key=key)
    return private_response(conversation_data(conversation, request))


def action_context(action, conversation):
    if not isinstance(action, dict) or set(action) - {'type', 'payload', 'widgetId'}:
        raise ValueError('انتخابت کامل نرسید؛ دوباره امتحان کن.')
    event, payload = action.get('type'), action.get('payload', {})
    if not isinstance(event, str) or not isinstance(payload, dict) or len(json.dumps(payload, ensure_ascii=False)) > 3000:
        raise ValueError('انتخابت کامل نرسید.')
    allowed = {'find_sellers', 'select_product', 'select_shop', 'view_product', 'view_offer', 'filter_credit', 'set_budget', 'preferences_changed', 'clarification_answer', 'quick_reply', 'request_shop_contact', 'confirm_action', 'cancel_action', 'start_itinerary', 'select_date', 'plan_visit', 'retry_widget', 'reset_filters'}
    if event not in allowed:
        raise ValueError('این انتخاب در گفتگو قابل انجام نیست.')
    known = None
    for turn in conversation.turns.filter(status='done').order_by('-created_at')[:20]:
        known = next((w for w in turn.response.get('widgets', []) if w.get('id') == action.get('widgetId')), None)
        if known:
            break
    if not known:
        raise ValueError('این کارت متعلق به گفتگوی فعلی نیست؛ یک انتخاب تازه انجام بده.')
    evidence = conversation.state.get('evidence', {})
    for field, kind in [('productId', 'products'), ('shopId', 'shops')]:
        if field in payload and payload[field] not in evidence.get(kind, {}):
            raise ValueError('این گزینه در انتخاب‌های گفتگو پیدا نشد.')
    if event == 'set_budget' and (type(payload.get('amount')) is not int or not 0 <= payload['amount'] <= 10**12):
        raise ValueError('بودجه را به تومان وارد کن.')
    if event == 'clarification_answer':
        props = known.get('props', {})
        allowed_values = {option['id']: option['label'] for option in props.get('options', [])}
        values = payload.get('values', [])
        other = payload.get('other')
        if known['type'] != 'clarification' or not isinstance(values, list) or len(values) > 8 or any(not isinstance(value, str) or value not in allowed_values for value in values) or (other is not None and (not isinstance(other, str) or len(other) > 500)):
            raise ValueError('پاسخ سؤال را دوباره انتخاب کن.')
        return 'پاسخ من به «' + props.get('question', '') + '»: ' + '، '.join(allowed_values[v] for v in values) + (f'؛ {other}' if other else '')
    labels = {'find_sellers': 'فروشگاه‌های این محصول را پیدا کن', 'select_product': 'این محصول را بیشتر بررسی کنیم', 'view_product': 'مشخصات این محصول را ببینیم', 'select_shop': 'این فروشگاه را بررسی کن', 'filter_credit': 'فقط فروشگاه‌های دارای خرید اعتباری حضوری را پیدا کن', 'set_budget': 'با این بودجه جستجو کن', 'preferences_changed': 'ترجیح‌های من تغییر کرد', 'quick_reply': 'انتخاب من', 'request_shop_contact': 'متن استعلام و راه ارتباط رسمی این فروشگاه را آماده کن؛ پیامی نفرست', 'retry_widget': 'این بخش را دوباره بررسی کن', 'reset_filters': 'راهی برای پیدا کردن گزینه‌های بیشتر پیشنهاد بده', 'plan_visit': 'برای این زمان برنامه‌ریزی کنیم', 'select_date': 'این روز را برای مراجعه در نظر بگیر', 'start_itinerary': 'برنامهٔ این فروشگاه‌ها را بچین', 'confirm_action': 'این قدم را تأیید می‌کنم', 'cancel_action': 'این قدم را انجام نده', 'view_offer': 'جزئیات این پیشنهاد را ببینیم'}
    return labels.get(event, 'انتخاب من') + ': ' + json.dumps(payload, ensure_ascii=False)


@require_POST
def create_turn(request, conversation_id):
    key = owner(request)
    try:
        data = body(request)
        text = data.get('text', '')
        if not isinstance(text, str) or len(text) > 2000:
            raise ValueError('پیامت را کوتاه‌تر بنویس؛ تا دو هزار نویسه کافیه.')
        request_id = uuid.UUID(str(data.get('request_id', '')))
        with transaction.atomic():
            conversation = Conversation.objects.select_for_update().get(pk=conversation_id, owner_key=key)
            existing = conversation.turns.filter(request_id=request_id).first()
            if existing:
                return private_response(turn_data(existing))
            if conversation.turns.filter(status__in=['queued', 'running']).exists():
                return private_response({'error': 'هنوز دارم پیام قبلیت رو بررسی می‌کنم.'}, 409)
            if AgentTurn.objects.filter(conversation__owner_key=key, created_at__gte=timezone.now() - timedelta(hours=1)).count() >= 40:
                return private_response({'error': 'برای این ساعت به سقف گفتگو رسیدیم؛ کمی بعد ادامه بدیم.'}, 429)
            action = data.get('action') or {}
            if action:
                text = action_context(action, conversation)
            if not text.strip():
                raise ValueError('یه جمله بنویس تا شروع کنیم.')
            address = SavedAddress.objects.filter(owner_key=key, is_active=True).first()
            context = {'origin': {'latitude': address.latitude, 'longitude': address.longitude, 'label': address.label} if address else None, 'time': time_context(), 'preferences': dict(conversation.state.get('preferences', {}))}
            if action.get('type') == 'set_budget':
                context['preferences']['max_price'] = action['payload']['amount']
            if action.get('type') == 'filter_credit':
                context['preferences']['credit_only'] = True
            turn = AgentTurn.objects.create(conversation=conversation, request_id=request_id, text=text.strip(), action=action, context=context)
            return private_response(turn_data(turn), 202)
    except Conversation.DoesNotExist:
        return private_response({'error': 'گفتگو پیدا نشد.'}, 404)
    except (ValueError, TypeError, IntegrityError):
        return private_response({'error': 'پیام یا انتخابت کامل نرسید؛ دوباره امتحان کن.'}, 400)


@require_GET
def turn_status(request, turn_id):
    turn = AgentTurn.objects.filter(pk=turn_id, conversation__owner_key=owner(request)).first()
    return private_response(turn_data(turn)) if turn else private_response({'error': 'این پیام پیدا نشد.'}, 404)


@require_GET
def conversation_shop(request, conversation_id, shop_id):
    from .catalog_tools import store_details
    from .presentation import clean
    conversation = Conversation.objects.filter(pk=conversation_id, owner_key=owner(request)).first()
    if not conversation or shop_id not in conversation.state.get('evidence', {}).get('shops', {}):
        return private_response({'error': 'این فروشگاه در گفتگوی فعلی پیدا نشد.'}, 404)
    address = SavedAddress.objects.filter(owner_key=conversation.owner_key, is_active=True).first()
    context = {'origin': {'latitude': address.latitude, 'longitude': address.longitude} if address else None}
    shop = store_details(context, shop_id)['shops'][0]
    return private_response({'shop': {'id': shop['id'], 'name': shop['name'], 'address': shop['address'], 'coordinates': shop['_coordinates'], 'distance_m': shop['distanceMeters'], 'category': shop.get('_map_category', 'other'), 'type': shop.get('_map_type', 'فروشگاه')}, 'details': clean(shop)})
