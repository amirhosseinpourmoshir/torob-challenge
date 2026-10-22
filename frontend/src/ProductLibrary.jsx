import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Bookmark, GitCompareArrows, MapPin, Search, SlidersHorizontal, Sparkles, Store, Trash2 } from 'lucide-react'
import { ShoppingContext } from './shopping-context.js'
import { AgentDialog, PriceTag, ProductImage, LoadingCard } from './agent-ui/primitives.jsx'
import { PriceComparisonChart } from './agent-ui/charts.jsx'
import { ContactRequestCard } from './agent-ui/interactions.jsx'
import { ProductCard, ComparisonTable, SellerCard } from './agent-ui/commerce.jsx'
import './shopping-experience.css'

export default function ProductLibrary({ children, shops, origin, onToggleShop, onChooseShop, onToast, libraryRef, onSavedCountChange }) {
  const [savedProducts, setSavedProducts] = useState([])
  const [pendingSaves, setPendingSaves] = useState([])
  const [panel, setPanel] = useState(null)
  const [sheet, setSheet] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [compare, setCompare] = useState([])
  const [comparison, setComparison] = useState([])
  const [revision, setRevision] = useState(0)
  const [savedDropdownOpen, setSavedDropdownOpen] = useState(false)
  const [savedLoaded, setSavedLoaded] = useState(false)
  const [mappingProduct, setMappingProduct] = useState(null)
  const [shopSheet, setShopSheet] = useState(null)
  const focusPending = useRef(Promise.resolve())
  const csrf = useRef('')
  const cache = useRef(new Map())
  function invalidateProductCache() { cache.current.clear(); setRevision(value => value + 1) }
  useEffect(() => { invalidateProductCache() }, [origin?.join(',')])
  useEffect(() => { onSavedCountChange?.(savedProducts.length) }, [savedProducts.length, shops.length])
  async function request(path, method = 'GET', data, signal) {
    const timeout = AbortSignal.timeout(15000)
    const response = await fetch(`/api/agent/${path}`, { method, signal: signal ? AbortSignal.any([signal, timeout]) : timeout, headers: { 'Content-Type': 'application/json', ...(method !== 'GET' ? { 'X-CSRFToken': csrf.current } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'دریافت اطلاعات کامل نشد؛ دوباره امتحان کن.')
    return result
  }
  useEffect(() => { const controller = new AbortController(); request('saved-products/', 'GET', undefined, controller.signal).then(data => { csrf.current = data.csrf_token; setSavedProducts(data.products); setSavedLoaded(true) }).catch(e => { if (e.name !== 'AbortError') onToast?.(e.name === 'TimeoutError' ? 'دریافت ذخیره‌ها طول کشید؛ صفحه رو دوباره باز کن.' : e.message) }); return () => controller.abort() }, [])
  useEffect(() => { if (!savedProducts.length && !shops.length) setSavedDropdownOpen(false) }, [savedProducts.length, shops.length])
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
  const openProduct = (product, tab = 'details') => { setSavedDropdownOpen(false); setError(''); setPanel({ type: 'product', product, tab }) }
  const openSavedProducts = () => { if (!savedLoaded) { onToast?.('ذخیره‌هات هنوز در حال دریافت‌اند؛ یه لحظه دیگه امتحان کن.'); return }; if (!savedProducts.length && !shops.length) { onToast?.('هنوز انتخابی ذخیره نکردی؛ نشانک روی محصول یا فروشگاه دلخواهت رو بزن.'); return }; setSavedDropdownOpen(open => !open) }
  const openShop = shop => { setSavedDropdownOpen(false); setError(''); setPanel({ type: 'shop', shop, query: '', category: '', offset: 0 }) }
  async function showProductOnMap(product) {
    setMappingProduct(product.id)
    try {
      const data = await request(`products/${encodeURIComponent(product.id)}/?section=stores`)
      if (!data.map_shops.length) { onToast?.('با شرایط فعلی فروشنده‌ای پیدا نکردم؛ بودجه یا فیلترها رو بررسی کن.'); return }
      setSavedDropdownOpen(false); setPanel(null); onChooseShop?.(data.map_shops[0])
    } catch (e) { onToast?.(e.name === 'TimeoutError' ? 'رسیدن فروشنده‌ها طول کشید؛ دوباره امتحان کن.' : e.message) } finally { setMappingProduct(null) }
  }
  function focusShop(shop) {
    focusPending.current = focusPending.current.catch(() => {}).then(async () => {
      const conversation = await request('conversations/')
      csrf.current = conversation.csrf_token
      await request(`conversations/${conversation.id}/focus-shop/`, 'POST', { shop_id: shop.id })
    }).catch(() => {})
    return focusPending.current
  }
  const addCompare = product => {
    if (compare.length >= 4 && !compare.some(row => row.id === product.id)) { onToast?.('تا چهار محصول رو می‌تونیم کنار هم مقایسه کنیم.'); return }
    if (compare.length && compare[0].category !== product.category) { onToast?.('برای مقایسه، محصول‌هایی از یک دسته انتخاب کن.'); return }
    setCompare(previous => previous.some(p => p.id === product.id) ? previous.filter(p => p.id !== product.id) : [...previous.filter(p => p.category === product.category), product].slice(-4))
  }
  const showComparison = () => { if (compare.length < 2) return; setPanel({ type: 'compare' }) }
  if (libraryRef) libraryRef.current = { openSaved: openSavedProducts, openShop, focusShop, count: savedProducts.length + shops.length }
  useEffect(() => {
    if (panel?.type !== 'product') return
    const controller = new AbortController(); let live = true
    const key = `${panel.product.id}:${panel.tab}`
    const hit = cache.current.get(key)
    if (hit && Date.now() - hit.created < 60000) { setSheet(hit.data); setLoading(false); return }
    setSheet(null); setLoading(true); setError('')
    request(`products/${encodeURIComponent(panel.product.id)}/?section=${panel.tab}`, 'GET', undefined, controller.signal).then(data => { if (!live) return; cache.current.set(key, { data, created: Date.now() }); if (cache.current.size > 24) cache.current.delete(cache.current.keys().next().value); setSheet(data) }).catch(e => { if (live && e.name !== 'AbortError') setError(e.name === 'TimeoutError' ? 'این بار دریافت اطلاعات طول کشید؛ دوباره امتحان کنیم؟' : e.message) }).finally(() => { if (live) setLoading(false) })
    return () => { live = false; controller.abort() }
  }, [panel?.type, panel?.product?.id, panel?.tab, revision])
  useEffect(() => {
    if (panel?.type !== 'shop') return
    const controller = new AbortController(); setLoading(true); setError(''); if (!panel.offset) setShopSheet(null)
    const params = new URLSearchParams({ q: panel.query, category: panel.category, offset: panel.offset })
    const timer = setTimeout(() => request(`shops/${encodeURIComponent(panel.shop.id)}/products/?${params}`, 'GET', undefined, controller.signal).then(data => { if (controller.signal.aborted) return; setShopSheet(previous => panel.offset && previous?.shop.id === data.shop.id ? { ...data, products: [...previous.products, ...data.products] } : data) }).catch(e => { if (!controller.signal.aborted && e.name !== 'AbortError') setError(e.name === 'TimeoutError' ? 'ویترین دیر رسید؛ دوباره امتحان کنیم؟' : e.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) }), 180)
    return () => { clearTimeout(timer); controller.abort() }
  }, [panel?.type, panel?.shop?.id, panel?.query, panel?.category, panel?.offset, revision])
  useEffect(() => {
    if (panel?.type !== 'compare') return
    const controller = new AbortController(); setLoading(true); setComparison([]); setError('')
    Promise.all(compare.map(product => request(`products/${encodeURIComponent(product.id)}/?section=details`, 'GET', undefined, controller.signal))).then(rows => setComparison(rows.map(row => ({ ...row.product, specs: Object.fromEntries(row.specifications.map(item => [item.label, item.value])) })))).catch(e => { if (e.name !== 'AbortError') setError(e.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [panel?.type, revision])
  function chooseShop(shop) { setPanel(null); onChooseShop?.(shop) }
  function action(event) { if (event.type === 'request_shop_contact') { request(`shops/${encodeURIComponent(event.payload.shopId)}/inquiry/`, 'POST', { product_id: panel?.product?.id }).then(data => setSheet(previous => ({ ...previous, inquiry: data.contact }))).catch(e => onToast?.(e.message)); return }; if (event.type === 'select_shop') { const shop = sheet?.map_shops.find(row => row.id === event.payload.shopId); if (shop) chooseShop(shop) } }
  const value = { savedProducts, pendingSaves, toggleSaved, openProduct, openSellers: product => openProduct(product, 'stores'), openSimilar: product => openProduct(product, 'similar'), compare, addCompare, savedShops: shops, toggleSavedShop: onToggleShop, showSavedShop: shop => { setSavedDropdownOpen(false); chooseShop(shop) }, clearComparison: () => setCompare([]), invalidateProductCache, openSavedProducts, savedDropdownOpen, closeSavedProducts: () => setSavedDropdownOpen(false), showProductOnMap, mappingProduct, waitForFocus: () => focusPending.current }
  const titles = { compare: 'انتخاب‌ها، کنار هم', product: 'یک قدم نزدیک‌تر به انتخابت', shop: 'ویترین فروشگاه، همین‌جا' }
  const activeProduct = sheet?.product || panel?.product
  return <ShoppingContext.Provider value={value}>{children}{compare.length > 0 && <div className="shopping-compare-tray" role="region" aria-label="فهرست مقایسه"><span><GitCompareArrows size={19}/>{compare.length.toLocaleString('fa-IR')} انتخاب برای مقایسه</span><button disabled={compare.length < 2} onClick={showComparison}>مقایسه کن<ArrowLeft size={15}/></button><button className="compare-clear" aria-label="پاک کردن فهرست مقایسه" onClick={() => setCompare([])}><Trash2 size={16}/></button></div>}<AgentDialog open={!!panel} onClose={() => setPanel(null)} title={titles[panel?.type] || ''} className="shopping-sheet">
    {error && <div className="shopping-error" role="alert">{error}<button onClick={() => { cache.current.clear(); setRevision(value => value + 1) }}>تلاش دوباره</button></div>}
    {panel?.type === 'product' && <><div className="shopping-product-hero"><div className="shopping-product-art"><ProductImage src={activeProduct?.image} alt={activeProduct?.title}/><span><Sparkles size={16}/>{activeProduct?.category}</span></div><div><span className="shopping-eyebrow">انتخاب رو با خیال راحت بررسی کن</span><h2>{activeProduct?.title}</h2><PriceTag value={activeProduct?.price}/><div className="shopping-hero-actions"><button onClick={() => toggleSaved(activeProduct)}><Bookmark size={16}/>{savedProducts.some(row => row.id === activeProduct?.id) ? 'ذخیره شده' : 'نگهش دار'}</button><button onClick={() => addCompare(activeProduct)}><GitCompareArrows size={16}/>{compare.some(row => row.id === activeProduct?.id) ? 'برداشتن از مقایسه' : 'افزودن به مقایسه'}</button></div></div></div><div className="shopping-tabs" role="tablist" aria-label="اطلاعات محصول">{[['details', 'مشخصات کامل', SlidersHorizontal], ['similar', 'انتخاب‌های مشابه', GitCompareArrows], ['stores', 'کجا پیداش کنم؟', MapPin]].map(([id, label, Icon]) => <button key={id} role="tab" aria-selected={panel.tab === id} onClick={() => setPanel({ ...panel, tab: id })}><Icon size={16}/>{label}</button>)}</div>{loading ? <LoadingCard label="دارم جزئیات ثبت‌شده رو میارم…"/> : sheet && <>{panel.tab === 'details' && <div className="shopping-specifications">{sheet.specifications.length ? [...new Set(sheet.specifications.map(item => item.section))].map(section => <section key={section}><h3><SlidersHorizontal size={16}/>{section}</h3><dl>{sheet.specifications.filter(item => item.section === section).map((item, index) => <div key={index}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl></section>) : <div className="shopping-empty"><Search size={32}/><p>برای این محصول هنوز مشخصات بیشتری ثبت نشده.</p></div>}</div>}{panel.tab === 'similar' && <><p className="shopping-section-note">{sheet.similar_basis}</p><div className="shopping-products-grid">{sheet.similar.map(product => <ProductCard key={product.id} product={product}/>)}</div>{!sheet.similar.length && <p className="shopping-section-note">فعلاً انتخاب مشابهی در همین دسته پیدا نکردم.</p>}</>}{panel.tab === 'stores' && <><div className="shopping-map-guide"><MapPin size={21}/><p>{sheet.criteria?.credit_only && <strong>فقط خرید اعتباری حضوری · </strong>}یک فروشگاه رو انتخاب کن؛ نقشه باز می‌شه و فاصله‌اش تا آدرس انتخابی‌ات رو می‌بینی.</p></div>{sheet.offers.length >= 2 && <PriceComparisonChart offers={sheet.offers}/>}{sheet.offers.length > 0 && <ContactRequestCard {...(sheet.inquiry || { shopId: sheet.offers[0].id, shopName: sheet.offers[0].name, questions: ['قیمت و موجودی امروز چقدره؟'] })} onAction={action}/>}<div className="shopping-sellers-grid">{sheet.offers.map(seller => <SellerCard key={seller.id} seller={seller} onAction={action}/>)}</div>{!sheet.offers.length && <p className="shopping-section-note">فعلاً فروشگاهی برای این انتخاب ثبت نشده.</p>}</>}</>}</>}
    {panel?.type === 'shop' && <div className="shop-catalog-sheet"><div className="shop-catalog-heading"><span><Store size={28}/></span><div><small>از ویترین تا خرید حضوری</small><h2>{panel.shop.name}</h2><p>{panel.shop.address}</p></div></div><label className="shop-catalog-search"><Search size={18}/><input aria-label="جستجو در محصولات فروشگاه" value={panel.query} onChange={event => setPanel({ ...panel, query: event.target.value, offset: 0 })} placeholder="توی این فروشگاه دنبال چی می‌گردی؟" maxLength={160}/></label>{shopSheet && <><div className="shop-catalog-stats"><strong>{shopSheet.catalog.total_products.toLocaleString('fa-IR')} محصول ثبت‌شده</strong><span>قیمت‌های همین فروشگاه</span></div><div className="shop-catalog-categories"><button aria-pressed={!panel.category} onClick={() => setPanel({ ...panel, category: '', offset: 0 })}>همه</button>{shopSheet.catalog.categories.map(row => <button key={row.product__category_id} aria-pressed={panel.category === row.product__category_id} onClick={() => setPanel({ ...panel, category: row.product__category_id, offset: 0 })}>{row.product__category_id}<small>{row.products.toLocaleString('fa-IR')}</small></button>)}</div><div className="shopping-products-grid">{shopSheet.products.map(product => <ProductCard key={product.id} product={product}/>)}</div>{!shopSheet.products.length && <p className="shopping-section-note">با فیلترها و جست‌وجوی فعلی محصولی پیدا نکردم؛ یه نام کوتاه‌تر یا دستهٔ دیگه رو امتحان کنیم؟</p>}{shopSheet.catalog.has_more && <button className="shop-catalog-more" disabled={loading} onClick={() => setPanel({ ...panel, offset: shopSheet.catalog.next_offset })}>محصول‌های بیشتر<ArrowLeft size={16}/></button>}<p className="shopping-section-note">این‌ها قیمت‌های ثبت‌شدهٔ فروشگاه‌اند؛ برای تخفیف و موجودی امروز از فروشگاه بپرس.</p></>}{loading && <LoadingCard label="دارم ویترین فروشگاه رو میارم…"/>}</div>}
    {panel?.type === 'compare' && (loading ? <LoadingCard/> : comparison.length >= 2 && <><PriceComparisonChart title="قیمت انتخاب‌ها، کنار هم" basis="products" offers={comparison.map(product => ({ id: product.id, name: product.title, price: product.price }))}/><ComparisonTable products={comparison} features={[...new Set(comparison.flatMap(product => Object.keys(product.specs || {})))].slice(0, 30).map(key => ({ key, label: key }))} onAction={event => { const product = comparison.find(row => row.id === event.payload?.productId); if (product) openProduct(product) }}/></>) }
  </AgentDialog></ShoppingContext.Provider>
}
