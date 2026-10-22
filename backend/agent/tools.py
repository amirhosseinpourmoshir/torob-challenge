import json
from jsonschema import Draft202012Validator
from catalog.models import Product, Shop, Category, PaymentOption
from catalog.normalization import normalize_search
from . import catalog_tools as catalog
from .skills import load_skill, SKILLS


def parameters(properties, required=()):
    return {'type': 'object', 'properties': properties, 'required': list(required), 'additionalProperties': False}


TEXT = {'type': 'string', 'maxLength': 160}
ID = {'type': 'string', 'minLength': 1, 'maxLength': 100}
LIMIT = {'type': 'integer', 'minimum': 1, 'maximum': 8}
PRICE = {'type': ['integer', 'null'], 'minimum': 0, 'maximum': 1_000_000_000_000}
FILTERS = {'max_price': PRICE, 'min_price': PRICE, 'credit_only': {'type': 'boolean'}, 'original_only': {'type': 'boolean'}, 'provider': TEXT}
TOOL_DEFINITIONS = {
    'load_skill': ('راهنمای تخصصی فروشندگی، دستهٔ کالا، تهران، اقساط، رابط یا بازیابی مسیر را بخوان.', parameters({'name': {'enum': list(SKILLS)}}, ['name'])),
    'get_context': ('زمان شمسی و ساعت تهران، آدرس فعال و محدودیت‌های همین گفتگو؛ بدون تغییر موقعیت کاربر.', parameters({})),
    'set_preferences': ('نیازهای صریح کاربر را در همین گفتگو نگه دار. بودجه عدد تومان است. شرط قسطی را بدون درخواست کاربر حذف نکن.', parameters(FILTERS)),
    'search_categories': ('دسته‌های واقعی کالا را برای رفع ابهام نام کالا پیدا کن.', parameters({'query': TEXT}, ['query'])),
    'search_products': ('محصولات واقعی با مشخصات و کمترین قیمت واجدشرایط؛ query فقط نام کوتاه کالا/مدل. برای درخواست اقساط credit_only=true.', parameters({'query': TEXT, 'limit': LIMIT, 'sort': {'enum': ['budget_fit', 'price']}, **FILTERS}, ['query'])),
    'product_details': ('مشخصات و تصاویر واقعی یک محصول مشخص را بخوان.', parameters({'product_id': ID}, ['product_id'])),
    'compare_products': ('مشخصات و قیمت واقعی دو تا چهار محصول مشخص را کنار هم بگذار.', parameters({'product_ids': {'type': 'array', 'items': ID, 'minItems': 2, 'maxItems': 4}}, ['product_ids'])),
    'find_sellers': ('فروشندگان ثبت‌شدهٔ همین محصول؛ فیلتر قیمت، خرید اعتباری حضوری، فاصله و ساعت ثبت‌شده. موجودی و ساعات زنده تأیید نمی‌شوند.', parameters({'product_id': ID, 'sort': {'enum': ['price', 'distance']}, 'radius_km': {'type': 'number', 'exclusiveMinimum': 0, 'maximum': 50}, 'limit': LIMIT, 'exclude_shop_ids': {'type': 'array', 'items': ID, 'maxItems': 10}, 'open_now': {'type': 'boolean'}, **FILTERS}, ['product_id'])),
    'nearby_shops': ('فروشگاه‌های نزدیک آدرس فعال با دسته یا محله؛ این ابزار موجودی محصول خاص را اثبات نمی‌کند.', parameters({'query': TEXT, 'neighborhood': TEXT, 'limit': LIMIT})),
    'store_details': ('نشانی دقیق/داخل پاساژ، ساعت ثبت‌شده، روش‌های پرداخت و لینک‌های رسمی فروشگاه.', parameters({'shop_id': ID}, ['shop_id'])),
    'store_products': ('محصولات، دسته‌ها و قیمت‌های فروش یک فروشگاه مشخص؛ برای «چیا میفروشه؟ افرهاش چیه؟» حتماً اجرا کن. بدون shop_id فروشگاه انتخابی فعلی استفاده می‌شود. query و category برای محدودکردن، offset برای ادامه.', parameters({'shop_id': ID, 'query': TEXT, 'category': TEXT, 'limit': LIMIT, 'offset': {'type': 'integer', 'minimum': 0, 'maximum': 1000}})),
    'price_context': ('قیمت‌های مرجع تاریخ‌دار مدل‌های پوشش‌داده‌شده برای بررسی اختلاف شدید قیمت؛ منبع، مدل و تاریخ را ذکر کن، از قیمت حافظه‌ای یا حکم قطعی فیک بودن استفاده نکن.', parameters({'query': TEXT}, ['query'])),
    'get_price_range': ('پیش از کنترل بودجه، بازه قیمت واقعی همین دسته یا مدل را از کاتالوگ بخوان؛ فیلتر بودجه قبلی در محاسبه اعمال نمی‌شود.', parameters({'query': TEXT}, ['query'])),
    'neighborhood_info': ('محله‌ها و مرکز تراکم فروشگاه‌های موجود در دیتاست تهران را پیدا کن؛ اطلاعات جغرافیایی دلخواه نساز.', parameters({'query': TEXT})),
    'payment_providers': ('نام ارائه‌دهنده‌ها و تعداد روش‌های حضوری واقعی را ببین.', parameters({})),
    'prepare_contact': ('فقط متن استعلام و لینک رسمی فروشگاه را آماده کن. هیچ تماس یا دایرکتی ارسال نمی‌شود.', parameters({'shop_id': ID, 'questions': {'type': 'array', 'items': {'type': 'string', 'maxLength': 300}, 'maxItems': 6}}, ['shop_id'])),
    'price_history': ('بررسی وجود تاریخچهٔ قیمت؛ دادهٔ جاری را تاریخچه وانمود نکن.', parameters({'product_id': ID}, ['product_id'])),
}
TOOL_SPECS = [{'type': 'function', 'function': {'name': name, 'description': description, 'parameters': schema}} for name, (description, schema) in TOOL_DEFINITIONS.items()]
TOOL_LABELS = {'load_skill': 'دارم راهنمای انتخاب رو بررسی می‌کنم', 'get_context': 'شرایط خریدت رو بررسی می‌کنم', 'set_preferences': 'انتخاب‌هات رو نگه می‌دارم', 'search_categories': 'دستهٔ مناسب رو پیدا می‌کنم', 'search_products': 'دارم مدل‌های مناسب رو پیدا می‌کنم', 'product_details': 'جزئیات این مدل رو می‌خونم', 'compare_products': 'تفاوت مدل‌ها رو کنار هم می‌ذارم', 'find_sellers': 'فروشگاه‌های این محصول رو بررسی می‌کنم', 'nearby_shops': 'دارم اطرافت رو می‌گردم', 'store_details': 'نشانی و شرایط فروشگاه رو بررسی می‌کنم', 'neighborhood_info': 'این محله رو در داده‌ها بررسی می‌کنم', 'payment_providers': 'روش‌های خرید اعتباری رو بررسی می‌کنم', 'prepare_contact': 'متن استعلام رو آماده می‌کنم', 'price_history': 'داده‌های قیمت رو بررسی می‌کنم'}


TOOL_LABELS.update(store_products='دارم ویترین این فروشگاه رو می‌بینم', price_context='قیمت و نشانه‌های اصالت رو بررسی می‌کنم', get_price_range='بازهٔ قیمت همین کالاها رو پیدا می‌کنم')

def execute_tool(name, arguments, context):
    if name not in TOOL_DEFINITIONS:
        return {'error': 'این ابزار در دسترس نیست.'}
    schema = TOOL_DEFINITIONS[name][1]
    if list(Draft202012Validator(schema).iter_errors(arguments)):
        return {'error': 'ورودی ابزار معتبر نیست؛ از قالب اعلام‌شده استفاده کن.'}
    try:
        if name == 'load_skill':
            return {'skill': arguments['name'], 'guide': load_skill(arguments['name'])}
        if name == 'get_context':
            return {**context, 'time': catalog.time_context()}
        if name == 'set_preferences':
            preferences = context.setdefault('preferences', {})
            preferences.update(arguments)
            if preferences.get('max_price') is not None and preferences.get('min_price') is not None and preferences['max_price'] < preferences['min_price']:
                preferences.pop('min_price', None)
            return {'preferences': preferences}
        if name == 'search_categories':
            query = normalize_search(arguments['query'])
            return {'categories': list(Category.objects.filter(name__icontains=query).values_list('name', flat=True)[:12])}
        if name == 'search_products':
            from .budget import price_range
            if context.get('shopping_query') != arguments['query'] or not context.get('price_range'):
                context['shopping_query'] = arguments['query']
                context['price_range'] = price_range(context, arguments['query'])
            return catalog.search_products(context, **arguments)
        if name == 'get_price_range':
            from .budget import price_range
            context['shopping_query'] = arguments['query']
            context['price_range'] = price_range(context, arguments['query'])
            return {'price_range': context['price_range'], 'preferences': context.get('preferences', {}), 'note': 'اگر بازه پیدا نشد نام دسته یا مدل را روشن کن؛ عدد دلخواه به‌جای بازه بازار نگذار.'}
        if name == 'product_details':
            return catalog.product_details(context, **arguments)
        if name == 'compare_products':
            rows = []
            for product_id in arguments['product_ids']:
                rows.extend(catalog.product_details(context, product_id)['products'])
            return {'products': rows}
        if name == 'find_sellers':
            return catalog.find_sellers(context, **arguments)
        if name == 'nearby_shops':
            return catalog.nearby_shops(context, **arguments)
        if name == 'store_details':
            return catalog.store_details(context, **arguments)
        if name == 'store_products':
            return catalog.store_products(context, **arguments)
        if name == 'price_context':
            return catalog.price_context(**arguments)
        if name == 'neighborhood_info':
            return catalog.neighborhood_info(**arguments)
        if name == 'payment_providers':
            from django.db.models import Count
            return {'providers': list(PaymentOption.objects.filter(channel='in_person').values('provider_name').annotate(shops=Count('shop_id', distinct=True)).order_by('-shops')[:15]), 'unknown_channel_is_not_in_person': True}
        if name == 'prepare_contact':
            return catalog.prepare_contact(context, **arguments)
        if name == 'price_history':
            Product.objects.only('pk').get(pk=arguments['product_id'])
            return {'product_id': arguments['product_id'], 'history': [], 'available': False, 'note': 'دیتاست قیمت و زمان آخرین تغییر دارد؛ سری زمانی تاریخچه در اختیار نیست. نمودار تاریخی نساز.'}
    except (ValueError, TypeError, Product.DoesNotExist, Shop.DoesNotExist):
        return {'error': 'این گزینه یا ورودی در داده‌ها پیدا نشد؛ شناسهٔ معتبر ابزار را استفاده کن.'}
    return {'error': 'این ابزار در دسترس نیست.'}


def collect_evidence(evidence, result):
    evidence.setdefault('products', {})
    evidence.setdefault('shops', {})
    evidence.setdefault('contacts', {})
    for kind in ('products', 'shops'):
        for row in result.get(kind, [])[:8]:
            if isinstance(row, dict) and row.get('id'):
                old = evidence[kind].get(row['id'], {})
                # A details read without a price must not erase a known offer price.
                if row.get('price') is None and old.get('price') is not None and (kind == 'products' or row.get('productId') and row.get('productId') == old.get('productId')):
                    row = {**row, 'price': old['price']}
                    if kind == 'shops':
                        row['credit'] = old.get('credit', False)
                evidence[kind][row['id']] = row
        while len(evidence[kind]) > 40:
            evidence[kind].pop(next(iter(evidence[kind])))
    if result.get('contact'):
        evidence['contacts'][result['contact']['shopId']] = result['contact']
    return evidence
