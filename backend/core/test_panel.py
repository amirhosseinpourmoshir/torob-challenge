import json
from unittest.mock import patch
from urllib.error import HTTPError
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, Client, override_settings
from .ai_config import cipher, resolve_connection, resolve_model
from .panel_models import AIConnection, AIModelProfile, MODEL_IDS, CHAT, EMBEDDINGS


@override_settings(AI={'BASE_URL': 'https://example.com/v1', 'API_KEY': 'test-environment-secret', 'MODEL': 'gpt-6-luna', 'TIMEOUT_SECONDS': 60})
class PanelTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = get_user_model().objects.create_superuser('panel_test', password='test-only-password-482')

    def setUp(self):
        cache.clear()
        self.client.force_login(self.admin)

    def send(self, path, method='post', data=None):
        return getattr(self.client, method)('/api/panel/' + path, data=json.dumps(data or {}), content_type='application/json')

    def state(self):
        return self.client.get('/api/panel/settings/').json()

    def test_authentication_and_csrf_required(self):
        anon = Client(enforce_csrf_checks=True)
        self.assertEqual(anon.get('/api/panel/settings/').status_code, 403)
        self.assertEqual(anon.post('/api/panel/login/', data='{}', content_type='application/json').status_code, 403)
        token = anon.get('/api/panel/session/').json()['csrf_token']
        result = anon.post('/api/panel/login/', data=json.dumps({'username': 'panel_test', 'password': 'test-only-password-482'}), content_type='application/json', HTTP_X_CSRFTOKEN=token)
        self.assertEqual(result.status_code, 200)
        self.assertTrue(result.json()['authenticated'])
        self.assertEqual(anon.patch('/api/panel/settings/', data='{}', content_type='application/json').status_code, 403)
        self.assertEqual(anon.post('/api/panel/logout/', HTTP_X_CSRFTOKEN=result.json()['csrf_token']).status_code, 200)
        self.assertEqual(anon.get('/api/panel/settings/').status_code, 403)

    def test_non_admin_and_login_throttling(self):
        user = get_user_model().objects.create_user('ordinary', password='test-password')
        self.client.force_login(user)
        self.assertEqual(self.client.get('/api/panel/settings/').status_code, 403)
        for _ in range(8):
            self.assertEqual(self.send('login/', data={'username': 'ordinary', 'password': 'wrong'}).status_code, 403)
        self.assertEqual(self.send('login/', data={'username': 'panel_test', 'password': 'test-only-password-482'}).status_code, 429)

    def test_defaults_and_no_secret_exposure(self):
        data = self.state()
        self.assertEqual(data['connection']['base_url'], 'https://example.com/v1')
        self.assertEqual(data['connection']['key_source'], 'env')
        self.assertEqual(len(data['allowed_models']), 12)
        self.assertNotIn('test-environment-secret', json.dumps(data))
        self.assertEqual(resolve_model()['model'], 'gpt-6-luna')
        self.assertEqual(resolve_model(EMBEDDINGS)['model'], 'text-embedding-3-small')

    def test_encryption_keep_key_and_reset(self):
        self.state()
        response = self.send('settings/', 'patch', {'base_url': 'https://example.net/v1', 'api_key': 'new-private-secret', 'timeout_seconds': 45})
        self.assertEqual(response.status_code, 200)
        stored = AIConnection.objects.get().encrypted_api_key
        self.assertNotIn('new-private-secret', stored)
        self.assertEqual(cipher().decrypt(stored.encode()).decode(), 'new-private-secret')
        self.assertNotIn('new-private-secret', response.content.decode())
        self.send('settings/', 'patch', {'base_url': 'https://example.net/v1', 'api_key': '', 'timeout_seconds': 30})
        self.assertEqual(resolve_connection()['api_key'], 'new-private-secret')
        self.send('settings/', 'patch', {'reset_to_env': True})
        self.assertEqual(resolve_connection()['api_key'], 'test-environment-secret')
        self.assertEqual(resolve_connection()['base_url'], 'https://example.com/v1')

    def test_allowlist_endpoints_and_default_integrity(self):
        self.state()
        for model in MODEL_IDS:
            expected = EMBEDDINGS if model.startswith('text-embedding-') else CHAT
            self.assertEqual(self.send('models/', data={'name': 'مدل جدید', 'model': model}).status_code, 200)
            self.assertTrue(AIModelProfile.objects.filter(model=model, endpoint=expected).exists())
        self.assertEqual(self.send('models/', data={'name': 'مدل', 'model': 'unknown-model'}).status_code, 400)
        self.assertEqual(self.send('models/', data={'name': 'مدل', 'model': 'gpt-6-luna', 'endpoint': EMBEDDINGS}).status_code, 400)
        current = AIModelProfile.objects.get(endpoint=CHAT, is_default=True)
        self.assertEqual(self.send(f'models/{current.pk}/', 'delete').status_code, 409)
        self.assertEqual(self.send(f'models/{current.pk}/', 'patch', {'enabled': False}).status_code, 400)
        replacement = AIModelProfile.objects.filter(endpoint=CHAT, is_default=False).first()
        self.assertEqual(self.send(f'models/{replacement.pk}/', 'patch', {'is_default': True}).status_code, 200)
        self.assertEqual(AIModelProfile.objects.filter(endpoint=CHAT, is_default=True).count(), 1)
        self.assertEqual(resolve_model()['model'], replacement.model)
        self.assertEqual(self.send(f'models/{current.pk}/', 'delete').status_code, 200)

    def test_connection_validation_and_probe(self):
        data = self.state()
        for url in ['http://localhost:8000', 'https://example.com?api_key=secret', 'https://u:p@example.com', 'https://example.com/v1/embeddings']:
            self.assertEqual(self.send('settings/', 'patch', {'base_url': url}).status_code, 400)
        self.assertEqual(self.send('settings/', 'patch', {'timeout_seconds': True}).status_code, 400)
        profile = data['models'][0]
        with patch('core.panel.provider_probe') as call:
            response = self.send(f"models/{profile['id']}/test/")
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.json()['ok'])
            self.assertEqual(call.call_args.args[0]['api_key'], 'test-environment-secret')
        self.assertEqual(self.send(f"models/{profile['id']}/test/").status_code, 429)
        cache.clear()
        with patch('core.panel.provider_probe', side_effect=HTTPError('https://example.com', 401, 'secret must not appear', {}, None)):
            response = self.send(f"models/{profile['id']}/test/")
            self.assertEqual(response.status_code, 502)
            self.assertNotIn('secret must not appear', response.content.decode())

    def test_probe_uses_only_supported_endpoint_and_keeps_key_in_header(self):
        from types import SimpleNamespace
        from .panel import provider_probe
        connection = {'base_url': 'https://example.com/v1', 'api_key': 'private-key', 'timeout_seconds': 30}
        for model, endpoint, result in [('gpt-6-luna', CHAT, {'choices': [{'message': {'content': 'OK'}}]}), ('text-embedding-3-small', EMBEDDINGS, {'data': [{'embedding': [0.1, 0.2]}]})]:
            with patch('core.panel.socket.getaddrinfo', return_value=[(2, 1, 6, '', ('93.184.216.34', 443))]), patch('core.panel.build_opener') as opener:
                opener.return_value.open.return_value.__enter__.return_value.read.return_value = json.dumps(result).encode()
                provider_probe(connection, SimpleNamespace(model=model, endpoint=endpoint))
                request = opener.return_value.open.call_args.args[0]
                self.assertEqual(request.full_url, connection['base_url'] + endpoint)
                self.assertEqual(request.get_header('Authorization'), 'Bearer private-key')
                payload = json.loads(request.data)
                self.assertEqual(payload['model'], model)
                self.assertNotIn('private-key', request.data.decode())
                self.assertIn('messages' if endpoint == CHAT else 'input', payload)

    def test_probe_blocks_private_hosts_and_redirects(self):
        from types import SimpleNamespace
        from .panel import provider_probe, NoRedirect
        with patch('core.panel.socket.getaddrinfo', return_value=[(2, 1, 6, '', ('127.0.0.1', 443))]), patch('core.panel.build_opener') as opener:
            with self.assertRaises(ValueError):
                provider_probe({'base_url': 'https://example.com', 'api_key': 'private-key', 'timeout_seconds': 30}, SimpleNamespace(model='gpt-6-luna', endpoint=CHAT))
            opener.assert_not_called()
        self.assertIsNone(NoRedirect().redirect_request(None, None, 302, '', {}, 'https://other.example'))

    def test_logout_preserves_the_browsers_address_identity(self):
        import uuid
        owner = str(uuid.uuid4())
        session = self.client.session
        session['address_owner'] = owner
        session.save()
        self.assertEqual(self.send('logout/').status_code, 200)
        self.assertEqual(self.client.session['address_owner'], owner)
        self.assertFalse(self.client.get('/api/panel/session/').json()['authenticated'])
