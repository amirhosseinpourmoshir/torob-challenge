"""Known card actions use validated catalogue tools without a model round trip."""
import json
from .tools import execute_tool, collect_evidence, TOOL_LABELS


def prepare_action(state, action, notify):
    event, payload = action.get('type'), action.get('payload', {})
    product_id = payload.get('productId')
    if event == 'find_sellers' and product_id:
        name, arguments = 'find_sellers', {'product_id': product_id}
    elif event in ('view_product', 'select_product', 'view_offer') and product_id:
        name, arguments = 'product_details', {'product_id': product_id}
    elif event == 'request_shop_contact' and payload.get('shopId'):
        name, arguments = 'prepare_contact', {'shop_id': payload['shopId'], 'questions': payload.get('questions', [])}
    else:
        return False
    notify(name, TOOL_LABELS[name], 'running')
    result = execute_tool(name, arguments, state['context'])
    if result.get('error'):
        answer = {'text': result['error'], 'blocks': []}
    else:
        state['evidence'] = collect_evidence(state.get('evidence', {}), result)
        if name == 'find_sellers':
            ids = [row['id'] for row in result.get('shops', [])]
            state['discovered_shops'] = ids
            text = 'این فروشگاه‌ها رو برای انتخابت پیدا کردم؛ قیمت‌ها رو کنار هم ببین و قبل از رفتن موجودی رو بپرس.' if ids else 'با انتخاب‌های فعلی فروشگاهی پیدا نکردم؛ می‌تونیم بودجه یا گزینه‌های دیگه رو بررسی کنیم.'
            answer = {'text': text, 'blocks': [{'type': 'offers', 'shop_ids': ids}] if ids else [], 'map_shop_ids': ids}
        elif name == 'product_details':
            state['discovered_products'] = [row['id'] for row in result.get('products', [])]
            answer = {'text': 'این هم جزئیات انتخابت؛ از دکمهٔ فروشگاه‌ها می‌تونی ببینی کجا پیداش می‌کنی.', 'blocks': [{'type': 'product', 'product_id': product_id}]}
        else:
            answer = {'text': 'متن استعلام آماده‌ست؛ می‌تونی کپی‌اش کنی و از راه رسمی فروشگاه بفرستی.', 'blocks': [{'type': 'contact', 'shop_id': payload['shopId']}]}
    notify(name, TOOL_LABELS[name], 'done')
    state['answer'] = answer
    state['messages'].append({'role': 'assistant', 'content': json.dumps(answer, ensure_ascii=False)})
    return True
