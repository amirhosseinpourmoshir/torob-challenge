import { useEffect, useRef, useState } from 'react'

export default function useSpeechInput({ text, onText, onNotice }) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [persianVoice, setPersianVoice] = useState(null)
  const [speaking, setSpeaking] = useState(false)
  const recognition = useRef(null)
  const latest = useRef({ text, onText, onNotice }); latest.current = { text, onText, onNotice }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
  useEffect(() => {
    const synth = window.speechSynthesis
    if (!synth) return
    const update = () => setPersianVoice(synth.getVoices().find(voice => /^fa(?:-|_|$)/i.test(voice.lang)) || null)
    update(); synth.addEventListener('voiceschanged', update)
    return () => { synth.removeEventListener('voiceschanged', update); synth.cancel() }
  }, [])
  useEffect(() => () => { recognition.current?.abort() }, [])
  function stop() { recognition.current?.stop() }
  function start() {
    if (listening) { stop(); return }
    if (!Recognition) { latest.current.onNotice?.('تبدیل گفتار در این مرورگر در دسترس نیست؛ می‌تونی از میکروفن کیبورد گوشی استفاده کنی.'); return }
    const engine = new Recognition()
    engine.lang = 'fa-IR'; engine.continuous = false; engine.interimResults = true; engine.maxAlternatives = 1
    recognition.current = engine
    const prefix = latest.current.text.trim()
    engine.onstart = () => { setListening(true); setInterim('') }
    engine.onresult = event => {
      let final = '', pending = ''
      for (let index = 0; index < event.results.length; index++) {
        const result = event.results[index]
        if (result.isFinal) final += result[0].transcript + ' '
        else pending += result[0].transcript
      }
      setInterim(pending)
      if (final.trim()) latest.current.onText?.([prefix, final.trim()].filter(Boolean).join(' ').slice(0, 2000))
    }
    engine.onerror = event => {
      const messages = { 'not-allowed': 'دسترسی میکروفن رو از تنظیمات همین سایت در مرورگر روشن کن.', 'audio-capture': 'میکروفن در دسترس نیست؛ اتصالش رو بررسی کن.', 'no-speech': 'صدایی دریافت نکردم؛ یه بار دیگه امتحان کنیم؟', network: 'سرویس تشخیص گفتار مرورگر وصل نشد؛ می‌تونی متن رو بنویسی یا دوباره امتحان کنی.', 'language-not-supported': 'تشخیص فارسی در این مرورگر در دسترس نیست.' }
      if (event.error !== 'aborted') latest.current.onNotice?.(messages[event.error] || 'تبدیل صدا کامل نشد؛ دوباره امتحان کنیم؟')
      setListening(false); setInterim('')
    }
    engine.onend = () => { setListening(false); setInterim(''); recognition.current = null }
    try { engine.start() } catch { latest.current.onNotice?.('میکروفن شروع نشد؛ اجازهٔ دسترسی مرورگر رو بررسی کن.') }
  }
  function speak(value) {
    if (speaking) { window.speechSynthesis?.cancel(); setSpeaking(false); return }
    if (!persianVoice) { latest.current.onNotice?.('برای خواندن فارسی باید یک صدای فارسی روی دستگاهت نصب باشه.'); return }
    if (!value?.trim()) return
    const utterance = new SpeechSynthesisUtterance(value)
    utterance.lang = 'fa-IR'; utterance.voice = persianVoice; utterance.rate = 1
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance)
  }
  function cancel() { recognition.current?.abort(); window.speechSynthesis?.cancel(); setListening(false); setSpeaking(false); setInterim('') }
  return { listening, interim, start, stop, speak, speaking, canRead: !!persianVoice, canListen: !!Recognition, cancel }
}
