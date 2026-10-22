import { useEffect, useId, useState } from 'react'

// قوس در فضای تصویر ارتفاع می‌گیرد؛ دو انتها همیشه به مختصات نقشه متصل‌اند.
export default function RouteArc({ map, origin, destination, theme }) {
  const id = useId().replace(/:/g, '')
  const [geometry, setGeometry] = useState(null)
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => setReduced(media.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])
  useEffect(() => {
    const project = () => {
      const a = map.project(origin), b = map.project(destination)
      const distance = Math.hypot(b.x - a.x, b.y - a.y)
      const lift = Math.min(125, Math.max(24, distance * .25))
      setGeometry({ path: `M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 - lift * 2} ${b.x} ${b.y}`, shadow: `M ${a.x} ${a.y} L ${b.x} ${b.y}`, a, b })
    }
    project(); map.on('move', project); map.on('resize', project)
    return () => { map.off('move', project); map.off('resize', project) }
  }, [map, origin[0], origin[1], destination[0], destination[1]])
  if (!geometry) return null
  const dark = theme === 'dark'
  return <svg className="map-route-arc" aria-label="کمان فاصلهٔ مستقیم مبدأ تا فروشگاه" role="img">
    <defs><linearGradient id={`arc-${id}`} x1="0" y1="1" x2="1" y2="0"><stop stopColor={dark ? '#71d9ca' : '#207e77'}/><stop offset=".5" stopColor={dark ? '#e8ceb0' : '#bb6942'}/><stop offset="1" stopColor={dark ? '#ffad88' : '#bd5035'}/></linearGradient></defs>
    <path d={geometry.shadow} className="route-ground-shadow"/>
    <path d={geometry.path} className="route-arc-halo" stroke={`url(#arc-${id})`}/>
    <path d={geometry.path} className="route-arc-line" stroke={`url(#arc-${id})`}/>
    {[geometry.a, geometry.b].map((point, index) => <g key={index}><ellipse cx={point.x} cy={point.y} rx="7" ry="3" className="route-anchor-ring"/><circle cx={point.x} cy={point.y} r="2.5" fill={index ? (dark ? '#ffad88' : '#bd5035') : (dark ? '#71d9ca' : '#207e77')}/></g>)}
    {!reduced && <g className="route-traveller"><circle r="7" fill={dark ? '#ffe2bd' : '#bb6942'} opacity=".12"/><circle r="2.8" fill={dark ? '#ffe2bd' : '#a85232'}/><animateMotion dur="4.8s" repeatCount="indefinite" path={geometry.path} keyPoints="0;1;0" keyTimes="0;.5;1" calcMode="linear"/></g>}
  </svg>
}
