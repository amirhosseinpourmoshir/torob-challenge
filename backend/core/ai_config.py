"""Server-side resolution shared by the panel and future agent tools."""
import base64
import hashlib
from urllib.parse import urlsplit
from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from .panel_models import AIConnection, AIModelProfile, MODEL_IDS, CHAT, EMBEDDINGS


def cipher():
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(('torob-ai-connection-v1:' + settings.SECRET_KEY).encode()).digest()))


def endpoint_for(model):
    return EMBEDDINGS if model.startswith('text-embedding-') else CHAT


def validate_url(value):
    url = urlsplit(value)
    if len(value) > 500 or url.scheme != 'https' or not url.hostname or url.username or url.password or url.query or url.fragment or url.port not in (None, 443):
        raise ValueError('آدرس اتصال باید یک نشانی HTTPS بدون کلید یا پارامتر اضافی باشد.')
    if url.path.rstrip('/').endswith((CHAT, EMBEDDINGS)):
        raise ValueError('آدرس پایه را بدون بخش chat/completions یا embeddings وارد کن.')
    return value.rstrip('/')


def resolve_connection():
    row = AIConnection.objects.filter(pk=1).first()
    try:
        key = cipher().decrypt(row.encrypted_api_key.encode()).decode() if row and row.encrypted_api_key else settings.AI['API_KEY']
    except InvalidToken:
        raise ValueError('کلید ذخیره‌شده قابل خواندن نیست؛ کلید اتصال را دوباره ذخیره کن.')
    return {
        'base_url': row.base_url if row and row.base_url else settings.AI['BASE_URL'],
        'api_key': key,
        'timeout_seconds': row.timeout_seconds if row and row.timeout_seconds else settings.AI['TIMEOUT_SECONDS'],
    }


def resolve_model(endpoint=CHAT):
    profile = AIModelProfile.objects.filter(endpoint=endpoint, is_default=True, enabled=True).first()
    model = profile.model if profile else settings.AI['MODEL'] if endpoint == CHAT else 'text-embedding-3-small'
    if model not in MODEL_IDS or endpoint_for(model) != endpoint:
        raise ValueError('مدل پیش‌فرض این بخش را در تنظیمات انتخاب کن.')
    return {**resolve_connection(), 'model': model, 'endpoint': endpoint}


def seed_profiles():
    # Called inside the singleton connection lock, never overwrite user choices.
    for endpoint, fallback, label in [(CHAT, 'gpt-6-luna', 'گفتگوی اصلی'), (EMBEDDINGS, 'text-embedding-3-small', 'جستجوی معنایی')]:
        if not AIModelProfile.objects.filter(endpoint=endpoint).exists():
            env_model = settings.AI['MODEL']
            model = env_model if env_model in MODEL_IDS and endpoint_for(env_model) == endpoint else fallback
            AIModelProfile.objects.create(name=label, model=model, endpoint=endpoint, is_default=True)
