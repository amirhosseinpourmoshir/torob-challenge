import { Component, lazy, Suspense, useEffect, useId, useState } from 'react'
import { BarChart3, ChartNoAxesCombined, CircleHelp } from 'lucide-react'
import { AgentCard, Badge, EmptyCard, ErrorCard, LoadingCard, PriceTag } from './primitives.jsx'
import { fa, isAmount, money, persianDate } from './utils.js'

const ApexChart = lazy(() => import('react-apexcharts'))
const text = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
function useDark() {
  const [dark, setDark] = useState(document.documentElement.dataset.theme === 'dark')
  useEffect(() => { const observer = new MutationObserver(() => setDark(document.documentElement.dataset.theme === 'dark')); observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); return () => observer.disconnect() }, [])
  return dark
}
class ChartBoundary extends Component {
  state = { error: false }
  static getDerivedStateFromError() { return { error: true } }
  render() { return this.state.error ? <ErrorCard message="نمودار باز نشد؛ دوباره امتحان کنیم؟" onRetry={() => this.setState({ error: false })}/> : this.props.children }
}
function BaseChart({ type, series, options, label, height = 230 }) {
  const dark = useDark()
  const id = useId().replace(/[^a-z0-9]/gi, '')
  const common = {
    chart: { id: `agent-${id}`, background: 'transparent', fontFamily: 'Peyda, sans-serif', foreColor: dark ? '#b8c5bc' : '#52665d', toolbar: { show: false }, animations: { enabled: !window.matchMedia('(prefers-reduced-motion: reduce)').matches }, zoom: { enabled: false } },
    theme: { mode: dark ? 'dark' : 'light' }, colors: ['#de8963', '#6cae9b', '#8c9dd2', '#c59aba'],
    grid: { borderColor: dark ? '#3a4848' : '#dce2d7', strokeDashArray: 4, padding: { left: 8, right: 8 } }, dataLabels: { enabled: false }, legend: { show: false },
    tooltip: { theme: dark ? 'dark' : 'light', y: { formatter: value => `${money(value)} تومان` } }, noData: { text: 'هنوز داده‌ای برای نمایش نیست', style: { fontFamily: 'Peyda' } },
  }
  return <div className="au-chart-canvas" role="img" aria-label={label} dir="ltr"><ChartBoundary><Suspense fallback={<LoadingCard label="نمودار داره آماده می‌شه…"/>}><ApexChart type={type} height={height} width="100%" series={series} options={{ ...common, ...options, chart: { ...common.chart, ...options.chart } }}/></Suspense></ChartBoundary></div>
}
export function PriceHistoryChart({ title = 'قیمت چه مسیری اومده؟', points = [] }) {
  const rows = points.filter(p => isAmount(p.price) && Number.isFinite(Date.parse(p.date))).sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  const first = rows[0]?.price, last = rows.at(-1)?.price
  const delta = first > 0 ? (last - first) / first * 100 : null
  return <AgentCard className="au-chart" title={title} icon={ChartNoAxesCombined}>{rows.length ? <><div className="au-chart-summary"><PriceTag compact value={last} label="آخرین قیمت ثبت‌شده"/>{delta != null && <Badge tone={delta <= 0 ? 'success' : 'accent'}>{fa(Math.abs(delta))}٪ {delta <= 0 ? 'کمتر' : 'بیشتر'} از شروع</Badge>}</div><BaseChart type="area" label="روند قیمت به تومان" series={[{ name: 'قیمت', data: rows.map(p => ({ x: Date.parse(p.date), y: p.price })) }]} options={{ stroke: { curve: 'smooth', width: 3 }, fill: { type: 'gradient', gradient: { opacityFrom: .3, opacityTo: .01 } }, xaxis: { type: 'datetime', labels: { formatter: (_value, timestamp) => persianDate(timestamp) }, tooltip: { enabled: false }, axisBorder: { show: false }, axisTicks: { show: false } }, yaxis: { labels: { formatter: value => value >= 1e6 ? `${fa(value / 1e6)} م` : fa(value) } }, tooltip: { x: { formatter: value => persianDate(value) }, y: { formatter: value => `${money(value)} تومان` } } }}/><details className="au-data-table"><summary>دیدن داده‌های نمودار</summary><table><thead><tr><th>تاریخ</th><th>قیمت / تومان</th></tr></thead><tbody>{rows.map((p, i) => <tr key={i}><td>{persianDate(p.date)}</td><td>{money(p.price)}</td></tr>)}</tbody></table></details></> : <EmptyCard title="برای این بازه هنوز قیمتی ثبت نشده" description="وقتی دادهٔ قیمت برسد، روندش را همین‌جا می‌بینی."/>}</AgentCard>
}
export function PriceComparisonChart({ title = 'قیمت فروشگاه‌ها کنار هم', offers = [], basis = 'stores' }) {
  const rows = offers.filter(o => isAmount(o.price)).slice(0, 8)
  return <AgentCard className="au-chart" title={title} icon={BarChart3}>{rows.length ? <><BaseChart type="bar" label="مقایسه قیمت فروشگاه‌ها به تومان" height={Math.max(200, rows.length * 48)} series={[{ name: 'قیمت', data: rows.map(o => o.price) }]} options={{ plotOptions: { bar: { horizontal: true, borderRadius: 5, barHeight: '38%', distributed: true } }, xaxis: { categories: rows.map((o, index) => text(`${fa(index + 1)}. ${o.name}`)), labels: { formatter: value => Number(value) >= 1e6 ? `${fa(Number(value) / 1e6)} میلیون` : fa(Number(value)) }, axisBorder: { show: false }, axisTicks: { show: false } }, yaxis: { labels: { maxWidth: 100 } } }}/><p className="au-chart-caption">{basis === 'products' ? 'کمترین قیمت ثبت‌شدهٔ مدل‌ها به تومان؛ امکانات و شرایطشان را هم کنار قیمت ببین.' : 'قیمت‌های ثبت‌شده به تومان؛ برای قیمت و موجودی امروز استعلام بگیر.'}</p><ul className="au-chart-legend">{rows.map((row, index) => <li key={row.id}><span>{fa(index + 1)}</span><strong>{row.name}</strong><PriceTag compact value={row.price}/></li>)}</ul></> : <EmptyCard/>}</AgentCard>
}
export function FitScoreChart({ title = 'چقدر به خواسته‌هات نزدیکه؟', scores = [], description }) {
  const rows = scores.filter(s => typeof s.value === 'number' && Number.isFinite(s.value) && s.value >= 0 && s.value <= 100).slice(0, 8)
  return <AgentCard className="au-chart" title={title} icon={CircleHelp}>{rows.length ? <><BaseChart type="radar" label="میزان تطابق معیارها، از صفر تا صد" series={[{ name: 'تطابق', data: rows.map(s => s.value) }]} height={270} options={{ colors: ['#6cae9b'], stroke: { width: 2 }, fill: { opacity: .16 }, markers: { size: 3 }, xaxis: { categories: rows.map(s => text(s.label)) }, yaxis: { min: 0, max: 100, show: false }, tooltip: { y: { formatter: value => `${fa(value)} از ۱۰۰` } } }}/><p className="au-chart-caption">{description || 'این امتیاز تطابق با معیارهای توست؛ امتیاز کاربران نیست.'}</p><div className="au-score-list">{rows.map(s => <span key={s.label}>{s.label}<strong>{fa(s.value)}</strong></span>)}</div></> : <EmptyCard/>}</AgentCard>
}
