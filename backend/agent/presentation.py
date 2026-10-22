import json
from functools import lru_cache
from pathlib import Path
from jsonschema import Draft202012Validator


@lru_cache(maxsize=1)
def validator():
    return Draft202012Validator(json.loads((Path(__file__).parent / 'widget-schema.json').read_text(encoding='utf-8')))


def clean(row):
    return {key: value for key, value in row.items() if not key.startswith('_')}


def render_response(answer, state, turn_id):
    evidence = state.get('evidence', {})
    products, shops = evidence.get('products', {}), evidence.get('shops', {})
    if state.get('context', {}).get('preferences', {}).get('original_only'):
        products = {key: row for key, row in products.items() if row.get('_quality', {}).get('kind', 'unverified') == 'unverified'}
    widgets = []
    blocks = answer.get('blocks', []) if isinstance(answer, dict) else []
    if not isinstance(blocks, list):
        blocks = []
    generic = {'clarification', 'budget', 'preferences', 'quick_replies', 'calendar', 'clock', 'visit', 'checklist', 'empty'}
    for block in blocks[:4]:
        if not isinstance(block, dict):
            continue
        kind = block.get('type')
        props = None
        product = products.get(block.get('product_id')) if isinstance(block.get('product_id'), str) else None
        product_ids = block.get('product_ids', [])
        selected_products = [products[id] for id in product_ids[:4] if isinstance(id, str) and id in products] if isinstance(product_ids, list) else []
        shop = shops.get(block.get('shop_id')) if isinstance(block.get('shop_id'), str) else None
        shop_ids = block.get('shop_ids', [])
        selected_shops = [shops[id] for id in shop_ids[:8] if isinstance(id, str) and id in shops] if isinstance(shop_ids, list) else []
        if kind == 'product_list' and selected_products:
            props = {'products': [clean(p) for p in selected_products[:3]]}
        elif kind == 'product' and product:
            props = {'product': clean(product)}
        elif kind == 'recommendation' and product:
            reasons = [s[:300] for s in block.get('reasons', [])[:4] if isinstance(s, str)] if isinstance(block.get('reasons', []), list) else []
            props = {'product': clean(product), 'reasons': reasons}
        elif kind == 'comparison' and len(selected_products) >= 2:
            keys = list(dict.fromkeys(key for product in selected_products for key in product.get('specs', {})))[:8]
            props = {'products': [clean(p) for p in selected_products], 'features': [{'key': key, 'label': key} for key in keys]}
        elif kind in ('seller', 'offers', 'price_comparison'):
            if kind == 'seller' and shop:
                props = {'seller': clean(shop)}
            elif selected_shops:
                props = {'offers': [clean(s) for s in selected_shops]}
        elif kind == 'gallery' and product:
            props = {'title': product['title'], 'images': [{'src': src, 'alt': product['title']} for src in product.get('_images', [])[:12]]}
        elif kind == 'contact' and shop:
            draft = evidence.get('contacts', {}).get(shop['id'])
            if draft:
                props = draft
        elif kind == 'alternative' and product:
            props = {'product': clean(product), 'reason': str(block.get('reason', 'این انتخاب رو هم می‌تونیم بررسی کنیم.'))[:500]}
        elif kind == 'itinerary' and selected_shops:
            props = {'stops': [{'id': s['id'], 'name': s['name'], 'address': s.get('address', '')} for s in selected_shops]}
        elif kind == 'price_history':
            kind, props = 'empty', {'title': 'هنوز سابقهٔ کافی برای نمودار نداریم', 'description': 'فعلاً می‌تونیم قیمت فروشگاه‌های مختلف رو کنار هم ببینیم.'}
        elif kind in generic:
            props = {key: value for key, value in block.items() if key != 'type'}
        if props is None:
            continue
        widget = {'version': 1, 'id': f'{turn_id}-{len(widgets)}', 'type': kind, 'props': props}
        if not list(validator().iter_errors(widget)):
            widgets.append(widget)
    if not widgets and state.get('discovered_products'):
        found = [clean(products[id]) for id in state['discovered_products'][:3] if id in products]
        if found:
            widgets.append({'version': 1, 'id': f'{turn_id}-auto', 'type': 'product_list', 'props': {'products': found}})
    if not widgets and state.get('discovered_shops'):
        found = [clean(shops[id]) for id in state['discovered_shops'][:6] if id in shops]
        if found:
            widgets.append({'version': 1, 'id': f'{turn_id}-auto', 'type': 'offers', 'props': {'offers': found}})
    text = answer.get('text', '') if isinstance(answer, dict) else ''
    if not isinstance(text, str) or not text.strip():
        text = 'این انتخاب‌ها رو ببین؛ کدوم به چیزی که توی ذهنته نزدیک‌تره؟' if widgets else 'یه کم بیشتر راهنماییم می‌کنی؟ چه چیزی می‌خوای بخری و حدود بودجه‌ات چقدره؟'
    maps = answer.get('map_shop_ids', []) if isinstance(answer, dict) else []
    if not isinstance(maps, list):
        maps = []
    map_rows = [shops[id] for id in maps[:8] if isinstance(id, str) and id in shops]
    if not map_rows:
        map_rows = [shops[id] for id in state.get('discovered_shops', [])[:6] if id in shops]
    return {'text': text[:5000], 'widgets': widgets, 'map_shops': [{'id': s['id'], 'name': s['name'], 'address': s.get('address', ''), 'coordinates': s['_coordinates'], 'category': s.get('_map_category', 'other'), 'type': s.get('_map_type', 'فروشگاه'), 'distance_m': s.get('distanceMeters'), 'name_is_synthetic': s.get('_name_is_synthetic', True)} for s in map_rows if s.get('_coordinates')]}
