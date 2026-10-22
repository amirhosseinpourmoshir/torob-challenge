let sessionPromise

// نشست باید پیش از درخواست‌های هم‌زمان چت، آدرس و ذخیره‌ها ایجاد شود.
export function ensureBrowserSession() {
  if (!sessionPromise) {
    sessionPromise = fetch('/api/addresses/', { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('ارتباط کامل نشد؛ دوباره تلاش کنیم؟')
      await response.json()
    }).catch(error => { sessionPromise = null; throw error })
  }
  return sessionPromise
}
