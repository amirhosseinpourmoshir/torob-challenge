import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Map, Marker, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { RefreshCw, WifiOff } from 'lucide-react'
import 'maplibre-gl/dist/maplibre-gl.css'

setWorkerUrl(workerUrl)
export const TEHRAN_BOUNDS = [[51.08, 35.53], [51.65, 35.84]]
const HOME = { center: [51.412, 35.713], zoom: 14, pitch: 35, bearing: -12 }
const START = [51.4102, 35.7141]
const emptyRoute = { type: 'FeatureCollection', features: [] }
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Mixed-language names are omitted instead of falling back to Latin text.
export function persianLabelExpression() {
  const clean = value => ['all',
    ['any', ...Array.from('اآبتثجچحخدذرزژسشصضطظعغفقکگلمنوهیيكۀةؤئ').map(letter => ['>=', ['index-of', letter, value], 0])],
    ...Array.from('abcdefghijklmnopqrstuvwxyz').map(letter => ['==', ['index-of', letter, ['downcase', value]], -1]),
  ]
  return ['let', 'fa', ['to-string', ['coalesce', ['get', 'name:fa'], '']], 'local', ['to-string', ['coalesce', ['get', 'name'], '']],
    ['case', clean(['var', 'fa']), ['var', 'fa'], clean(['var', 'local']), ['var', 'local'], '']]
}

function applyPalette(map, theme) {
  const dark = theme === 'dark'
  for (const layer of map.getStyle().layers) {
    const id = layer.id
    if (id.startsWith('guide-line')) continue
    if (layer.type === 'background') map.setPaintProperty(id, 'background-color', dark ? '#17242a' : '#f3f0e8')
    if (layer.type === 'fill') {
      const color = /water/.test(id) ? (dark ? '#23434e' : '#cee2df') : /park|wood|landcover/.test(id) ? (dark ? '#243c34' : '#dfe8d8') : /building/.test(id) ? (dark ? '#35444a' : '#e4ddd0') : (dark ? '#1c2c32' : '#ede9de')
      map.setPaintProperty(id, 'fill-color', color)
      if (/building/.test(id)) map.setPaintProperty(id, 'fill-outline-color', dark ? '#445158' : '#d9cfc0')
    }
    if (layer.type === 'line') {
      const color = /water/.test(id) ? (dark ? '#305864' : '#c3dcd8') : /casing|boundary|railway/.test(id) ? (dark ? '#3c4b50' : '#e2d7c4') : /major|motorway/.test(id) ? (dark ? '#737263' : '#fff4dc') : (dark ? '#48595e' : '#fffdf8')
      map.setPaintProperty(id, 'line-color', color)
    }
    if (layer.type === 'symbol' && layer.layout?.['text-field']) {
      map.setPaintProperty(id, 'text-color', dark ? '#c4cbbc' : '#857c6b')
      map.setPaintProperty(id, 'text-halo-color', dark ? '#1a292e' : '#f9f6ee')
      map.setPaintProperty(id, 'text-halo-width', 1.5)
    }
    if (layer.type === 'fill-extrusion') map.setPaintProperty(id, 'fill-extrusion-color', dark ? '#4b5a60' : '#e5d6bf')
  }
}

function MapMarker({ map, coordinates, children, className }) {
  const [element] = useState(() => document.createElement('div'))
  useEffect(() => {
    const marker = new Marker({ element, anchor: 'bottom' }).setLngLat(coordinates).addTo(map)
    return () => marker.remove()
  }, [map, element, coordinates])
  element.className = `maplibregl-marker ${className}`
  return createPortal(children, element)
}

const TehranMap = forwardRef(function TehranMap({ shops, selected, route, onSelect, theme }, ref) {
  const container = useRef(null)
  const instance = useRef(null)
  const themeRef = useRef(theme)
  themeRef.current = theme
  const [map, setMap] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [scale, setScale] = useState('۱۰۰ متر')
  useImperativeHandle(ref, () => ({
    zoomIn: () => instance.current?.zoomIn({ duration: reducedMotion() ? 0 : 300 }),
    zoomOut: () => instance.current?.zoomOut({ duration: reducedMotion() ? 0 : 300 }),
    reset: () => instance.current?.flyTo({ ...HOME, duration: reducedMotion() ? 0 : 900 }),
    togglePitch: () => { const m = instance.current; if (m) m.easeTo({ pitch: m.getPitch() > 10 ? 0 : 50, bearing: m.getPitch() > 10 ? 0 : -12, duration: reducedMotion() ? 0 : 650 }) },
  }), [])
  useEffect(() => {
    setLoaded(false); setError(''); setMap(null)
    let m
    let disposed = false
    let observer
    let timeout
    const controller = new AbortController()
    async function initialize() {
      try {
        timeout = setTimeout(() => { if (!disposed) setError('دریافت نقشه طول کشید؛ اتصال اینترنت را بررسی و دوباره تلاش کن.') }, 25000)
        const response = await fetch(import.meta.env.VITE_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/positron', { signal: controller.signal })
        if (!response.ok) throw new Error('style-unavailable')
        const style = await response.json()
        if (disposed) return
        for (const layer of style.layers) {
          if (layer.type === 'symbol' && layer.layout?.['text-field']) {
            layer.layout['text-field'] = persianLabelExpression()
            if (/shield|airport|country|state/.test(layer.id)) layer.layout.visibility = 'none'
          }
        }
        // Required source credits are rendered below in Persian with original links.
        for (const source of Object.values(style.sources)) if ('attribution' in source) source.attribution = ''
        m = new Map({ container: container.current, style, ...HOME, maxBounds: TEHRAN_BOUNDS, minZoom: 11.5, maxZoom: 18.5, attributionControl: false, canvasContextAttributes: { antialias: true }, locale: { 'Map.Title': 'نقشه تهران' } })
        instance.current = m
        setMap(m)
        const updateScale = () => {
          const y = m.getContainer().clientHeight - 20
          const distance = m.unproject([20, y]).distanceTo(m.unproject([90, y]))
          const amount = distance >= 1000 ? distance / 1000 : Math.max(10, Math.round(distance / 10) * 10)
          setScale(`${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: distance >= 1000 ? 1 : 0 }).format(amount)} ${distance >= 1000 ? 'کیلومتر' : 'متر'}`)
        }
        m.on('load', () => {
          clearTimeout(timeout)
          if (disposed) return
          const source = Object.entries(style.sources).find(([, value]) => value.type === 'vector')?.[0]
          if (source && !m.getLayer('tehran-buildings-3d')) m.addLayer({ id: 'tehran-buildings-3d', type: 'fill-extrusion', source, 'source-layer': 'building', minzoom: 14, paint: { 'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8], 'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0], 'fill-extrusion-opacity': .65 } }, style.layers.find(layer => layer.type === 'symbol')?.id)
          m.addSource('guide-line', { type: 'geojson', data: emptyRoute })
          m.addLayer({ id: 'guide-line-outline', type: 'line', source: 'guide-line', paint: { 'line-color': '#fffaf4', 'line-width': 7 } })
          m.addLayer({ id: 'guide-line', type: 'line', source: 'guide-line', paint: { 'line-color': '#e7463e', 'line-width': 3, 'line-dasharray': [2, 2] } })
          applyPalette(m, themeRef.current)
          updateScale(); setLoaded(true); setError('')
        })
        m.on('error', event => {
          if (!m.getStyle() || event.error?.message?.includes('WebGL')) setError('نمایش نقشه امکان‌پذیر نیست؛ اتصال اینترنت و پشتیبانی گرافیکی مرورگر را بررسی کن.')
        })
        m.on('moveend', updateScale)
        observer = new ResizeObserver(() => { m.resize(); updateScale() })
        observer.observe(container.current)
      } catch (failure) {
        if (!disposed && failure.name !== 'AbortError') { clearTimeout(timeout); setError('دریافت نقشه امکان‌پذیر نیست؛ اتصال اینترنت را بررسی و دوباره تلاش کن.') }
      }
    }
    initialize()
    return () => { disposed = true; controller.abort(); clearTimeout(timeout); observer?.disconnect(); m?.remove(); instance.current = null }
  }, [revision])
  useEffect(() => { if (map && loaded) applyPalette(map, theme) }, [theme, map, loaded])
  useEffect(() => {
    if (!map || !loaded) return
    const shop = shops.find(s => s.id === selected)
    if (shop) map.flyTo({ center: shop.coordinates, zoom: Math.max(15, map.getZoom()), pitch: 40, duration: reducedMotion() ? 0 : 900 })
  }, [selected, map, loaded])
  useEffect(() => {
    if (!map || !loaded) return
    const shop = shops.find(s => s.id === selected)
    map.getSource('guide-line')?.setData(route && shop ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [START, shop.coordinates] } } : emptyRoute)
  }, [route, selected, loaded, map, shops])
  return <>
    <div ref={container} className="geographic-map" role="region" aria-label="نقشه تعاملی تهران"/>
    {map && shops.map(shop => <MapMarker key={shop.id} map={map} coordinates={shop.coordinates} className={`geo-shop-marker marker-${shop.color} ${selected === shop.id ? 'active' : ''}`}><button onClick={() => onSelect(shop.id)} aria-label={`انتخاب فروشگاه ${shop.name}`}><span className="marker-label">{shop.name}<span>نمونه</span></span><span className="marker-body"><shop.icon size={20}/></span></button></MapMarker>)}
    {map && <MapMarker map={map} coordinates={START} className="geo-start-marker"><span>نقطهٔ شروع نمونه</span><i/></MapMarker>}
    <div className="persian-map-scale"><span/>{scale}</div>
    <div className="persian-map-attribution"><span>© </span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">مشارکت‌کنندگان اوپن‌استریت‌مپ</a><span> · </span><a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">اوپن‌مپ‌تایلز</a></div>
    {!loaded && !error && <div className="map-loading" role="status"><span className="map-spinner"/><span>در حال دریافت نقشهٔ تهران…</span></div>}
    {error && <div className="map-network-error" role="alert"><WifiOff size={25}/><p>{error}</p><button onClick={() => setRevision(n => n + 1)}><RefreshCw size={15}/>تلاش دوباره</button></div>}
  </>
})
export default TehranMap
