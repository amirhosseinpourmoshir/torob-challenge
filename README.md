# ترب همراه

از گفت‌وگو تا خرید حضوری در تهران: نیازت را بگو، محصول‌ها و قیمت‌های ثبت‌شده را مقایسه کن، ویترین فروشگاه را ببین و انتخابت را روی نقشه پیدا کن.

رابط فارسی و واکنش‌گرا با تم روشن و تاریک، آدرس فعال، ذخیره‌های یکپارچه، سؤال انتخابی، فیلتر بودجه، نمودار قیمت، مشخصات و مشابه‌ها و آماده‌سازی متن استعلام. ایجنت LangGraph به مدل پیش‌فرض BoxAPI در پنل اختصاصی و کاتالوگ PostgreSQL متصل است.

## اجرای توسعه

Docker Desktop با Linux containers و Compose v2 لازم است. پس از clone:

```powershell
Copy-Item .env.example .env
```

در `.env` رمز دیتابیس، secret جنگو، اتصال AI و نام/رمز مدیر را وارد کنید. رمز اولیهٔ مدیر حداقل ۱۲ نویسه باشد. فایل محیطی و CSVهای دیتاست وارد Git نمی‌شوند.

```powershell
docker compose up -d --build
docker compose exec backend python manage.py bootstrap_panel
```

رابط روی `http://localhost:5000`، پنل اختصاصی روی `/panel` و نمایشگاه کامپوننت‌ها روی `/agent-ui` است. بک‌اند توسعه روی پورت ۸۰۰۰ و PostgreSQL روی ۱۵۴۳۲ در دسترس محلی‌اند. نام دیتابیس `torob_hakatoon` است.

## اجرای پروداکشن

فایل `compose.production.yaml` مستقل است؛ آن را با فایل توسعه ترکیب نکنید. این تنظیمات به‌خودی‌خود چیزی روی سرور واقعی منتشر نمی‌کند.

در `.env` مقدارهای `DJANGO_ALLOWED_HOSTS` و `DJANGO_CSRF_TRUSTED_ORIGINS` را برای دامنه/آدرس مقصد تنظیم کنید. برای اجرای محلی همان `localhost` و `http://localhost:5000` کافی است. پشت HTTPS، مقدار `COOKIE_SECURE=true` را فعال کنید. TLS را پراکسی میزبان یا سرویس میزبانی تأمین می‌کند.

```powershell
# اگر توسعه در همین پوشه در حال اجراست، متوقفش کنید؛ volume حذف نمی‌شود.
docker compose down
docker compose -f compose.production.yaml up -d --build
docker compose -f compose.production.yaml ps
docker compose -f compose.production.yaml logs -f backend agentworker frontend
```

تنها پورت عمومی پیش‌فرض ۵۰۰۰ است و با `FRONTEND_PORT` قابل تغییر است. Nginx خروجی build شدهٔ React را ارائه می‌کند و API را به Gunicorn می‌فرستد. backend، worker و دیتابیس پورت عمومی ندارند. migration، فایل‌های static و ساخت اولیهٔ مدیر هنگام راه‌اندازی backend انجام می‌شوند. این تنظیمات hot reload و bind mount سورس ندارند. `agentworker` باید همیشه روشن باشد.

اگر دانلود PyPI در شبکه کند است:

```powershell
docker compose -f compose.production.yaml build --build-arg PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple
docker compose -f compose.production.yaml up -d --no-build
```

توقف بدون حذف داده:

```powershell
docker compose -f compose.production.yaml down
```

گزینهٔ `down -v` داده‌های volume را حذف می‌کند. پیش از جابه‌جایی سرور از PostgreSQL نسخهٔ پشتیبان بگیرید؛ `.env` و `DJANGO_SECRET_KEY` را نیز نگه دارید تا کلید رمزگذاری‌شدهٔ اتصال قابل خواندن بماند.

## دیتاست در نصب تازه

CSVهای چالش را جداگانه در `dataset/` قرار دهید. پس از بالا آمدن سرویس‌ها:

```powershell
docker compose -f compose.production.yaml exec backend python manage.py import_torob --path /dataset
docker compose -f compose.production.yaml exec backend python manage.py audit_catalog
```

این مرحله روی نصب فعلی انجام شده است. در پنل، تب «دانش ایجنت»، آماده‌سازی محلی و ترجمهٔ ذخیره‌شونده را مدیریت کنید. تنظیمات AI از `.env` شروع می‌شوند و انتخاب مدل در پنل برای درخواست‌های بعدی اعمال می‌شود؛ کلید به فرانت ارسال نمی‌شود.

## بررسی نسخه

```powershell
docker compose -f compose.production.yaml exec backend python manage.py check
docker compose -f compose.production.yaml exec backend python manage.py test --noinput
docker compose -f compose.production.yaml exec backend python manage.py makemigrations --check --dry-run
```

تست قرارداد کامپوننت‌ها و build فرانت در image توسعه:

```powershell
docker compose run --build --rm --no-deps frontend npm run test:agent-ui
docker compose run --build --rm --no-deps frontend npm run build
```

## ساختار

- `backend/catalog`: ورود داده، مدل‌های محصول/فروشگاه و جستجوی نقشه.
- `backend/agent`: گردش LangGraph، ابزارها، قواعد مشترک جستجو، کیفیت قیمت، ساخت پاسخ و ذخیره‌های نشست.
- `backend/core`: آدرس، تنظیمات اتصال و پنل مدیر.
- `frontend/src/agent-ui`: قرارداد داده و کامپوننت‌های تعاملی RTL.
- `frontend/src`: چت، نقشه، ویترین، ذخیره‌ها و پنل.
- `docs`: راهنمای API و رفتار محصول؛ خروجی‌های موقت تست در مخزن نگهداری نمی‌شوند.

## حدود داده و استعلام

قیمت و موجودی ثبت‌شده، تأیید امروز فروشنده نیست. نمودارها فقط از داده ساخته می‌شوند؛ تاریخچه، امتیاز و تخفیف حدسی تولید نمی‌شود. اختلاف قیمت با پیشنهادهای همان کالا یا مرجع مدلِ تاریخ‌دار هشدار بررسی است، نه حکم قطعی فیک بودن. اصالت بدون تأیید فروشنده تضمین نمی‌شود.

استعلام فعلی متن آماده و لینک رسمی موجود در داده را ارائه می‌کند؛ تماس، پیام خودکار یا خواندن اینستاگرام انجام نمی‌شود. فاصلهٔ نقشه مستقیم است و لینک مسیریابی خیابانی جدا باز می‌شود. نام‌های ساختگی و محدودیت‌های فایل چالش در داده حفظ شده‌اند؛ شماره‌های ساختگی منتشر نمی‌شوند.

جزئیات: [ایجنت](docs/shopping-agent.md)، [کاتالوگ](docs/catalog.md)، [نقشه](docs/shop-map.md)، [پنل](docs/admin-panel.md)، [کامپوننت‌ها](docs/agent-ui.md).
