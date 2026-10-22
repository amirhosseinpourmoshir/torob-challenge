import json
import uuid
from io import BytesIO
from datetime import timedelta
from unittest.mock import patch
from django.test import TestCase, SimpleTestCase, Client
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils import timezone
from catalog.models import DatasetImport, Category, Product, Shop, Offer, PaymentOption, ShopContact
from .catalog_tools import search_products, find_sellers, prepare_contact, time_context
from .tools import execute_tool
from .models import Conversation, AgentTurn, LocalizedTerm
from .presentation import render_response, validator
from .worker import execute_turn, claim


class AgentCatalogTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        dataset = DatasetImport.objects.create()
        category = Category.objects.create(name='هدفون، هدست و هندزفری')
        accessory = Category.objects.create(name='کیف و کاور هدفون و هندزفری')
        cls.product = Product.objects.create(id='p-main', persian_title='هدفون برای موسیقی', category=category, specs=[{'key': 'Battery Life', 'value': '35h'}], image_urls=['https://example.com/image.png'], search_text='هدفون برای موسیقی', source_data={}, dataset_import=dataset)
        Product.objects.create(id='p-case', persian_title='کاور هدفون', category=accessory, specs=[], search_text='کاور هدفون', source_data={}, dataset_import=dataset)
        for i in range(4):
            shop = Shop.objects.create(id=f's-{i}', name=f'فروشگاه {i}', address='تهران، پاساژ، طبقه دوم، واحد ۲۱۴', location_label='ولیعصر', latitude=35.70 + i * .001, longitude=51.40, search_text='فروشگاه هدفون ولیعصر', source_data={}, dataset_import=dataset, instagram={'profile_url': 'https://www.instagram.com/store/'} if i == 1 else None)
            Offer.objects.create(id=f'o-{i}', product=cls.product, shop=shop, seller_title='هدفون', price_toman=[100, 300, 200, 250][i], source_data={}, dataset_import=dataset)
        Offer.objects.create(id='case-offer', product_id='p-case', shop_id='s-0', seller_title='کاور', price_toman=10, source_data={}, dataset_import=dataset)
        # A cheap unknown-channel option must never qualify as in-person credit.
        PaymentOption.objects.create(shop_id='s-0', position=0, provider_name='الف', channel='unknown', source_data={})
        PaymentOption.objects.create(shop_id='s-1', position=0, provider_name='الف', channel='in_person', min_price_toman=250, max_price_toman=400, category_names=[category.pk], source_data={})
        PaymentOption.objects.create(shop_id='s-2', position=0, provider_name='الف', channel='in_person', min_price_toman=250, source_data={})
        PaymentOption.objects.create(shop_id='s-3', position=0, provider_name='الف', channel='in_person', category_names=['نامرتبط'], source_data={})

    def setUp(self):
        cache.clear()
        self.context = {'origin': {'latitude': 35.70, 'longitude': 51.40}, 'preferences': {}}

    def test_primary_product_search_excludes_accessory_and_preserves_nulls(self):
        result = search_products(self.context, 'هدفون', max_price=350)
        self.assertEqual([row['id'] for row in result['products']], ['p-main'])
        self.assertEqual(result['products'][0]['price'], 100)
        self.assertIn('عمر باتری', result['products'][0]['specs'])
        self.assertEqual(search_products(self.context, 'کاور هدفون')['products'][0]['id'], 'p-case')

    def test_credit_requires_same_option_price_category_and_in_person_channel(self):
        result = find_sellers(self.context, 'p-main', credit_only=True, provider='الف')
        self.assertEqual([row['id'] for row in result['shops']], ['s-1'])
        self.assertEqual(search_products(self.context, 'هدفون', credit_only=True)['products'][0]['price'], 300)
        self.assertEqual(find_sellers(self.context, 'p-main', credit_only=True, max_price=250)['shops'], [])
        self.assertEqual(find_sellers(self.context, 'p-main', credit_only=True, provider='ب')['shops'], [])
        badges = {row['id']: row['credit'] for row in find_sellers(self.context, 'p-main')['shops']}
        self.assertEqual(badges, {'s-0': False, 's-1': True, 's-2': False, 's-3': False})

    def test_locations_are_authoritative_and_no_fake_travel_time(self):
        result = find_sellers(self.context, 'p-main', sort='distance')
        self.assertEqual(result['shops'][0]['id'], 's-0')
        self.assertLessEqual(result['shops'][0]['distanceMeters'], 1)
        self.assertEqual(result['distance_kind'], 'straight_line')
        self.assertNotIn('durationMinutes', result['shops'][0])
        self.assertTrue(find_sellers({'preferences': {}}, 'p-main', sort='distance')['needs_location'])

    def test_contacts_are_drafts_and_fake_phone_numbers_do_not_leave_backend(self):
        ShopContact.objects.create(shop_id='s-1', position=0, channel='phone', details={'number': 'fake-number'}, is_synthetic=True, is_publishable=False)
        result = prepare_contact(self.context, 's-1', ['قیمت امروز چقدره؟'])
        self.assertFalse(result['can_send_automatically'])
        self.assertEqual(result['status'], 'draft_only')
        self.assertIn('instagramUrl', result['contact'])
        self.assertNotIn('fake-number', json.dumps(result))

    def test_tool_allowlist_arguments_and_skill_path_are_bounded(self):
        self.assertIn('error', execute_tool('sql', {'query': 'DROP'}, self.context))
        self.assertIn('error', execute_tool('search_products', {'query': 'هدفون', 'limit': 100000}, self.context))
        self.assertIn('error', execute_tool('load_skill', {'name': '../../.env'}, self.context))
        self.assertIn('guide', execute_tool('load_skill', {'name': 'credit'}, self.context))

    def test_presenter_rehydrates_prices_and_rejects_invented_ids_and_widgets(self):
        product = search_products(self.context, 'هدفون')['products'][0]
        state = {'evidence': {'products': {'p-main': product}, 'shops': {}}, 'discovered_products': []}
        result = render_response({'text': 'ببین', 'blocks': [{'type': 'product', 'product_id': 'p-main', 'price': 1}, {'type': 'product', 'product_id': 'imaginary'}, {'type': 'fit_score', 'scores': [100]}]}, state, 'turn')
        self.assertEqual(len(result['widgets']), 1)
        self.assertEqual(result['widgets'][0]['props']['product']['price'], 100)
        self.assertFalse(list(validator().iter_errors(result['widgets'][0])))

    def test_graph_tool_loop_and_durable_turn_state_without_external_calls(self):
        conversation = Conversation.objects.create(owner_key=uuid.uuid4())
        turn = AgentTurn.objects.create(conversation=conversation, request_id=uuid.uuid4(), text='هدفون می‌خوام', context=self.context, status='running')
        replies = [
            {'message': {'role': 'assistant', 'tool_calls': [{'id': 'call-1', 'type': 'function', 'function': {'name': 'search_products', 'arguments': '{"query":"هدفون"}'}}]}, 'model': 'gpt-6-luna', 'usage': {'total_tokens': 10}},
            {'message': {'role': 'assistant', 'content': json.dumps({'text': 'این انتخاب رو ببین.', 'blocks': [{'type': 'product_list', 'product_ids': ['p-main']} ]})}, 'model': 'gpt-6-luna', 'usage': {'total_tokens': 20}},
        ]
        with patch('agent.graph.chat', side_effect=replies) as provider:
            execute_turn(turn)
        turn.refresh_from_db(); conversation.refresh_from_db()
        self.assertEqual(turn.status, 'done')
        self.assertEqual(turn.usage['total_tokens'], 30)
        self.assertEqual(provider.call_count, 2)
        self.assertEqual(turn.response['widgets'][0]['props']['products'][0]['id'], 'p-main')
        self.assertIn('p-main', conversation.state['evidence']['products'])
        self.assertEqual(turn.checkpoint, {})

    def test_product_card_actions_use_catalogue_without_a_model_request(self):
        product = search_products(self.context, 'هدفون')['products'][0]
        conversation = Conversation.objects.create(owner_key=uuid.uuid4(), state={'evidence': {'products': {'p-main': product}, 'shops': {}}, 'preferences': {}})
        turn = AgentTurn.objects.create(conversation=conversation, request_id=uuid.uuid4(), text='فروشگاه‌های انتخابم', action={'type': 'find_sellers', 'payload': {'productId': 'p-main'}}, context=self.context, status='running')
        with patch('agent.graph.chat', side_effect=AssertionError('card selection must not call the model')):
            execute_turn(turn)
        turn.refresh_from_db()
        self.assertEqual(turn.status, 'done')
        self.assertEqual(turn.response['widgets'][0]['type'], 'offers')
        self.assertEqual(len(turn.response['widgets'][0]['props']['offers']), 4)
        self.assertEqual(turn.usage, {})

    def test_saved_products_are_private_idempotent_and_survive_clearing_chat(self):
        client = Client(enforce_csrf_checks=True)
        initial = client.get('/api/agent/saved-products/').json()
        payload = json.dumps({'product_id': 'p-main', 'saved': True})
        self.assertEqual(client.post('/api/agent/saved-products/', data=payload, content_type='application/json').status_code, 403)
        for _ in range(2):
            response = client.post('/api/agent/saved-products/', data=payload, content_type='application/json', HTTP_X_CSRFTOKEN=initial['csrf_token'])
            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(response.json()['products']), 1)
        self.assertEqual(Client().get('/api/agent/saved-products/').json()['products'], [])
        conversation = client.get('/api/agent/conversations/').json()
        response = client.delete(f"/api/agent/conversations/{conversation['id']}/", HTTP_X_CSRFTOKEN=conversation['csrf_token'])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(client.get('/api/agent/saved-products/').json()['products']), 1)
        response = client.post('/api/agent/saved-products/', data=json.dumps({'product_id': 'p-main', 'saved': False}), content_type='application/json', HTTP_X_CSRFTOKEN=initial['csrf_token'])
        self.assertEqual(response.json()['products'], [])

    def test_product_sheet_has_complete_specs_and_only_same_category_similar_choices(self):
        product = self.product
        product.specs = [{'key': f'ویژگی {index}', 'value': f'مقدار {index}', 'section': 'مشخصات فنی'} for index in range(55)]
        product.save()
        peer = Product.objects.create(id='p-peer', persian_title='هدفون مشابه', category=product.category, search_text='هدفون مشابه', source_data={}, dataset_import=product.dataset_import)
        Offer.objects.create(id='o-peer', product=peer, shop_id='s-0', price_toman=120, source_data={}, dataset_import=product.dataset_import)
        response = self.client.get('/api/agent/products/p-main/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data['specifications']), 55)
        self.assertEqual([row['id'] for row in data['similar']], ['p-peer'])
        self.assertEqual(len(data['map_shops']), 4)
        self.assertNotIn('_coordinates', data['offers'][0])

    def test_product_sheet_keeps_current_conversation_credit_constraints(self):
        initial = self.client.get('/api/agent/conversations/').json()
        conversation = Conversation.objects.get(pk=initial['id'])
        conversation.state = {'preferences': {'credit_only': True, 'provider': 'الف'}}
        conversation.save()
        data = self.client.get('/api/agent/products/p-main/').json()
        self.assertEqual([row['id'] for row in data['offers']], ['s-1'])
        self.assertEqual(data['product']['price'], 300)
        self.assertTrue(data['criteria']['credit_only'])

    def test_recovery_resumes_completed_model_step_without_paying_for_it_again(self):
        conversation = Conversation.objects.create(owner_key=uuid.uuid4())
        state = {'messages': [], 'context': self.context, 'evidence': {}, 'answer': {'text': 'نیازت رو بگو.', 'blocks': []}, 'pending': [], 'model': 'gpt-6-luna'}
        turn = AgentTurn.objects.create(conversation=conversation, request_id=uuid.uuid4(), text='سلام', context=self.context, checkpoint=state, status='running')
        with patch('agent.graph.chat', side_effect=AssertionError('must not call provider')):
            execute_turn(turn)
        turn.refresh_from_db()
        self.assertEqual(turn.status, 'done')

    def test_translation_cache_preserves_original_and_skips_prepared_terms(self):
        from .localization import normalize_catalog, translated_label
        first = normalize_catalog()
        count = LocalizedTerm.objects.count()
        normalize_catalog()
        self.assertEqual(LocalizedTerm.objects.count(), count)
        self.assertEqual(translated_label('Battery Life'), 'عمر باتری')
        self.product.refresh_from_db()
        self.assertEqual(self.product.specs[0]['key'], 'Battery Life')


class AgentApiTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        self.conversation = self.client.get('/api/agent/conversations/').json()
        self.headers = {'HTTP_X_CSRFTOKEN': self.conversation['csrf_token']}

    def post(self, data):
        return self.client.post(f"/api/agent/conversations/{self.conversation['id']}/turns/", data=json.dumps(data), content_type='application/json', **self.headers)

    def test_csrf_ownership_and_idempotency(self):
        request_id = str(uuid.uuid4())
        result = self.post({'request_id': request_id, 'text': 'سلام'})
        self.assertEqual(result.status_code, 202)
        self.assertEqual(self.post({'request_id': request_id, 'text': 'سلام'}).json()['id'], result.json()['id'])
        self.assertEqual(AgentTurn.objects.count(), 1)
        self.assertEqual(self.post({'request_id': str(uuid.uuid4()), 'text': 'بعدی'}).status_code, 409)
        other = Client()
        self.assertEqual(other.get(f"/api/agent/turns/{result.json()['id']}/").status_code, 404)
        self.assertEqual(self.client.post(f"/api/agent/conversations/{self.conversation['id']}/turns/", data='{}', content_type='application/json').status_code, 403)

    def test_foreign_widget_action_is_not_accepted(self):
        response = self.post({'request_id': str(uuid.uuid4()), 'action': {'type': 'set_budget', 'widgetId': 'foreign', 'payload': {'amount': 3000000}}})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(AgentTurn.objects.count(), 0)

    def test_clear_conversation_deletes_history_but_preserves_other_sessions(self):
        conversation = Conversation.objects.get(pk=self.conversation['id'])
        AgentTurn.objects.create(conversation=conversation, request_id=uuid.uuid4(), status='done', text='گفتگوی قبلی')
        path = f'/api/agent/conversations/{conversation.pk}/'
        self.assertEqual(Client().delete(path).status_code, 404)
        self.assertEqual(self.client.delete(path).status_code, 403)
        response = self.client.delete(path, **self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['turns'], [])
        self.assertNotEqual(response.json()['id'], str(conversation.pk))
        self.assertFalse(Conversation.objects.filter(pk=conversation.pk).exists())
        self.assertEqual(AgentTurn.objects.count(), 0)

    def test_action_is_returned_so_history_does_not_render_internal_request_text(self):
        conversation = Conversation.objects.get(pk=self.conversation['id'])
        action = {'type': 'find_sellers', 'widgetId': 'card', 'payload': {'productId': 'product_internal'}}
        AgentTurn.objects.create(conversation=conversation, request_id=uuid.uuid4(), status='done', action=action, text='internal product_internal')
        response = self.client.get('/api/agent/conversations/').json()
        self.assertEqual(response['turns'][0]['action'], action)

    def test_clearing_a_queued_turn_is_allowed_and_cannot_resurrect_the_chat(self):
        conversation = Conversation.objects.get(pk=self.conversation['id'])
        turn = AgentTurn.objects.create(conversation=conversation, request_id=uuid.uuid4(), text='در صف', context={'preferences': {}})
        response = self.client.delete(f'/api/agent/conversations/{conversation.pk}/', **self.headers)
        self.assertEqual(response.status_code, 200)
        with patch('agent.graph.chat', side_effect=AssertionError('cancelled turn must not call provider')):
            execute_turn(turn)
        self.assertFalse(Conversation.objects.filter(pk=conversation.pk).exists())
        self.assertFalse(AgentTurn.objects.filter(pk=turn.pk).exists())

    def test_knowledge_panel_requires_superuser_and_queues_only_one_job(self):
        self.assertEqual(self.client.get('/api/agent/knowledge/').status_code, 403)
        admin = get_user_model().objects.create_superuser('testadmin', password='strong-password-only-for-tests')
        self.client.force_login(admin)
        from django.middleware.csrf import get_token
        token = self.client.get('/api/panel/session/').json()['csrf_token']
        for expected in [200, 409]:
            response = self.client.post('/api/agent/knowledge/', data='{"mode":"normalize"}', content_type='application/json', HTTP_X_CSRFTOKEN=token)
            self.assertEqual(response.status_code, expected)

    def test_expired_lease_is_reclaimed_without_unbounded_retries(self):
        conversation = Conversation.objects.get(pk=self.conversation['id'])
        turn = AgentTurn.objects.create(conversation=conversation, request_id=uuid.uuid4(), text='سلام', status='running', lease_until=timezone.now() - timedelta(seconds=1))
        claimed = claim(AgentTurn)
        self.assertEqual(claimed.pk, turn.pk)
        self.assertEqual(claimed.attempts, 1)


class TimeTests(SimpleTestCase):
    def test_boxapi_reasoning_compatibility_keeps_model_and_endpoint(self):
        from urllib.error import HTTPError
        from unittest.mock import MagicMock
        from .provider import chat
        cache.clear()
        config = {'api_key': 'test-key', 'base_url': 'https://api.example.com/v1', 'model': 'gpt-6-luna', 'timeout_seconds': 10}
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'{"choices":[{"message":{"role":"assistant","content":"{}"}}]}'
        opener = MagicMock()
        opener.open.side_effect = [HTTPError(config['base_url'], 400, 'bad request', {}, BytesIO(b"Function tools with reasoning_effort not supported; set reasoning_effort to none")), response, response]
        with patch('agent.provider.socket.getaddrinfo', return_value=[(0, 0, 0, '', ('8.8.8.8', 443))]), patch('agent.provider.build_opener', return_value=opener):
            for _ in range(2):
                self.assertEqual(chat([], tools=[{'type': 'function'}], config=config)['model'], config['model'])
        requests = [call.args[0] for call in opener.open.call_args_list]
        self.assertTrue(all(request.full_url == 'https://api.example.com/v1/chat/completions' for request in requests))
        self.assertEqual(json.loads(requests[-1].data)['reasoning_effort'], 'none')

    def test_structured_answer_accepts_prose_and_fences_without_showing_json(self):
        from .provider import json_content
        answer = {'text': 'این گزینه‌ها رو ببین.', 'blocks': []}
        encoded = json.dumps(answer, ensure_ascii=False)
        for value in [encoded, '```json\n' + encoded + '\n```', 'چند پیشنهاد دارم:\n' + encoded]:
            self.assertEqual(json_content(value), answer)
        self.assertEqual(json_content('این گزینه‌ها رو ببین.\n{"blocks":[]}'), answer)
        with self.assertRaises(ValueError):
            json_content('متن بدون پاسخ ساخت‌یافته')

    def test_shamsi_time_is_tehran_not_host_timezone(self):
        from datetime import datetime, timezone as tz
        with patch('agent.catalog_tools.timezone.now', return_value=datetime(2026, 10, 21, 21, 0, tzinfo=tz.utc)):
            info = time_context()
        self.assertEqual(info['date_iso'], '2026-10-22')
        self.assertEqual(info['time'], '00:30')
        self.assertEqual(info['timezone'], 'Asia/Tehran')
        self.assertTrue(info['jalali_date'].startswith('1405/'))
