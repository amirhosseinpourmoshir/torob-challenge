# اجرا، نگهداری و رفع خطا

[فهرست مستندات](README.md) · [شروع سریع](../README.md)

تمام دستورهای این صفحه از ریشهٔ مخزن اجرا می‌شوند و مربوط به `compose.production.yaml` هستند. برای توسعه، از فایل پیش‌فرض به‌جای این فایل استفاده کنید. نمونه‌ها با نام کاربر `torob` و دیتابیس `torob_hakatoon` نوشته شده‌اند؛ اگر تنظیم را تغییر داده‌اید، نام واقعی را جایگزین کنید.

## عملیات روزمره

| کار | دستور |
| --- | --- |
| ساخت و اجرا | `docker compose -f compose.production.yaml up -d --build` |
| وضعیت | `docker compose -f compose.production.yaml ps` |
| logهای اخیر | `docker compose -f compose.production.yaml logs --tail 100 backend agentworker frontend` |
| دنبال‌کردن log | `docker compose -f compose.production.yaml logs -f backend agentworker` |
| توقف بدون حذف داده | `docker compose -f compose.production.yaml down` |
| روشن‌کردن image موجود | `docker compose -f compose.production.yaml up -d --no-build` |
| بررسی Django | `docker compose -f compose.production.yaml exec backend python manage.py check` |
| تغییر رمز مدیر موجود | `docker compose -f compose.production.yaml exec backend python manage.py changepassword admin` |

مدیر اولیه فقط یک بار ساخته می‌شود. تغییر `PANEL_ADMIN_PASSWORD` در `.env` رمز حساب موجود را تغییر نمی‌دهد. `bootstrap_panel` حساب فعال قبلی را حفظ می‌کند.

## دریافت نسخهٔ تازه از GitHub

ابتدا تغییرات محلی را بررسی و از دیتابیس نسخهٔ پشتیبان بگیرید. `.env` موجود را حفظ کنید.

```powershell
git status
git pull --ff-only origin main
docker compose -f compose.production.yaml up -d --build
docker compose -f compose.production.yaml ps
docker compose -f compose.production.yaml exec backend python manage.py check
```

اگر pull به علت تغییر محلی یا تاریخچه متوقف شد، ابتدا همان اختلاف را بررسی کنید؛ از reset اجباری یا force push برای دورزدن آن استفاده نکنید. migrationهای نسخهٔ جدید در شروع backend اجرا می‌شوند. دیتاست را در هر به‌روزرسانی دوباره وارد نکنید؛ import مخصوص نصب تازه یا تغییر واقعی snapshot است.

در پروداکشن سورس داخل image کپی شده است. ویرایش فایل میزبان و restart ساده، کد image را تغییر نمی‌دهد؛ build مجدد لازم است.

## پشتیبان‌گیری PostgreSQL

فایل dump را بیرون مخزن نگه دارید. این روش از redirect باینری PowerShell استفاده نمی‌کند:

```powershell
$backupDirectory = Join-Path $env:USERPROFILE 'torob-backups'
New-Item -ItemType Directory -Force -Path $backupDirectory
$backupPath = Join-Path $backupDirectory ('torob-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.dump')
docker compose -f compose.production.yaml exec -T db pg_dump -U torob -d torob_hakatoon -Fc -f /tmp/torob-backup.dump
docker compose -f compose.production.yaml cp db:/tmp/torob-backup.dump $backupPath
Get-Item $backupPath
```

پیش از اتکا به backup، موفقیت دستور dump و وجود فایل غیرخالی را بررسی کنید. فایل `.env` و secret را نیز جداگانه و امن نگه دارید. dump شامل دادهٔ شخصی نشست‌ها و تنظیمات است و نباید وارد Git شود. برای نصب‌های با نام متفاوت یا چند اپراتور هم‌زمان، نام فایل موقت یکتا انتخاب کنید.

### بازیابی روی نصب تازه

این مسیر برای دیتابیس مقصد خالی است؛ روی دیتابیس فعال کاربر بدون برنامهٔ انتقال اجرا نشود. ابتدا `.env` مقصد را آماده کنید، فقط db را بالا بیاورید، backup را کپی و بازیابی کنید؛ سپس برنامه را اجرا کنید.

```powershell
# مسیر فایل backup خودتان را جایگزین کنید.
$backupPath = 'C:/Users/YOUR_USER/torob-backups/torob-backup.dump'
docker compose -f compose.production.yaml up -d db
docker compose -f compose.production.yaml cp $backupPath db:/tmp/torob-restore.dump
docker compose -f compose.production.yaml exec -T db pg_restore -U torob -d torob_hakatoon --no-owner --no-privileges --exit-on-error /tmp/torob-restore.dump
docker compose -f compose.production.yaml up -d --build
```

منتظر سالم‌شدن db بمانید. اگر جداول مقصد از قبل وجود دارند، بازیابی را ادامه ندهید تا وضعیت مقصد روشن شود. برای انتقال، یکی از دو مسیر «import CSV در دیتابیس خالی» یا «restore کامل backup» را انتخاب کنید؛ restore بعد از ایجاد جداول برنامه می‌تواند با تداخل روبه‌رو شود.

## اجرای ارائه و بررسی دستی

- صفحهٔ اصلی و پنل باز شوند و backend/db در `ps` سالم باشند؛ worker روشن باشد.
- آدرس تهران فعال باشد و انتخاب نقطه/آدرس معکوس بررسی شود.
- اتصال مدل با مدل پیش‌فرض گفتگو تست شود؛ حساب اعتبار API داشته باشد.
- محصول با بودجه جستجو شود؛ کارت، مشخصات، مشابه‌ها و مقایسه باز شوند.
- فیلتر دسته و متن داخل ویترین پاسخ بدهد و خطای HTML نمایش داده نشود.
- دکمهٔ فروشگاه‌های یک پیام قدیمی، همان گروه را روی نقشه نمایش دهد؛ هر فروشگاه قابل انتخاب باشد.
- Stop در پیام در حال اجرا کار کند؛ رفرش، مبلغ و گفتگو را درست بازیابی کند.
- فهرست ذخیره‌ها، تم روشن/تاریک و موبایل بررسی شوند.
- متن استعلام قابل آماده‌سازی باشد؛ ارسال واقعی پیام قابلیت فعلی نیست.

این بررسی‌ها جای تست‌های واحد را نمی‌گیرند. دستورهای تست در README آمده‌اند. برای تغییر صرفاً مستندات، بررسی لینک‌ها و تطابق مثال‌ها با سورس مناسب است.

## رفع خطاهای رایج

| نشانه | بررسی و اقدام |
| --- | --- |
| خطای دسترسی clone | دسترسی حساب به مخزن خصوصی و احراز هویت GitHub را بررسی کنید. |
| Docker در دسترس نیست | Docker Desktop/daemon روشن و Linux containers فعال باشد. |
| پورت ۵۰۰۰ اشغال است | برنامهٔ قبلی را متوقف یا `FRONTEND_PORT` را عوض کنید؛ CSRF origin را هم هماهنگ کنید. |
| backend شروع نمی‌شود | log را بخوانید؛ رمز دیتابیس، migration و رمز حداقل ۱۲ نویسهٔ اولین مدیر را بررسی کنید. |
| password authentication failed | رمز `.env` باید با کاربر volume قبلی مطابق باشد؛ تغییر env به‌تنهایی رمز داخل PostgreSQL را عوض نمی‌کند. |
| پنل login نمی‌شود | رمز واقعی حساب موجود و cookie/CSRF origin را بررسی کنید؛ روی HTTP محلی `COOKIE_SECURE=false` باشد. |
| خطای ۴۰۰ برای Host یا ۴۰۳ CSRF | hostname در ALLOWED_HOSTS و origin کامل در CSRF_TRUSTED_ORIGINS قرار گیرد؛ پس از تغییر محیط سرویس recreate شود. |
| کاتالوگ خالی است | CSV در `dataset` باشد و import/audit روی همین دیتابیس انجام شده باشد. |
| چت در صف می‌ماند | وضعیت و log `agentworker` را ببینید؛ اتصال، اعتبار API و deadline را بررسی کنید. |
| پاسخ مدل کند است | زمان ابزار و مدل را در رخدادها مقایسه کنید؛ زمان شبکهٔ BoxAPI با سریع‌ترشدن وب‌سرور حذف نمی‌شود. |
| نقشه خالی است | اتصال به OpenFreeMap، WebGL مرورگر، log/خطای شبکه و style URL را بررسی کنید. |
| فروشگاه‌ها در زوم دور دیده نمی‌شوند | دریافت عمومی برای جلوگیری از تراکم محدود است؛ نزدیک‌تر شوید. نتایج منتخب پیام مسیر نمایش مستقل دارند. |
| آدرس معکوس کامل نیست | پوشش و دسترسی Photon را بررسی کنید و نشانی را دستی تکمیل کنید؛ سرویس عمومی تضمین نامحدود ندارد. |
| کلیک نقشه نتیجهٔ قبلی را نشان می‌دهد | نسخهٔ تازهٔ فرانت را build و صفحه را reload کنید؛ هر پیام گروه فروشگاه خودش را فعال می‌کند. |
| کد عوض شده ولی رابط همان است | پروداکشن image ثابت دارد؛ `up -d --build` اجرا و cache مرورگر بررسی شود. |
| میکروفن کار نمی‌کند | مجوز، HTTPS/localhost و پشتیبانی speech مرورگر لازم است؛ ورود متن همچنان در دسترس است. |

اگر دانلود dependencyهای Python در شبکهٔ شما مشکل دارد، index جایگزین اختیاری است:

```powershell
docker compose -f compose.production.yaml build --build-arg PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple
docker compose -f compose.production.yaml up -d --no-build
```

## انتقال به میزبان واقعی

[راهنمای میزبانی](hosting.md) ظرفیت پیشنهادی را توضیح می‌دهد. قبل از اجرای عمومی، دامنه، HTTPS، host/origin، cookie و مسیر backup را متناسب با میزبان تنظیم کنید. روی VPS کوچک `WEB_CONCURRENCY=1` می‌تواند مصرف پایه را کاهش دهد. کلیدها و backup با کانال امن منتقل شوند؛ دیتابیس عمومی نشود. دستورات این مخزن به‌خودی‌خود حساب لیارا یا دامنه را ایجاد نمی‌کنند.
