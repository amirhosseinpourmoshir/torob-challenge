import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowUpLeft, AudioLines, Bookmark, Compass, CornerDownLeft, Gift, Headphones, HelpCircle, MapPin, Mic, Moon, MessageCircle, Navigation, RotateCcw, ShoppingBag, Smartphone, Sparkles, Store, Sun, WandSparkles, Volume2, X } from 'lucide-react'
import ShopExplorer from './ShopExplorer.jsx'
import AddressBook from './AddressBook.jsx'

const suggestions = [{ text: 'هدفون تا ۳ میلیون', icon: Headphones }, { text: 'موبایل نزدیک من', icon: Smartphone }, { text: 'دنبال یه هدیه‌ام', icon: Gift }]


function Mascot({ className = '' }) { return <img className={className} src="/images/torob-guide.png" alt="تُربی، راهنمای سه‌بعدی خرید" /> }
function App() {
  const [address, setAddress] = useState(null)
  const origin = useMemo(() => address ? [address.longitude, address.latitude] : null, [address?.longitude, address?.latitude])
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('torob-theme') === 'dark' ? 'dark' : 'light' } catch { return 'light' } })
  const [saved, setSaved] = useState([])
  const [savedOnly, setSavedOnly] = useState(false)
  const [sound, setSound] = useState(false)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])
  const [typing, setTyping] = useState(false)
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState('')
  const timer = useRef(null)
  const end = useRef(null)
  const composer = useRef(null)
  const chatPanel = useRef(null)
  const mapRef = useRef(null)
  useEffect(() => { document.documentElement.dataset.theme = theme; document.documentElement.style.removeProperty('background-color'); document.documentElement.style.colorScheme = theme; document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#181b20' : '#faf9f6'); try { localStorage.setItem('torob-theme', theme) } catch {} }, [theme])
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [messages, typing])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t) }, [toast])
  useEffect(() => { const close = e => { if (e.key === 'Escape') { setModal(null) } }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close) }, [])
  function send(text = message) {
    if (!text.trim() || typing) return
    setMessages(m => [...m, { role: 'user', text: text.trim() }]); setMessage(''); setTyping(true)
    timer.current = setTimeout(() => {
      const fashion = /لباس|پوشاک|هدیه|بوتیک/.test(text)
      const home = /خانه|منزل|دکور/.test(text)
      const searchQuery = fashion ? 'پوشاک' : home ? 'خانه' : /موبایل|گوشی/.test(text) ? 'موبایل' : 'هدفون'
      const answer = 'برای شروع، فروشگاه‌های این دسته رو ببین. آدرست رو که انتخاب کنی، نزدیک‌ترین‌ها رو روی نقشه پیدا می‌کنی.'
      setMessages(m => [...m, { role: 'assistant', text: answer, searchQuery }]); setTyping(false)
      if (sound && 'speechSynthesis' in window) { const utterance = new SpeechSynthesisUtterance(answer); utterance.lang = 'fa-IR'; window.speechSynthesis.speak(utterance) }
    }, 1300)
  }
  function startChat() { chatPanel.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' }); composer.current?.focus({ preventScroll: true }) }
  function toggleSaved(shop) { setSaved(s => s.some(i => i.id === shop.id) ? s.filter(i => i.id !== shop.id) : [...s, shop].slice(-100)) }
  function resetMap() { mapRef.current?.reset() }
  return <div className="app-shell" dir="rtl">
    <header className="header header-v3">
      <a className="brand" href="#" aria-label="صفحه اصلی ترب همراه"><span className="brand-mark"><Mascot /></span><span>ترب<span className="brand-light">همراه</span><small>همراهِ کشف و خرید</small></span></a>

      <div className="header-actions"><button className={`saved-header-button ${savedOnly ? 'is-filtered' : ''}`} aria-label={savedOnly ? 'نمایش همه فروشگاه‌ها' : 'فروشگاه‌های ذخیره‌شده'} title={savedOnly ? 'نمایش همه فروشگاه‌ها' : 'ذخیره‌شده‌ها'} aria-pressed={savedOnly} onClick={() => { setSavedOnly(value => !value); document.querySelector('.explore-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}><Bookmark size={22} fill={savedOnly ? 'currentColor' : 'none'}/>{saved.length > 0 && <span>{saved.length.toLocaleString('fa-IR')}</span>}</button><AddressBook theme={theme} onActiveChange={setAddress}/><span className="header-divider"/><button className="theme-toggle icon-button" aria-label={theme === 'dark' ? 'فعال کردن تم روشن' : 'فعال کردن تم تاریک'} aria-pressed={theme === 'dark'} title={theme === 'dark' ? 'تم روشن' : 'تم تاریک'} onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>{theme === 'dark' ? <Sun size={24}/> : <Moon size={24}/>}</button><button className="icon-button help-button" aria-label="راهنما" onClick={() => setModal('help')}><HelpCircle size={21}/></button></div>
    </header>
    <main>
      <section className="intro hero-v2"><div className="hero-copy"><div className="eyebrow"><span/> تهران رو یه جور دیگه کشف کن <span className="hero-beta">نسخهٔ آزمایشی</span></div><h1>یه گفت‌وگوی ساده،<br/>یه <span>خریدِ دوست‌داشتنی<svg viewBox="0 0 230 12" aria-hidden="true"><path d="M3 9Q110 -4 227 6"/></svg></span></h1><p>از «چی بخرم؟» تا «کجا پیداش کنم؟»<br/>تُربی کنارته تا انتخاب بعدیت، همین نزدیکی باشه.</p><div className="hero-actions"><button className="hero-primary" onClick={startChat}><MessageCircle size={19}/>بیا پیداش کنیم<ArrowLeft size={18}/></button><button className="hero-secondary" onClick={() => { resetMap(); document.querySelector('.explore-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}><Compass size={18}/>یه گشت توی تهران</button></div></div><div className="hero-visual" aria-hidden="true"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="hero-floating-pin"><MapPin size={25}/></div><div className="hero-floating-bag"><ShoppingBag size={26}/></div><div className="hero-discovery"><span><Navigation size={19}/></span><div><strong>انتخاب خوب، نزدیک تو</strong><small>یک قدم نزدیک‌تر به چیزی که می‌خوای</small></div><span className="discovery-dot"/></div></div></section>

      <div className="workspace">
        <aside className="chat-panel chat-v2" ref={chatPanel}>
          <div className="chat-header"><div className={`assistant-avatar ${typing ? 'is-thinking' : ''}`}><Mascot/><span/></div><div><h2>تُربی، همراه خریدت <Sparkles size={14}/></h2><p><span className="online-dot"/> اینجام، برای پیدا کردن انتخاب تو</p></div><button className={`icon-button sound-button ${sound ? 'enabled' : ''}`} aria-label={sound ? 'خاموش کردن صدا' : 'روشن کردن صدا'} onClick={() => { setSound(!sound); if (sound) window.speechSynthesis?.cancel(); else setToast('خواندن پاسخ‌ها فعال شد؛ پشتیبانی فارسی به مرورگر بستگی دارد.') }}><Volume2 size={19}/></button></div>
          <div className="chat-content">
            {messages.length === 0 && <div className="welcome"><div className="welcome-kicker"><span/>همراه انتخاب‌های تو</div><div className="mascot-stage"><div className="mascot-halo"/><span className="floating-star star-one"><Sparkles size={21}/></span><span className="floating-star star-two"><Sparkles size={26}/></span><button className="mascot-interaction" aria-label="شروع گفت‌وگو با تُربی" onClick={() => { composer.current?.focus(); setToast('من اینجام؛ بگو چی توی ذهنته.') }}><Mascot className="hero-mascot"/></button><div className="mascot-shadow"/><span className="mascot-label"><AudioLines size={14}/> گوشم با توئه</span></div><h3>امروز چی توی ذهنته؟</h3><p>یه ایده، یه نیاز، یا حتی یه «نمی‌دونم»؛<br/>با هم از همین‌جا شروع می‌کنیم.</p><div className="suggestions">{suggestions.map((s,i) => <button key={s.text} style={{ '--delay': `${i*80}ms` }} onClick={() => send(s.text)}><span className={`suggestion-icon suggestion-${i}`}><s.icon size={20}/></span><span><strong>{s.text}</strong><small>{i === 0 ? 'یه انتخاب خوش‌صدا' : i === 1 ? 'کشف فروشگاه‌های نزدیک' : 'یه چیزی که خوشحالش کنه'}</small></span><ArrowUpLeft size={17}/></button>)}</div></div>}

            {messages.length > 0 && <div className="conversation"><div className="conversation-note">شروع یک خرید خوب <Sparkles size={13}/></div>{messages.map((m, i) => <div key={i} className={`message ${m.role}`}>{m.role === 'assistant' && <span className="message-author">تُربی <Sparkles size={12}/></span>}<p>{m.text}</p>{m.role === 'assistant' && <button className="chat-shop-result" onClick={() => { mapRef.current?.search(m.searchQuery) }}><span><Store size={18}/></span><span><strong>فروشگاه‌های {m.searchQuery}</strong><small>ببین روی نقشه کجاست</small></span><ArrowUpLeft size={17}/></button>}</div>)}{typing && <div className="thinking-card"><span className="thinking-orb"><WandSparkles size={19}/></span><div><strong>دارم انتخاب‌ها رو زیرورو می‌کنم</strong><div className="typing"><span/><span/><span/><small>یه لحظه همراه من باش</small></div></div></div>}<div ref={end}/></div>}
          </div>
          <div className="chat-bottom">{messages.length > 0 && <button className="restart-chat" onClick={() => { clearTimeout(timer.current); setMessages([]); setTyping(false); window.speechSynthesis?.cancel() }}><RotateCcw size={12}/> گفت‌وگوی تازه</button>}<form className="chat-input" onSubmit={e => { e.preventDefault(); send() }}><input ref={composer} value={message} onChange={e => setMessage(e.target.value)} placeholder="مثلاً یه هدفون خوب می‌خوام…" aria-label="پیام به دستیار"/><button type="button" className="mic-button" aria-label="ورودی صوتی" onClick={() => setToast('ورودی صوتی در نسخهٔ بعد اضافه می‌شود؛ فعلاً پیامت را بنویس.')}><Mic size={19}/></button><button className="send-button" type="submit" disabled={!message.trim() || typing} aria-label="ارسال پیام"><ArrowUpLeft size={20}/></button></form><div className="composer-meta"><span><Sparkles size={11}/>با یه جمله شروع کن</span><span><CornerDownLeft size={11}/>برای ارسال</span></div><p className="demo-note"><Sparkles size={11}/> قیمت و موجودی رو قبل از رفتن از فروشگاه بپرس.</p></div>
        </aside>
        <ShopExplorer ref={mapRef} theme={theme} origin={origin} saved={saved} savedOnly={savedOnly} onToggleSaved={toggleSaved} onClearSaved={() => setSavedOnly(false)} onHelp={() => setModal('help')}/>

      </div>

    </main>

    {toast && <div className="toast" role="status"><Sparkles size={18}/>{toast}<button aria-label="بستن پیام" onClick={() => setToast('')}><X size={15}/></button></div>}
    {modal && <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}><section className="modal" role="dialog" aria-modal="true" aria-label="اطلاعات"><button autoFocus className="modal-close icon-button" onClick={() => setModal(null)} aria-label="بستن پنجره"><X size={20}/></button>
      <span className="modal-illustration"><Mascot/></span><h2>تهران را از نزدیک کشف کن</h2><p>اسم فروشگاه، چیزی که دنبالش می‌گردی یا محله‌ات رو بنویس؛ نزدیک‌ترین‌ها همون موقع ظاهر می‌شن. روی هر نتیجه بزنی، جاش رو روی نقشه می‌بینی. برای دیدن فروشگاه‌های بیشتر نزدیک‌تر شو و با نشانک، اون‌هایی که دوست داری رو نگه دار. فاصله‌ها مستقیم تا آدرس انتخابی تو حساب می‌شن.</p><button className="modal-primary" onClick={() => setModal(null)}>بریم کشف کنیم <ArrowLeft size={17}/></button>
    </section></div>}

  </div>
}
export default App
