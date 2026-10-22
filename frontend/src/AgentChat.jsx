import { useEffect, useRef, useState } from 'react'
import { ArrowUpLeft, AudioLines, CornerDownLeft, Gift, Headphones, LoaderCircle, Mic, RotateCcw, Smartphone, Sparkles, Volume2, WandSparkles } from 'lucide-react'
import { AgentRenderer } from './agent-ui/AgentRenderer.jsx'
import { AgentProgress } from './agent-ui/interactions.jsx'
import { ActionButton } from './agent-ui/primitives.jsx'
import './agent-chat.css'

const suggestions = [{ text: 'هدفون تا ۳ میلیون', icon: Headphones }, { text: 'موبایل نزدیک من', icon: Smartphone }, { text: 'دنبال یه هدیه‌ام', icon: Gift }]
const labels = { find_sellers: 'فروشگاه‌های این محصول رو پیدا کن.', select_product: 'این محصول رو بیشتر بررسی کنیم.', view_product: 'جزئیات این محصول رو ببینیم.', select_shop: 'این فروشگاه رو روی نقشه ببینیم.', filter_credit: 'فقط خرید اعتباری حضوری رو بررسی کن.', set_budget: 'با این بودجه بگرد.', preferences_changed: 'این ترجیح‌ها برام مهمه.', clarification_answer: 'انتخابم رو مشخص کردم.', quick_reply: 'این گزینه رو ادامه بدیم.', request_shop_contact: 'متن استعلام از فروشگاه رو آماده کن.', plan_visit: 'برای این زمان برنامه‌ریزی کنیم.', select_date: 'این روز رو در نظر بگیریم.', start_itinerary: 'برنامهٔ بازدید رو ببینیم.', retry_widget: 'این بخش رو دوباره بررسی کن.', reset_filters: 'گزینه‌های بیشتری پیشنهاد بده.' }
function stepsFor(turn) {
  const rows = new Map()
  for (const event of turn?.events || []) {
    if (event.name !== 'model' && rows.has('model')) rows.get('model').status = 'done'
    rows.set(event.name, { id: event.name, label: event.label, status: event.status, ...(event.durationMs != null ? { durationMs: event.durationMs } : {}) })
  }
  return [...rows.values()].slice(-5)
}
function Mascot({ className = '' }) { return <img className={className} src="/images/torob-guide.png" alt="تُربی، همراه خرید"/> }

export default function AgentChat({ panelRef, composerRef, onToast, onMapShops, onSelectShop, onSearch }) {
  const [conversation, setConversation] = useState(null)
  const [turns, setTurns] = useState([])
  const [message, setMessage] = useState('')
  const [posting, setPosting] = useState(false)
  const [pendingText, setPendingText] = useState('')
  const [error, setError] = useState('')
  const [sound, setSound] = useState(false)
  const csrf = useRef('')
  const lastRequest = useRef(null)
  const end = useRef(null)
  const currentId = useRef(null)
  const callbacks = useRef({ onMapShops, onSelectShop, onSearch }); callbacks.current = { onMapShops, onSelectShop, onSearch }
  const activeTurn = turns.find(turn => ['queued', 'running'].includes(turn.status))
  const busy = posting || !!activeTurn
  async function api(path, method = 'GET', data, signal) {
    const response = await fetch(`/api/agent/${path}`, { method, signal, headers: { 'Content-Type': 'application/json', ...(method !== 'GET' ? { 'X-CSRFToken': csrf.current } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) })
    let body
    try { body = await response.json() } catch { throw new Error('ارتباط کامل نشد؛ دوباره امتحان کنیم؟') }
    if (!response.ok) throw new Error(body.error || 'این بار نتیجه نرسید.')
    return body
  }
  async function load(method = 'GET', signal) {
    const data = await api('conversations/', method, undefined, signal)
    csrf.current = data.csrf_token
    setConversation(data.id); setTurns(data.turns); setError('')
    const latest = [...data.turns].reverse().find(t => t.response?.map_shops?.length)
    if (latest) callbacks.current.onMapShops?.(latest.response.map_shops)
  }
  useEffect(() => { const controller = new AbortController(); load('GET', controller.signal).catch(e => { if (e.name !== 'AbortError') setError(e.message) }); return () => controller.abort() }, [])
  useEffect(() => {
    if (!activeTurn?.id) return
    let disposed = false, timer
    const controller = new AbortController()
    const poll = async () => {
      try {
        const result = await api(`turns/${activeTurn.id}/`, 'GET', undefined, controller.signal)
        if (disposed) return
        setError(''); setTurns(previous => previous.map(turn => turn.id === result.id ? result : turn))
        if (result.status === 'done') {
          if (result.response?.map_shops?.length) callbacks.current.onMapShops?.(result.response.map_shops)
          if (sound && 'speechSynthesis' in window && result.response?.text) { const utterance = new SpeechSynthesisUtterance(result.response.text); utterance.lang = 'fa-IR'; speechSynthesis.speak(utterance) }
        } else if (['queued', 'running'].includes(result.status)) timer = setTimeout(poll, 1000)
      } catch (e) { if (!disposed && e.name !== 'AbortError') { setError('ارتباط یه لحظه قطع شد؛ هنوز داریم نتیجه رو دنبال می‌کنیم.'); timer = setTimeout(poll, 3000) } }
    }
    poll()
    return () => { disposed = true; clearTimeout(timer); controller.abort() }
  }, [activeTurn?.id, sound])
  useEffect(() => { end.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' }) }, [turns.map(t => `${t.id}:${t.status}`).join('|'), pendingText])
  useEffect(() => () => window.speechSynthesis?.cancel(), [])
  async function submit(text = message, action, retry = false) {
    if (!conversation || busy || (!text.trim() && !action)) return
    const request = retry && lastRequest.current ? lastRequest.current : { request_id: crypto.randomUUID(), text: text.trim(), ...(action ? { action } : {}) }
    lastRequest.current = request
    setPosting(true); setPendingText(action ? labels[action.type] || text : request.text); setMessage(''); setError('')
    try {
      const turn = await api(`conversations/${conversation}/turns/`, 'POST', request)
      setTurns(previous => previous.some(t => t.id === turn.id) ? previous : [...previous, turn]); setPendingText(''); lastRequest.current = null
    } catch (e) { setError(e.message) } finally { setPosting(false) }
  }
  async function handleAction(action) {
    if (action.type === 'select_shop') {
      try { const data = await api(`conversations/${conversation}/shops/${encodeURIComponent(action.payload.shopId)}/`); callbacks.current.onSelectShop?.(data.shop) } catch (e) { onToast?.(e.message) }
      return
    }
    if (['save_product', 'view_image', 'checklist_changed'].includes(action.type)) return
    await submit(labels[action.type] || 'این انتخاب رو ادامه بدیم.', action)
  }
  async function restart() {
    if (busy) return
    setPosting(true); setError(''); setPendingText(''); lastRequest.current = null
    try { await load('POST'); window.speechSynthesis?.cancel() } catch (e) { setError(e.message) } finally { setPosting(false) }
  }
  return <aside className="chat-panel chat-v2 real-agent-chat" ref={panelRef} aria-label="گفتگو با دستیار خرید"><div className="chat-header"><div className={`assistant-avatar ${busy ? 'is-thinking' : ''}`}><Mascot/><span/></div><div><h2>تُربی، همراه خریدت <Sparkles size={14}/></h2><p><span className="online-dot"/>{busy ? 'دارم قدم بعدی رو بررسی می‌کنم' : 'اینجام، برای پیدا کردن انتخاب تو'}</p></div><button className={`icon-button sound-button ${sound ? 'enabled' : ''}`} aria-label={sound ? 'خاموش کردن صدا' : 'روشن کردن صدا'} onClick={() => { setSound(v => !v); if (sound) window.speechSynthesis?.cancel() }}><Volume2 size={19}/></button></div><div className="chat-content">
    {!turns.length && !pendingText && <div className="welcome"><div className="welcome-kicker"><span/>همراه انتخاب‌های تو</div><div className="mascot-stage"><div className="mascot-halo"/><span className="floating-star star-one"><Sparkles size={21}/></span><span className="floating-star star-two"><Sparkles size={26}/></span><button className="mascot-interaction" aria-label="شروع گفت‌وگو با تُربی" onClick={() => composerRef.current?.focus()}><Mascot className="hero-mascot"/></button><div className="mascot-shadow"/><span className="mascot-label"><AudioLines size={14}/>گوشم با توئه</span></div><h3>امروز چی توی ذهنته؟</h3><p>یه نیاز، یه ایده یا حتی یه «نمی‌دونم»؛<br/>با هم از همین‌جا شروع می‌کنیم.</p><div className="suggestions">{suggestions.map((suggestion, i) => <button key={suggestion.text} disabled={!conversation || busy} style={{ '--delay': `${i * 80}ms` }} onClick={() => submit(suggestion.text)}><span className={`suggestion-icon suggestion-${i}`}><suggestion.icon size={20}/></span><span><strong>{suggestion.text}</strong><small>{i === 0 ? 'یه انتخاب خوش‌صدا' : i === 1 ? 'کشف فروشگاه‌های نزدیک' : 'یه چیزی که خوشحالش کنه'}</small></span><ArrowUpLeft size={17}/></button>)}</div></div>}
    {(turns.length > 0 || pendingText) && <div className="conversation real-conversation"><div className="conversation-note">قدم‌به‌قدم تا انتخاب تو<Sparkles size={13}/></div>{turns.map(turn => <div key={turn.id} className="agent-turn"><div className="message user"><p>{turn.action?.type ? labels[turn.action.type] || turn.text : turn.text}</p></div>{turn.status === 'done' && <div className="agent-reply"><span className="message-author">تُربی<Sparkles size={12}/></span><p>{turn.response?.text}</p><AgentRenderer widgets={turn.response?.widgets || []} onAction={handleAction}/></div>}{['queued', 'running'].includes(turn.status) && <div className="agent-ui agent-live-progress">{turn.events?.length ? <AgentProgress title="داریم به انتخاب نزدیک‌تر می‌شیم" steps={stepsFor(turn)}/> : <div className="thinking-card"><span className="thinking-orb"><WandSparkles size={19}/></span><div><strong>دارم خواسته‌ات رو بررسی می‌کنم</strong><div className="typing"><span/><span/><span/><small>یه لحظه همراه من باش</small></div></div></div>}</div>}{turn.status === 'failed' && <div className="agent-ui agent-turn-error" role="alert"><p>{turn.error || 'این بار نتیجه نرسید.'}</p><ActionButton tone="secondary" icon={RotateCcw} disabled={busy} onClick={() => submit(turn.text, turn.action)}>دوباره امتحان کنیم</ActionButton></div>}</div>)}{pendingText && <div className="message user"><p>{pendingText}</p></div>}<div ref={end}/></div>}
    </div><div className="chat-bottom">{error && <div className="agent-chat-error" role="alert"><span>{error}</span>{!busy && <button onClick={() => conversation ? lastRequest.current ? submit(lastRequest.current.text, lastRequest.current.action, true) : load().catch(e => setError(e.message)) : load().catch(e => setError(e.message))}>تلاش دوباره</button>}</div>}{turns.length > 0 && <button className="restart-chat" disabled={busy} onClick={restart}><RotateCcw size={12}/>گفتگوی تازه</button>}<form className="chat-input" onSubmit={e => { e.preventDefault(); submit() }}><input ref={composerRef} value={message} maxLength={2000} onChange={e => setMessage(e.target.value)} placeholder="مثلاً یه هدفون خوب می‌خوام…" aria-label="پیام به دستیار"/><button type="button" className="mic-button" aria-label="ورودی صوتی" onClick={() => onToast?.('فعلاً پیامت رو بنویس؛ انتخاب رو با هم جلو می‌بریم.')}><Mic size={19}/></button><button className="send-button" type="submit" disabled={!message.trim() || busy || !conversation} aria-label="ارسال پیام">{busy ? <LoaderCircle size={19} className="au-spin"/> : <ArrowUpLeft size={20}/>}</button></form><div className="composer-meta"><span><Sparkles size={11}/>با یه جمله شروع کن</span><span><CornerDownLeft size={11}/>برای ارسال</span></div><p className="demo-note">قیمت و موجودی رو قبل از رفتن از فروشگاه بپرس.</p></div></aside>
}
