// Data-only protocol. The agent cannot supply HTML, callbacks, styles or scripts.
const str = { type: 'string', maxLength: 2000 }
const id = { type: 'string', minLength: 1, maxLength: 100 }
const bool = { type: 'boolean' }
const amount = { type: ['number', 'null'], minimum: 0 }
const list = (items, maxItems = 40) => ({ type: 'array', items, maxItems })
const obj = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false })
const choice = obj({ id, label: str, description: str }, ['id', 'label'])
const image = obj({ src: str, alt: str }, ['src'])
const date = { type: 'string', format: 'date', maxLength: 10 }
const timestamp = { type: 'string', format: 'date-time', maxLength: 40 }
const product = obj({ id, title: str, subtitle: str, category: str, image: str, price: amount, originalPrice: amount, badge: str, highlights: list(str, 8), offerCount: { type: 'integer', minimum: 0 }, specs: { type: 'object', additionalProperties: { type: ['string', 'number', 'boolean', 'null'] } } }, ['id', 'title'])
const seller = obj({ id, name: str, neighborhood: str, address: str, insideAddress: str, price: amount, distanceMeters: amount, distanceKind: { enum: ['route', 'straight_line'] }, availability: { enum: ['confirmed', 'unavailable', 'unverified'] }, hoursLabel: str, credit: bool, updatedAt: timestamp }, ['id', 'name'])
export const widgetPropsSchemas = {
  product: obj({ product, selected: bool }, ['product']),
  product_list: obj({ products: list(product, 8) }, ['products']),
  recommendation: obj({ product, reasons: list(str, 6), note: str }, ['product']),
  comparison: obj({ products: list(product, 4), features: list(obj({ key: id, label: str, bestId: id }, ['key', 'label']), 12) }, ['products']),
  seller: obj({ seller, compact: bool }, ['seller']), offers: obj({ offers: list(seller, 15) }, ['offers']),
  deal: obj({ product, expiresAt: timestamp }, ['product']),
  installment: obj({ price: amount, downPayment: amount, months: { type: 'integer', minimum: 1, maximum: 120 }, totalPayable: amount, provider: str }, ['price', 'totalPayable']),
  alternative: obj({ reason: str, product }, ['reason', 'product']),
  budget: obj({ min: { type: 'number', minimum: 0 }, max: { type: 'number', minimum: 1 }, step: { type: 'number', exclusiveMinimum: 0 }, value: { type: 'number', minimum: 0 } }),
  preferences: obj({ title: str, options: list(choice, 12), selected: list(id, 12), multiple: bool }, ['options']),
  clarification: obj({ questionId: id, question: str, description: str, options: list(choice, 8), multiple: bool, allowOther: bool, presentation: { enum: ['inline', 'popup'] } }, ['question', 'options']),
  quick_replies: obj({ options: list(choice, 8) }, ['options']),
  progress: obj({ title: str, steps: list(obj({ id, label: str, detail: str, status: { enum: ['pending', 'running', 'done', 'failed', 'waiting'] }, durationMs: { type: 'number', minimum: 0 } }, ['id', 'label', 'status']), 12) }, ['steps']),
  receipt: obj({ title: str, summary: str, status: { enum: ['done', 'failed', 'waiting'] }, facts: list(obj({ label: str, value: str }, ['label', 'value']), 12) }),
  confirmation: obj({ title: str, description: str, confirmLabel: str, cancelLabel: str, actionId: id }, ['actionId', 'description']),
  contact: obj({ shopName: str, questions: list(str, 8), channel: { enum: ['message', 'phone'] } }, ['shopName']),
  checklist: obj({ title: str, items: list(obj({ id, label: str, done: bool }, ['id', 'label']), 20) }, ['items']),
  itinerary: obj({ stops: list(obj({ id, name: str, address: str, time: str }, ['id', 'name']), 8), totalDistanceMeters: amount, durationMinutes: amount }, ['stops']),
  calendar: obj({ selectedDate: date, minDate: date, maxDate: date }),
  clock: obj({ label: str, showSeconds: bool }), visit: obj({ date, slots: list(str, 16) }, ['date']),
  gallery: obj({ title: str, images: list(image, 12) }, ['images']),
  price_history: obj({ title: str, points: list(obj({ date: timestamp, price: amount }, ['date', 'price']), 365) }, ['points']),
  price_comparison: obj({ title: str, offers: list(seller, 8) }, ['offers']),
  fit_score: obj({ title: str, scores: list(obj({ label: str, value: { type: 'number', minimum: 0, maximum: 100 } }, ['label', 'value']), 8), description: str }, ['scores']),
  empty: obj({ title: str, description: str }), loading: obj({ label: str }), error: obj({ message: str }),
  source: obj({ label: str, updatedAt: timestamp, status: { enum: ['confirmed', 'unverified'] } }),
}
export const agentWidgetSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema', title: 'Torob Agent UI v1',
  oneOf: Object.entries(widgetPropsSchemas).map(([type, props]) => obj({ version: { const: 1 }, id, type: { const: type }, props }, ['version', 'id', 'type', 'props'])),
}
function matches(value, schema, depth = 0) {
  if (depth > 12) return false
  if (schema.const !== undefined && value !== schema.const) return false
  if (schema.enum && !schema.enum.includes(value)) return false
  if (schema.type) {
    const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
    const types = Array.isArray(schema.type) ? schema.type : [schema.type]
    if (!types.includes(actual) && !(types.includes('integer') && actual === 'number' && Number.isInteger(value))) return false
  }
  if (typeof value === 'number' && (!Number.isFinite(value) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity) || (schema.exclusiveMinimum != null && value <= schema.exclusiveMinimum))) return false
  if (typeof value === 'string') {
    if (value.length > (schema.maxLength ?? 2000) || value.length < (schema.minLength ?? 0)) return false
    if (schema.format && (!Number.isFinite(Date.parse(value)) || (schema.format === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(value).toISOString().slice(0, 10) !== value)))) return false
  }
  if (Array.isArray(value) && (value.length > (schema.maxItems ?? 40) || value.some(item => !matches(item, schema.items || {}, depth + 1)))) return false
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (Object.keys(value).length > 50 || (schema.required || []).some(key => !Object.hasOwn(value, key))) return false
    for (const [key, item] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) return false
      const child = schema.properties?.[key]
      if (!child && schema.additionalProperties === false) return false
      if (child && !matches(item, child, depth + 1)) return false
      if (!child && typeof schema.additionalProperties === 'object' && !matches(item, schema.additionalProperties, depth + 1)) return false
    }
  }
  return true
}
export function validateWidget(value) {
  try {
    if (!value || typeof value !== 'object' || !Object.hasOwn(widgetPropsSchemas, value.type) || value.version !== 1 || !matches(value, obj({ version: { const: 1 }, id, type: { const: value.type }, props: widgetPropsSchemas[value.type] }, ['version', 'id', 'type', 'props']))) return { valid: false, error: 'این کارت با قالب گفتگو هماهنگ نیست.' }
    return { valid: true, value }
  } catch { return { valid: false, error: 'اطلاعات کارت قابل نمایش نیست.' } }
}
