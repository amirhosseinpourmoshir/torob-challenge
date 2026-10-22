"""Price controls use the selected catalogue family, independent of budget filters."""
import math
from django.db.models import Min, Max, Count, Subquery, Aggregate, FloatField
from catalog.models import Product
from .search_policy import apply_search_intent


class Quartile(Aggregate):
    function = 'PERCENTILE_CONT'
    template = '%(function)s(%(fraction)s) WITHIN GROUP (ORDER BY %(expressions)s)'
    output_field = FloatField()

    def __init__(self, expression, fraction):
        super().__init__(expression, fraction=fraction)


def price_range(context, query=None):
    from .catalog_tools import eligible_offers
    query = query or context.get('shopping_query')
    if not query:
        return None
    products, predicate, original = apply_search_intent(Product.objects.all(), query)
    products = products.filter(predicate)
    preferences = {key: value for key, value in context.get('preferences', {}).items() if key not in ('min_price', 'max_price')}
    if original:
        preferences.setdefault('original_only', True)
    offers = eligible_offers({'preferences': preferences}).filter(product_id__in=Subquery(products.values('pk')), price_toman__gt=0, price_toman__lte=1000000000000)
    spread = offers.aggregate(q1=Quartile('price_toman', .25), q3=Quartile('price_toman', .75), count=Count('pk'))
    if spread['count'] >= 8:
        width = spread['q3'] - spread['q1']
        if width > 0:
            offers = offers.filter(price_toman__gte=max(1, spread['q1']-3*width), price_toman__lte=spread['q3']+3*width)
    stats = offers.aggregate(minimum=Min('price_toman'), maximum=Max('price_toman'), count=Count('pk'))
    if not stats['count']:
        return None
    low, high = int(stats['minimum']), int(stats['maximum'])
    if high <= low:
        high = low + max(1000, round(low * .1))
    step = max(1000, 10 ** max(0, math.floor(math.log10(max(1, (high - low) / 100)))))
    return {'min': low, 'max': high, 'step': step, 'count': stats['count'], 'excluded_outliers': spread['count']-stats['count'], 'query': query}


def budget_props(context, fallback=None):
    observed = context.get('price_range')
    selected = context.get('preferences', {}).get('max_price')
    if observed:
        value = selected if selected is not None else min(observed['max'], observed['min'] + round((observed['max']-observed['min']) / 2 / observed['step']) * observed['step'])
        return {'min': min(observed['min'], value), 'max': max(observed['max'], value), 'step': observed['step'], 'value': value}
    props = dict(fallback or {'min': 0, 'max': 10000000, 'step': 100000, 'value': 3000000})
    if selected is not None:
        props.update(value=selected, min=min(props.get('min', 0), selected), max=max(props.get('max', selected + 1), selected + 1))
    return props
