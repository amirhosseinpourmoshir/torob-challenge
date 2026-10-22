import copy
import json
import time
from typing import TypedDict
from django.conf import settings
from langgraph.graph import StateGraph, START, END
from .provider import chat, json_content, ProviderError
from .skills import base_prompt
from .tools import TOOL_SPECS, TOOL_LABELS, execute_tool, collect_evidence, FILTERS
from .presentation import render_response


class AgentState(TypedDict, total=False):
    messages: list
    context: dict
    evidence: dict
    pending: list
    rounds: int
    tool_count: int
    answer: dict
    response: dict
    usage: dict
    model: str
    discovered_products: list
    discovered_shops: list


def build_graph(turn_id, notify, provider=None):
    provider = provider or chat
    def reason(state):
        notify('model', 'دارم بهترین قدم بعدی رو انتخاب می‌کنم', 'running')
        last_round = state.get('rounds', 0) >= settings.AGENT_MAX_ROUNDS - 1 or state.get('tool_count', 0) >= settings.AGENT_MAX_TOOLS
        history = state.get('messages', [])
        system = base_prompt(state['context'])
        if last_round:
            system += '\nاکنون با دادهٔ موجود پاسخ نهایی JSON بده؛ ابزار دیگری اجرا نکن. اگر داده کافی نیست یک سؤال روشن بپرس.'
        result = provider([{'role': 'system', 'content': system}, *history], tools=None if last_round else TOOL_SPECS, max_tokens=settings.AGENT_OUTPUT_TOKENS)
        message = result['message']
        usage = dict(state.get('usage', {}))
        for key, value in result.get('usage', {}).items():
            if isinstance(value, (int, float)):
                usage[key] = usage.get(key, 0) + value
        pending = message.get('tool_calls', []) if not last_round else []
        if not isinstance(pending, list):
            pending = []
        if pending:
            normalized = {'role': 'assistant', 'content': message.get('content') if isinstance(message.get('content'), str) else None, 'tool_calls': pending[:settings.AGENT_MAX_TOOLS - state.get('tool_count', 0)]}
            return {'messages': [*history, normalized], 'pending': normalized['tool_calls'], 'rounds': state.get('rounds', 0) + 1, 'usage': usage, 'model': result['model'], 'answer': {}}
        content = message.get('content')
        try:
            answer = json_content(content)
        except (ValueError, TypeError):
            # Plain prose remains usable; malformed structured output is retriable.
            if isinstance(content, str) and not content.lstrip().startswith(('{', '```')):
                answer = {'text': content[:5000], 'blocks': []}
            else:
                raise ProviderError('پاسخ کامل نرسید؛ می‌تونیم دوباره امتحان کنیم.')
        return {'messages': [*history, {'role': 'assistant', 'content': json.dumps(answer, ensure_ascii=False)}], 'pending': [], 'answer': answer, 'rounds': state.get('rounds', 0) + 1, 'usage': usage, 'model': result['model']}

    def tools(state):
        history = list(state['messages'])
        context = copy.deepcopy(state['context'])
        evidence = copy.deepcopy(state.get('evidence', {}))
        products, shops = list(state.get('discovered_products', [])), list(state.get('discovered_shops', []))
        count = state.get('tool_count', 0)
        for call in state.get('pending', []):
            function = call.get('function', {})
            name = function.get('name', '')
            started = time.monotonic()
            notify(name, TOOL_LABELS.get(name, 'دارم این انتخاب رو بررسی می‌کنم'), 'running')
            try:
                args = json.loads(function.get('arguments', '{}'))
                if not isinstance(args, dict):
                    raise ValueError()
                old = copy.deepcopy(context.get('preferences', {}))
                # Search constraints persist across turns; never mix filtered and
                # unfiltered prices in subsequent cards.
                if name in ('search_products', 'find_sellers'):
                    from jsonschema import Draft202012Validator
                    from .tools import TOOL_DEFINITIONS
                    if not list(Draft202012Validator(TOOL_DEFINITIONS[name][1]).iter_errors(args)):
                        context.setdefault('preferences', {}).update({k: v for k, v in args.items() if k in FILTERS})
                result = execute_tool(name, args, context)
                if name in ('store_details', 'store_products') and not result.get('error'):
                    context['selected_shop_id'] = args.get('shop_id') or context.get('selected_shop_id')
                    context['catalog_categories'] = [row['product__category_id'] for row in result.get('catalog', {}).get('categories', []) if row.get('product__category_id')]
                elif name == 'nearby_shops' and len(result.get('shops', [])) == 1:
                    context['selected_shop_id'] = result['shops'][0]['id']
                if old != context.get('preferences', {}):
                    evidence = {}; products = []; shops = []
                if name in ('search_products', 'store_products') and not result.get('error'):
                    products = []
                    evidence['products'] = {}
                evidence = collect_evidence(evidence, result)
                products = list(dict.fromkeys([*products, *(p['id'] for p in result.get('products', []) if p.get('id'))]))[-20:]
                shops = list(dict.fromkeys([*shops, *(s['id'] for s in result.get('shops', []) if s.get('id'))]))[-20:]
            except (ValueError, TypeError, KeyError):
                result = {'error': 'پارامترهای ابزار کامل نبود؛ قالب ابزار را بررسی کن.'}
            count += 1
            notify(name, TOOL_LABELS.get(name, name), 'failed' if result.get('error') else 'done', duration_ms=round((time.monotonic() - started) * 1000))
            def bounded(value, depth=0):
                if isinstance(value, str):
                    return value[:4000 if name == 'load_skill' else 500]
                if isinstance(value, list):
                    return [bounded(v, depth + 1) for v in value[:8]]
                if isinstance(value, dict):
                    return {k: bounded(v, depth + 1) for k, v in list(value.items())[:16]}
                return value
            history.append({'role': 'tool', 'tool_call_id': call.get('id', f'tool-{count}'), 'content': json.dumps(bounded(result), ensure_ascii=False)})
        return {'messages': history, 'context': context, 'evidence': evidence, 'pending': [], 'tool_count': count, 'discovered_products': products, 'discovered_shops': shops}

    def render(state):
        notify('render', 'انتخاب‌ها آماده‌ان', 'done')
        return {'response': render_response(state.get('answer', {}), state, turn_id)}

    builder = StateGraph(AgentState)
    builder.add_node('reason', reason); builder.add_node('tools', tools); builder.add_node('render', render)
    builder.add_conditional_edges(START, lambda s: 'render' if s.get('answer') else 'tools' if s.get('pending') else 'reason')
    builder.add_conditional_edges('reason', lambda s: 'tools' if s.get('pending') else 'render')
    builder.add_edge('tools', 'reason'); builder.add_edge('render', END)
    return builder.compile()
