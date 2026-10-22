export const zone = 'Asia/Tehran'
export const DAY = 86400000
const persianParts = new Intl.DateTimeFormat('en-US-u-ca-persian', { timeZone: zone, year: 'numeric', month: 'numeric', day: 'numeric' })
export function jalaliParts(date) { return Object.fromEntries(persianParts.formatToParts(date).filter(p => ['year', 'month', 'day'].includes(p.type)).map(p => [p.type, Number(p.value)])) }
export function dateKey(date) { return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) }
export function calendarMonth(date) {
  const reference = new Date(dateKey(date) + 'T12:00:00Z')
  const first = new Date(reference.getTime() - (jalaliParts(reference).day - 1) * DAY)
  const next = new Date(first.getTime() + 31 * DAY)
  while (jalaliParts(next).day !== 1) next.setTime(next.getTime() - DAY)
  const days = Math.round((next - first) / DAY)
  return { first, next, days, offset: (first.getUTCDay() + 1) % 7, label: new Intl.DateTimeFormat('fa-IR', { timeZone: zone, month: 'long', year: 'numeric' }).format(first) }
}
