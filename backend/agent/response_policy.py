"""Complete the shopping interaction using evidence, never invented chart data."""
import re


def interaction_blocks(answer, state):
    answer = dict(answer) if isinstance(answer, dict) else {}
    blocks = [dict(block) for block in answer.get('blocks', []) if isinstance(block, dict)] if isinstance(answer.get('blocks', []), list) else []
    text = answer.get('text', '') if isinstance(answer.get('text', ''), str) else ''
    preferences = state.get('context', {}).get('preferences', {})
    for block in blocks:
        if block.get('type') == 'clarification':
            block['presentation'] = 'popup'
            block.setdefault('allowOther', True)
    from .presentation import validator
    controls = {'clarification', 'budget', 'quick_replies', 'preferences'}
    kinds = {block.get('type') for block in blocks if block.get('type') in controls and not list(validator().iter_errors({'version': 1, 'id': 'control', 'type': block['type'], 'props': {key: value for key, value in block.items() if key != 'type'}}))}
    inquiry = bool(state.get('discovered_shops')) and bool(re.search(r'استعلام|تأیید.*قیمت', text))
    if ('؟' in text or '?' in text) and not kinds and not inquiry:
        if re.search(r'بودجه|تا چه قیمت|چقدر.*هزینه', text) and preferences.get('max_price') is None:
            blocks.insert(0, {'type': 'budget', 'min': 0, 'max': 100000000, 'step': 100000, 'value': 10000000})
        else:
            questions = re.findall(r'[^\n.!؟?]+[؟?]', text)
            if questions:
                choices = state.get('context', {}).get('catalog_categories', []) if re.search(r'دسته|نوع|کدوم', questions[-1]) else []
                blocks.insert(0, {'type': 'clarification', 'questionId': 'next-choice', 'question': questions[-1].strip()[:500], 'options': [{'id': f'category-{index}', 'label': label} for index, label in enumerate(choices[:6])], 'allowOther': True, 'presentation': 'popup'})
    return {**answer, 'blocks': blocks[:4]}
