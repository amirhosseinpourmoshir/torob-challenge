import uuid
from django.db import models


class Conversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner_key = models.UUIDField(db_index=True)
    state = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class AgentTurn(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='turns')
    request_id = models.UUIDField()
    text = models.TextField()
    action = models.JSONField(default=dict)
    status = models.CharField(max_length=16, default='queued', db_index=True)
    context = models.JSONField(default=dict)
    checkpoint = models.JSONField(default=dict)
    events = models.JSONField(default=list)
    response = models.JSONField(default=dict)
    error = models.TextField(blank=True)
    model = models.CharField(max_length=64, blank=True)
    usage = models.JSONField(default=dict)
    attempts = models.PositiveSmallIntegerField(default=0)
    lease_until = models.DateTimeField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']
        constraints = [models.UniqueConstraint(fields=['conversation', 'request_id'], name='unique_agent_request'), models.UniqueConstraint(fields=['conversation'], condition=models.Q(status__in=['queued', 'running']), name='one_pending_agent_turn')]


class LocalizedTerm(models.Model):
    key = models.CharField(max_length=64, primary_key=True)
    kind = models.CharField(max_length=24)
    original = models.TextField()
    persian = models.TextField(blank=True)
    aliases = models.JSONField(default=list)
    source = models.CharField(max_length=24, default='original')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=['original'], name='agent_term_original_idx'), models.Index(models.functions.Upper('persian'), name='agent_term_persian_upper_idx')]


class KnowledgeJob(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mode = models.CharField(max_length=16, default='normalize')
    status = models.CharField(max_length=16, default='queued', db_index=True)
    limit = models.PositiveSmallIntegerField(default=30)
    progress = models.PositiveIntegerField(default=0)
    total = models.PositiveIntegerField(default=0)
    stats = models.JSONField(default=dict)
    error = models.TextField(blank=True)
    lease_until = models.DateTimeField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class WorkerHeartbeat(models.Model):
    id = models.CharField(max_length=100, primary_key=True)
    seen_at = models.DateTimeField()


class SavedProduct(models.Model):
    owner_key = models.UUIDField(db_index=True)
    product = models.ForeignKey('catalog.Product', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [models.UniqueConstraint(fields=['owner_key', 'product'], name='unique_saved_product_owner')]
