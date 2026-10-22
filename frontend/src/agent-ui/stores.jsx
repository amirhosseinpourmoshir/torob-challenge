import { useState } from 'react'
import { ArrowUpRight, ChevronLeft, CreditCard, MapPin, Navigation, Store, Tag } from 'lucide-react'
import { useShopping } from '../shopping-context.js'
import { AgentCard, ActionButton, Badge, PriceTag, SourceNote, EmptyCard } from './primitives.jsx'
import { emit, fa, isAmount, safeImage } from './utils.js'

const hasOffer = seller => !!seller.productId || isAmount(seller.price)
const distance = value => isAmount(value) ? `${fa(value < 1000 ? value : value / 1000)} ${value < 1000 ? 'متر' : 'کیلومتر'}` : 'آدرس رو روی نقشه ببین'

export function SellerCard({ seller, onAction, compact = false }) {
  const shopping = useShopping()
  if (!seller) return <EmptyCard/>
  const offering = hasOffer(seller)
  const stock = !offering ? ['فروشگاه حضوری', 'neutral'] : seller.availability === 'confirmed' ? ['موجودی تأیید شده', 'success'] : seller.availability === 'unavailable' ? ['ناموجود', 'danger'] : ['موجودی نیازمند استعلام', 'neutral']
  return <AgentCard className={`au-seller ${compact ? 'is-compact' : ''}`}>
    <div className="au-seller-heading"><span className="au-seller-icon"><Store size={23}/></span><div><h3>{seller.name}</h3><small>{seller.neighborhood || 'تهران'}</small></div><Badge tone={stock[1]}>{stock[0]}</Badge></div>
    <p className="au-inline"><MapPin size={14}/>{seller.address || 'نشانی دقیق را از فروشگاه بپرس.'}</p>
    {seller.insideAddress && <div className="au-inside-address"><Navigation size={16}/><span>{seller.insideAddress}</span></div>}
    <div className="au-seller-metrics"><span><Navigation size={14}/>{distance(seller.distanceMeters)}<small>{seller.distanceKind === 'route' ? 'مسیر' : 'مستقیم'}</small></span><span>{seller.hoursLabel || 'ساعت کاری ثبت نشده'}</span>{seller.credit && <span><CreditCard size={14}/>خرید اعتباری</span>}</div>
    <div className="au-seller-bottom">{offering ? isAmount(seller.price) ? <PriceTag compact label="قیمت ثبت‌شدهٔ این کالا" value={seller.price}/> : <small>قیمت این کالا رو از فروشنده استعلام بگیر.</small> : shopping && <ActionButton tone="secondary" icon={Store} onClick={() => shopping.openShop(seller)}>ویترین فروشگاه</ActionButton>}<ActionButton tone="secondary" icon={ArrowUpRight} onClick={() => emit(onAction, 'select_shop', { shopId: seller.id })}>روی نقشه</ActionButton></div>
    {(safeImage(seller.instagramUrl) || safeImage(seller.websiteUrl)) && <div className="au-social-links">{safeImage(seller.instagramUrl) && <a href={safeImage(seller.instagramUrl)} target="_blank" rel="noopener noreferrer">اینستاگرام فروشگاه<ArrowUpRight size={13}/></a>}{safeImage(seller.websiteUrl) && <a href={safeImage(seller.websiteUrl)} target="_blank" rel="noopener noreferrer">وب‌سایت فروشگاه<ArrowUpRight size={13}/></a>}</div>}
    {offering && seller.updatedAt && <SourceNote label="آخرین ثبت قیمت کالا" updatedAt={seller.updatedAt}/>}
  </AgentCard>
}

export function OffersList({ offers = [], onAction }) {
  const shopping = useShopping()
  const [sort, setSort] = useState('distance')
  const priced = offers.some(hasOffer)
  const field = priced && sort === 'price' ? 'price' : 'distanceMeters'
  const ordered = [...offers].sort((a, b) => (isAmount(a[field]) ? a[field] : Infinity) - (isAmount(b[field]) ? b[field] : Infinity))
  return <AgentCard className={`au-offers ${priced ? '' : 'au-store-list'}`} title={priced ? 'فروشنده‌های این کالا' : 'فروشگاه‌هایی برای سر زدن'} icon={priced ? Tag : Store} trailing={priced ? <select aria-label="ترتیب پیشنهادها" value={sort} onChange={event => setSort(event.target.value)}><option value="price">کمترین قیمت کالا</option><option value="distance">نزدیک‌ترین</option></select> : <Badge>نزدیک‌ترین‌ها</Badge>}>
    {!offers.length ? <EmptyCard/> : ordered.map((offer, index) => <div className="au-offer-row" key={offer.id}><span className="au-rank">{fa(index + 1)}</span><div><strong>{offer.name}</strong><small>{distance(offer.distanceMeters)}{isAmount(offer.distanceMeters) && ' مستقیم'}{offer.credit && ' · خرید اعتباری'}</small></div>{hasOffer(offer) ? isAmount(offer.price) ? <PriceTag value={offer.price} compact/> : <span className="au-offer-inquiry">قیمت کالا با استعلام</span> : shopping && <button className="au-store-catalog-button" onClick={() => shopping.openShop(offer)}><Store size={14}/>ویترین</button>}<button className="au-icon-button" aria-label={`انتخاب ${offer.name}`} onClick={() => emit(onAction, 'select_shop', { shopId: offer.id })}><ChevronLeft size={19}/></button></div>)}
  </AgentCard>
}
