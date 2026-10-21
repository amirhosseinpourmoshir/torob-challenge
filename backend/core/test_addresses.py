import json
from datetime import timedelta
from unittest.mock import patch
from urllib.error import URLError

from django.test import Client, TestCase
from django.utils import timezone
from .models import GeocodeGate, SavedAddress


DATA = {'label': 'خانه', 'full_address': 'تهران، خیابان ولیعصر، کوچه بهار', 'plaque': '۱۲', 'unit': '۳', 'latitude': 35.71, 'longitude': 51.41}


class AddressTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        self.token = self.client.get('/api/addresses/').json()['csrf_token']

    def create(self, data=None):
        return self.client.post('/api/addresses/', json.dumps(data or DATA), content_type='application/json', HTTP_X_CSRFTOKEN=self.token)

    def test_persistence_and_owner_isolation(self):
        response = self.create()
        self.assertEqual(response.status_code, 201)
        address_id = response.json()['address']['id']
        self.assertEqual(self.client.get('/api/addresses/').json()['addresses'][0]['label'], 'خانه')
        other = Client(enforce_csrf_checks=True)
        token = other.get('/api/addresses/').json()['csrf_token']
        self.assertEqual(other.get('/api/addresses/').json()['addresses'], [])
        for method, suffix in [('patch', ''), ('delete', ''), ('post', 'activate/')]:
            response = getattr(other, method)(f'/api/addresses/{address_id}/{suffix}', json.dumps(DATA), content_type='application/json', HTTP_X_CSRFTOKEN=token)
            self.assertEqual(response.status_code, 404)

    def test_csrf_is_required(self):
        response = self.client.post('/api/addresses/', json.dumps(DATA), content_type='application/json')
        self.assertEqual(response.status_code, 403)

    def test_validation_rejects_outside_tehran_nan_and_missing_fields(self):
        for change in [{'latitude': 32.6}, {'latitude': float('nan')}, {'longitude': True}, {'plaque': ''}, {'label': ' '}, {'full_address': 'کوتاه'}]:
            with self.subTest(change=change):
                self.assertEqual(self.create(DATA | change).status_code, 400)
        self.assertEqual(SavedAddress.objects.count(), 0)

    def test_edit_activate_delete_and_default_replacement(self):
        first = self.create().json()['address']
        second = self.create(DATA | {'label': 'محل کار'}).json()['address']
        self.assertEqual(SavedAddress.objects.filter(is_active=True).count(), 1)
        response = self.client.patch(f"/api/addresses/{first['id']}/", json.dumps(DATA | {'plaque': '۴۵'}), content_type='application/json', HTTP_X_CSRFTOKEN=self.token)
        self.assertEqual(response.json()['address']['plaque'], '۴۵')
        self.client.post(f"/api/addresses/{first['id']}/activate/", HTTP_X_CSRFTOKEN=self.token)
        self.assertTrue(SavedAddress.objects.get(pk=first['id']).is_active)
        self.assertFalse(SavedAddress.objects.get(pk=second['id']).is_active)
        self.assertEqual(SavedAddress.objects.filter(is_active=True).count(), 1)
        self.client.delete(f"/api/addresses/{first['id']}/", HTTP_X_CSRFTOKEN=self.token)
        self.assertTrue(SavedAddress.objects.get(pk=second['id']).is_active)

    def test_maximum_ten_addresses(self):
        for i in range(10):
            self.assertEqual(self.create(DATA | {'label': f'خانه {i}'}).status_code, 201)
        self.assertEqual(self.create().status_code, 400)

    @patch('core.addresses.fetch_reverse', return_value={'address': 'تهران، خیابان ولیعصر', 'found': True, 'source': 'photon'})
    def test_reverse_cache_and_rate_limit(self, fetch):
        url = '/api/locations/reverse/?lat=35.71&lon=51.41'
        self.assertEqual(self.client.get(url).status_code, 200)
        self.assertEqual(self.client.get(url).status_code, 200)
        self.assertEqual(fetch.call_count, 1)
        self.assertEqual(self.client.get('/api/locations/reverse/?lat=35.72&lon=51.42').status_code, 429)
        self.assertEqual(self.client.get('/api/locations/reverse/?lat=0&lon=0').status_code, 400)

    @patch('core.addresses.fetch_reverse', side_effect=URLError('offline'))
    def test_reverse_outage_allows_manual_save(self, fetch):
        self.assertEqual(self.client.get('/api/locations/reverse/?lat=35.71&lon=51.41').status_code, 503)
        self.assertEqual(self.create().status_code, 201)

    @patch('core.addresses.urlopen')
    def test_photon_persian_format_does_not_send_building_details(self, urlopen):
        from .addresses import fetch_reverse
        import io
        urlopen.return_value.__enter__.return_value = io.BytesIO(json.dumps({'features': [{'properties': {'city': 'تهران', 'street': 'خیابان ولیعصر', 'name': 'English POI'}}]}).encode())
        result = fetch_reverse(35.71, 51.41)
        self.assertEqual(result['address'], 'تهران، خیابان ولیعصر')
        self.assertIn('lat=35.71', urlopen.call_args.args[0].full_url)
        self.assertNotIn('plaque', urlopen.call_args.args[0].full_url)
