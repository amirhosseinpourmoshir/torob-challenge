"""Terminal transitions are locked and cannot be overwritten by a late model reply."""
import json
from datetime import timedelta
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from .models import AgentTurn, Conversation

ACTIVE = ('queued', 'running')


def deadline(turn):
    return turn.created_at + timedelta(seconds=settings.AGENT_TURN_TIMEOUT_SECONDS)


def finish(turn_id, state=None, *, error='', status='done'):
    state = state or {}
    from .presentation import render_response
    conversation_id = AgentTurn.objects.filter(pk=turn_id).values_list('conversation_id', flat=True).first()
    if not conversation_id:
        return False
    with transaction.atomic():
        conversation = Conversation.objects.select_for_update().filter(pk=conversation_id).first()
        turn = AgentTurn.objects.select_for_update().filter(pk=turn_id, status__in=ACTIVE).first()
        if not turn or not conversation:
            return False
        if status == 'done':
            answer = state.get('answer', {})
            response = state.get('response') or render_response(answer, state, str(turn.pk))
            context = state.get('context', turn.context)
            current = conversation.state
            conversation.state = {**current, 'messages': state.get('messages', []), 'evidence': state.get('evidence', {}), 'preferences': context.get('preferences', {}), 'shopping_query': context.get('shopping_query'), 'price_range': context.get('price_range'), 'selected_shop_id': current.get('selected_shop_id') if current.get('selected_shop_id') != turn.context.get('selected_shop_id') else context.get('selected_shop_id')}
            conversation.save(update_fields=['state', 'updated_at'])
            turn.response = response
        turn.status, turn.error, turn.checkpoint, turn.lease_until = status, error, {}, None
        turn.save(update_fields=['status', 'error', 'response', 'checkpoint', 'lease_until', 'updated_at'])
        return True


def fail_or_complete(turn_id, error):
    from .outcomes import found_answer
    turn = AgentTurn.objects.filter(pk=turn_id, status__in=ACTIVE).first()
    if not turn:
        return
    state = turn.checkpoint or {}
    answer = found_answer(state, interrupted=True)
    if answer:
        history = list(state.get('messages', []))
        # Remove an unfinished function-call group before saving usable history.
        for index, message in enumerate(history):
            calls = message.get('tool_calls') if message.get('role') == 'assistant' else None
            if calls:
                returned = {row.get('tool_call_id') for row in history[index + 1:] if row.get('role') == 'tool'}
                if any(call.get('id') not in returned for call in calls):
                    history = history[:index]
                    break
        state.update(answer=answer, messages=[*history, {'role': 'assistant', 'content': json.dumps(answer, ensure_ascii=False)}])
        state.pop('response', None)
        finish(turn_id, state)
    else:
        finish(turn_id, error=error, status='failed')


def expire_turns(queryset):
    limit = timezone.now() - timedelta(seconds=settings.AGENT_TURN_TIMEOUT_SECONDS)
    for id in queryset.filter(status__in=ACTIVE, created_at__lte=limit).values_list('pk', flat=True)[:40]:
        fail_or_complete(id, 'مهلت دریافت پاسخ تمام شد؛ دوباره امتحان کن یا درخواستت رو کوتاه‌تر بفرست.')
