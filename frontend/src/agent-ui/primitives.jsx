import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Check, CircleAlert, ImageOff, LoaderCircle, Package, RotateCcw, X } from 'lucide-react'
import { fa, isAmount, money, percentOff, safeImage, persianDate } from './utils.js'

export function AgentCard({ children, className = '', title, eyebrow, icon: Icon, trailing }) {
  return <section className={`au-card ${className}`}>{(title || eyebrow) && <header className="au-card-heading">{Icon && <span className="au-heading-icon"><Icon size={20}/></span>}<div>{eyebrow && <small>{eyebrow}</small>}{title && <h3>{title}</h3>}</div>{trailing}</header>}{children}</section>
}
export function ActionButton({ children, icon: Icon, tone = 'primary', className = '', ...props }) { return <button className={`au-button au-button-${tone} ${className}`} {...props}>{Icon && <Icon size={16}/>}<span>{children}</span></button> }
export function Badge({ children, tone = 'neutral', icon: Icon }) { return <span className={`au-badge au-badge-${tone}`}>{Icon && <Icon size={12}/>}<span>{children}</span></span> }
export function PriceTag({ value, original, label, compact = false }) { return <div className={`au-price ${compact ? 'is-compact' : ''}`}>{label && <small>{label}</small>}{isAmount(original) && isAmount(value) && original > value && <del>{money(original)}</del>}<span><strong>{money(value)}</strong>{isAmount(value) && <small>تومان</small>}</span></div> }
export function DiscountBadge({ price, original, percent }) { const number = percentOff(price, original) ?? (typeof percent === 'number' && Number.isFinite(percent) && percent > 0 && percent <= 100 ? Math.round(percent) : null); return number ? <Badge tone="sale">{fa(number)}٪ تخفیف</Badge> : null }
export function ProductImage({ src, alt = '', className = '', onClick }) {
  const [failed, setFailed] = useState(false)
  const url = safeImage(src)
  useEffect(() => setFailed(false), [src])
  const content = url && !failed ? <img src={url} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)}/> : <span className="au-image-fallback" role="img" aria-label={alt || 'تصویر در دسترس نیست'}>{failed ? <ImageOff size={30}/> : <Package size={30}/>}</span>
  return onClick ? <button className={`au-image ${className}`} onClick={onClick} aria-label={`بزرگنمایی تصویر ${alt}`}>{content}</button> : <div className={`au-image ${className}`}>{content}</div>
}
export function AgentDialog({ open, onClose, title, children, className = '' }) {
  const ref = useRef(null)
  const id = useId()
  const close = useRef(onClose); close.current = onClose
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const controls = () => [...ref.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') || []].filter(e => e.getClientRects().length)
    controls()[0]?.focus()
    const key = event => {
      if (event.key === 'Escape') { event.preventDefault(); close.current?.() }
      if (event.key === 'Tab') { const list = controls(), first = list[0], last = list.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() } }
    }
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = previousOverflow; previous?.focus() }
  }, [open])
  if (!open) return null
  return createPortal(<div className="agent-ui au-overlay" dir="rtl" onClick={e => { if (e.target === e.currentTarget) onClose?.() }}><section ref={ref} className={`au-dialog ${className}`} role="dialog" aria-modal="true" aria-labelledby={id}><header><h2 id={id}>{title}</h2><button className="au-icon-button" aria-label="بستن پنجره" onClick={onClose}><X size={21}/></button></header>{children}</section></div>, document.body)
}
export function EmptyCard({ title = 'هنوز انتخابی اینجا نیست', description = 'یه عبارت دیگه رو امتحان کن؛ با هم پیداش می‌کنیم.', onRetry }) { return <AgentCard className="au-empty"><Package size={30}/><h3>{title}</h3><p>{description}</p>{onRetry && <ActionButton onClick={onRetry} icon={ArrowLeft}>دوباره بگرد</ActionButton>}</AgentCard> }
export function LoadingCard({ label = 'دارم انتخاب‌ها رو کنار هم می‌چینم…' }) { return <AgentCard className="au-loading"><div role="status"><LoaderCircle size={19} className="au-spin"/>{label}</div><div className="au-skeleton"/><div className="au-skeleton"/><div className="au-skeleton short"/></AgentCard> }
export function ErrorCard({ message = 'این بار نتیجه نرسید. دوباره امتحان کنیم؟', onRetry }) { return <AgentCard className="au-error" title="یه بار دیگه امتحان کنیم" icon={CircleAlert}><p>{message}</p>{onRetry && <ActionButton onClick={onRetry} tone="secondary" icon={RotateCcw}>تلاش دوباره</ActionButton>}</AgentCard> }
export function SourceNote({ label = 'اطلاعات فروشگاه', updatedAt, status = 'unverified' }) { return <div className="au-source"><span>{status === 'confirmed' ? <Check size={13}/> : <CircleAlert size={13}/>}<span>{label}</span></span>{updatedAt && <time dateTime={updatedAt}>{persianDate(updatedAt)}</time>}</div> }
