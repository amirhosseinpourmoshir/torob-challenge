# استقرار با CLI لیارا

[فهرست مستندات](README.md) · [تنظیمات](configuration.md)

این مسیر مخصوص برنامهٔ Docker در PaaS لیارا است. فایل Compose محلی روی این سرویس اجرا نمی‌شود. image مخصوص `Dockerfile.liara` فرانت build‌شده، Nginx، Gunicorn و worker ایجنت را در یک برنامه اجرا می‌کند؛ Supervisor پردازش‌ها و فرزند worker را مدیریت می‌کند. PostgreSQL باید سرویس مستقل و پایدار باشد. برای VPS همچنان راهنمای Compose معتبر است.

## پیش‌نیازهای محلی

Node.js نسخهٔ سازگار با CLI و Python با `python-dotenv` لازم است. نسخهٔ بررسی‌شدهٔ CLI، 9.6.0 است. نصب محدود به همین پروژه:

```powershell
npm install --prefix .venv/liara-cli @liara/cli@9.6.0 --no-audit --no-fund
```

در دستگاه توسعهٔ فعلی، Python و CLI در `.venv` آماده‌اند. روی نصب تازه، محیط Python و وابستگی‌های backend را ابتدا نصب کنید. wrapper در `scripts/liara.py` دستورهای اصلی CLI را اجرا و تنظیمات را از `.env` می‌خواند؛ فایل محیطی را upload نمی‌کند.

## تیم و احراز هویت

در `.env` مقدار `LIARA_TEAM_ID` را برابر شناسهٔ تیم قرار دهید، نه لینک کنسول و نه کلید API. یکی از دو روش ورود کافی است:

```powershell
.venv/Scripts/python.exe scripts/liara.py login
.venv/Scripts/python.exe scripts/liara.py teams
.venv/Scripts/python.exe scripts/liara.py status
.venv/Scripts/python.exe scripts/liara.py apps
.venv/Scripts/python.exe scripts/liara.py databases
```

یا `LIARA_API_TOKEN` را فقط در `.env` محلی وارد کنید. wrapper آن را برای احراز هویت به CLI می‌دهد و در env برنامه یا سورس ارسالی قرار نمی‌دهد. از `--debug` یا چاپ فرمان حاوی توکن برای گزارش‌گیری استفاده نکنید. شناسهٔ تیم در تمام عملیات مرتبط صریح ارسال می‌شود تا به اشتباه حساب شخصی انتخاب نشود.

## منابع مقصد

ابتدا برنامه‌ها و دیتابیس‌های موجود تیم را بررسی کنید. ایجاد سرویس تازه هزینه دارد؛ اندازه و نام منابع باید مشخص شود. برای این معماری یک برنامهٔ Docker همیشه روشن با حافظهٔ کافی برای وب و worker و یک PostgreSQL مستقل لازم است. شروع با ۱ گیگابایت برای برنامهٔ دموی محدود پیشنهاد ظرفیت است، نه تضمین هم‌زمانی. برنامه را یک replica نگه دارید تا قبل از ارزیابی چندنمونه‌ای پیچیدگی اضافه نشود.

این مقادیر در `.env` مخصوص ابرند و تنظیمات Docker محلی را تغییر نمی‌دهند:

| متغیر | مقدار |
| --- | --- |
| `LIARA_TEAM_ID` | شناسهٔ تیم |
| `LIARA_API_TOKEN` | اختیاری در صورت login مرورگری |
| `LIARA_APP_ID` | شناسهٔ برنامهٔ Docker مقصد |
| `LIARA_PUBLIC_HOST` | hostname واقعی برنامه، بدون `https://` |
| `LIARA_POSTGRES_HOST` | میزبان PostgreSQL قابل دسترس از برنامه |
| `LIARA_POSTGRES_PORT` | پورت واقعی سرویس |
| `LIARA_POSTGRES_DB` | نام دیتابیس مقصد؛ پیش‌فرض نمونه `torob_hakatoon` |
| `LIARA_POSTGRES_USER` | کاربر دیتابیس مقصد |
| `LIARA_POSTGRES_PASSWORD` | رمز دیتابیس مقصد |

نام کاربر/دیتابیس را از تنظیمات واقعی سرویس بردارید؛ آن‌ها را صرفاً از نمونه حدس نزنید. در شبکهٔ خصوصی، برنامه و دیتابیس باید شبکهٔ سازگار داشته باشند. `db` و `127.0.0.1` مربوط به دیتابیس ابری نیستند. آدرس و اعتبار BoxAPI از متغیرهای `AI_*` فعلی می‌آیند. secret اصلی را برای بازیابی دادهٔ رمز‌شده حفظ کنید.

## بررسی، تنظیم محیط و انتشار

اگر backup کامل منتقل می‌کنید، بازیابی داده و migration history را روی دیتابیس مقصد خالی **پیش از اولین deploy** کامل کنید. شروع برنامه روی restore نیمه‌کاره ممکن است با خطای وجود جدول مواجه شود.

```powershell
# فقط بررسی محلی؛ تغییری روی ابر انجام نمی‌دهد.
.venv/Scripts/python.exe scripts/liara.py check

# env برنامهٔ انتخاب‌شده را اعمال و ممکن است آن را restart کند.
.venv/Scripts/python.exe scripts/liara.py configure

# بیلد و انتشار واقعی در برنامهٔ انتخاب‌شده.
.venv/Scripts/python.exe scripts/liara.py deploy

.venv/Scripts/python.exe scripts/liara.py logs
```

`configure` فقط متغیرهای runtime لازم را می‌فرستد؛ نام تیم، توکن کنترل لیارا و پورت دیتابیس محلی ارسال نمی‌شوند. HTTPS، cookie امن، origin عمومی و یک worker وب به‌صورت مشخص تنظیم می‌شوند. اگر دامنه عوض شد، hostname را اصلاح و configure را تکرار کنید. در deploy پورت 8080، `Dockerfile.liara` و محل build آلمان صریح انتخاب می‌شوند؛ محل build، محل اجرای برنامه را تغییر نمی‌دهد. فرمان health check آرایهٔ آرگومان‌هاست؛ CLI متن ساده را با فاصله جدا می‌کند، بنابراین فرمان Python دارای کوتیشن نباید به شکل رشته فرستاده شود. زمان‌های health check در تنظیمات لیارا بر حسب میلی‌ثانیه‌اند؛ مقدارها باید با محدودیت API فعلی سازگار باشند. `liara.json` فقط تنظیمات عمومی و health check دارد و هیچ کلیدی داخل آن نیست.

## دیتابیس و دیتاست

CSV خام، `.env`، dump، محیط مجازی و node_modules با `.liaraignore` و `.dockerignore` از بسته حذف می‌شوند. build سورس به معنی انتقال دیتابیس سیستم شما نیست.

برای مقصد تازه، پس از تعیین دسترسی واقعی PostgreSQL، backup محلی را به سرویس مقصد بازیابی کنید یا import کنترل‌شدهٔ CSV انجام دهید. مقصد باید خالی و انتقال هماهنگ با migrationها باشد؛ روی جداول فعال بدون بررسی restore نکنید. روش شبکه/ورود backup باید با سرویس خریداری‌شده تطبیق داده شود. دیتاست را به image عمومی یا Git اضافه نکنید. در هر نصب تازه، انتقال داده باید مستقل بررسی شود؛ موفقیت build به معنی ورود دیتاست نیست.

پس از آماده‌شدن داده و انتشار، برای دسترسی به shell:

```powershell
.venv/Scripts/python.exe scripts/liara.py shell
```

در shell برنامه می‌توانید `python manage.py check` و `python manage.py audit_catalog` را اجرا کنید. شروع برنامه migration، collectstatic و bootstrap اولین مدیر را اجرا می‌کند. حساب مدیر موجود بازنویسی نمی‌شود.

## بررسی image قبل از انتشار

```powershell
docker build -f Dockerfile.liara -t torob-liara:check .
.venv/Scripts/python.exe -m unittest discover -s scripts -p test_liara.py
```

بررسی محلی جای اجرای واقعی روی زیرساخت لیارا و بررسی دامنه/DB را نمی‌گیرد. در انتشار، صفحهٔ اصلی، فایل‌های static و فونت، نشست/CSRF روی HTTPS، پنل، سلامت API، heartbeat worker، گفت‌وگو و توقف را بررسی کنید. وب و worker هر دو باید روشن باشند.

منابع رسمی مطالعه‌شده:

- [مستندات و فرمان‌های CLI لیارا](https://github.com/liara-cloud/cli/blob/master/README.md)
- [تعریف تنظیمات liara.json در CLI](https://github.com/liara-cloud/cli/blob/master/src/types/liara-json.ts)
- [رفتار exclude کردن فایل‌ها هنگام بسته‌بندی](https://github.com/liara-cloud/cli/blob/master/src/utils/create-archive.ts)


## وضعیت استقرار بررسی‌شده

در ۱ آبان ۱۴۰۵، نسخهٔ `t-hak-amirhosein` با CLI روی PaaS منتشر و وضعیت release آن `READY` تأیید شد. آدرس برنامه [t-hak-amirhosein.liara.run](https://t-hak-amirhosein.liara.run) است. PostgreSQL اقتصادی در همان شبکهٔ خصوصی برنامه، ۲۲۵٬۹۰۳ محصول، ۳۳۱٬۵۰۶ آفر و ۶٬۴۷۶ فروشگاه را نگه می‌دارد. ایندکس‌ها، کلیدهای خارجی و sequenceها بازیابی و آمار query planner آماده شدند؛ نمونهٔ محتوای سه جدول اصلی با منبع محلی تطبیق داده شد.

دسترسی عمومی دیتابیس فقط برای انتقال فعال بود و پس از پایان انتقال بسته شد؛ برنامه از مسیر خصوصی وصل است. روی نصب فعلی، ورود دوبارهٔ CSV لازم نیست. اطلاعات اتصال واقعی صرفاً در `.env` و تنظیمات محیط لیارا نگهداری می‌شود.

بررسی‌ها: ۷۰ تست بک‌اند روی image مخصوص لیارا، ۳ تست تنظیمات انتشار، بررسی بستهٔ ارسالی برای حذف رازها و دیتاست، سلامت HTTPS، صفحهٔ اصلی/پنل/نمایشگاه/فونت، گفت‌وگوی واقعی با محصول و فروشندگان، نقشه و عرض موبایل، ورود پنل با CSRF و cookie امن و heartbeat worker. بعد از بسته‌شدن شبکهٔ عمومی دیتابیس نیز سلامت وب تأیید شد. این بررسی، آزمون فشار یا تضمین تعداد مشخصی کاربر هم‌زمان نیست.

منبع وضعیت حساب و هزینه، API همان حساب هنگام اجرا بود: دیتابیس `small-g2` با بستهٔ `basic` حدود ۱٬۰۴۱٫۶۶ تومان در ساعت، جدا از برنامهٔ موجود، هزینه داشت. قیمت روز کنسول ملاک است. متوقف‌کردن برنامهٔ وب لزوماً دیتابیس را متوقف نمی‌کند.
