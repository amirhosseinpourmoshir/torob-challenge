import { Store, Smartphone, ShoppingBag, House, HeartPulse, Wrench, Bike, Coffee, BookOpen, Watch } from 'lucide-react'

export const shopTypes = {
  all: { name: 'همه', icon: Store },
  digital: { name: 'دیجیتال', icon: Smartphone, color: '#ca593a' },
  fashion: { name: 'پوشاک', icon: ShoppingBag, color: '#9970c4' },
  home: { name: 'خانه', icon: House, color: '#338976' },
  beauty: { name: 'زیبایی و سلامت', icon: HeartPulse, color: '#bc5887' },
  auto: { name: 'خودرو و ابزار', icon: Wrench, color: '#557eaf' },
  sport: { name: 'ورزش و سفر', icon: Bike, color: '#63913c' },
  food: { name: 'خوراکی', icon: Coffee, color: '#aa7c36' },
  culture: { name: 'فرهنگ و سرگرمی', icon: BookOpen, color: '#538b9d' },
  jewelry: { name: 'زیورآلات', icon: Watch, color: '#9d7d2d' },
  other: { name: 'سایر', icon: Store, color: '#687c86' },
}
export const distanceLabel = meters => meters == null ? 'آدرس انتخاب نشده' : meters < 1000 ? `${Math.round(meters).toLocaleString('fa-IR')} متر` : `${(meters / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} کیلومتر`
