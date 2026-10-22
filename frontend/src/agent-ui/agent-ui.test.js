import test from 'node:test'
import assert from 'node:assert/strict'
import { asWidget, demos } from './demo.js'
import { validateWidget, widgetPropsSchemas } from './contracts.js'
import { calendarMonth, dateKey, jalaliParts } from './calendar.js'
import { isAmount, money, percentOff, safeImage } from './utils.js'

test('all thirty example payloads satisfy the published widget protocol', () => {
  assert.equal(Object.keys(widgetPropsSchemas).length, 30)
  assert.equal(demos.length, 30)
  for (const demo of demos) assert.equal(validateWidget(asWidget(demo)).valid, true, demo.type)
})
test('unknown components, executable props, callbacks and excessive arrays are rejected', () => {
  const base = { version: 1, id: 'test', type: 'product', props: { product: { id: 'a', title: 'محصول' } } }
  assert.equal(validateWidget(base).valid, true)
  for (const data of [null, { ...base, type: 'html' }, { ...base, version: 2 }, { ...base, props: { ...base.props, onAction: () => {} } }, { ...base, props: { ...base.props, dangerouslySetInnerHTML: '<img>' } }, { ...base, type: 'product_list', props: { products: Array(9).fill(base.props.product) } }, JSON.parse('{"version":1,"id":"x","type":"clock","props":{"__proto__":{}}}')]) assert.equal(validateWidget(data).valid, false)
})
test('zero is a real price, missing price stays unknown and discounts are derived', () => {
  assert.equal(isAmount(0), true)
  assert.equal(isAmount(null), false)
  assert.equal(isAmount(-1), false)
  assert.equal(money(null), 'قیمت نامشخص')
  assert.equal(percentOff(800, 1000), 20)
  assert.equal(percentOff(0, 1000), 100)
  assert.equal(percentOff(1000, 800), null)
  assert.equal(percentOff(null, 1000), null)
})
test('image inputs cannot navigate to script, data, protocol-relative or credentialed URLs', () => {
  assert.equal(safeImage('/images/agent-headphones.svg'), '/images/agent-headphones.svg')
  assert.equal(safeImage('https://example.com/product.png'), 'https://example.com/product.png')
  for (const url of ['javascript:alert(1)', 'data:image/svg+xml,test', '//example.com/a', '/\\example.com/a', 'http://example.com/a', 'https://user:pass@example.com/a']) assert.equal(safeImage(url), null)
})
test('Persian months follow leap years and Tehran dates across year boundaries', () => {
  assert.equal(calendarMonth(new Date('2025-03-10T12:00:00Z')).days, 30)
  assert.equal(calendarMonth(new Date('2026-03-10T12:00:00Z')).days, 29)
  const month = calendarMonth(new Date('2026-03-21T12:00:00Z'))
  assert.equal(month.days, 31)
  assert.deepEqual(jalaliParts(month.first), { year: 1405, month: 1, day: 1 })
  assert.equal(dateKey(new Date('2026-10-21T21:00:00Z')), '2026-10-22')
})
test('invalid dates and out-of-range scores cannot reach time/chart widgets', () => {
  const widget = (type, props) => ({ version: 1, id: 'test', type, props })
  assert.equal(validateWidget(widget('calendar', { selectedDate: '2026-02-30' })).valid, false)
  assert.equal(validateWidget(widget('fit_score', { scores: [{ label: 'کیفیت', value: 101 }] })).valid, false)
  assert.equal(validateWidget(widget('progress', { steps: [{ id: 'a', label: 'ثبت', status: 'fabricated' }] })).valid, false)
  assert.equal(validateWidget(widget('product', { product: { id: 'a', title: 'محصول', price: null } })).valid, true)
})
