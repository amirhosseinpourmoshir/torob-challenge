import uuid
from django.db import models


class SavedAddress(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner_key = models.UUIDField(db_index=True)
    label = models.CharField(max_length=60)
    full_address = models.CharField(max_length=1000)
    plaque = models.CharField(max_length=20)
    unit = models.CharField(max_length=20, blank=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['owner_key'], condition=models.Q(is_active=True), name='one_active_address_per_owner')]
        ordering = ['-is_active', '-updated_at']


class GeocodeCache(models.Model):
    key = models.CharField(max_length=80, primary_key=True)
    result = models.JSONField()
    expires_at = models.DateTimeField()


class GeocodeGate(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1)
    next_allowed_at = models.DateTimeField()
