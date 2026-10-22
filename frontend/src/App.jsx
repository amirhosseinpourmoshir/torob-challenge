import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Bookmark, Settings2, Compass, HelpCircle, MapPin, Moon, MessageCircle, Navigation, ShoppingBag, Sparkles, Sun, X } from 'lucide-react'
import ShopExplorer from './ShopExplorer.jsx'
import AddressBook from './AddressBook.jsx'
import AgentChat from './AgentChat.jsx'

function Mascot({ className = '' }) { return <img className={className} src="/images/torob-guide.png" alt="تُربی، راهنمای سه‌بعدی خرید" /> }
function App() {
  const [address, setAddress] = useState(null)
  const origin = useMemo(() => address ? [address.longitude, address.latitude] : null, [address?.longitude, address?.latitude])
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('torob-theme') === 'dark' ? 'dark' : 'light' } catch { return 'light' } })
  const [saved, setSaved] = useState([])
  const [savedOnly, setSavedOnly] = useState(false)
  const [agentShops, setAgentShops] = useState([])
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState('')
  const composer = useRef(null)
  const chatPanel = useRef(null)
  const mapRef = useRef(null)
  useEffect(() => { document.documentElement.dataset.theme = theme; document.documentElement.style.removeProperty('background-color'); document.documentElement.style.colorScheme = theme; document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#181b20' : '#faf9f6'); try { localStorage.setItem('torob-theme', theme) } catch {} }, [theme])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t) }, [toast])
  useEffect(() => { const close = e => { if (e.key === 'Escape') { setModal(null) } }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close) }, [])
  function startChat() { chatPanel.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' }); composer.current?.focus({ preventScroll: true }) }
  function toggleSaved(shop) { setSaved(s => s.some(i => i.id === shop.id) ? s.filter(i => i.id !== shop.id) : [...s, shop].slice(-100)) }
  function resetMap() { mapRef.current?.reset() }
  return <div className="app-shell" dir="rtl">
    <header className="header header-v3">
      <a className="brand" href="#" aria-label="صفحه اصلی ترب همراه"><span className="brand-mark"><Mascot /></span><span>ترب<span className="brand-light">همراه</span><small>همراهِ کشف و خرید</small></span></a>

      <div className="header-actions"><a className="icon-button" href="/panel" aria-label="پنل مدیریت" title="پنل مدیریت"><Settings2 size={21}/></a><button className={`saved-header-button ${savedOnly ? 'is-filtered' : ''}`} aria-label={savedOnly ? 'نمایش همه فروشگاه‌ها' : 'فروشگاه‌های ذخیره‌شده'} title={savedOnly ? 'نمایش همه فروشگاه‌ها' : 'ذخیره‌شده‌ها'} aria-pressed={savedOnly} onClick={() => { setSavedOnly(value => !value); document.querySelector('.explore-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}><Bookmark size={22} fill={savedOnly ? 'currentColor' : 'none'}/>{saved.length > 0 && <span>{saved.length.toLocaleString('fa-IR')}</span>}</button><AddressBook theme={theme} onActiveChange={setAddress}/><span className="header-divider"/><button className="theme-toggle icon-button" aria-label={theme === 'dark' ? 'فعال کردن تم روشن' : 'فعال کردن تم تاریک'} aria-pressed={theme === 'dark'} title={theme === 'dark' ? 'تم روشن' : 'تم تاریک'} onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>{theme === 'dark' ? <Sun size={24}/> : <Moon size={24}/>}</button><button className="icon-button help-button" aria-label="راهنما" onClick={() => setModal('help')}><HelpCircle size={21}/></button></div>
    </header>
    <main>
      <section className="intro hero-v2"><div className="hero-copy"><div className="eyebrow"><span/> تهران رو یه جور دیگه کشف کن <span className="hero-beta">نسخهٔ آزمایشی</span></div><h1>یه گفت‌وگوی ساده،<br/>یه <span>خریدِ دوست‌داشتنی<svg viewBox="0 0 230 12" aria-hidden="true"><path d="M3 9Q110 -4 227 6"/></svg></span></h1><p>از «چی بخرم؟» تا «کجا پیداش کنم؟»<br/>تُربی کنارته تا انتخاب بعدیت، همین نزدیکی باشه.</p><div className="hero-actions"><button className="hero-primary" onClick={startChat}><MessageCircle size={19}/>بیا پیداش کنیم<ArrowLeft size={18}/></button><button className="hero-secondary" onClick={() => { resetMap(); document.querySelector('.explore-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}><Compass size={18}/>یه گشت توی تهران</button></div></div><div className="hero-visual" aria-hidden="true"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="hero-floating-pin"><MapPin size={25}/></div><div className="hero-floating-bag"><ShoppingBag size={26}/></div><div className="hero-discovery"><span><Navigation size={19}/></span><div><strong>انتخاب خوب، نزدیک تو</strong><small>یک قدم نزدیک‌تر به چیزی که می‌خوای</small></div><span className="discovery-dot"/></div></div></section>

      <div className="workspace">
        <AgentChat panelRef={chatPanel} composerRef={composer} onToast={setToast} onMapShops={rows => { setAgentShops(rows); mapRef.current?.showShops(rows) }} onSelectShop={shop => { setAgentShops(rows => [...rows.filter(s => s.id !== shop.id), shop]); mapRef.current?.showShops([shop]) }}/>
        <ShopExplorer ref={mapRef} theme={theme} origin={origin} agentShops={agentShops} saved={saved} savedOnly={savedOnly} onToggleSaved={toggleSaved} onClearSaved={() => setSavedOnly(false)} onHelp={() => setModal('help')}/>

      </div>

    </main>

    {toast && <div className="toast" role="status"><Sparkles size={18}/>{toast}<button aria-label="بستن پیام" onClick={() => setToast('')}><X size={15}/></button></div>}
    {modal && <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}><section className="modal" role="dialog" aria-modal="true" aria-label="اطلاعات"><button autoFocus className="modal-close icon-button" onClick={() => setModal(null)} aria-label="بستن پنجره"><X size={20}/></button>
      <span className="modal-illustration"><Mascot/></span><h2>تهران را از نزدیک کشف کن</h2><p>اسم فروشگاه، چیزی که دنبالش می‌گردی یا محله‌ات رو بنویس؛ نزدیک‌ترین‌ها همون موقع ظاهر می‌شن. روی هر نتیجه بزنی، جاش رو روی نقشه می‌بینی. برای دیدن فروشگاه‌های بیشتر نزدیک‌تر شو و با نشانک، اون‌هایی که دوست داری رو نگه دار. فاصله‌ها مستقیم تا آدرس انتخابی تو حساب می‌شن.</p><button className="modal-primary" onClick={() => setModal(null)}>بریم کشف کنیم <ArrowLeft size={17}/></button>
    </section></div>}

  </div>
}
export default App
