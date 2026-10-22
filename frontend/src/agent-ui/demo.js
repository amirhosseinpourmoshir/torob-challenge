export const products = [
  { id: 'demo-ava', title: 'هدفون بی‌سیم آوا', subtitle: 'برای تمرکز، موسیقی و رفت‌وآمد', category: 'هدفون و صدا', image: '/images/agent-headphones.svg', price: 2790000, originalPrice: 3290000, badge: 'انتخاب متعادل', highlights: ['حذف نویز', '۳۵ ساعت پخش', 'سبک و راحت'], offerCount: 6, specs: { battery: '۳۵ ساعت', noise: 'فعال', weight: '۲۱۰ گرم', warranty: '۱۸ ماه' } },
  { id: 'demo-rhythm', title: 'ایرباد ریتم', subtitle: 'کوچک و همراه هر روز', category: 'هدفون و صدا', image: '/images/agent-earbuds.svg', price: 1950000, highlights: ['مقاوم در برابر رطوبت', '۲۸ ساعت با کیس'], offerCount: 4, specs: { battery: '۲۸ ساعت', noise: 'غیرفعال', weight: '۴۸ گرم', warranty: '۱۲ ماه' } },
  { id: 'demo-pulse', title: 'اسپیکر پالس', subtitle: 'صدای پرحجم، برای دورهمی', category: 'هدفون و صدا', image: '/images/agent-speaker.svg', price: 3490000, originalPrice: 3990000, highlights: ['پخش استریو', '۱۸ ساعت پخش'], offerCount: 3, specs: { battery: '۱۸ ساعت', noise: 'ندارد', weight: '۶۲۰ گرم', warranty: '۱۲ ماه' } },
]
export const sellers = [
  { id: 'demo-shop-1', name: 'خانهٔ صدا', neighborhood: 'ولیعصر', address: 'تهران، خیابان ولیعصر، مرکز خرید آفتاب', insideAddress: 'ورودی شمالی، طبقهٔ دوم، واحد ۲۱۴', price: 2790000, distanceMeters: 850, distanceKind: 'straight_line', availability: 'unverified', hoursLabel: '۱۰ تا ۲۱', credit: true, updatedAt: '2026-10-21T10:00:00Z' },
  { id: 'demo-shop-2', name: 'گالری آوا', neighborhood: 'انقلاب', address: 'تهران، خیابان انقلاب', price: 2690000, distanceMeters: 1800, availability: 'unverified', hoursLabel: '۱۰ تا ۲۰', credit: false },
  { id: 'demo-shop-3', name: 'صدای شهر', neighborhood: 'فاطمی', address: 'تهران، میدان فاطمی', price: 2890000, distanceMeters: 500, availability: 'unverified', hoursLabel: '۱۱ تا ۲۱', credit: true },
]
const widget = (type, props, group, label, wide = false) => ({ version: 1, id: `preview-${type}`, type, props, group, label, wide })
export const clarification = { questionId: 'usage', question: 'بیشتر کجا از هدفون استفاده می‌کنی؟', description: 'این‌طوری می‌تونم بین راحتی، کیفیت صدا و حذف نویز بهتر انتخاب کنم.', options: [{ id: 'commute', label: 'توی رفت‌وآمد', description: 'سبک باشه و صدای اطراف کمتر شنیده بشه' }, { id: 'work', label: 'موقع کار و تمرکز', description: 'راحتی طولانی و صدای شفاف مهم‌تره' }, { id: 'sport', label: 'برای ورزش', description: 'محکم بمونه و با رطوبت مشکلی نداشته باشه' }], allowOther: true }
export const demos = [
  widget('product_list', { products }, 'commerce', 'ویترین محصول', true),
  widget('product', { product: products[0] }, 'commerce', 'کارت محصول'),
  widget('recommendation', { product: products[0], reasons: ['داخل بودجه‌ایه که گفتی', 'برای استفادهٔ طولانی راحت‌تره', 'حذف نویز به تمرکزت کمک می‌کنه'], note: 'اگر اندازهٔ کوچک‌تر اولویتته، ایرباد ریتم رو هم کنار این ببین.' }, 'commerce', 'پیشنهاد شخصی'),
  widget('deal', { product: products[0], expiresAt: '2026-10-25T18:00:00Z' }, 'commerce', 'پیشنهاد ویژه و تخفیف'),
  widget('comparison', { products, features: [{ key: 'battery', label: 'باتری', bestId: 'demo-ava' }, { key: 'noise', label: 'حذف نویز', bestId: 'demo-ava' }, { key: 'weight', label: 'وزن', bestId: 'demo-rhythm' }, { key: 'warranty', label: 'گارانتی' }] }, 'commerce', 'جدول مقایسه', true),
  widget('installment', { price: 2790000, downPayment: 590000, months: 4, totalPayable: 2990000, provider: 'خرید اعتباری' }, 'commerce', 'شرایط اقساط'),
  widget('alternative', { reason: 'اگر انتخاب اولت موجود نبود، این مدل سبک‌تر رو هم می‌تونیم بررسی کنیم.', product: products[1] }, 'commerce', 'گزینهٔ جایگزین'),
  widget('seller', { seller: sellers[0] }, 'stores', 'کارت فروشگاه'),
  widget('offers', { offers: sellers }, 'stores', 'پیشنهادهای قابل مرتب‌سازی'),
  widget('itinerary', { stops: sellers.map((s, i) => ({ id: s.id, name: s.name, address: s.address, time: ['۱۱:۰۰', '۱۱:۳۰', '۱۲:۰۰'][i] })), totalDistanceMeters: 4200, durationMinutes: 35 }, 'stores', 'برنامهٔ بازدید'),
  widget('budget', { min: 500000, max: 10000000, step: 100000, value: 3000000 }, 'questions', 'انتخاب بودجه'),
  widget('preferences', { title: 'چه چیزهایی برات مهم‌تره؟', options: [{ id: 'noise', label: 'حذف نویز' }, { id: 'battery', label: 'باتری قوی' }, { id: 'light', label: 'سبک بودن' }, { id: 'credit', label: 'خرید قسطی' }], selected: ['noise'], multiple: true }, 'questions', 'انتخاب چند ترجیح'),
  widget('clarification', clarification, 'questions', 'سؤال تکمیلی'),
  widget('quick_replies', { options: [{ id: 'compare', label: 'این‌ها رو مقایسه کن' }, { id: 'closer', label: 'نزدیک‌ترش رو پیدا کن' }, { id: 'credit', label: 'فقط خرید قسطی' }] }, 'questions', 'پاسخ‌های سریع', true),
  widget('progress', { steps: [{ id: 'need', label: 'خواسته‌هات رو کنار هم گذاشتم', detail: 'بودجه تا سه میلیون، حذف نویز و استفادهٔ روزانه', status: 'done' }, { id: 'product', label: 'مدل‌ها رو مقایسه کردم', detail: 'سه انتخاب متناسب با بودجه', status: 'done', durationMs: 1800 }, { id: 'shop', label: 'دارم فروشگاه‌های نزدیک رو بررسی می‌کنم', status: 'running' }, { id: 'stock', label: 'استعلام موجودی', detail: 'با تأیید تو', status: 'waiting' }] }, 'operations', 'پیشرفت کار ایجنت'),
  widget('receipt', { title: 'سه انتخاب متناسب پیدا شد', summary: 'نتیجهٔ مقایسه آماده است؛ حالا می‌تونیم سراغ فروشگاه‌ها بریم.', facts: [{ label: 'محدودهٔ جستجو', value: 'تهران' }, { label: 'بودجه', value: 'تا ۳ میلیون تومان' }, { label: 'تعداد انتخاب‌ها', value: '۳ مدل' }], status: 'done' }, 'operations', 'نتیجهٔ عملیات'),
  widget('confirmation', { title: 'از فروشگاه دربارهٔ موجودی بپرسیم؟', description: 'مدل و رنگ انتخابی‌ات رو می‌پرسیم و ساعت مراجعه رو چک می‌کنیم.', actionId: 'contact-shop-1', confirmLabel: 'آره، بپرس' }, 'operations', 'تأیید پیش از اقدام'),
  widget('contact', { shopName: 'خانهٔ صدا', channel: 'message', questions: ['مدل آوا با رنگ مشکی موجوده؟', 'قیمت امروز چقدره؟', 'امروز تا چه ساعتی باز هستید؟'] }, 'operations', 'درخواست ارتباط'),
  widget('checklist', { items: [{ id: 'address', label: 'آدرس و واحد فروشگاه رو دارم', done: true }, { id: 'price', label: 'قیمت امروز رو پرسیدم' }, { id: 'stock', label: 'موجودی و رنگ رو تأیید کردم' }, { id: 'warranty', label: 'شرایط گارانتی رو بررسی کردم' }] }, 'operations', 'چک‌لیست خرید'),
  widget('price_history', { points: [{ date: '2026-10-01T12:00:00Z', price: 3290000 }, { date: '2026-10-05T12:00:00Z', price: 3190000 }, { date: '2026-10-09T12:00:00Z', price: 3250000 }, { date: '2026-10-13T12:00:00Z', price: 2990000 }, { date: '2026-10-17T12:00:00Z', price: 2890000 }, { date: '2026-10-21T12:00:00Z', price: 2790000 }] }, 'charts', 'روند قیمت / ApexCharts'),
  widget('price_comparison', { offers: sellers }, 'charts', 'مقایسهٔ قیمت / ApexCharts'),
  widget('fit_score', { scores: [{ label: 'بودجه', value: 95 }, { label: 'راحتی', value: 88 }, { label: 'باتری', value: 90 }, { label: 'حذف نویز', value: 82 }, { label: 'وزن', value: 76 }] }, 'charts', 'تطابق نیاز / ApexCharts'),
  widget('calendar', { selectedDate: '2026-10-22' }, 'time', 'تقویم شمسی تعاملی'),
  widget('clock', { showSeconds: true }, 'time', 'ساعت زندهٔ تهران'),
  widget('visit', { date: '2026-10-22' }, 'time', 'انتخاب زمان مراجعه'),
  widget('gallery', { images: products.map(p => ({ src: p.image, alt: p.title })) }, 'media', 'گالری و بزرگنمایی تصویر'),
  widget('source', { label: 'آخرین ثبت اطلاعات فروشگاه', updatedAt: '2026-10-21T10:00:00Z', status: 'unverified' }, 'states', 'منبع و زمان اطلاعات'),
  widget('loading', { label: 'دارم فروشگاه‌های نزدیک رو بررسی می‌کنم…' }, 'states', 'حالت در حال دریافت'),
  widget('empty', { title: 'با این فیلتر چیزی پیدا نشد', description: 'می‌تونیم محدوده رو کمی بزرگ‌تر کنیم یا سراغ یه مدل دیگه بریم.' }, 'states', 'حالت بدون نتیجه'),
  widget('error', { message: 'پاسخ فروشگاه نرسید. می‌تونیم دوباره امتحان کنیم یا گزینهٔ بعدی رو ببینیم.' }, 'states', 'حالت خطا'),
]
export const groups = [{ id: 'all', label: 'همهٔ اجزا' }, { id: 'commerce', label: 'محصول و خرید' }, { id: 'stores', label: 'فروشگاه و مسیر' }, { id: 'questions', label: 'سؤال و انتخاب' }, { id: 'operations', label: 'عملیات ایجنت' }, { id: 'charts', label: 'نمودارها' }, { id: 'time', label: 'زمان و تقویم' }, { id: 'media', label: 'تصویر' }, { id: 'states', label: 'حالت‌ها' }]
export function asWidget(demo) { const { group, label, wide, ...widget } = demo; return widget }
