import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Bookmark, GitCompareArrows, MapPin, Search, ShoppingBag, SlidersHorizontal, Sparkles, Store, Trash2 } from 'lucide-react'
import { ShoppingContext } from './shopping-context.js'
import { AgentDialog, PriceTag, ProductImage, LoadingCard } from './agent-ui/primitives.jsx'
import { ProductCard, ComparisonTable, SellerCard } from './agent-ui/commerce.jsx'
import './shopping-experience.css'

export default function ProductLibrary({ children, shops, origin, onToggleShop, onChooseShop, onShowSavedShops, onToast, libraryRef, onSavedCountChange }) {
  const [savedProducts, setSavedProducts] = useState([])
  const [pendingSaves, setPendingSaves] = useState([])
  const [panel, setPanel] = useState(null)
  const [sheet, setSheet] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [compare, setCompare] = useState([])
  const [comparison, setComparison] = useState([])
  const [revision, setRevision] = useState(0)
  const csrf = useRef('')
  const cache = useRef(new Map())
  function invalidateProductCache() { cache.current.clear(); setRevision(value => value + 1) }
  useEffect(() => { invalidateProductCache() }, [origin?.join(',')])
  useEffect(() => { onSavedCountChange?.(savedProducts.length) }, [savedProducts.length])
  async function request(path, method = 'GET', data, signal) {
    const response = await fetch(`/api/agent/${path}`, { method, signal, headers: { 'Content-Type': 'application/json', ...(method !== 'GET' ? { 'X-CSRFToken': csrf.current } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'دریافت اطلاعات کامل نشد؛ دوباره امتحان کن.')
    return result
  }
  useEffect(() => { const controller = new AbortController(); request('saved-products/', 'GET', undefined, controller.signal).then(data => { csrf.current = data.csrf_token; setSavedProducts(data.products) }).catch(e => { if (e.name !== 'AbortError') onToast?.(e.message) }); return () => controller.abort() }, [])
  async function toggleSaved(product) {
    if (pendingSaves.includes(product.id)) return
    setPendingSaves(ids => [...ids, product.id])
    try {
      if (!csrf.current) { const data = await request('saved-products/'); csrf.current = data.csrf_token }
      const isSaved = savedProducts.some(row => row.id === product.id)
      const data = await request('saved-products/', 'POST', { product_id: product.id, saved: !isSaved })
      setSavedProducts(data.products)
      onToast?.(isSaved ? 'از ذخیره‌های محصول برداشته شد.' : 'محصول توی ذخیره‌ها منتظرته.')
    } catch (e) { onToast?.(e.message) } finally { setPendingSaves(ids => ids.filter(id => id !== product.id)) }
  }
  const openProduct = (product, tab = 'details') => { setError(''); setPanel({ type: 'product', product, tab }) }
  const openSaved = () => { setError(''); setPanel({ type: 'saved', tab: 'products' }) }
  const addCompare = product => {
    if (compare.length >= 4 && !compare.some(row => row.id === product.id)) { onToast?.('تا چهار محصول رو می‌تونیم کنار هم مقایسه کنیم.'); return }
    if (compare.length && compare[0].category !== product.category) { onToast?.('برای مقایسه، محصول‌هایی از یک دسته انتخاب کن.'); return }
    setCompare(previous => previous.some(p => p.id === product.id) ? previous.filter(p => p.id !== product.id) : [...previous.filter(p => p.category === product.category), product].slice(-4))
  }
  const showComparison = () => { if (compare.length < 2) return; setPanel({ type: 'compare' }) }
  if (libraryRef) libraryRef.current = { openSaved, count: savedProducts.length + shops.length }
  useEffect(() => {
    if (panel?.type !== 'product') return
    const controller = new AbortController(); let live = true
    const hit = cache.current.get(panel.product.id)
    if (hit && Date.now() - hit.created < 60000) { setSheet(hit.data); setLoading(false); return }
    setSheet(null); setLoading(true); setError('')
    request(`products/${encodeURIComponent(panel.product.id)}/`, 'GET', undefined, controller.signal).then(data => { if (!live) return; cache.current.set(panel.product.id, { data, created: Date.now() }); if (cache.current.size > 24) cache.current.delete(cache.current.keys().next().value); setSheet(data) }).catch(e => { if (live && e.name !== 'AbortError') setError(e.message) }).finally(() => { if (live) setLoading(false) })
    return () => { live = false; controller.abort() }
  }, [panel?.type, panel?.product?.id, revision])
  useEffect(() => {
    if (panel?.type !== 'compare') return
    const controller = new AbortController(); setLoading(true); setComparison([]); setError('')
    Promise.all(compare.map(product => request(`products/${encodeURIComponent(product.id)}/`, 'GET', undefined, controller.signal))).then(rows => setComparison(rows.map(row => ({ ...row.product, specs: Object.fromEntries(row.specifications.map(item => [item.label, item.value])) })))).catch(e => { if (e.name !== 'AbortError') setError(e.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [panel?.type, revision])
  function chooseShop(shop) { setPanel(null); onChooseShop?.(shop) }
  function action(event) { if (event.type === 'select_shop') { const shop = sheet?.map_shops.find(row => row.id === event.payload.shopId); if (shop) chooseShop(shop) } }
  const value = { savedProducts, pendingSaves, toggleSaved, openProduct, openSellers: product => openProduct(product, 'stores'), openSimilar: product => openProduct(product, 'similar'), compare, addCompare, openSaved, clearComparison: () => setCompare([]), invalidateProductCache }
  const titles = { saved: 'چیزهایی که دوست داشتی', compare: 'انتخاب‌ها، کنار هم', product: 'یک قدم نزدیک‌تر به انتخابت' }
  const activeProduct = sheet?.product || panel?.product
  return <ShoppingContext.Provider value={value}>{children}{compare.length > 0 && <div className="shopping-compare-tray" role="region" aria-label="فهرست مقایسه"><span><GitCompareArrows size={19}/>{compare.length.toLocaleString('fa-IR')} انتخاب برای مقایسه</span><button disabled={compare.length < 2} onClick={showComparison}>مقایسه کن<ArrowLeft size={15}/></button><button className="compare-clear" aria-label="پاک کردن فهرست مقایسه" onClick={() => setCompare([])}><Trash2 size={16}/></button></div>}<AgentDialog open={!!panel} onClose={() => setPanel(null)} title={titles[panel?.type] || ''} className="shopping-sheet">
    {error && <div className="shopping-error" role="alert">{error}<button onClick={() => { cache.current.clear(); setRevision(value => value + 1) }}>تلاش دوباره</button></div>}
    {panel?.type === 'saved' && <><div className="shopping-sheet-intro"><span className="shopping-eyebrow"><Bookmark size={15}/>برای وقتی که دوباره برگشتی</span><p>انتخاب‌هات اینجا می‌مونن، حتی وقتی گفتگو رو پاک کنی.</p></div><div className="shopping-tabs" role="tablist" aria-label="نوع ذخیره‌ها">{[['products', 'محصول‌ها', savedProducts.length], ['shops', 'فروشگاه‌ها', shops.length]].map(([id, label, count]) => <button key={id} role="tab" aria-selected={panel.tab === id} onClick={() => setPanel({ ...panel, tab: id })}>{id === 'products' ? <ShoppingBag size={17}/> : <Store size={17}/>} {label}<b>{count.toLocaleString('fa-IR')}</b></button>)}</div>{panel.tab === 'products' ? savedProducts.length ? <div className="shopping-products-grid">{savedProducts.map(product => <ProductCard key={product.id} product={product}/>)}</div> : <div className="shopping-empty"><Bookmark size={35}/><h3>یه انتخاب خوب رو نگه دار</h3><p>نشانک روی محصول رو بزن؛ دفعهٔ بعد از همین‌جا پیداش کن.</p></div> : shops.length ? <div className="shopping-saved-shops"><button className="shopping-show-saved-map" onClick={() => { setPanel(null); onShowSavedShops?.() }}><MapPin size={17}/>همهٔ ذخیره‌ها رو روی نقشه ببین</button>{shops.map(shop => <article key={shop.id}><span><Store size={23}/></span><div><h3>{shop.name}</h3><p>{shop.address}</p><button onClick={() => chooseShop(shop)}><MapPin size={15}/>دیدن روی نقشه</button></div><button aria-label={`حذف ${shop.name} از ذخیره‌ها`} onClick={() => onToggleShop(shop)}><Trash2 size={17}/></button></article>)}</div> : <div className="shopping-empty"><Store size={35}/><h3>هنوز فروشگاهی نگه نداشتی</h3><p>از کارت فروشگاه روی نقشه، نشانک رو بزن.</p></div>}</>}
    {panel?.type === 'product' && <><div className="shopping-product-hero"><div className="shopping-product-art"><ProductImage src={activeProduct?.image} alt={activeProduct?.title}/><span><Sparkles size={16}/>{activeProduct?.category}</span></div><div><span className="shopping-eyebrow">انتخاب رو با خیال راحت بررسی کن</span><h2>{activeProduct?.title}</h2><PriceTag value={activeProduct?.price}/><div className="shopping-hero-actions"><button onClick={() => toggleSaved(activeProduct)}><Bookmark size={16}/>{savedProducts.some(row => row.id === activeProduct?.id) ? 'ذخیره شده' : 'نگهش دار'}</button><button onClick={() => addCompare(activeProduct)}><GitCompareArrows size={16}/>{compare.some(row => row.id === activeProduct?.id) ? 'برداشتن از مقایسه' : 'افزودن به مقایسه'}</button></div></div></div><div className="shopping-tabs" role="tablist" aria-label="اطلاعات محصول">{[['details', 'مشخصات کامل', SlidersHorizontal], ['similar', 'انتخاب‌های مشابه', GitCompareArrows], ['stores', 'کجا پیداش کنم؟', MapPin]].map(([id, label, Icon]) => <button key={id} role="tab" aria-selected={panel.tab === id} onClick={() => setPanel({ ...panel, tab: id })}><Icon size={16}/>{label}</button>)}</div>{loading ? <LoadingCard label="دارم جزئیات ثبت‌شده رو میارم…"/> : sheet && <>{panel.tab === 'details' && <div className="shopping-specifications">{sheet.specifications.length ? [...new Set(sheet.specifications.map(item => item.section))].map(section => <section key={section}><h3><SlidersHorizontal size={16}/>{section}</h3><dl>{sheet.specifications.filter(item => item.section === section).map((item, index) => <div key={index}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl></section>) : <div className="shopping-empty"><Search size={32}/><p>برای این محصول هنوز مشخصات بیشتری ثبت نشده.</p></div>}</div>}{panel.tab === 'similar' && <><p className="shopping-section-note">{sheet.similar_basis}</p><div className="shopping-products-grid">{sheet.similar.map(product => <ProductCard key={product.id} product={product}/>)}</div>{!sheet.similar.length && <p className="shopping-section-note">فعلاً انتخاب مشابهی در همین دسته پیدا نکردم.</p>}</>}{panel.tab === 'stores' && <><div className="shopping-map-guide"><MapPin size={21}/><p>{sheet.criteria?.credit_only && <strong>فقط خرید اعتباری حضوری · </strong>}یک فروشگاه رو انتخاب کن؛ نقشه باز می‌شه و فاصله‌اش تا آدرس انتخابی‌ات رو می‌بینی.</p></div><div className="shopping-sellers-grid">{sheet.offers.map(seller => <SellerCard key={seller.id} seller={seller} onAction={action}/>)}</div>{!sheet.offers.length && <p className="shopping-section-note">فعلاً فروشگاهی برای این انتخاب ثبت نشده.</p>}</>}</>}</>}
    {panel?.type === 'compare' && (loading ? <LoadingCard/> : comparison.length >= 2 && <ComparisonTable products={comparison} features={[...new Set(comparison.flatMap(product => Object.keys(product.specs || {})))].slice(0, 30).map(key => ({ key, label: key }))} onAction={event => { const product = comparison.find(row => row.id === event.payload?.productId); if (product) openProduct(product) }}/>) }
  </AgentDialog></ShoppingContext.Provider>
}
