import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowUpLeft, AudioLines, Bookmark, Check, ChevronDown, ChevronLeft, Compass, CornerDownLeft, Gift, Hand, Headphones, Heart, HelpCircle, Layers3, LocateFixed, MapPin, Maximize2, Mic, Minus, Moon, MessageCircle, Navigation, Plus, RotateCcw, Search, ShoppingBag, SlidersHorizontal, Smartphone, Sparkles, Star, Store, Sun, WandSparkles, Volume2, X } from 'lucide-react'
import TehranMap from './TehranMap.jsx'
import AddressBook from './AddressBook.jsx'

const shops = [
  { id: 1, name: 'دیجی‌لند', type: 'موبایل و دیجیتال', distance: '۳۵۰ متر', time: '۵ دقیقه', price: 'از ۱۲٬۴۹۰٬۰۰۰', category: 'digital', coordinates: [51.4079, 35.7107], color: 'red', description: 'موبایل، هدفون و لوازم جانبی', icon: Smartphone },
  { id: 2, name: 'خانهٔ صدا', type: 'صوتی و تصویری', distance: '۶۰۰ متر', time: '۸ دقیقه', price: 'از ۲٬۸۹۰٬۰۰۰', category: 'digital', coordinates: [51.4138, 35.7149], color: 'orange', description: 'هدفون و اسپیکرهای منتخب', icon: Headphones },
  { id: 3, name: 'بوتیک آبان', type: 'مد و پوشاک', distance: '۴۵۰ متر', time: '۶ دقیقه', price: 'از ۸۹۰٬۰۰۰', category: 'fashion', coordinates: [51.4099, 35.7161], color: 'green', description: 'یک انتخاب تازه برای استایل تو', icon: ShoppingBag },
  { id: 4, name: 'خانهٔ سبز', type: 'خانه و زندگی', distance: '۸۰۰ متر', time: '۱۰ دقیقه', price: 'از ۴۹۰٬۰۰۰', category: 'home', coordinates: [51.4155, 35.7118], color: 'purple', description: 'چیزهای کوچک برای یک خانهٔ دوست‌داشتنی', icon: Store },
]
const categories = [{ id: 'all', name: 'همه فروشگاه‌ها', icon: Store }, { id: 'digital', name: 'کالای دیجیتال', icon: Smartphone }, { id: 'fashion', name: 'مد و پوشاک', icon: ShoppingBag }, { id: 'home', name: 'خانه و زندگی', icon: Heart }]
const suggestions = [{ text: 'هدفون تا ۳ میلیون', icon: Headphones }, { text: 'موبایل نزدیک من', icon: Smartphone }, { text: 'دنبال یه هدیه‌ام', icon: Gift }]


function Mascot({ className = '' }) { return <img className={className} src="/images/torob-guide.png" alt="تُربی، راهنمای سه‌بعدی خرید" /> }
function App() {
  const [address, setAddress] = useState(null)
  const origin = useMemo(() => address ? [address.longitude, address.latitude] : null, [address?.longitude, address?.latitude])
  const [category, setCategory] = useState('all')
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('torob-theme') === 'dark' ? 'dark' : 'light' } catch { return 'light' } })
  const [saved, setSaved] = useState([])
  const [savedOnly, setSavedOnly] = useState(false)
  const [route, setRoute] = useState(false)
  const [sound, setSound] = useState(false)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])
  const [typing, setTyping] = useState(false)
  const [modal, setModal] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const [toast, setToast] = useState('')
  const [status, setStatus] = useState(false)
  const timer = useRef(null)
  const end = useRef(null)
  const composer = useRef(null)
  const chatPanel = useRef(null)
  const mapRef = useRef(null)
  const active = shops.find(s => s.id === selected)
  const visible = shops.filter(s => (category === 'all' || s.category === category) && (!savedOnly || saved.includes(s.id)) && (!search || (s.name + s.type + s.description).includes(search)))
  useEffect(() => { document.documentElement.dataset.theme = theme; document.documentElement.style.removeProperty('background-color'); document.documentElement.style.colorScheme = theme; document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#181b20' : '#faf9f6'); try { localStorage.setItem('torob-theme', theme) } catch {} }, [theme])
  useEffect(() => { fetch('/api/health/').then(r => r.json()).then(d => setStatus(d.status === 'ok')).catch(() => {}); return () => clearTimeout(timer.current) }, [])
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [messages, typing])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t) }, [toast])
  useEffect(() => { const close = e => { if (e.key === 'Escape') { setModal(null); setExpanded(false) } }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close) }, [])
  function send(text = message) {
    if (!text.trim() || typing) return
    setMessages(m => [...m, { role: 'user', text: text.trim() }]); setMessage(''); setTyping(true)
    timer.current = setTimeout(() => {
      const fashion = /لباس|پوشاک|هدیه|بوتیک/.test(text)
      const home = /خانه|منزل|دکور/.test(text)
      const shop = fashion ? shops[2] : home ? shops[3] : shops[1]
      setCategory(shop.category); setSelected(shop.id); setRoute(false)
      const answer = `بیا از «${shop.name}» شروع کنیم! ${shop.description}؛ فقط ${shop.time} با نقطهٔ شروع فاصله داره. روی نقشه برات مشخصش کردم. این یک پیشنهاد نمایشی است؛ قیمت و موجودی واقعی هنوز متصل نیست.`
      setMessages(m => [...m, { role: 'assistant', text: answer, shopId: shop.id }]); setTyping(false)
      if (sound && 'speechSynthesis' in window) { const utterance = new SpeechSynthesisUtterance(answer); utterance.lang = 'fa-IR'; window.speechSynthesis.speak(utterance) }
    }, 1300)
  }
  function startChat() { chatPanel.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' }); composer.current?.focus({ preventScroll: true }) }
  function toggleSaved(id) { setSaved(s => s.includes(id) ? s.filter(i => i !== id) : [...s, id]) }
  function resetMap() { setSelected(null); setRoute(false); mapRef.current?.reset() }
  return <div className="app-shell" dir="rtl">
    <header className="header header-v3">
      <a className="brand" href="#" aria-label="صفحه اصلی ترب همراه"><span className="brand-mark"><Mascot /></span><span>ترب<span className="brand-light">همراه</span><small>همراهِ کشف و خرید</small></span></a>

      <div className="header-actions"><button className={`saved-header-button ${savedOnly ? 'is-filtered' : ''}`} aria-label={savedOnly ? 'نمایش همه فروشگاه‌ها' : 'فروشگاه‌های ذخیره‌شده'} title={savedOnly ? 'نمایش همه فروشگاه‌ها' : 'ذخیره‌شده‌ها'} aria-pressed={savedOnly} onClick={() => { setSavedOnly(value => !value); if (!savedOnly) { setCategory('all'); setSearch(''); setQuery('') } }}><Bookmark size={22} fill={savedOnly ? 'currentColor' : 'none'}/>{saved.length > 0 && <span>{saved.length.toLocaleString('fa-IR')}</span>}</button><AddressBook theme={theme} onActiveChange={setAddress}/><span className="header-divider"/><button className="theme-toggle icon-button" aria-label={theme === 'dark' ? 'فعال کردن تم روشن' : 'فعال کردن تم تاریک'} aria-pressed={theme === 'dark'} title={theme === 'dark' ? 'تم روشن' : 'تم تاریک'} onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>{theme === 'dark' ? <Sun size={24}/> : <Moon size={24}/>}</button><button className="icon-button help-button" aria-label="راهنما" onClick={() => setModal('help')}><HelpCircle size={21}/></button></div>
    </header>
    <main>
      <section className="intro hero-v2"><div className="hero-copy"><div className="eyebrow"><span/> تهران رو یه جور دیگه کشف کن <span className="hero-beta">نسخهٔ آزمایشی</span></div><h1>یه گفت‌وگوی ساده،<br/>یه <span>خریدِ دوست‌داشتنی<svg viewBox="0 0 230 12" aria-hidden="true"><path d="M3 9Q110 -4 227 6"/></svg></span></h1><p>از «چی بخرم؟» تا «کجا پیداش کنم؟»<br/>تُربی کنارته تا انتخاب بعدیت، همین نزدیکی باشه.</p><div className="hero-actions"><button className="hero-primary" onClick={startChat}><MessageCircle size={19}/>بیا پیداش کنیم<ArrowLeft size={18}/></button><button className="hero-secondary" onClick={() => { resetMap(); document.querySelector('.explore-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}><Compass size={18}/>یه گشت توی تهران</button></div></div><div className="hero-visual" aria-hidden="true"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="hero-floating-pin"><MapPin size={25}/></div><div className="hero-floating-bag"><ShoppingBag size={26}/></div><div className="hero-discovery"><span><Navigation size={19}/></span><div><strong>انتخاب خوب، نزدیک تو</strong><small>یک قدم نزدیک‌تر به چیزی که می‌خوای</small></div><span className="discovery-dot"/></div></div></section>

      <div className="workspace">
        <aside className="chat-panel chat-v2" ref={chatPanel}>
          <div className="chat-header"><div className={`assistant-avatar ${typing ? 'is-thinking' : ''}`}><Mascot/><span/></div><div><h2>تُربی، همراه خریدت <Sparkles size={14}/></h2><p><span className="online-dot"/> اینجام، برای پیدا کردن انتخاب تو</p></div><button className={`icon-button sound-button ${sound ? 'enabled' : ''}`} aria-label={sound ? 'خاموش کردن صدا' : 'روشن کردن صدا'} onClick={() => { setSound(!sound); if (sound) window.speechSynthesis?.cancel(); else setToast('خواندن پاسخ‌ها فعال شد؛ پشتیبانی فارسی به مرورگر بستگی دارد.') }}><Volume2 size={19}/></button></div>
          <div className="chat-content">
            {messages.length === 0 && <div className="welcome"><div className="welcome-kicker"><span/>همراه انتخاب‌های تو</div><div className="mascot-stage"><div className="mascot-halo"/><span className="floating-star star-one"><Sparkles size={21}/></span><span className="floating-star star-two"><Sparkles size={26}/></span><button className="mascot-interaction" aria-label="شروع گفت‌وگو با تُربی" onClick={() => { composer.current?.focus(); setToast('من اینجام؛ بگو چی توی ذهنته.') }}><Mascot className="hero-mascot"/></button><div className="mascot-shadow"/><span className="mascot-label"><AudioLines size={14}/> گوشم با توئه</span></div><h3>امروز چی توی ذهنته؟</h3><p>یه ایده، یه نیاز، یا حتی یه «نمی‌دونم»؛<br/>با هم از همین‌جا شروع می‌کنیم.</p><div className="suggestions">{suggestions.map((s,i) => <button key={s.text} style={{ '--delay': `${i*80}ms` }} onClick={() => send(s.text)}><span className={`suggestion-icon suggestion-${i}`}><s.icon size={20}/></span><span><strong>{s.text}</strong><small>{i === 0 ? 'یه انتخاب خوش‌صدا' : i === 1 ? 'کشف فروشگاه‌های نزدیک' : 'یه چیزی که خوشحالش کنه'}</small></span><ArrowUpLeft size={17}/></button>)}</div></div>}

            {messages.length > 0 && <div className="conversation"><div className="conversation-note">شروع یک خرید خوب <Sparkles size={13}/></div>{messages.map((m, i) => <div key={i} className={`message ${m.role}`}>{m.role === 'assistant' && <span className="message-author">تُربی <Sparkles size={12}/></span>}<p>{m.text}</p>{m.role === 'assistant' && <button className="chat-shop-result" onClick={() => { setSelected(m.shopId); setRoute(true) }}><span><Store size={18}/></span><span><strong>{shops.find(s => s.id === m.shopId)?.name}</strong><small>ببین روی نقشه کجاست</small></span><ArrowUpLeft size={17}/></button>}</div>)}{typing && <div className="thinking-card"><span className="thinking-orb"><WandSparkles size={19}/></span><div><strong>دارم انتخاب‌ها رو زیرورو می‌کنم</strong><div className="typing"><span/><span/><span/><small>یه لحظه همراه من باش</small></div></div></div>}<div ref={end}/></div>}
          </div>
          <div className="chat-bottom">{messages.length > 0 && <button className="restart-chat" onClick={() => { clearTimeout(timer.current); setMessages([]); setTyping(false); setCategory('all'); setRoute(false); window.speechSynthesis?.cancel() }}><RotateCcw size={12}/> گفت‌وگوی تازه</button>}<form className="chat-input" onSubmit={e => { e.preventDefault(); send() }}><input ref={composer} value={message} onChange={e => setMessage(e.target.value)} placeholder="مثلاً یه هدفون خوب می‌خوام…" aria-label="پیام به دستیار"/><button type="button" className="mic-button" aria-label="ورودی صوتی" onClick={() => setToast('ورودی صوتی در نسخهٔ بعد اضافه می‌شود؛ فعلاً پیامت را بنویس.')}><Mic size={19}/></button><button className="send-button" type="submit" disabled={!message.trim() || typing} aria-label="ارسال پیام"><ArrowUpLeft size={20}/></button></form><div className="composer-meta"><span><Sparkles size={11}/>با یه جمله شروع کن</span><span><CornerDownLeft size={11}/>برای ارسال</span></div><p className="demo-note"><Sparkles size={11}/> نسخهٔ نمایشی · پیشنهادها و گفت‌وگو آزمایشی‌اند</p></div>
        </aside>
        <section className={`explore-panel ${expanded ? 'expanded-map' : ''}`} aria-label="نقشه فروشگاه‌ها">
          <div className="map-topbar"><div className="map-title"><span className="map-icon"><MapPin size={19}/></span><div><h2>{savedOnly ? 'فروشگاه‌های ذخیره‌شده' : 'اینجا، تهران'} <span>ولیعصر</span></h2><p>یک شهر، کلی انتخاب نزدیک</p></div></div><form className="map-search" onSubmit={e => { e.preventDefault(); setSearch(query) }}><Search size={17}/><input placeholder="جست‌وجوی فروشگاه یا دسته‌بندی" value={query} onChange={e => { setQuery(e.target.value); setSearch(e.target.value) }} aria-label="جستجوی فروشگاه"/>{query && <button type="button" aria-label="پاک کردن جستجو" onClick={() => { setQuery(''); setSearch('') }}><X size={14}/></button>}<button type="button" aria-label="فیلترها" onClick={() => setModal('filters')}><SlidersHorizontal size={18}/></button></form></div>
          <div className="category-bar">{categories.map(c => <button key={c.id} className={category === c.id ? 'selected' : ''} onClick={() => { setCategory(c.id); setRoute(false) }}><c.icon size={15}/>{c.name}</button>)}<button className="country-shortcut" onClick={resetMap}><MapPin size={13}/>محدودهٔ تهران</button></div>
          <div className="map-viewport geographic-viewport">
            <TehranMap ref={mapRef} shops={visible} selected={selected} route={route} theme={theme} origin={origin} onSelect={id => { setSelected(id); setRoute(false) }}/>
            <div className="map-caption"><span className="pulse-dot"/> تهران، حوالی ولیعصر<span className="caption-divider"/><span>فروشگاه‌های نزدیک تو</span></div>
            <div className="map-controls"><button aria-label="بزرگنمایی" onClick={() => mapRef.current?.zoomIn()}><Plus size={19}/></button><button aria-label="کوچک‌نمایی" onClick={() => mapRef.current?.zoomOut()}><Minus size={19}/></button><span/><button aria-label="بازگشت به ولیعصر" onClick={resetMap}><LocateFixed size={19}/></button><button aria-label="تغییر زاویه سه‌بعدی" onClick={() => mapRef.current?.togglePitch()}><Compass size={19}/></button><button aria-label={expanded ? 'بستن نمای بزرگ' : 'بزرگ کردن نقشه'} onClick={() => setExpanded(!expanded)}>{expanded ? <X size={18}/> : <Maximize2 size={18}/>}</button></div>
            <button className="map-style" onClick={() => mapRef.current?.togglePitch()}><Layers3 size={16}/><span>تغییر زاویهٔ دید</span></button>

            {route && <div className="route-disclaimer">خط راهنما؛ مسیر خیابانی نیست</div>}
            {visible.length === 0 ? <div className="empty-state"><Search size={28}/><h3>فروشگاهی پیدا نشد</h3><p>{savedOnly ? 'با نشانک کنار فروشگاه‌ها، انتخاب‌هایت را ذخیره کن.' : 'یک عبارت یا دسته‌بندی دیگر را امتحان کن.'}</p><button onClick={() => { setSearch(''); setQuery(''); setCategory('all'); setSavedOnly(false) }}>نمایش همه فروشگاه‌ها</button></div> : active && visible.some(s => s.id === selected) && <div className="shop-preview" key={selected}><div className={`shop-thumb thumb-${active.color}`}><active.icon size={29}/><span className="thumb-roof"/></div><div className="shop-info"><div><h3>{active.name}</h3><span className="open-label">فروشگاه نمونه</span></div><p>{active.type} <span>·</span> <span className="rating"><Star size={10}/> ۴٫۸ نمونه</span></p><span className="walking"><Navigation size={12}/>{active.distance} <span>·</span> {active.time} پیاده‌روی</span></div><div className="shop-preview-actions"><button className={`save-shop ${saved.includes(active.id) ? 'is-saved' : ''}`} onClick={() => toggleSaved(active.id)} aria-label={saved.includes(active.id) ? 'حذف از ذخیره‌ها' : 'ذخیره فروشگاه'}><Bookmark size={18} fill={saved.includes(active.id) ? 'currentColor' : 'none'}/></button><button className={`route-button ${route ? 'route-active' : ''}`} onClick={() => setRoute(!route)}><Navigation size={14}/>{route ? 'مقصد مشخص شد' : 'نمایش مقصد'}</button></div></div>}
          </div>
          <div className="map-footer"><span><span className="online-dot"/> {status ? 'اتصال برقرار است' : 'در حال بررسی اتصال'}</span><span><Navigation size={12}/> نقشهٔ واقعی · فروشگاه‌های نمونه</span><button onClick={() => setModal('help')}>راهنمای نقشه <ChevronLeft size={13}/></button></div>
        </section>
      </div>

    </main>

    {toast && <div className="toast" role="status"><Sparkles size={18}/>{toast}<button aria-label="بستن پیام" onClick={() => setToast('')}><X size={15}/></button></div>}
    {modal && <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}><section className={`modal ${modal === 'neighborhood' ? 'neighborhood-modal' : ''}`} role="dialog" aria-modal="true" aria-label="اطلاعات"><button autoFocus className="modal-close icon-button" onClick={() => setModal(null)} aria-label="بستن پنجره"><X size={20}/></button>
      {modal === 'neighborhood' ? <><img className="neighborhood-full" src="/images/shopping-neighborhood.png" alt="تصویر هنری محلهٔ خرید سه‌بعدی با فروشگاه‌ها و خیابان‌های درخت‌کاری‌شده"/><h2>تصور کن، بعد کشفش کن</h2><p>این محلهٔ سه‌بعدی، تصویر هنری دنیای ترب همراه است. برای کشف خیابان‌ها و فروشگاه‌های واقعی از نقشهٔ تهران استفاده کن.</p><button className="modal-primary" onClick={() => setModal(null)}>برگشت به نقشه <ArrowLeft size={17}/></button></> : <><span className="modal-illustration"><Mascot/></span><h2>{modal === 'about' ? 'یک تجربه در حال ساخت' : modal === 'location' ? 'فعلاً در تهران همراهتیم' : modal === 'profile' ? 'خوش اومدی، همراه!' : modal === 'filters' ? 'چی رو دوست داری ببینی؟' : 'از اینجا شروع کن'}</h2><p>{modal === 'about' ? 'این پروژه برای چالش ترب ساخته شده است. نقشهٔ تهران واقعی است؛ اطلاعات فروشگاه‌ها، قیمت‌ها و پاسخ‌های دستیار در این مرحله نمونه‌اند. ذخیره‌ها فقط تا پایان همین نشست باقی می‌مانند.' : modal === 'location' ? 'محدودهٔ این نسخه فقط شهر تهران است. نقشه را جابه‌جا کن و اطراف ولیعصر را کشف کن؛ نشان‌های فروشگاه هنوز نمونه‌اند.' : modal === 'profile' ? 'فعلاً بدون ثبت‌نام گشت بزن و فروشگاه‌ها را در همین نشست ذخیره کن. حساب کاربری در نسخهٔ بعد فعال می‌شود.' : modal === 'filters' ? 'یک دسته را انتخاب کن تا فروشگاه‌های نمونهٔ همان دسته روی نقشه نمایش داده شوند.' : 'نقشه فقط در محدودهٔ تهران جابه‌جا می‌شود. روی نشان فروشگاه‌ها بزن، زوم کن و زاویهٔ دید را تغییر بده؛ در بزرگنمایی شهری حجم ساختمان‌های موجود در داده‌ها نمایش داده می‌شود. اطلاعات فروشگاه و پاسخ‌های چت هنوز آزمایشی‌اند. خط راهنما، مسیریابی خیابانی نیست.'}</p>
      {modal === 'location' ? <button className="modal-primary" onClick={() => { resetMap(); setModal(null) }}>برگشت به ولیعصر <LocateFixed size={16}/></button> : modal === 'filters' ? <div className="modal-categories">{categories.map(c => <button key={c.id} onClick={() => { setCategory(c.id); setModal(null) }}><c.icon size={18}/>{c.name}{category === c.id && <Check size={16}/>}</button>)}</div> : <button className="modal-primary" onClick={() => setModal(null)}>بریم کشف کنیم <ArrowLeft size={17}/></button>}</>}
    </section></div>}

  </div>
}
export default App
