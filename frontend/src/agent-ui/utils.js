export const fa = value => new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(value)
export const isAmount = value => typeof value === 'number' && Number.isFinite(value) && value >= 0
export const money = value => isAmount(value) ? fa(value) : 'قیمت نامشخص'
export const percentOff = (price, original) => isAmount(price) && isAmount(original) && original > price ? Math.round((original - price) / original * 100) : null
export function safeImage(value) {
  if (typeof value !== 'string') return null
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return value
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null } catch { return null }
}
export const persianDate = value => {
  const date = value != null ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeZone: 'Asia/Tehran' }).format(date) : 'زمان ثبت نشده'
}
export const emit = (onAction, type, payload = {}) => onAction?.({ type, payload })
