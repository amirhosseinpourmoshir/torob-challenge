import copy
import os
import re
import socket
import subprocess
import sys
import time
from datetime import timedelta
from django.db import transaction, close_old_connections
from django.utils import timezone
from .models import AgentTurn, Conversation, KnowledgeJob, LocalizedTerm, WorkerHeartbeat


class TurnTimedOut(Exception):
    pass


class TurnCancelled(Exception):
    pass


def heartbeat():
    if os.getenv('AGENT_CHILD') == '1':
        return
    WorkerHeartbeat.objects.update_or_create(pk=f'{socket.gethostname()}-{os.getpid()}', defaults={'seen_at': timezone.now()})


def claim(model):
    if model is AgentTurn:
        from .lifecycle import expire_turns
        expire_turns(AgentTurn.objects.all())
    with transaction.atomic():
        expired = model.objects.select_for_update(skip_locked=True).filter(status='running', lease_until__lt=timezone.now()).first()
        if expired:
            expired.status = 'queued'
            expired.save(update_fields=['status', 'updated_at'])
        row = model.objects.select_for_update(skip_locked=True).filter(status='queued').order_by('created_at').first()
        if row:
            row.status = 'running'; row.lease_until = timezone.now() + timedelta(minutes=3)
            if isinstance(row, AgentTurn):
                row.attempts += 1
                if row.attempts > 2:
                    row.status = 'failed'; row.error = 'دریافت پاسخ متوقف شد؛ یک پیام تازه بفرست تا ادامه بدیم.'
                    row.save()
                    return None
            row.save()
        return row


def execute_turn(turn):
    from .provider import ProviderError
    heartbeat()
    conversation = turn.conversation
    previous = conversation.state
    state = turn.checkpoint or {
        'messages': [*previous.get('messages', []), {'role': 'user', 'content': turn.text}],
        'context': turn.context, 'evidence': copy.deepcopy(previous.get('evidence', {})) if previous.get('preferences', {}) == turn.context.get('preferences', {}) else {},
        'rounds': 0, 'tool_count': 0, 'pending': [], 'answer': {}, 'usage': {}, 'discovered_products': [], 'discovered_shops': [],
    }
    # Retain whole user/assistant/tool groups, never orphan a tool-call result.
    starts = [i for i, message in enumerate(state['messages']) if message.get('role') == 'user']
    if len(starts) > 4:
        state['messages'] = state['messages'][starts[-4]:]
    events = list(turn.events)
    def notify(name, label, status, duration_ms=None):
        from .lifecycle import deadline
        if timezone.now() >= deadline(turn):
            raise TurnTimedOut()
        event = {'id': f'{name}-{len(events)}', 'name': name, 'label': label, 'status': status}
        if duration_ms is not None:
            event['durationMs'] = duration_ms
        events.append(event)
        if not AgentTurn.objects.filter(pk=turn.pk, status='running').update(events=events[-30:], lease_until=timezone.now() + timedelta(minutes=3)):
            raise TurnCancelled()
        heartbeat()
    try:
        if turn.action and not state.get('answer') and not state.get('pending'):
            from .actions import prepare_action
            prepare_action(state, turn.action, notify)
        if state.get('answer'):
            from .presentation import render_response
            notify('render', 'انتخاب‌ها آماده‌ان', 'done')
            state['response'] = render_response(state['answer'], state, str(turn.pk))
        else:
            from .graph import build_graph
            graph = build_graph(str(turn.pk), notify)
            for chunk in graph.stream(state, stream_mode='updates', config={'recursion_limit': 20}):
                for update in chunk.values():
                    if isinstance(update, dict):
                        state.update(update)
                if not AgentTurn.objects.filter(pk=turn.pk, status='running').update(checkpoint=state, model=state.get('model', ''), usage=state.get('usage', {}), lease_until=timezone.now() + timedelta(minutes=3)):
                    raise TurnCancelled()
                heartbeat()
        from .lifecycle import finish
        finish(turn.pk, state)
    except (TurnCancelled, Conversation.DoesNotExist):
        return
    except TurnTimedOut:
        from .lifecycle import fail_or_complete
        fail_or_complete(turn.pk, 'مهلت دریافت پاسخ تمام شد؛ دوباره امتحان کن.')
    except ProviderError as error:
        from .lifecycle import fail_or_complete
        fail_or_complete(turn.pk, str(error))
    except Exception:
        import logging
        logging.getLogger(__name__).error('Agent turn failed: %s', turn.pk)
        from .lifecycle import fail_or_complete
        fail_or_complete(turn.pk, 'این بار نتیجه کامل نرسید؛ دوباره امتحان کنیم؟')



def execute_knowledge(job):
    from .localization import normalize_catalog, translate_batch, is_technical_code
    try:
        if job.mode == 'normalize':
            def progress(current, total):
                KnowledgeJob.objects.filter(pk=job.pk).update(progress=current, total=total, lease_until=timezone.now() + timedelta(minutes=3))
                heartbeat()
            stats = normalize_catalog(progress)
            KnowledgeJob.objects.filter(pk=job.pk).update(status='done', stats=stats, lease_until=None)
        else:
            rows = [row for row in LocalizedTerm.objects.filter(persian='', kind__in=['category', 'spec']).exclude(key__in=job.stats.get('attempted_keys', [])).order_by('key') if len(row.original) <= 160 and re.search('[A-Za-z]{3}', row.original) and not is_technical_code(row.original)][:min(10, job.limit - job.progress)]
            if not rows or job.progress >= job.limit:
                KnowledgeJob.objects.filter(pk=job.pk).update(status='done', lease_until=None)
                return
            translated = translate_batch(rows)
            progress = job.progress + len(rows)
            stats = job.stats or {}
            stats['translated'] = stats.get('translated', 0) + translated
            # Unsupported/empty translations are not retried forever in this job.
            stats['attempted_keys'] = [*stats.get('attempted_keys', []), *(row.key for row in rows)]
            KnowledgeJob.objects.filter(pk=job.pk).update(status='done' if progress >= job.limit else 'queued', progress=progress, stats=stats, lease_until=None)
    except Exception:
        KnowledgeJob.objects.filter(pk=job.pk).update(status='failed', error='آماده‌سازی کامل نشد؛ اتصال مدل و داده‌ها را بررسی کن.', lease_until=None)


def work_once():
    close_old_connections(); heartbeat()
    turn = claim(AgentTurn)
    if turn:
        from .lifecycle import deadline, fail_or_complete
        # A dedicated child lets Stop interrupt even a blocked network read.
        process = subprocess.Popen([sys.executable, 'manage.py', 'agent_worker', '--turn', str(turn.pk)], env={**os.environ, 'AGENT_CHILD': '1'})
        last_heartbeat = time.monotonic()
        try:
            while process.poll() is None:
                if time.monotonic() - last_heartbeat >= 10:
                    heartbeat(); last_heartbeat = time.monotonic()
                status = AgentTurn.objects.filter(pk=turn.pk).values_list('status', flat=True).first()
                if status != 'running' or timezone.now() >= deadline(turn):
                    process.terminate()
                    try:
                        process.wait(timeout=3)
                    except subprocess.TimeoutExpired:
                        process.kill(); process.wait()
                    if status == 'running':
                        fail_or_complete(turn.pk, 'مهلت دریافت پاسخ تمام شد؛ دوباره امتحان کن.')
                    break
                time.sleep(.5)
            if AgentTurn.objects.filter(pk=turn.pk, status='running').exists():
                fail_or_complete(turn.pk, 'اجرای پاسخ متوقف شد؛ دوباره امتحان کن.')
        finally:
            if process.poll() is None:
                process.terminate(); process.wait(timeout=3)
        return True
    job = claim(KnowledgeJob)
    if job:
        execute_knowledge(job)
        return True
    return False
