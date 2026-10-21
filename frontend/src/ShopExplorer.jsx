import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Bookmark, Check, ChevronLeft, Compass, LocateFixed, MapPin, Maximize2, Minus, Navigation, Plus, Search, Store, X, ArrowUpLeft, RefreshCw } from 'lucide-react'
import TehranMap from './TehranMap.jsx'
import { shopTypes, distanceLabel } from './shopTypes.jsx'

const MIN_ZOOM = 14
async function request(url, signal) {
  const response = await fetch(url, { signal })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'دریافت فروشگاه‌ها ممکن نشد؛ دوباره تلاش کن.')
  return data
}

const ShopExplorer = forwardRef(function ShopExplorer({ theme, origin, saved, savedOnly, onToggleSaved, onClearSaved, onHelp }, ref) {
  const map = useRef(null)
  const cache = useRef(new Map())
  const searchController = useRef(null)
  const searchVersion = useRef(0)
  const searchBox = useRef(null)
  const [view, setView] = useState(null)
  const [category, setCategory] = useState('all')
  const [shops, setShops] = useState([])
  const [markerCount, setMarkerCount] = useState(0)
  const [active, setActive] = useState(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(false)
  const [limited, setLimited] = useState(false)
  const [error, setError] = useState('')
  const [searchError, setSearchError] = useState('')
  const [retry, setRetry] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [route, setRoute] = useState(false)
  const savedIds = saved.map(s => s.id).sort().join(',')
  const closeSearch = () => { searchVersion.current++; searchController.current?.abort(); setSearching(false); setResults(null); setSearchError('') }
  const select = shop => { setActive(shop); setRoute(true); setResults(null); map.current?.goTo(shop.coordinates) }
  const reset = () => { setActive(null); setRoute(false); closeSearch(); map.current?.reset() }
  async function search(text = query, group = category) {
    const value = text.trim()
    closeSearch(); setQuery(value)
    if (value.length < 2) { setSearchError('حداقل دو حرف بنویس.'); return }
    if (!origin) { setSearchError('اول آدرس انتخابی‌ات را در هدر ثبت کن.'); return }
    const version = searchVersion.current
    const controller = new AbortController(); searchController.current = controller
    setSearching(true); setSearchError('')
    try {
      const params = new URLSearchParams({ q: value, category: group })
      if (savedOnly) params.set('ids', savedIds)
      const data = await request(`/api/shops/search/?${params}`, controller.signal)
      if (version !== searchVersion.current) return
      setResults(data.shops)
      if (data.shops.length) { setActive(data.shops[0]); setRoute(true); map.current?.goTo(data.shops[0].coordinates) }
    } catch (failure) { if (failure.name !== 'AbortError' && version === searchVersion.current) setSearchError(failure.message) }
    finally { if (version === searchVersion.current) setSearching(false) }
  }
  useImperativeHandle(ref, () => ({ reset, search: value => { search(value); searchBox.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) } }))
  useEffect(() => {
    setShops([]); setActive(null); setRoute(false); cache.current.clear(); closeSearch()
  }, [origin, category, savedOnly])
  useEffect(() => {
    if (!view || view.zoom < MIN_ZOOM) { setShops([]); setLoading(false); setError(''); return }
    const controller = new AbortController()
    setLoading(true); setError('')
    // Hide old viewport markers immediately; abort superseded requests on pan.
    setShops([])
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ west: view.west, south: view.south, east: view.east, north: view.north, zoom: view.zoom, category })
      if (savedOnly) params.set('ids', savedIds)
      const key = `${params}|${origin?.join(',')}`
      try {
        const data = cache.current.get(key) || await request(`/api/shops/map/?${params}`, controller.signal)
        if (controller.signal.aborted) return
        cache.current.set(key, data)
        if (cache.current.size > 24) cache.current.delete(cache.current.keys().next().value)
        setShops(data.shops); setLimited(data.limited)
      } catch (failure) { if (failure.name !== 'AbortError') setError(failure.message) }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [view, origin, category, savedOnly, savedIds, retry])
  useEffect(() => { if (savedOnly && active && !saved.some(s => s.id === active.id)) { setActive(null); setRoute(false) } }, [savedOnly, savedIds])
  useEffect(() => () => { searchVersion.current++; searchController.current?.abort() }, [])
  useEffect(() => { const escape = e => { if (e.key === 'Escape') { setExpanded(false); closeSearch() } }; window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape) }, [])
  const zoomedOut = view && view.zoom < MIN_ZOOM
  const shown = !zoomedOut && active && view && active.coordinates[0] >= view.west && active.coordinates[0] <= view.east && active.coordinates[1] >= view.south && active.coordinates[1] <= view.north && !shops.some(s => s.id === active.id) ? [...shops.slice(0, 71), active] : shops
  const Icon = shopTypes[active?.category]?.icon || Store
  return <section className={`explore-panel shop-explorer ${expanded ? 'expanded-map' : ''}`} aria-label="نقشه فروشگاه‌ها">
    <div className="map-topbar"><div className="map-title"><span className="map-icon"><MapPin size={21}/></span><div><h2>{savedOnly ? 'انتخاب‌های ذخیره‌شده' : 'کشف کن، همین نزدیکی'}</h2><p>فروشگاه‌های تهران، از دل داده‌های ترب</p></div></div>
      <div className="shop-search-wrap" ref={searchBox}><form className="map-search" onSubmit={e => { e.preventDefault(); search() }}><Search size={18}/><input value={query} maxLength={120} onChange={e => { setQuery(e.target.value); closeSearch() }} placeholder="نام فروشگاه، دسته یا محله…" aria-label="جستجوی فروشگاه"/>{query && <button type="button" aria-label="پاک کردن جستجو" onClick={() => { setQuery(''); closeSearch() }}><X size={16}/></button>}<button className="shop-search-submit" type="submit" aria-label="یافتن نزدیک‌ترین فروشگاه" disabled={searching}>{searching ? <RefreshCw className="shop-spinning" size={18}/> : <ArrowUpLeft size={18}/>}</button></form>
      {(results !== null || searchError || searching) && <div className="shop-search-results" role="region" aria-label="نتایج جستجوی فروشگاه"><div className="shop-results-heading"><span>{searching ? 'پیدا کردن نزدیک‌ترین انتخاب…' : 'به ترتیب نزدیکی به آدرس انتخابی'}</span><button aria-label="بستن نتایج" onClick={closeSearch}><X size={16}/></button></div>{searchError && <p role="alert">{searchError}</p>}{results?.length === 0 && <p>نتیجه‌ای پیدا نشد؛ نام کوتاه‌تر یا دستهٔ دیگری را امتحان کن.</p>}{results?.map((shop, i) => { const ResultIcon = shopTypes[shop.category]?.icon || Store; return <button className="shop-search-result" key={shop.id} onClick={() => select(shop)}><span className="shop-result-icon" style={{ '--shop-color': shopTypes[shop.category]?.color }}><ResultIcon size={19}/></span><span><strong>{shop.name}</strong><small>{i === 0 ? 'نزدیک‌ترین نتیجه · ' : ''}{shop.type}</small></span><span className="shop-result-distance">{distanceLabel(shop.distance_m)}<small>مستقیم</small></span></button> })}</div>}
      </div>
    </div>
    <div className="category-bar shop-categories">{Object.entries(shopTypes).map(([id, type]) => <button key={id} className={category === id ? 'selected' : ''} aria-pressed={category === id} onClick={() => setCategory(id)}><type.icon size={16}/>{type.name}</button>)}</div>
    {savedOnly && <div className="shop-saved-banner"><Bookmark size={15}/>فقط ذخیره‌شده‌ها <button onClick={onClearSaved}>نمایش همه <X size={13}/></button></div>}
    <div className="map-viewport geographic-viewport shop-map-viewport">
      <TehranMap ref={map} shops={shown} activeShop={active} selected={active?.id} route={route} theme={theme} origin={origin} onViewport={setView} onVisibleCount={setMarkerCount} onSelect={id => { const shop = shown.find(s => s.id === id); if (shop) select(shop) }}/>
      <div className={`shop-map-status ${loading ? 'is-loading' : ''}`} role="status"><span className={loading ? 'shop-tiny-loader' : 'shop-status-dot'}/>{zoomedOut ? 'کمی نزدیک‌تر شو؛ فروشگاه‌ها در زوم محله ظاهر می‌شوند' : loading ? 'کشف فروشگاه‌های این محدوده…' : error ? 'ارتباط با فروشگاه‌ها قطع شد' : `${markerCount.toLocaleString('fa-IR')} نشان در این قاب`}{error && <button aria-label="تلاش دوباره برای فروشگاه‌ها" onClick={() => setRetry(r => r + 1)}><RefreshCw size={15}/></button>}</div>
      <div className="map-controls"><button aria-label="بزرگنمایی" onClick={() => map.current?.zoomIn()}><Plus size={19}/></button><button aria-label="کوچک‌نمایی" onClick={() => map.current?.zoomOut()}><Minus size={19}/></button><span/><button aria-label="بازگشت به آدرس انتخابی" onClick={reset}><LocateFixed size={19}/></button><button aria-label="تغییر زاویه سه‌بعدی" onClick={() => map.current?.togglePitch()}><Compass size={19}/></button><button aria-label={expanded ? 'بستن نمای بزرگ' : 'بزرگ کردن نقشه'} onClick={() => setExpanded(v => !v)}>{expanded ? <X size={18}/> : <Maximize2 size={18}/>}</button></div>
      {!loading && !zoomedOut && !shown.length && !active && !error && view && <div className="shop-map-hint"><Store size={22}/><strong>{savedOnly ? 'ذخیره‌ای در این قاب نیست' : 'اینجا هنوز نشانی نداریم'}</strong><span>نقشه را جابه‌جا کن یا از بالا جست‌وجو کن.</span></div>}
      {!active && limited && !loading && <div className="shop-density-hint">برای دیدن انتخاب‌های بیشتر، نزدیک‌تر شو <Plus size={13}/></div>}
      {active && <article className="shop-detail" key={active.id} aria-label={`اطلاعات ${active.name}`}><div className="shop-detail-head"><span className="shop-detail-icon" style={{ '--shop-color': shopTypes[active.category]?.color }}><Icon size={25}/></span><div><small>{active.type}</small><h3>{active.name}</h3></div><button className={`shop-detail-save ${saved.some(s => s.id === active.id) ? 'is-saved' : ''}`} aria-label={saved.some(s => s.id === active.id) ? 'حذف از ذخیره‌ها' : 'ذخیره فروشگاه'} aria-pressed={saved.some(s => s.id === active.id)} onClick={() => onToggleSaved(active)}><Bookmark size={21} fill={saved.some(s => s.id === active.id) ? 'currentColor' : 'none'}/></button><button aria-label="بستن اطلاعات فروشگاه" onClick={() => { setActive(null); setRoute(false) }}><X size={19}/></button></div>
        <p className="shop-detail-address"><MapPin size={15}/>{active.address || 'آدرس متنی در دیتاست ثبت نشده است.'}</p><div className="shop-distance-row"><span><Navigation size={18}/><strong>{distanceLabel(active.distance_m)}</strong><small>فاصلهٔ مستقیم از آدرس انتخابی</small></span><button onClick={() => setRoute(v => !v)} aria-pressed={route}>{route ? <Check size={16}/> : <Navigation size={16}/>}خط اتصال</button></div>
        <p className="shop-data-note">{active.name_is_synthetic ? 'مختصات از دیتاست؛ نام فروشگاه در داده‌ها ساختگی است. ' : 'مختصات و نام از دیتاست ترب. '}موجودی تأیید نشده؛ خط اتصال، مسیر خیابانی نیست.</p>
      </article>}
    </div>
    <div className="map-footer"><span><span className="online-dot"/> بارگذاری هوشمند محدوده</span><button onClick={onHelp}>راهنمای نقشه <ChevronLeft size={13}/></button></div>
  </section>
})
export default ShopExplorer
