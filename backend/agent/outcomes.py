"""Grounded completion for successful tools and interrupted provider calls."""
def found_answer(state, interrupted=False):
    import re
    evidence = state.get('evidence', {})
    products = evidence.get('products', {})
    original_only = state.get('context', {}).get('preferences', {}).get('original_only')
    user_text = next((row.get('content', '') for row in reversed(state.get('messages', [])) if row.get('role') == 'user'), '')
    ids = [id for id in state.get('discovered_products', []) if id in products and (not original_only or products[id].get('_quality', {}).get('kind') not in ('replica_declared', 'price_outlier', 'conditions_unclear'))]
    shops = [id for id in state.get('discovered_shops', []) if id in evidence.get('shops', {})]
    if shops and state.get('context', {}).get('result_kind') == 'store_details' and re.search(r'ساعت|آدرس|نشانی|کجاست|اینستا|وب.?سایت', user_text):
        shop = evidence['shops'][shops[0]]
        blocks = [{'type': 'seller', 'shop_id': shop['id']}]
        if re.search(r'برم|مراجعه|بازدید|برنامه', user_text):
            from datetime import timedelta
            from django.utils import timezone
            day = timezone.localdate() + timedelta(days=1 if 'فردا' in user_text else 0)
            blocks.extend([{'type': 'calendar', 'selectedDate': day.isoformat(), 'minDate': timezone.localdate().isoformat()}, {'type': 'clock', 'label': 'الان به وقت تهران'}])
        return {'text': f"این هم اطلاعات ثبت‌شدهٔ {shop['name']}؛ ساعت کاری رو پیش از رفتن تأیید کن.", 'blocks': blocks, 'map_shop_ids': [shop['id']]}
    if state.get('context', {}).get('result_kind') == 'prepare_contact' and evidence.get('contacts'):
        id = next(iter(evidence['contacts']))
        return {'text': 'متن استعلام آماده‌ست؛ می‌تونی از راه رسمی فروشگاه بفرستیش.', 'blocks': [{'type': 'contact', 'shop_id': id}]}
    if ids:
        if re.search(r'تصویر|عکس|گالری', user_text) and state.get('context', {}).get('result_kind') == 'product_details':
            return {'text': 'این تصویرهای ثبت‌شدهٔ همین محصول‌اند.', 'blocks': [{'type': 'gallery', 'product_id': ids[0]}]}
        comparing = state.get('context', {}).get('result_kind') == 'compare_products' and len(ids) >= 2
        text = 'این گزینه‌ها رو با اطلاعات ثبت‌شده پیدا کردم؛ مشخصات و قیمت‌هاشون رو کنار هم ببین.'
        if interrupted:
            text = 'ادامهٔ پاسخ مدل نرسید، ولی این نتیجه‌ها پیدا شده‌اند؛ می‌تونی مشخصات و فروشنده‌هاشون رو همین‌جا بررسی کنی.'
        blocks = [{'type': 'comparison' if comparing else 'product_list', 'product_ids': ids[:4 if comparing else 3]}]
        if re.search(r'فیلتر|کنترل|بازه|محدوده', user_text) and re.search(r'قیمت|بودجه', user_text):
            from .budget import budget_props
            blocks.append({'type': 'budget', **budget_props(state.get('context', {}))})
        return {'text': text, 'blocks': blocks}
    if shops:
        has_product = any(evidence['shops'][id].get('productId') for id in shops)
        text = 'این فروشنده‌ها رو پیدا کردم؛ قیمت ثبت‌شدهٔ کالا و فاصله رو کنار هم ببین. پیش از رفتن می‌تونیم متن استعلام آماده کنیم.' if has_product else 'این فروشگاه‌ها نزدیکت هستن؛ ویترین هر کدوم رو باز کن تا ببینیم کدوم به خریدت می‌خوره.'
        return {'text': text, 'blocks': [{'type': 'offers', 'shop_ids': shops[:6]}], 'map_shop_ids': shops[:6]}
    if state.get('context', {}).get('result_kind') == 'get_price_range' and state['context'].get('price_range'):
        from .budget import budget_props
        return {'text': 'بازهٔ قیمت‌های رایج این کالاها رو پیدا کردم؛ سقف خریدت رو انتخاب کن یا مبلغ دلخواهت رو بنویس. قیمت‌های ثبت‌شده ممکنه نیاز به استعلام داشته باشن.', 'blocks': [{'type': 'budget', **budget_props(state['context'])}]}
    return None
