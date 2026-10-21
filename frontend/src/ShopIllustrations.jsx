// A single geometric, duotone symbol per category; no decorative illustration.
const shapes = {
  store: <><path opacity=".24" d="M4 9h16v11H4z"/><path fillRule="evenodd" d="m4 3-2 6v1a3 3 0 0 0 5 2.24 3 3 0 0 0 5 0 3 3 0 0 0 5 0A3 3 0 0 0 22 10V9l-2-6H4Zm1.44 2L4.1 9H7l.67-4H5.44Zm4.26 0L9 9h6l-.7-4H9.7Zm6.63 0L17 9h2.9l-1.34-4h-2.23Z" clipRule="evenodd"/><path d="M3 14h3v6h4v-6h4v6h4v-6h3v7H3v-7Z"/></>,
  digital: <><rect opacity=".25" x="2" y="6" width="10" height="15" rx="2"/><path fillRule="evenodd" d="M10 2a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H10Zm0 3h10v11H10V5Zm4 13h2v1h-2v-1Z" clipRule="evenodd"/><path opacity=".45" d="m12 12 5-5h-5v5Z"/></>,
  fashion: <><path opacity=".24" d="m2 8 5-5h10l5 5-4 5-2-2v11H8V11l-2 2-4-5Z"/><path d="M8 3a4 4 0 0 0 8 0l6 5-4 4-2-2v11H8V10l-2 2-4-4 6-5Z"/><path opacity=".3" d="M8 17h8v4H8z" fill="#fff"/></>,
  home: <><rect opacity=".24" x="5" y="3" width="14" height="12" rx="3"/><path d="M4 9a3 3 0 0 0-3 3v7h22v-7a3 3 0 1 0-6 0v3H7v-3a3 3 0 0 0-3-3Z"/><path d="M4 19h3v3H4zm13 0h3v3h-3z"/><path opacity=".5" d="M8 6h3v7H8zm5 0h3v7h-3z"/></>,
  beauty: <><path opacity=".25" d="M12 1C9 5 3 10 3 15a9 9 0 0 0 18 0C21 10 15 5 12 1Z"/><path fillRule="evenodd" d="M12 5c-2.6 3.5-6 6.6-6 10a6 6 0 0 0 12 0c0-3.4-3.4-6.5-6-10Zm-1 5h2v3h3v2h-3v3h-2v-3H8v-2h3v-3Z" clipRule="evenodd"/></>,
  auto: <><path opacity=".25" d="m15 3 6 6-6 6-6-6 6-6ZM3 18l5-5 3 3-5 5H3v-3Z"/><path d="M20.4 2.6 16 7l-3-3 4.4-4.4A7 7 0 0 0 9 9l-7 7a4.24 4.24 0 0 0 6 6l7-7a7 7 0 0 0 9.4-8.4L20 11l-3-3 4.4-4.4-1-1Z" transform="translate(0 1) scale(.91)"/><circle cx="5.5" cy="18.5" r="1.3" fill="var(--glyph-surface, #fff)"/></>,
  sport: <><path opacity=".25" d="M7 7h10v10H7z"/><rect x="1" y="7" width="3" height="10" rx="1"/><rect x="5" y="4" width="4" height="16" rx="1"/><path d="M9 10h6v4H9z"/><rect x="15" y="4" width="4" height="16" rx="1"/><rect x="20" y="7" width="3" height="10" rx="1"/></>,
  food: <><path opacity=".25" d="M2 2h8v9H2zm14 0h5v20h-5z"/><path d="M2 2h2v6h1V2h2v6h1V2h2v7a4 4 0 0 1-3 3.87V22H4v-9.13A4 4 0 0 1 1 9V2h1Zm19 0v20h-3v-7h-4V9a7 7 0 0 1 7-7Z"/></>,
  culture: <><path opacity=".25" d="M12 5c-3-3-7-3-11-2v17c4-1 8-1 11 2 3-3 7-3 11-2V3c-4-1-8-1-11 2Z"/><path d="M3 5c3-.5 5 0 8 2v13c-3-2-5-2.5-8-2V5Zm10 2c3-2 5-2.5 8-2v13c-3-.5-5 0-8 2V7Z"/><path opacity=".4" fill="#fff" d="m5 8 4 1v2l-4-1V8Zm10 1 4-1v2l-4 1V9Z"/></>,
  jewelry: <><path opacity=".25" d="m6 2-5 7 11 14L23 9l-5-7H6Z"/><path d="M8 3 4 8h6L8 3Zm3 0L9 8h6l-2-5h-2Zm5 0-2 5h6l-4-5ZM4 10l6 9-2-9H4Zm7 0 1 9 1-9h-2Zm5 0-2 9 6-9h-4Z"/></>,
}
const colors = { store: '#d25b3d', digital: '#4d68e8', fashion: '#8a4cce', home: '#168b7d', beauty: '#d74382', auto: '#4779ba', sport: '#329454', food: '#ce7727', culture: '#1389a1', jewelry: '#b38320' }
function Symbol({ kind, size = 24, className = '', style, strokeWidth: _, ...props }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={`shop-illustration ${className}`} style={{ color: colors[kind], ...style }} aria-hidden="true" {...props}>{shapes[kind]}</svg>
}
const icon = kind => function ShopIcon(props) { return <Symbol {...props} kind={kind}/> }
export const ShopStore = icon('store')
export const ShopDigital = icon('digital')
export const ShopFashion = icon('fashion')
export const ShopHome = icon('home')
export const ShopBeauty = icon('beauty')
export const ShopAuto = icon('auto')
export const ShopSport = icon('sport')
export const ShopFood = icon('food')
export const ShopCulture = icon('culture')
export const ShopJewelry = icon('jewelry')
