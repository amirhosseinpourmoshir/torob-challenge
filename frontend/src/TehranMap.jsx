import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Map, Marker, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { RefreshCw, WifiOff } from 'lucide-react'
import 'maplibre-gl/dist/maplibre-gl.css'
import './map-layout.css'
import RouteArc from './RouteArc.jsx'
import { shopTypes } from './shopTypes.jsx'

setWorkerUrl(workerUrl)
export const TEHRAN_BOUNDS = [[51.08, 35.53], [51.65, 35.84]]
const HOME = { center: [51.412, 35.713], zoom: 14, pitch: 35, bearing: -12 }
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches


function fitTrip(map, start, point) {
  if (!map || !point) return
  if (!start) { map.flyTo({ center: point, zoom: 16.3, duration: reducedMotion() ? 0 : 500 }); return }
  const height = map.getContainer().clientHeight
  map.fitBounds([[Math.min(start[0], point[0]), Math.min(start[1], point[1])], [Math.max(start[0], point[0]), Math.max(start[1], point[1])]], {
    padding: { top: Math.min(125, height * .3), bottom: Math.min(55, height * .18), left: 48, right: 48 },
    maxZoom: 16.3, pitch: 0, bearing: 0, duration: reducedMotion() ? 0 : 650,
  })
}

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
    if (layer.type === 'background') map.setPaintProperty(id, 'background-color', dark ? '#17242a' : '#e5e9e4')
    if (layer.type === 'fill') {
      const color = /water/.test(id) ? (dark ? '#23434e' : '#85becb') : /park|wood|landcover/.test(id) ? (dark ? '#243c34' : '#b4cda4') : /building/.test(id) ? (dark ? '#35444a' : '#b5bdb7') : (dark ? '#1c2c32' : '#dce1d8')
      map.setPaintProperty(id, 'fill-color', color)
      if (/building/.test(id)) map.setPaintProperty(id, 'fill-outline-color', dark ? '#445158' : '#889b97')
    }
    if (layer.type === 'line') {
      const color = /water/.test(id) ? (dark ? '#305864' : '#7aaebd') : /casing|boundary|railway/.test(id) ? (dark ? '#3c4b50' : '#a8b6ab') : /major|motorway/.test(id) ? (dark ? '#737263' : '#f2c27d') : (dark ? '#48595e' : '#fffdf8')
      map.setPaintProperty(id, 'line-color', color)
    }
    if (layer.type === 'symbol' && layer.layout?.['text-field']) {
      map.setPaintProperty(id, 'text-color', dark ? '#f0eee0' : '#203f43')
      map.setPaintProperty(id, 'text-halo-color', dark ? '#182a30' : '#fffef7')
      map.setPaintProperty(id, 'text-halo-width', dark ? 1.6 : 1.8)
      map.setPaintProperty(id, 'text-halo-blur', .35)
    }
    if (layer.type === 'fill-extrusion') map.setPaintProperty(id, 'fill-extrusion-color', dark ? '#4b5a60' : '#a9b5ad')
  }
}

function MapMarker({ map, coordinates, children, className }) {
  const [element] = useState(() => document.createElement('div'))
  useEffect(() => {
    const marker = new Marker({ element, anchor: 'bottom' }).setLngLat(coordinates).addTo(map)
    return () => marker.remove()
  }, [map, element, coordinates[0], coordinates[1]])
  element.className = `maplibregl-marker ${className}`
  return createPortal(children, element)
}

const TehranMap = forwardRef(function TehranMap({ shops = [], highlightedShops = [], selected, route, onSelect, theme, pickMode = false, onPick, initialCoordinates, origin, activeShop, onViewport, onVisibleCount }, ref) {
  const container = useRef(null)
  const instance = useRef(null)
  const themeRef = useRef(theme)
  themeRef.current = theme
  const pickRef = useRef(onPick)
  pickRef.current = onPick
  const viewportRef = useRef(onViewport)
  viewportRef.current = onViewport
  const originRef = useRef(origin)
  originRef.current = origin
  const [zoom, setZoom] = useState(14)
  const [, setCameraRevision] = useState(0)
  const initialPoint = useRef(initialCoordinates)
  const [map, setMap] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [scale, setScale] = useState('۱۰۰ متر')
  useImperativeHandle(ref, () => ({
    zoomIn: () => instance.current?.zoomIn({ duration: reducedMotion() ? 0 : 300 }),
    zoomOut: () => instance.current?.zoomOut({ duration: reducedMotion() ? 0 : 300 }),
    reset: () => instance.current?.flyTo({ ...HOME, ...(originRef.current ? { center: originRef.current, zoom: 14.8 } : {}), duration: reducedMotion() ? 0 : 900 }),
    goTo: point => { instance.current?.flyTo({ center: point, zoom: pickMode ? 16 : 16.6, pitch: 0, bearing: 0, duration: reducedMotion() ? 0 : 500 }); if (pickMode) pickRef.current?.(point) },
    showTrip: point => fitTrip(instance.current, originRef.current, point),
    showPoints: points => { const m = instance.current; if (!m || !points.length) return; m.fitBounds([[Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1]))], [Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))]], { padding: 65, maxZoom: 16.3, pitch: 0, bearing: 0, duration: reducedMotion() ? 0 : 650 }) },
    pickCenter: () => { const point = instance.current?.getCenter(); if (point && pickMode) pickRef.current?.([point.lng, point.lat]) },
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
        style['font-faces'] = {
          'Peyda Map Medium': new URL('/fonts/peyda/Peyda-Medium.ttf', window.location.origin).href,
          'Peyda Map Bold': new URL('/fonts/peyda/Peyda-Bold.ttf', window.location.origin).href,
        }
        for (const layer of style.layers) {
          if (layer.type === 'symbol' && layer.layout?.['text-field']) {
            layer.layout['text-field'] = persianLabelExpression()
            layer.layout['text-font'] = [/place|settlement|neigh|suburb/.test(layer.id) ? 'Peyda Map Bold' : 'Peyda Map Medium']
            layer.layout['text-letter-spacing'] = 0
            layer.layout['text-size'] = ['interpolate', ['linear'], ['zoom'], 11, 11, 14, 12.5, 17, 15, 19, 17]
            if (/shield|airport|country|state/.test(layer.id)) layer.layout.visibility = 'none'
          }
        }
        // Required source credits are rendered below in Persian with original links.
        for (const source of Object.values(style.sources)) if ('attribution' in source) source.attribution = ''
        m = new Map({ container: container.current, style, ...HOME, ...(pickMode ? { center: initialPoint.current || HOME.center, zoom: 15.5, pitch: 0, bearing: 0 } : {}), maxBounds: TEHRAN_BOUNDS, minZoom: 11.5, maxZoom: 18.5, attributionControl: false, scrollZoom: false, cooperativeGestures: true, canvasContextAttributes: { antialias: true }, locale: { 'Map.Title': 'نقشه تهران', 'CooperativeGesturesHandler.WindowsHelpText': 'برای زوم از دکمه‌های نقشه استفاده کن', 'CooperativeGesturesHandler.MacHelpText': 'برای زوم از دکمه‌های نقشه استفاده کن', 'CooperativeGesturesHandler.MobileHelpText': 'نقشه را با دو انگشت جابه‌جا کن' } })
        instance.current = m
        setMap(m)
        const publishViewport = () => {
          const bounds = m.getBounds()
          viewportRef.current?.({ west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth(), zoom: m.getZoom() })
          setZoom(m.getZoom()); setCameraRevision(v => v + 1)
        }
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
          applyPalette(m, themeRef.current)
          updateScale(); publishViewport(); setLoaded(true); setError('')
        })
        m.on('error', event => {
          if (!m.getStyle() || event.error?.message?.includes('WebGL')) setError('نمایش نقشه امکان‌پذیر نیست؛ اتصال اینترنت و پشتیبانی گرافیکی مرورگر را بررسی کن.')
        })
        m.on('moveend', () => { updateScale(); publishViewport() })
        m.on('zoom', () => { setZoom(m.getZoom()); if (m.getZoom() < 14) publishViewport() })
        if (pickMode) {
          let dragged = false
          m.on('movestart', e => { if (e.originalEvent) dragged = true })
          m.on('dragstart', () => { dragged = true })
          m.on('moveend', () => { if (dragged) { dragged = false; const point = m.getCenter(); pickRef.current?.([point.lng, point.lat]) } })
          m.on('click', e => { const point = [e.lngLat.lng, e.lngLat.lat]; m.easeTo({ center: point, duration: reducedMotion() ? 0 : 250 }); pickRef.current?.(point) })
        }
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
  useEffect(() => { if (map && loaded && origin && !pickMode) map.flyTo({ center: origin, zoom: 14.8, duration: reducedMotion() ? 0 : 700 }) }, [origin, map, loaded, pickMode])
  useEffect(() => {
    if (!map || !loaded || !activeShop) return
    const fit = () => fitTrip(map, origin, activeShop.coordinates)
    const frame = requestAnimationFrame(fit)
    map.on('resize', fit)
    return () => { cancelAnimationFrame(frame); map.off('resize', fit) }
  }, [map, loaded, activeShop?.id, activeShop?.coordinates?.[0], activeShop?.coordinates?.[1], origin])
  const occupied = []
  const labels = []
  const markerCandidates = [...(zoom >= 14 ? shops : [])]
  for (const shop of highlightedShops) if (!markerCandidates.some(row => row.id === shop.id)) markerCandidates.unshift(shop)
  if (activeShop && !markerCandidates.some(shop => shop.id === activeShop.id)) markerCandidates.unshift(activeShop)
  const markers = map && loaded ? markerCandidates.sort((a, b) => Number(b.id === selected) - Number(a.id === selected)).filter(shop => {
    const point = map.project(shop.coordinates)
    if (point.x < 0 || point.y < 0 || point.x > map.getContainer().clientWidth || point.y > map.getContainer().clientHeight) return false
    if (!highlightedShops.some(row => row.id === shop.id) && occupied.some(p => Math.abs(p.x - point.x) < 45 && Math.abs(p.y - point.y) < 47)) return false
    occupied.push(point)
    return true
  }) : []
  const namedIds = new Set(markers.filter(shop => {
    const point = map.project(shop.coordinates)
    if (labels.some(p => Math.abs(p.x - point.x) < 140 && Math.abs(p.y - point.y) < 34)) return false
    labels.push(point)
    return true
  }).map(shop => shop.id))
  useEffect(() => { onVisibleCount?.(markers.length) }, [markers.length, onVisibleCount])
  return <>
    <div ref={container} className="geographic-map" role="region" aria-label="نقشه تعاملی تهران"/>
    {map && loaded && route && origin && (activeShop || shops.find(s => s.id === selected)) && <RouteArc map={map} origin={origin} destination={(activeShop || shops.find(s => s.id === selected)).coordinates} theme={theme}/>}
    {markers.map(shop => { const type = shopTypes[shop.category] || shopTypes.other; const Icon = type.icon; return <MapMarker key={shop.id} map={map} coordinates={shop.coordinates} className={`live-shop-marker ${selected === shop.id ? 'is-active' : ''} ${zoom >= 16.2 || selected === shop.id ? 'with-name' : ''}`}><button style={{ '--shop-color': type.color }} onClick={() => onSelect(shop.id)} aria-label={`انتخاب فروشگاه ${shop.name}`} aria-pressed={selected === shop.id} title={`${shop.name} · ${shop.type}`}><span className="live-marker-icon"><Icon size={17} strokeWidth={1.9}/></span>{(zoom >= 16.2 || selected === shop.id) && namedIds.has(shop.id) && <span className="live-marker-name">{shop.name}</span>}</button></MapMarker> })}
    {map && !pickMode && origin && <MapMarker map={map} coordinates={origin} className="geo-start-marker"><span>آدرس انتخابی تو</span><i/></MapMarker>}
    <div className="persian-map-scale"><span/>{scale}</div>
    <div className="persian-map-attribution"><span>© </span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">مشارکت‌کنندگان اوپن‌استریت‌مپ</a><span> · </span><a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">اوپن‌مپ‌تایلز</a></div>
    {!loaded && !error && <div className="map-loading" role="status"><span className="map-spinner"/><span>در حال دریافت نقشهٔ تهران…</span></div>}
    {error && <div className="map-network-error" role="alert"><WifiOff size={25}/><p>{error}</p><button onClick={() => setRevision(n => n + 1)}><RefreshCw size={15}/>تلاش دوباره</button></div>}
  </>
})
export default TehranMap
