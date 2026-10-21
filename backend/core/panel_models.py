import uuid
from django.db import models

MODEL_IDS = ['gpt-6.1-sol', 'gpt-6-astra', 'gpt-6-luna', 'gpt-6-sol', 'gpt-5-mini', 'gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6-sol', 'gpt-5.4-mini', 'gpt-5.3-codex', 'text-embedding-3-small', 'text-embedding-3-large']
CHAT = '/chat/completions'
EMBEDDINGS = '/embeddings'


class AIConnection(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1)
    base_url = models.URLField(max_length=500, blank=True)
    encrypted_api_key = models.TextField(blank=True)
    timeout_seconds = models.PositiveSmallIntegerField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class AIModelProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=80)
    model = models.CharField(max_length=64, choices=[(m, m) for m in MODEL_IDS])
    endpoint = models.CharField(max_length=32, choices=[(CHAT, CHAT), (EMBEDDINGS, EMBEDDINGS)])
    enabled = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['endpoint', '-is_default', 'name']
        constraints = [models.UniqueConstraint(fields=['endpoint'], condition=models.Q(is_default=True), name='one_default_ai_model_per_endpoint'), models.CheckConstraint(condition=models.Q(is_default=False) | models.Q(enabled=True), name='default_ai_model_enabled')]
