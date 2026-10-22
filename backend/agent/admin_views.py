from datetime import timedelta
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from core.panel import api
from core.addresses import body
from catalog.models import Product, Shop, Offer, Category
from .models import KnowledgeJob, LocalizedTerm, WorkerHeartbeat, AgentTurn
from .skills import SKILLS


def knowledge_state():
    latest = KnowledgeJob.objects.order_by('-created_at').first()
    return {'counts': {'products': Product.objects.count(), 'shops': Shop.objects.count(), 'offers': Offer.objects.count(), 'categories': Category.objects.count(), 'terms': LocalizedTerm.objects.count(), 'localized': LocalizedTerm.objects.exclude(persian='').count(), 'model_translated': LocalizedTerm.objects.filter(source='model').count(), 'remaining': LocalizedTerm.objects.filter(persian='', kind__in=['category', 'spec']).count()},
            'job': {'id': str(latest.pk), 'mode': latest.mode, 'status': latest.status, 'progress': latest.progress, 'total': latest.total or latest.limit, 'error': latest.error, 'stats': {k: v for k, v in latest.stats.items() if k != 'attempted_keys'}} if latest else None,
            'worker_online': WorkerHeartbeat.objects.filter(seen_at__gte=timezone.now() - timedelta(minutes=2)).exists(), 'skills': SKILLS,
            'runs': list(AgentTurn.objects.order_by('-created_at').values('id', 'status', 'model', 'usage', 'created_at')[:8])}


@require_http_methods(['GET', 'POST'])
@api
def knowledge(request):
    if request.method == 'POST':
        data = body(request)
        mode, limit = data.get('mode', 'normalize'), data.get('limit', 30)
        if mode not in ('normalize', 'translate') or type(limit) is not int or not 1 <= limit <= 300:
            return JsonResponse({'error': 'نوع آماده‌سازی و تعداد واژه‌ها را بررسی کن.'}, status=400)
        with transaction.atomic():
            from core.panel import lock_connection
            lock_connection()
            if KnowledgeJob.objects.filter(status__in=['queued', 'running']).exists():
                return JsonResponse({'error': 'آماده‌سازی قبلی هنوز در حال انجامه.'}, status=409)
            KnowledgeJob.objects.create(mode=mode, limit=limit, total=limit if mode == 'translate' else 0)
    return JsonResponse(knowledge_state())
