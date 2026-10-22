import { useEffect, useRef, useState } from 'react'
import { Bookmark, LoaderCircle, MapPin, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useShopping } from './shopping-context.js'
import { ProductCard } from './agent-ui/commerce.jsx'

export default function SavedProductsMenu() {
  const shopping = useShopping()
  const trigger = useRef(null), menu = useRef(null)
  const [position, setPosition] = useState({ top: 80, left: 16 })
  useEffect(() => {
    if (!shopping?.savedDropdownOpen) return
    const place = () => { const rect = trigger.current.getBoundingClientRect(); const width = Math.min(430, innerWidth - 32); setPosition({ top: Math.min(rect.bottom + 12, innerHeight - 200), left: Math.max(16, Math.min(rect.left, innerWidth - width - 16)) }) }
    const outside = event => { if (!menu.current?.contains(event.target) && !trigger.current?.contains(event.target)) shopping.closeSavedProducts() }
    const key = event => { if (event.key === 'Escape') { shopping.closeSavedProducts(); trigger.current?.focus({ preventScroll: true }) } }
    place(); document.addEventListener('pointerdown', outside); document.addEventListener('keydown', key); window.addEventListener('resize', place)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); window.removeEventListener('resize', place) }
  }, [shopping?.savedDropdownOpen])
  if (!shopping) return null
  return <><button ref={trigger} className="saved-header-button" aria-label="محصول‌های ذخیره‌شده" aria-haspopup="dialog" aria-expanded={shopping.savedDropdownOpen} title="محصول‌های نشان‌شده" onClick={shopping.openSavedProducts}><Bookmark size={22} fill={shopping.savedDropdownOpen ? 'currentColor' : 'none'}/>{shopping.savedProducts.length > 0 && <span>{shopping.savedProducts.length.toLocaleString('fa-IR')}</span>}</button>{shopping.savedDropdownOpen && createPortal(<section className="agent-ui saved-products-dropdown" ref={menu} role="dialog" aria-label="محصول‌های ذخیره‌شده" dir="rtl" style={position}><header><div><span><Bookmark size={17}/>انتخاب‌هایی که نگه داشتی</span><p>روی محصول بزن؛ فروشنده‌اش رو روی نقشه ببین.</p></div><button aria-label="بستن محصولات ذخیره‌شده" onClick={shopping.closeSavedProducts}><X size={19}/></button></header>{shopping.mappingProduct && <div className="saved-map-progress" role="status"><LoaderCircle size={17}/><span>دارم فروشنده‌ها رو پیدا می‌کنم…</span></div>}<div className="saved-dropdown-list">{shopping.savedProducts.map(product => <ProductCard key={product.id} product={product} onSelect={shopping.showProductOnMap}/>)}</div><footer><MapPin size={14}/>فروشگاه‌های نشان‌شده کنار نقشه منتظرته.</footer></section>, document.body)}</>
}
