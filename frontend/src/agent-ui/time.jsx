import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin } from 'lucide-react'
import { ActionButton, AgentCard, Badge } from './primitives.jsx'
import { emit, fa } from './utils.js'

import { zone, DAY, jalaliParts, dateKey, calendarMonth } from './calendar.js'
export function PersianCalendar({ selectedDate, minDate, maxDate, onAction }) {
  const initial = selectedDate && Number.isFinite(Date.parse(selectedDate)) ? new Date(selectedDate + (selectedDate.length === 10 ? 'T12:00:00Z' : '')) : new Date()
  const [cursor, setCursor] = useState(initial)
  const [selected, setSelected] = useState(selectedDate || '')
  useEffect(() => { if (selectedDate) { setSelected(selectedDate); if (Number.isFinite(Date.parse(selectedDate))) setCursor(new Date(selectedDate + (selectedDate.length === 10 ? 'T12:00:00Z' : ''))) } }, [selectedDate])
  const month = useMemo(() => calendarMonth(cursor), [cursor])
  const today = dateKey(new Date())
  return <AgentCard className="au-calendar" title="یه روز خوب برای خرید" icon={CalendarDays}><div className="au-calendar-nav"><button className="au-icon-button" aria-label="ماه قبل" onClick={() => setCursor(new Date(month.first.getTime() - DAY))}><ChevronRight size={18}/></button><strong aria-live="polite">{month.label}</strong><button className="au-icon-button" aria-label="ماه بعد" onClick={() => setCursor(month.next)}><ChevronLeft size={18}/></button></div><div className="au-calendar-grid" role="group" aria-label={month.label}>{['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map((day, i) => <span className="au-weekday" key={i}>{day}</span>)}{Array.from({ length: month.offset }, (_, i) => <span key={`empty-${i}`}/>)}{Array.from({ length: month.days }, (_, i) => { const date = new Date(month.first.getTime() + i * DAY), key = dateKey(date), disabled = !!((minDate && key < minDate) || (maxDate && key > maxDate)); return <button key={key} aria-label={new Intl.DateTimeFormat('fa-IR', { timeZone: zone, dateStyle: 'full' }).format(date)} aria-pressed={selected === key} aria-current={key === today ? 'date' : undefined} disabled={disabled} onClick={() => { setSelected(key); emit(onAction, 'select_date', { date: key, calendar: 'persian', ...jalaliParts(date) }) }}>{fa(i + 1)}</button> })}</div><button className="au-text-button" onClick={() => setCursor(new Date())}>برگشت به امروز</button></AgentCard>
}
export function DigitalClock({ label = 'الان به وقت تهران', showSeconds = true }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), showSeconds ? 1000 : 10000); return () => clearInterval(timer) }, [showSeconds])
  const parts = new Intl.DateTimeFormat('fa-IR', { timeZone: zone, hour: '2-digit', minute: '2-digit', ...(showSeconds ? { second: '2-digit' } : {}), hourCycle: 'h23' }).format(now)
  return <AgentCard className="au-clock"><span className="au-clock-kicker"><span/>{label}</span><time dateTime={now.toISOString()} dir="ltr">{parts}</time><p>{new Intl.DateTimeFormat('fa-IR', { timeZone: zone, dateStyle: 'full' }).format(now)}</p><span className="au-clock-location"><MapPin size={13}/>تهران</span></AgentCard>
}
export function VisitPlanner({ date, slots = ['۱۰:۰۰', '۱۱:۳۰', '۱۴:۰۰', '۱۶:۳۰', '۱۸:۰۰'], onAction }) { const [selected, setSelected] = useState(null); return <AgentCard className="au-visit" title="کی بریم سر بزنیم؟" icon={Clock3}>{date && <p>{new Intl.DateTimeFormat('fa-IR', { timeZone: zone, dateStyle: 'full' }).format(new Date(date))}</p>}<div className="au-time-slots">{slots.map(slot => <button key={slot} aria-pressed={slot === selected} onClick={() => setSelected(slot)}>{slot}</button>)}</div><ActionButton disabled={!selected || !date} onClick={() => emit(onAction, 'plan_visit', { date, time: selected, timeZone: zone })}>این زمان رو انتخاب کن</ActionButton></AgentCard> }
