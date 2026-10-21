# دیتاست ساختاریافتهٔ ترب

## دامنه و قواعد اطلاعات

منبع فقط فایل‌های کامل `dataset/shops.csv`، `products.csv` و `offers.csv` است. CSVها روی سرویس backend در مسیر `/dataset` به صورت فقط خواندنی mount شده‌اند. import اختیاری و دستی است؛ با هر بار راه‌اندازی پروژه دوباره اجرا نمی‌شود.

- `Shop`، `Product` و `Offer` همان شناسه‌های اصلی دیتاست را دارند؛ آفر با کلید خارجی به یک محصول و یک فروشگاه وصل است. دستهٔ فعالیت فروشگاه به‌تنهایی اثبات ارائهٔ محصول نیست.
- `Category` و `ShopCategory` دستهٔ محصول و دسته‌های فعالیت فروشگاه را قابل فیلتر می‌کنند.
- `PaymentOption` ارائه‌دهنده، کانال (`in_person` یا `unknown`)، بازهٔ مبلغ و دسته‌های مشمول را جدا ذخیره می‌کند. مقدار صفر و null بدون تغییر حفظ می‌شوند؛ وجود صفر به معنی نامحدودبودن نیست.
- `OpeningDay` وضعیت اعلام‌شده و شیفت‌های هر روز را ذخیره می‌کند. روز غایب نامشخص است؛ وضعیت closed با شیفت 00:00 به معنی بازبودن شبانه‌روزی نیست. برنامهٔ اعلام‌شده به معنی بازبودن تأییدشده در این لحظه نیست.
- `ShopContact` شامل شماره‌های جعلی دیتاست است؛ `is_synthetic=True` و `is_publishable=False`. ابزار فروشنده این شماره‌ها را برنمی‌گرداند و هیچ تماس واقعی انجام نمی‌شود.
- طبق توضیح برگزارکننده، نام فروشگاه‌های بدون وب‌سایت و اینستاگرام مصنوعی است؛ این وضعیت در `name_is_synthetic` ثبت شده است.
- نبود قیمت، برند، مدل، گارانتی، ساعت یا وضعیت ارسال به null/ساختار اصلی تبدیل می‌شود؛ داده حدس زده نمی‌شود. قیمت به تومان و عدد صحیح ذخیره می‌شود؛ زمان تغییر قیمت با منطقهٔ زمانی حفظ می‌شود.
- تمام آفرهای ورودی `availability_status=unverified` دارند؛ آفر اثبات موجودی زنده نیست. import مجدد وضعیت تأیید احتمالی آینده را بازنویسی نمی‌کند.
- اطلاعات اصلی هر سطر پس از تبدیل JSONهای توکار در `source_data` حفظ می‌شود؛ `specs` و `image_urls` بدون تخت‌کردن یا حذف ذخیره می‌شوند.
- `DatasetImport` زمان، تعداد رکوردها، SHA-256 و اندازهٔ فایل‌ها و گزارش کیفیت را نگه می‌دارد. دادهٔ اصلی CSV تغییر نمی‌کند.

## اجرا با Docker

از ریشهٔ پروژه:

```powershell
docker compose up -d backend
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py import_torob
docker compose exec backend python manage.py audit_catalog
```

خواندن داده‌ها streaming و ذخیره با PostgreSQL COPY در جدول‌های موقت انجام می‌شود. کل انتقال در یک transaction است؛ خطای فرمت، شناسهٔ تکراری یا آفر با مرجع ناموجود، کل آن اجرا را rollback می‌کند. قفل advisory از دو import همزمان جلوگیری می‌کند. فایل یکسان با تعداد رکوردهای مطابق، دوباره وارد نمی‌شود. برای بازاعمال فایل‌ها بدون ایجاد رکورد تکراری:

```powershell
docker compose exec backend python manage.py import_torob --force
```

ورود فایل‌های متفاوت upsert است؛ رکوردهای قدیمی غایب از فایل جدید حذف نمی‌شوند. برای این پروژه فقط snapshot کامل فعلی وارد شده است. ویرایش دستی رکوردها بدون تغییر تعداد با مسیر پیش‌فرض skip تشخیص داده نمی‌شود؛ برای بازاعمال از `--force` استفاده کنید.

اجرای محلی (PostgreSQL باید اجرا باشد و `.env` موجود باشد):

```powershell
.\.venv\Scripts\python.exe backend/manage.py migrate
.\.venv\Scripts\python.exe backend/manage.py import_torob --path dataset
```

## ابزارهای آماده برای ایجنت

در `backend/catalog/services.py`:

```python
from catalog.services import search_products, product_details, find_sellers

products = search_products("هدفون سوني", limit=10)
product = product_details(products[0]["product_id"])
sellers = find_sellers(
    product["product_id"],
    max_price=3_000_000,
    latitude=35.71,
    longitude=51.41,
    radius_km=5,
    in_person_credit=True,
    sort="distance",
    limit=20,
)
```

جست‌وجو حروف ی/ک، ارقام فارسی/عربی، نیم‌فاصله و اعراب را یکسان‌سازی می‌کند و متن عنوان، برند، مدل، دسته و مقادیر مشخصات را می‌گردد. ایندکس GIN trigram برای جست‌وجو و GIN برای JSON مشخصات، و ایندکس‌های محصول/قیمت، فروشگاه/محصول و مختصات ساخته شده‌اند. این جست‌وجو معنایی/برداری نیست و نیاز به embedding ندارد.

ابزارها فقط خواندنی‌اند، خروجی محدود (حداکثر 100)، قیمت نامشخص در انتهای ترتیب، و اطلاعات منبع و عدم تأیید زنده را دارند. فیلتر پرداخت، ارائه‌دهنده و کانال را روی همان گزینهٔ پرداخت اعمال می‌کند. فاصله، مستقیم جغرافیایی است؛ زمان پیاده‌روی یا مسیر خیابانی نیست. پیش‌شرط موجودی واقعی یا ارزیابی شرایط جزئی پرداخت به‌صورت خودکار ادعا نمی‌شود.

فعلاً این توابع سرویس داخلی Python هستند؛ endpoint عمومی، اتصال به مدل AI و جایگزینی داده‌های نمونهٔ UI در این مرحله انجام نشده است.

## بررسی

```powershell
docker compose exec backend python manage.py test catalog core
docker compose exec backend python manage.py audit_catalog
```

گزارش audit تعداد رکوردها، مراجع، قیمت‌ها، تاریخ‌ها، مختصات، مشخصات و تصاویر را با دادهٔ ذخیره‌شدهٔ منبع تطبیق می‌دهد. خروجی نهایی انتقال در `docs/catalog-import-report.json` قرار دارد.
