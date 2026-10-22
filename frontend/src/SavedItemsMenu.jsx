import { useEffect, useRef, useState } from 'react'
import { Bookmark, LoaderCircle, MapPin, ShoppingBag, Store, Trash2, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useShopping } from './shopping-context.js'
import { ProductCard } from './agent-ui/commerce.jsx'

export default function SavedItemsMenu() {
  const shopping = useShopping()
  const trigger = useRef(null), menu = useRef(null)
  const [tab, setTab] = useState('products')
  const [position, setPosition] = useState({ top: 80, left: 16 })
  useEffect(() => {
    if (!shopping?.savedDropdownOpen) return
    if (!shopping.savedProducts.length && shopping.savedShops.length) setTab('shops')
    const place = () => {
      const rect = trigger.current.getBoundingClientRect(), width = Math.min(460, innerWidth - 24)
      setPosition({ top: Math.max(12, Math.min(rect.bottom + 12, innerHeight - 200)), left: Math.max(12, Math.min(rect.left, innerWidth - width - 12)), maxHeight: `calc(100dvh - ${Math.max(12, rect.bottom + 24)}px)` })
    }
    const outside = event => { if (!menu.current?.contains(event.target) && !trigger.current?.contains(event.target)) shopping.closeSavedProducts() }
    const key = event => { if (event.key === 'Escape') { shopping.closeSavedProducts(); trigger.current?.focus({ preventScroll: true }) } }
    place(); document.addEventListener('pointerdown', outside); document.addEventListener('keydown', key); window.addEventListener('resize', place); window.addEventListener('scroll', place, true)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [shopping?.savedDropdownOpen])
  if (!shopping) return null
  const total = shopping.savedProducts.length + shopping.savedShops.length
  return <>
    <button ref={trigger} className="saved-header-button" aria-label="ذخیره‌شده‌ها" aria-haspopup="dialog" aria-expanded={shopping.savedDropdownOpen} onClick={shopping.openSavedProducts} title="محصول‌ها و فروشگاه‌های ذخیره‌شده">
      <Bookmark size={22} fill={shopping.savedDropdownOpen ? 'currentColor' : 'none'}/>{total > 0 && <span>{total.toLocaleString('fa-IR')}</span>}
    </button>
    {shopping.savedDropdownOpen && createPortal(<section className="agent-ui saved-products-dropdown" ref={menu} role="dialog" aria-label="ذخیره‌شده‌ها" dir="rtl" style={position}>
      <header><div><span><Bookmark size={18}/>انتخاب‌های تو، یک‌جا</span><p>برای ادامهٔ خرید، از همین‌جا برگرد.</p></div><button aria-label="بستن ذخیره‌شده‌ها" onClick={shopping.closeSavedProducts}><X size={20}/></button></header>
      <div className="saved-kind-tabs" role="tablist" aria-label="نوع ذخیره‌ها">{[['products', 'محصول‌ها', ShoppingBag, shopping.savedProducts.length], ['shops', 'فروشگاه‌ها', Store, shopping.savedShops.length]].map(([id, label, Icon, count]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}><Icon size={17}/>{label}<b>{count.toLocaleString('fa-IR')}</b></button>)}</div>
      {shopping.mappingProduct && <div className="saved-map-progress" role="status"><LoaderCircle size={17}/>دارم فروشنده‌ها رو پیدا می‌کنم…</div>}
      <div className="saved-dropdown-list" role="tabpanel" aria-label={tab === 'products' ? 'محصول‌های نشان‌شده' : 'فروشگاه‌های نشان‌شده'}>
        {tab === 'products' ? shopping.savedProducts.length ? shopping.savedProducts.map(product => <ProductCard key={product.id} product={product} onSelect={shopping.showProductOnMap}/>) : <div className="saved-empty"><ShoppingBag size={30}/><strong>محصول دلخواهت رو نگه دار</strong><p>نشانک روی کارت محصول رو بزن تا اینجا پیداش کنی.</p></div> : shopping.savedShops.length ? shopping.savedShops.map(shop => <article className="saved-shop-item" key={shop.id}><span><Store size={23}/></span><div><h3>{shop.name}</h3><p>{shop.address}</p><button onClick={() => shopping.showSavedShop(shop)}><MapPin size={15}/>روی نقشه ببین</button></div><button aria-label={`حذف ${shop.name} از ذخیره‌ها`} onClick={() => shopping.toggleSavedShop(shop)}><Trash2 size={17}/></button></article>) : <div className="saved-empty"><Store size={30}/><strong>یه فروشگاه خوب رو نگه دار</strong><p>از کارت فروشگاه روی نقشه، نشانک رو بزن.</p></div>}
      </div>
      <footer><MapPin size={14}/>روی تصویر یا نام محصول بزن؛ فروشنده‌اش رو روی نقشه ببین.</footer>
    </section>, document.body)}
  </>
}
