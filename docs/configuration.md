# تنظیمات محیط و اتصال

[فهرست مستندات](README.md) · [پنل](admin-panel.md)

`.env.example` را یک بار به `.env` کپی کنید و مقادیر همان نصب را وارد کنید. `.env` موجود را در به‌روزرسانی بازنویسی نکنید. متغیرهای محیط shell می‌توانند بر interpolation فایل Compose اولویت داشته باشند.

## جدول متغیرها

| نام | نمونه/پیش‌فرض | کاربرد |
| --- | --- | --- |
| `POSTGRES_DB` | `torob_hakatoon` | نام دیتابیس |
| `POSTGRES_USER` | `torob` | کاربر PostgreSQL |
| `POSTGRES_PASSWORD` | مقدار مخصوص نصب | رمز دیتابیس؛ در اولین ساخت volume اعمال می‌شود |
| `POSTGRES_PORT` | `15432` | پورت میزبان در توسعه؛ داخل Docker همیشه 5432 |
| `DJANGO_SECRET_KEY` | مقدار تصادفی | امضای نشست و مبنای رمزگذاری اتصال |
| `DJANGO_DEBUG` | `true` در نمونه | توسعه؛ Compose پروداکشن آن را false می‌کند |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1,backend` | میزبان‌های مجاز؛ برای دامنه تنظیم شود |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | دو نشانی محلی پورت 5000 | originهای مجاز همراه scheme و پورت |
| `BACKEND_PORT` | `8000` | پورت میزبان بک‌اند توسعه |
| `FRONTEND_PORT` | `5000` | پورت رابط روی میزبان |
| `SERVER_BIND` | `0.0.0.0` | bind پروداکشن؛ `127.0.0.1` برای دسترسی فقط محلی |
| `AI_BASE_URL` | آدرس HTTPS حساب BoxAPI | آدرس پایهٔ سرویس سازگار |
| `AI_API_KEY` | خالی در نمونه | کلید سمت سرور |
| `AI_MODEL` | شناسهٔ مجاز گفتگو | ساخت پیش‌فرض اولیهٔ پروفایل |
| `AI_TIMEOUT_SECONDS` | `60` | انتظار سرویس مدل؛ مستقل از deadline کل نوبت |
| `AGENT_TURN_TIMEOUT_SECONDS` | `90` | مهلت کل نوبت شامل صف |
| `PANEL_ADMIN_USERNAME` | `admin` | نام اولین مدیر |
| `PANEL_ADMIN_PASSWORD` | خالی در نمونه | رمز اولیه با حداقل ۱۲ نویسه |
| `VITE_MAP_STYLE_URL` | OpenFreeMap positron | URL عمومی style؛ راز نیست و در build فرانت قرار می‌گیرد |
| `GEOCODER_BASE_URL` | `https://photon.komoot.io` | آدرس معکوس؛ fair use و محدودیت سرویس عمومی لحاظ شود |
| `GEOCODER_USER_AGENT` | شناسهٔ پروژه | معرفی درخواست به سرویس geocoder |
| `WEB_CONCURRENCY` | `2` | تعداد worker وب Gunicorn |
| `WEB_THREADS` | `4` | thread هر worker وب |
| `COOKIE_SECURE` | `false` | پشت HTTPS روی true؛ روی HTTP محلی false |

تغییر رمز `.env`، رمز کاربر داخل volume قبلی PostgreSQL را تغییر نمی‌دهد. برای تغییر رمز دیتابیس موجود باید آن را در خود PostgreSQL تغییر و سپس تنظیمات برنامه را هماهنگ کنید؛ volume را برای حل این مسئله حذف نکنید.

## مدل‌های مجاز

| endpoint | شناسه‌ها |
| --- | --- |
| `/chat/completions` | `gpt-6.1-sol`، `gpt-6-astra`، `gpt-6-luna`، `gpt-6-sol`، `gpt-5-mini`، `gpt-5.6-luna`، `gpt-5.6-terra`، `gpt-5.6-sol`، `gpt-5.4-mini`، `gpt-5.3-codex` |
| `/embeddings` | `text-embedding-3-small`، `text-embedding-3-large` |

تنظیمات محیط نقطهٔ شروع‌اند؛ اتصال جایگزین و مدل پیش‌فرض فعال پنل در درخواست‌های بعدی اعمال می‌شوند. تغییر `AI_MODEL` در محیط الزاماً پروفایل پیش‌فرض موجود پنل را عوض نمی‌کند؛ انتخاب را در پنل بررسی کنید. embedding در چت استفاده نمی‌شود.

پس از تغییر محیط، صرف restart برای اعمال environment جدید کافی نیست:

```powershell
docker compose -f compose.production.yaml up -d --force-recreate backend agentworker
```

بعد از تغییر `VITE_MAP_STYLE_URL` فرانت پروداکشن را دوباره build کنید:

```powershell
docker compose -f compose.production.yaml up -d --build frontend
```

کلیدها را با پیشوند `VITE_` تعریف نکنید؛ این متغیرها برای کد عمومی مرورگرند. هنگام انتقال نصب، `.env` و `DJANGO_SECRET_KEY` را جدا و امن نگه دارید تا کلید ذخیره‌شدهٔ پنل قابل خواندن بماند. مقدار secret واقعی در مثال، screenshot یا کامیت قرار نگیرد.


برای متغیرهای `LIARA_*`، انتخاب تیم و اتصال دیتابیس PaaS به [راهنمای CLI](liara-cli.md) مراجعه کنید. این متغیرها مخصوص ابزار انتشار محلی‌اند؛ wrapper فقط تنظیمات runtime لازم را به برنامه می‌فرستد.
