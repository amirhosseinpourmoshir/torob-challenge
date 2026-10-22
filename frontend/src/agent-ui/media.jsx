import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Image, ZoomIn } from 'lucide-react'
import { AgentCard, AgentDialog, ProductImage } from './primitives.jsx'
import { emit, fa } from './utils.js'

export function ImageViewer({ open, onClose, images = [], initialIndex = 0 }) {
  const [index, setIndex] = useState(Math.max(0, Math.min(initialIndex, images.length - 1)))
  useEffect(() => setIndex(Math.max(0, Math.min(initialIndex, images.length - 1))), [initialIndex, images.length])
  const current = images[index] || images[0]
  return <AgentDialog open={open} onClose={onClose} title={current?.alt || 'نمای نزدیک‌تر'} className="au-image-dialog"><ProductImage src={current?.src} alt={current?.alt}/><div className="au-image-viewer-nav"><button className="au-icon-button" aria-label="تصویر قبلی" disabled={images.length < 2} onClick={() => setIndex(i => (i - 1 + images.length) % images.length)}><ArrowRight size={20}/></button><span>{fa(images.length ? Math.max(index, 0) + 1 : 0)} / {fa(images.length)}</span><button className="au-icon-button" aria-label="تصویر بعدی" disabled={images.length < 2} onClick={() => setIndex(i => (i + 1) % images.length)}><ArrowLeft size={20}/></button></div></AgentDialog>
}
export function ImageGallery({ title = 'از نزدیک‌تر ببین', images = [], onAction }) {
  const [active, setActive] = useState(0)
  const [viewer, setViewer] = useState(false)
  const current = images[active] || images[0]
  return <AgentCard className="au-gallery" title={title} icon={Image}><div className="au-gallery-main"><ProductImage src={current?.src} alt={current?.alt} onClick={images.length ? () => { setViewer(true); emit(onAction, 'view_image', { index: active }) } : undefined}/><span><ZoomIn size={16}/>برای دیدن جزئیات بزن</span></div><div className="au-gallery-thumbs">{images.map((image, index) => <button key={`${image.src}-${index}`} aria-label={`دیدن ${image.alt || `تصویر ${fa(index + 1)}`}`} aria-pressed={active === index} onClick={() => setActive(index)}><ProductImage src={image.src} alt={image.alt}/></button>)}</div>{viewer && <ImageViewer open onClose={() => setViewer(false)} images={images} initialIndex={active}/>}</AgentCard>
}
