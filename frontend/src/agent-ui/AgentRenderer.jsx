import { Component, useState } from 'react'
import { HelpCircle } from 'lucide-react'
import * as Commerce from './commerce.jsx'
import * as Interactions from './interactions.jsx'
import * as Time from './time.jsx'
import * as Media from './media.jsx'
import * as Charts from './charts.jsx'
import { ActionButton, EmptyCard, ErrorCard, LoadingCard, SourceNote } from './primitives.jsx'
import { validateWidget } from './contracts.js'
import './agent-ui.css'

function ClarificationWidget({ presentation = 'inline', autoOpenPopup = false, answered = false, onAction, ...props }) {
  const [open, setOpen] = useState(presentation === 'popup' && autoOpenPopup && !answered)
  if (answered) return <div className="au-question-answered"><HelpCircle size={15}/><span>انتخابت ثبت شده؛ با هم ادامه دادیم.</span></div>
  if (presentation === 'inline') return <Interactions.ClarificationCard {...props} onAction={onAction}/>
  return <><ActionButton tone="secondary" icon={HelpCircle} onClick={() => setOpen(true)}>یه سؤال کوتاه برای انتخاب بهتر</ActionButton><Interactions.ClarificationPopup {...props} onAction={onAction} open={open} onClose={() => setOpen(false)}/></>
}
function RetryWidget({ onAction, ...props }) { return <ErrorCard {...props} onRetry={() => onAction?.({ type: 'retry_widget', payload: {} })}/> }
function EmptyWidget({ onAction, ...props }) { return <EmptyCard {...props} onRetry={() => onAction?.({ type: 'reset_filters', payload: {} })}/> }
export const widgetRegistry = {
  product: Commerce.ProductCard, product_list: Commerce.ProductCollection, recommendation: Commerce.RecommendationCard, comparison: Commerce.ComparisonTable,
  seller: Commerce.SellerCard, offers: Commerce.OffersList, deal: Commerce.DealCard, installment: Commerce.InstallmentCard, alternative: Commerce.AlternativeCard,
  budget: Interactions.BudgetPicker, preferences: Interactions.PreferenceChips, clarification: ClarificationWidget, quick_replies: Interactions.QuickReplies,
  progress: Interactions.AgentProgress, receipt: Interactions.OperationReceipt, confirmation: Interactions.ConfirmationCard, contact: Interactions.ContactRequestCard,
  checklist: Interactions.ShoppingChecklist, itinerary: Interactions.ItineraryCard, calendar: Time.PersianCalendar, clock: Time.DigitalClock, visit: Time.VisitPlanner,
  gallery: Media.ImageGallery, price_history: Charts.PriceHistoryChart, price_comparison: Charts.PriceComparisonChart, fit_score: Charts.FitScoreChart,
  empty: EmptyWidget, loading: LoadingCard, error: RetryWidget, source: SourceNote,
}
class WidgetBoundary extends Component {
  state = { error: false }
  static getDerivedStateFromError() { return { error: true } }
  render() { return this.state.error ? <ErrorCard message="این کارت کامل نرسیده؛ می‌تونیم دوباره امتحان کنیم." onRetry={() => this.setState({ error: false })}/> : this.props.children }
}
export function AgentWidget({ widget, onAction, autoOpenPopups = false, answeredWidgetIds = [] }) {
  const validation = validateWidget(widget)
  if (!validation.valid) return <ErrorCard message={validation.error}/>
  const View = widgetRegistry[widget.type]
  return <WidgetBoundary key={`${widget.id}-${widget.type}`}><View {...widget.props} {...(widget.type === 'clarification' ? { autoOpenPopup: autoOpenPopups, answered: answeredWidgetIds.includes(widget.id) } : {})} onAction={action => onAction?.({ ...action, widgetId: widget.id })}/></WidgetBoundary>
}
export function AgentRenderer({ widgets = [], onAction, autoOpenPopups = false, answeredWidgetIds = [] }) { return <div className="agent-ui au-renderer" dir="rtl">{Array.isArray(widgets) ? widgets.slice(0, 20).map((widget, index) => <AgentWidget key={widget?.id || index} widget={widget} onAction={onAction} autoOpenPopups={autoOpenPopups} answeredWidgetIds={answeredWidgetIds}/>) : <ErrorCard message="پاسخ تصویری کامل نرسیده."/>}</div> }
export function AgentMessage({ text, widgets = [], onAction }) { return <div className="agent-ui au-agent-message" dir="rtl">{text && <p>{text}</p>}<AgentRenderer widgets={widgets} onAction={onAction}/></div> }
export default AgentRenderer
