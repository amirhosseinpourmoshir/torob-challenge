# کتابخانهٔ اجزای گفتگوی ایجنت

[فهرست مستندات](README.md) · [شروع سریع پروژه](../README.md)

پیش‌نمایش تعاملی: `http://localhost:5000/agent-ui`؛ لینک آن در پنل مدیریت، «اجزای گفتگو» نیز قرار دارد. این صفحه ۳۰ قالب، تغییر تم، نمای باریک چت، مشاهدهٔ JSON ورودی و خروجی رویدادها دارد. محصولات و فروشگاه‌های صفحه نمونه هستند و دکمه‌ها درخواست خارجی ارسال نمی‌کنند.

## استفاده در گفتگو

```jsx
import { AgentMessage } from './agent-ui/index.js'

<AgentMessage
  text="این مدل به بودجه و نیازت نزدیکه."
  widgets={message.widgets}
  onAction={event => handleAgentAction(event)}
/>
```

برای اجزای مستقل، همهٔ کامپوننت‌ها از `agent-ui/index.js` صادر می‌شوند؛ داخل یک والد با `className="agent-ui" dir="rtl"` قرار بگیرند. `AgentRenderer` و `AgentMessage` این والد را خودشان دارند. چت اصلی به مدل پیش‌فرض، ذخیرهٔ گفتگو و ابزارهای LangGraph متصل است؛ راهنمای اجرا و اتصال در [مستندات ایجنت](shopping-agent.md) آمده است.

## قرارداد داده

نمونهٔ پاسخ ایجنت:

```json
{
  "version": 1,
  "id": "product-result-1",
  "type": "product",
  "props": {
    "product": {
      "id": "catalog-product-id",
      "title": "نام محصول",
      "price": 2790000,
      "image": "/images/product.svg",
      "highlights": ["حذف نویز", "۳۵ ساعت پخش"]
    }
  }
}
```

مبالغ عددی و به تومان هستند؛ قیمت نامشخص `null` است و صفر یک قیمت معتبر محسوب می‌شود. فایل `docs/agent-ui.schema.json` قرارداد JSON Schema نسخهٔ ۲۰۲۰-۱۲ و `frontend/src/agent-ui/contracts.js` منبع اصلی تعریف‌هاست. `validateWidget` همین زیرمجموعهٔ منتشرشده را در مرورگر بررسی می‌کند. نام قالب ناشناخته، فیلد اضافه، HTML اجرایی، callback، سبک دلخواه، تاریخ نامعتبر و آرایهٔ بیش از سقف پذیرفته نمی‌شوند. در هر پیام حداکثر ۲۰ ویجت نمایش داده می‌شود. برای سؤال تازه یا عملیات مستقل، شناسهٔ تازه بفرستید؛ وضعیت تعامل هر کارت به شناسهٔ آن وابسته است.

بهتر است خروجی مدل پیش از ارسال در بک‌اند نیز با همین schema بررسی شود. تأیید موجودی، امتیاز تطابق، سابقهٔ قیمت، تخفیف و شرایط اقساط باید از خروجی ابزار معتبر بیایند؛ UI به‌تنهایی هیچ‌کدام را اثبات نمی‌کند.

## فهرست قالب‌ها

| type | کامپوننت | کاربرد |
|---|---|---|
| `product` | ProductCard | تصویر، مشخصات کوتاه، قیمت، نشانک و یافتن فروشنده |
| `product_list` | ProductCollection | ویترین افقی با اسکرول در عرض چت |
| `recommendation` | RecommendationCard | محصول پیشنهادی و دلایل انتخاب |
| `comparison` | ComparisonTable | مقایسهٔ حداکثر چهار محصول و ویژگی‌هایشان |
| `seller` | SellerCard | نشانی، واحد داخل پاساژ، فاصله، وضعیت استعلام و قیمت |
| `offers` | OffersList | مرتب‌سازی پیشنهادها با قیمت یا فاصله؛ مجهول‌ها در انتها |
| `deal` | DealCard | قیمت قبلی، قیمت جدید و تخفیف محاسبه‌شده |
| `installment` | InstallmentCard | پیش‌پرداخت، تعداد اقساط و مجموع پرداخت واقعی |
| `alternative` | AlternativeCard | جایگزین محصول و دلیل پیشنهاد |
| `budget` | BudgetPicker | انتخاب بودجه و ارسال مقدار نهایی |
| `preferences` | PreferenceChips | انتخاب تکی یا چندتایی معیارها |
| `clarification` | ClarificationCard / ClarificationPopup | سؤال تکمیلی با انتخاب و پاسخ آزاد |
| `quick_replies` | QuickReplies | پاسخ‌های کوتاه قابل انتخاب |
| `progress` | AgentProgress | مراحل pending/running/done/failed/waiting |
| `receipt` | OperationReceipt | خلاصهٔ نتیجهٔ واقعی یک عملیات |
| `confirmation` | ConfirmationCard | تأیید یا لغو پیش از اقدام |
| `contact` | ContactRequestCard | ثبت درخواست ارتباط؛ نه ارسال خودکار پیام یا تماس |
| `checklist` | ShoppingChecklist | چک‌لیست قابل انتخاب پیش از مراجعه |
| `itinerary` | ItineraryCard | ترتیب بازدید فروشگاه‌ها، فاصله و زمان ارائه‌شده |
| `calendar` | PersianCalendar | تقویم شمسی با تغییر ماه و محدودیت تاریخ |
| `clock` | DigitalClock | ساعت زنده و تاریخ تهران |
| `visit` | VisitPlanner | انتخاب بازهٔ مراجعه در یک تاریخ مشخص |
| `gallery` | ImageGallery / ImageViewer | تصاویر، بندانگشتی، پنجرهٔ بزرگنمایی و تغییر تصویر |
| `price_history` | PriceHistoryChart | نمودار روند قیمت با جدول جایگزین |
| `price_comparison` | PriceComparisonChart | نمودار میله‌ای قیمت فروشندگان |
| `fit_score` | FitScoreChart | نمودار راداری میزان تطابق؛ نه امتیاز کاربران |
| `source` | SourceNote | منبع، زمان و وضعیت اطلاعات |
| `empty` | EmptyCard | بدون نتیجه، با رویداد بازنشانی فیلتر |
| `loading` | LoadingCard | دریافت داده و اسکلت بارگذاری |
| `error` | ErrorCard | خطا و درخواست تلاش دوباره |

اجزای پایه نیز صادر می‌شوند: `PriceTag`، `DiscountBadge`، `ProductImage`، `AgentCard`، `ActionButton`، `Badge` و `AgentDialog`.

## سؤال تکمیلی و پاپ‌آپ

برای `clarification`، `presentation` را `inline` یا `popup` بدهید. پاپ‌آپ با دریافت کارت باز می‌شود؛ با Escape، کلیک بیرون یا دکمهٔ بستن بسته و از دکمهٔ داخل پیام دوباره باز می‌شود. هر گزینه `id`، `label` و `description` اختیاری دارد. `multiple=true` چندانتخابی است؛ `allowOther` پاسخ آزاد را فعال می‌کند. `questionId` شناسهٔ پایدار سؤال در گردش کار است. ارسال بدون انتخاب یا متن غیرفعال است و پس از پاسخ، فرم همان نمایش دوباره ارسال نمی‌شود.

## رویدادها و اقدامات

خروجی نمایشگر `{type, payload, widgetId}` است. نمونه:

```json
{
  "type": "clarification_answer",
  "widgetId": "question-usage-1",
  "payload": {
    "questionId": "usage",
    "values": ["work"],
    "other": null
  }
}
```

رویدادهای اصلی: `view_product`، `save_product`، `find_sellers`، `select_product`، `select_shop`، `view_offer`، `filter_credit`، `set_budget`، `preferences_changed`، `clarification_answer`، `quick_reply`، `confirm_action`، `cancel_action`، `request_shop_contact`، `checklist_changed`، `start_itinerary`، `select_date`، `plan_visit`، `view_image`، `retry_widget` و `reset_filters`.

اجرای عملیات در اختیار میزبان است: رویداد را اعتبارسنجی کند، ابزار بک‌اند را فراخوانی کند و نتیجهٔ واقعی را به کارت بعدی تبدیل کند. کارت `confirmation` صرفاً انتخاب کاربر را اعلام می‌کند و کارت `contact` نیز به‌تنهایی هیچ پیام یا تماسی ارسال نمی‌کند. نمونهٔ studio فقط رویدادها را در حافظه ثبت می‌کند.

## زمان، تصویر، نمودار و تم

- تقویم با `Intl` و تقویم `persian` ساخته شده و طول ماه و سال کبیسه از همان موتور گرفته می‌شود. انتخاب خروجی `YYYY-MM-DD` میلادی به همراه اجزای شمسی دارد. ساعت، تقویم و نمایش تاریخ همگی `Asia/Tehran` هستند.
- تصاویر فقط از مسیر محلی یا HTTPS بدون اطلاعات ورود پذیرفته می‌شوند؛ `javascript:`، `data:`، URL نسبی به پروتکل و مسیر با backslash رد می‌شوند. خطای تصویر به جای شکستن کارت، fallback دارد.
- نمودارهای واقعی ApexCharts با wrapper رسمی React استفاده شده‌اند. بستهٔ نمودار فقط هنگام نیاز بارگذاری می‌شود و صفحهٔ اصلی نقشه یا پنل برای این گالری نمودار دانلود نمی‌کنند. راهنمای مرجع: https://apexcharts.com/docs/react-charts/
- CSSها با `agent-ui` محدود شده‌اند؛ دو تم مستقل، عرض کوچک چت، اعداد فارسی، کاهش حرکت، کنترل با صفحه‌کلید، focus trap پنجره‌ها و بازگرداندن فوکوس رعایت شده‌اند.

## اجرا و بررسی

```powershell
docker compose up --build -d
docker compose exec -T frontend npm run test:agent-ui
docker compose exec -T frontend npm run build
```

تست‌های قرارداد، ورودی‌های ناامن، قیمت صفر و نامشخص، تخفیف، سال کبیسهٔ شمسی و تغییر روز در تهران وجود دارند. مرورگر برای هر ۳۰ نمونه، سه نمودار، انتخاب سؤال، رویدادها، مرتب‌سازی فروشندگان، بودجه، چک‌لیست، تصاویر، تقویم، تم و عرض‌های ۳۲۰ تا ۱۴۴۰ پیکسل بررسی شده است.


## اتصال رویداد به عملیات واقعی

`contracts.js` فقط شکل دادهٔ ورودی را بررسی می‌کند؛ عملکرد دکمه به handler صفحهٔ میزبان هم وابسته است. در چت، `AgentChat.handleAction` انتخاب فروشگاه را به نقشه، برنامهٔ بازدید را به نمایش گروهی و سایر عملیات به مسیر معتبر action وصل می‌کند. کارت محصول در زمینهٔ `ProductLibrary` جزئیات، مشابه‌ها، ذخیره و مقایسه را از context می‌گیرد. نمایشگاه `/agent-ui` محیط نمونه/بازبینی رویداد است و جای بررسی عملیات صفحهٔ اصلی را نمی‌گیرد.

`InteractionCoordinator` در کل تاریخچه یک کنترل تصمیم‌گیری فعال نگه می‌دارد؛ کنترل قدیمی با انتخاب کاربر دوباره باز می‌شود. هنگام پردازش، کنترل‌های ارسال تصمیم غیرفعال‌اند. گالری و چک‌لیست تعامل محلی دارند. برای هر دکمهٔ جدید، اجرای واقعی، حالت انتظار، خطا و رفرش را متناسب با نقش آن بررسی کنید.
