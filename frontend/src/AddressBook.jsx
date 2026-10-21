import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Home, LocateFixed, MapPin, Minus, Navigation, Pencil, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react'
import TehranMap, { TEHRAN_BOUNDS } from './TehranMap.jsx'
import './addresses.css'

async function request(path, options = {}, csrf = '') {
  const response = await fetch(`/api/${path}`, { credentials: 'same-origin', cache: 'no-store', ...options, headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf, ...options.headers } })
  let data
  try { data = await response.json() } catch { throw new Error('ارتباط با سرور برقرار نشد؛ دوباره تلاش کن.') }
  if (!response.ok) throw new Error(data.error || (response.status === 403 ? 'نشست منقضی شده؛ صفحه را تازه کن.' : 'ثبت اطلاعات ممکن نشد. دوباره تلاش کن.'))
  return data
}

function AddressForm({ address, theme, csrf, onSaved, onBack, canGoBack, onSaving }) {
  const [fields, setFields] = useState({ label: address?.label || '', full_address: address?.full_address || '', plaque: address?.plaque || '', unit: address?.unit || '' })
  const [point, setPoint] = useState(address ? [address.longitude, address.latitude] : null)
  const [reverse, setReverse] = useState({ loading: false, error: '', found: false })
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')
  const map = useRef(null)
  const timer = useRef(null)
  const controller = useRef(null)
  const sequence = useRef(0)
  const manualRevision = useRef(0)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; clearTimeout(timer.current); controller.current?.abort(); sequence.current += 1 } }, [])
  function pick(next) {
    setPoint(next); setFields(f => ({ ...f, full_address: '' })); setError(''); clearTimeout(timer.current); controller.current?.abort()
    const current = ++sequence.current
    const revision = manualRevision.current
    setReverse({ loading: true, error: '', found: false })
    timer.current = setTimeout(() => lookup(next, current, revision), 900)
  }
  async function lookup(next = point, current = ++sequence.current, revision = manualRevision.current) {
    if (!next) return
    controller.current?.abort()
    const abort = new AbortController(); controller.current = abort
    setReverse({ loading: true, error: '', found: false })
    try {
      const data = await request(`locations/reverse/?lat=${next[1]}&lon=${next[0]}`, { signal: abort.signal })
      if (current !== sequence.current || !mounted.current) return
      if (data.found && manualRevision.current === revision) setFields(f => ({ ...f, full_address: data.address }))
      setReverse({ loading: false, error: data.found ? '' : 'نشانی این نقطه پیدا نشد؛ آدرس کامل را دستی بنویس.', found: data.found })
    } catch (failure) {
      if (failure.name !== 'AbortError' && current === sequence.current && mounted.current) setReverse({ loading: false, error: failure.message, found: false })
    }
  }
  function locate() {
    if (!navigator.geolocation) { setError('مرورگر تو از موقعیت مکانی پشتیبانی نمی‌کند؛ نقطه را روی نقشه انتخاب کن.'); return }
    setLocating(true); setError('')
    navigator.geolocation.getCurrentPosition(result => {
      if (!mounted.current) return
      setLocating(false)
      const next = [result.coords.longitude, result.coords.latitude]
      if (next[0] < TEHRAN_BOUNDS[0][0] || next[0] > TEHRAN_BOUNDS[1][0] || next[1] < TEHRAN_BOUNDS[0][1] || next[1] > TEHRAN_BOUNDS[1][1]) { setError('موقعیت فعلی خارج از محدودهٔ تهران است؛ یک نقطه داخل تهران انتخاب کن.'); return }
      map.current?.goTo(next)
    }, failure => {
      if (!mounted.current) return
      setLocating(false)
      setError(failure.code === 1 ? 'دسترسی به موقعیت مکانی رد شد؛ نقطه را روی نقشه انتخاب کن.' : 'موقعیت فعلی پیدا نشد؛ روی نقشه انتخابش کن.')
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 })
  }
  async function save(event) {
    event.preventDefault()
    if (!point) { setError('ابتدا نقطهٔ دقیق آدرس را روی نقشه انتخاب کن.'); return }
    setSaving(true); onSaving(true); setError('')
    try {
      const result = await request(address ? `addresses/${address.id}/` : 'addresses/', { method: address ? 'PATCH' : 'POST', body: JSON.stringify({ ...fields, latitude: point[1], longitude: point[0] }) }, csrf)
      await onSaved(result.address)
    } catch (failure) { if (mounted.current) { setError(failure.message); setSaving(false); onSaving(false) } }
  }
  function field(name, value) { if (name === 'full_address') manualRevision.current += 1; setFields(f => ({ ...f, [name]: value })) }
  return <form className="address-editor" onSubmit={save}>
    <div className="address-map-pane"><div className="address-map-heading"><span><MapPin size={18}/>نقطهٔ دقیق آدرست</span><small>روی نقشه بزن یا نقشه را زیر نشان بکش</small></div><div className="address-map-canvas"><TehranMap ref={map} theme={theme} pickMode onPick={pick} initialCoordinates={point}/><div className={`address-center-pin ${point ? 'point-chosen' : ''}`} aria-hidden="true"><MapPin size={43} fill="currentColor"/><span/></div><button type="button" className="address-confirm-center" onClick={() => map.current?.pickCenter()}><MapPin size={15}/>انتخاب مرکز نقشه</button><div className="address-map-controls"><button type="button" aria-label="بزرگنمایی نقشه آدرس" onClick={() => map.current?.zoomIn()}><Plus size={20}/></button><button type="button" aria-label="کوچک‌نمایی نقشه آدرس" onClick={() => map.current?.zoomOut()}><Minus size={20}/></button></div><button type="button" className="address-geolocate" disabled={locating} onClick={locate}><LocateFixed size={19}/>{locating ? 'در حال پیدا کردن…' : 'موقعیت فعلی من'}</button></div><div className={`address-point-status ${point ? 'is-picked' : ''}`} role="status">{point ? <><Check size={17}/>نقطه انتخاب شد؛ می‌توانی جابه‌جایش کنی</> : <><Navigation size={17}/>برای ثبت آدرس، یک نقطه روی نقشه انتخاب کن</>}</div></div>
    <div className="address-fields-pane"><div className="address-fields-intro"><span>جزئیات آدرس</span><p>نشانی را بررسی و اطلاعات ساختمان را تکمیل کن.</p></div><label>نام مختصر آدرس <span>ضروری</span><input name="label" required minLength={2} maxLength={60} placeholder="مثلاً خانه یا محل کار" value={fields.label} onChange={e => field('label', e.target.value)}/></label><div className="address-name-presets">{['خانه', 'محل کار'].map(label => <button type="button" key={label} onClick={() => field('label', label)}><Home size={13}/>{label}</button>)}</div><label>آدرس کامل <span>ضروری</span><textarea name="full_address" required minLength={10} maxLength={1000} rows={3} placeholder="تهران، محله، خیابان، کوچه…" value={fields.full_address} onChange={e => field('full_address', e.target.value)}/></label><div className={`reverse-status ${reverse.error ? 'reverse-error' : ''}`} aria-live="polite">{reverse.loading ? <><RefreshCw size={13} className="address-spinning"/>در حال دریافت نشانی از نقشه…</> : reverse.error ? <><span>{reverse.error}</span><button type="button" onClick={() => lookup()} disabled={!point}>تلاش دوباره</button></> : reverse.found ? <><Check size={13}/>نشانی پیشنهادی دریافت شد؛ می‌توانی اصلاحش کنی.</> : <span>انتخاب نقطه، نشانی پیشنهادی را اینجا پر می‌کند.</span>}</div><div className="address-building-fields"><label>پلاک <span>ضروری</span><input name="plaque" required maxLength={20} placeholder="مثلاً ۱۲ یا بدون پلاک" value={fields.plaque} onChange={e => field('plaque', e.target.value)}/></label><label>واحد <span>اختیاری</span><input name="unit" maxLength={20} placeholder="مثلاً ۳" value={fields.unit} onChange={e => field('unit', e.target.value)}/></label></div><p className="address-storage-note">آدرس در نشست همین مرورگر ذخیره می‌شود. نشانی خودکار ممکن است دقیق نباشد؛ پلاک و واحد را خودت وارد کن.</p><p className="address-provider-note">برای دریافت نشانی، مختصات انتخابی به سرویس فوتون ارسال می‌شود. اطلاعات ساختمان ارسال نمی‌شود.</p>{error && <p className="address-form-error" role="alert">{error}</p>}<div className="address-form-actions">{canGoBack && <button type="button" className="address-back" onClick={onBack} disabled={saving}>برگشت</button>}<button className="address-submit" type="submit" disabled={saving || reverse.loading || !point}><Save size={18}/>{saving ? 'در حال ثبت…' : address ? 'ذخیرهٔ تغییرات' : 'ثبت و انتخاب آدرس'}</button></div></div>
  </form>
}

export default function AddressBook({ theme, onActiveChange }) {
  const [addresses, setAddresses] = useState([])
  const [csrf, setCsrf] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(undefined)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const dialog = useRef(null)
  const trigger = useRef(null)
  const change = useRef(onActiveChange); change.current = onActiveChange
  const active = addresses.find(a => a.is_active)
  async function load(initial = false) {
    setLoading(true); setError('')
    try {
      const data = await request('addresses/')
      setAddresses(data.addresses); setCsrf(data.csrf_token)
      change.current(data.addresses.find(a => a.is_active) || null)
      if (!data.addresses.length) { setEditing(null); setOpen(true) }
      else if (initial) setEditing(undefined)
      return data.addresses
    } catch (failure) { setError(failure.message); if (initial) setOpen(true); throw failure }
    finally { setLoading(false) }
  }
  useEffect(() => { load(true).catch(() => {}) }, [])
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focus = setTimeout(() => dialog.current?.querySelector('button:not(:disabled),input')?.focus(), 50)
    function keys(event) {
      if (event.key === 'Escape') { event.stopPropagation(); if (addresses.length && !busy) setOpen(false) }
      if (event.key !== 'Tab') return
      const focusable = [...dialog.current.querySelectorAll('button:not(:disabled),input,textarea,a[href]')].filter(e => e.getClientRects().length)
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', keys, true)
    return () => { clearTimeout(focus); document.body.style.overflow = overflow; document.removeEventListener('keydown', keys, true); previous?.focus?.() }
  }, [open, addresses.length, busy])
  function show() { setError(''); setDeleting(null); setEditing(addresses.length ? undefined : null); setOpen(true); if (!csrf) load().catch(() => {}) }
  function saved(next) {
    const remaining = [next, ...addresses.filter(a => a.id !== next.id).map(a => next.is_active ? { ...a, is_active: false } : a)]
    setAddresses(remaining); change.current(remaining.find(a => a.is_active) || null); setOpen(false); setEditing(undefined); setBusy(false)
  }
  async function activate(address) {
    setBusy(true); setError('')
    try { await request(`addresses/${address.id}/activate/`, { method: 'POST' }, csrf); await load(); setOpen(false) }
    catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }
  async function remove(id) {
    setBusy(true); setError('')
    try { await request(`addresses/${id}/`, { method: 'DELETE' }, csrf); const remaining = await load(); setDeleting(null); if (!remaining.length) setEditing(null) }
    catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }
  return <><button ref={trigger} className={`location-button address-header-button ${!active ? 'needs-address' : ''}`} aria-label="انتخاب آدرس" aria-haspopup="dialog" onClick={show}><span className="address-header-icon"><MapPin size={22}/></span><span><small>{active ? 'آدرس انتخابی' : 'برای خرید نزدیکت'}</small><strong>{loading ? 'در حال دریافت…' : active?.label || 'ثبت آدرس'}</strong></span><ChevronDown size={15}/></button>{open && createPortal(<div className="address-overlay" dir="rtl" onClick={e => { if (e.target === e.currentTarget && addresses.length && !busy) setOpen(false) }}><section ref={dialog} className={`address-dialog ${editing === undefined ? 'address-list-dialog' : ''}`} role="dialog" aria-modal="true" aria-labelledby="address-dialog-title"><header className="address-dialog-header"><div className="address-dialog-symbol"><MapPin size={25}/></div><div><h2 id="address-dialog-title">{editing === undefined ? 'آدرس‌های تو' : editing ? 'ویرایش آدرس' : 'از کجا خرید رو شروع کنیم؟'}</h2><p>{addresses.length ? 'نزدیک‌ترین انتخاب‌ها، از آدرس تو شروع می‌شوند.' : 'برای ادامه، آدرست را در تهران ثبت کن.'}</p></div>{addresses.length > 0 && <button type="button" className="address-close" aria-label="بستن انتخاب آدرس" disabled={busy} onClick={() => setOpen(false)}><X size={22}/></button>}</header>{error && <div className="address-load-error" role="alert">{error}<button onClick={() => load().catch(() => {})}>دوباره تلاش کن</button></div>}{loading ? <div className="address-loading"><RefreshCw className="address-spinning" size={24}/>در حال دریافت آدرس‌ها…</div> : csrf && editing !== undefined ? <AddressForm key={editing?.id || 'new'} address={editing} theme={theme} csrf={csrf} onSaved={saved} onSaving={setBusy} onBack={() => setEditing(undefined)} canGoBack={addresses.length > 0}/> : csrf && <div className="address-list">{addresses.map(a => <article key={a.id} className={`saved-address ${a.is_active ? 'active-address' : ''}`}><button className="saved-address-select" disabled={busy} onClick={() => activate(a)}><span className="address-radio">{a.is_active && <Check size={14}/>}</span><span><strong>{a.label}{a.is_active && <small>انتخاب‌شده</small>}</strong><p>{a.full_address}</p><small>پلاک {a.plaque}{a.unit ? `، واحد ${a.unit}` : ''}</small></span></button><div className="saved-address-actions"><button disabled={busy} aria-label={`ویرایش ${a.label}`} onClick={() => { setEditing(a); setError('') }}><Pencil size={17}/></button><button disabled={busy} aria-label={`حذف ${a.label}`} onClick={() => setDeleting(a.id)}><Trash2 size={17}/></button></div>{deleting === a.id && <div className="address-delete-confirm"><span>این آدرس حذف شود؟</span><button disabled={busy} onClick={() => remove(a.id)}>حذف آدرس</button><button onClick={() => setDeleting(null)}>انصراف</button></div>}</article>)}<button className="add-new-address" disabled={busy || addresses.length >= 10} onClick={() => setEditing(null)}><Plus size={21}/>ثبت آدرس جدید</button><p className="address-list-note">آدرس‌ها به همین مرورگر اختصاص دارند؛ برای دسترسی در دستگاه دیگر، حساب کاربری در مرحلهٔ بعد اضافه می‌شود.</p></div>}</section></div>, document.body)}</>
}
