import { useId } from 'react'

// Small, filled illustrations share a 48px canvas; gradients are scoped per SVG.
function Illustration({ kind, size = 24, className = '', ...props }) {
  const id = useId().replace(/:/g, '')
  const palettes = {
    store: ['#ffb86d', '#ee6650'], digital: ['#80caff', '#596bea'],
    fashion: ['#e6a1ff', '#a25be1'], home: ['#71ddbc', '#23a68e'],
    beauty: ['#ffabd2', '#ed6c9d'], auto: ['#8bc5ff', '#4b83df'],
    sport: ['#a7e57a', '#51ac68'], food: ['#ffcf7a', '#e98a46'],
    culture: ['#81d7ed', '#428aba'], jewelry: ['#ffe49a', '#d6a34c'],
  }
  const [light, dark] = palettes[kind] || palettes.store
  const paint = `url(#${id}-body)`
  const accent = `url(#${id}-accent)`
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shop-illustration ${className}`} aria-hidden="true" {...props}>
    <defs><linearGradient id={`${id}-body`} x1="10" y1="8" x2="37" y2="42" gradientUnits="userSpaceOnUse"><stop stopColor={light}/><stop offset="1" stopColor={dark}/></linearGradient><linearGradient id={`${id}-accent`} x1="12" y1="12" x2="35" y2="39" gradientUnits="userSpaceOnUse"><stop stopColor="#fff8e9"/><stop offset="1" stopColor="#f1d7b2"/></linearGradient></defs>
    <ellipse cx="24" cy="42" rx="15" ry="3" fill={dark} opacity=".17"/>
    {kind === 'store' && <><path d="M9 20h30v18a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3V20Z" fill={accent}/><path d="M8 20h32l-4-10H12L8 20Z" fill={paint}/><path d="m16 10-2 10h7l1-10m7 0 1 10h7l-3-10" fill="#fff0d9"/><path d="M8 20h8a4 4 0 0 1-8 0Zm8 0h8a4 4 0 0 1-8 0Zm8 0h8a4 4 0 0 1-8 0Zm8 0h8a4 4 0 0 1-8 0Z" fill="#df6550"/><rect x="13" y="28" width="10" height="8" rx="2" fill="#7bbfc8"/><path d="M27 29a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v12h-8V29Z" fill="#a66a50"/><circle cx="32" cy="34" r="1" fill="#ffe4a3"/><path d="m15 30 3-1" stroke="#e0ffff" strokeWidth="2" strokeLinecap="round"/></>}
    {kind === 'digital' && <><rect x="10" y="6" width="23" height="35" rx="6" fill="#4654a8"/><rect x="12" y="6" width="23" height="33" rx="5" fill={paint}/><rect x="15" y="10" width="17" height="24" rx="3" fill="#c9efff"/><path d="m16 29 15-17v14l-7 8h-8v-5Z" fill="#9bcefa"/><rect x="20" y="8" width="7" height="2" rx="1" fill="#4859ab"/><circle cx="23.5" cy="36.5" r="1" fill="#e6edff"/><path d="M31 23h9v12a5 5 0 0 1-10 0V24a1 1 0 0 1 1-1Z" fill={accent}/><path d="M30 23a5 5 0 0 1 10 0v3H30v-3Z" fill="#ffc776"/><path d="M35 21v5" stroke="#ca9851" strokeWidth="1.5" strokeLinecap="round"/></>}
    {kind === 'fashion' && <><path d="m8 18 4 21a3 3 0 0 0 3 3h21a3 3 0 0 0 3-3l2-21H8Z" fill="#7d48b6"/><path d="M8 17h27l3 21a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3L8 17Z" fill={paint}/><path d="M16 19v-5a7 7 0 0 1 14 0v5" stroke="#f8dfad" strokeWidth="4" strokeLinecap="round"/><circle cx="16" cy="20" r="2" fill="#fff2ca"/><circle cx="30" cy="20" r="2" fill="#fff2ca"/><path d="m30 27 7-3 6 10-7 4-6-11Z" fill={accent}/><circle cx="34.5" cy="28" r="1.3" fill="#b37bcd"/><path d="m16 31 3 3 7-8" stroke="#f5dcff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></>}
    {kind === 'home' && <><path d="M12 23h25v16a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3V23Z" fill={accent}/><path d="m6 23 16-15a3 3 0 0 1 4 0l16 15a2 2 0 0 1-3 3L24 12 9 26a2 2 0 0 1-3-3Z" fill={paint}/><path d="M31 10h5v9l-5-5v-4Z" fill="#df9975"/><path d="M21 30a3 3 0 0 1 6 0v12h-6V30Z" fill="#36a68e"/><rect x="14" y="27" width="5" height="6" rx="1.5" fill="#78c6dc"/><rect x="29" y="27" width="5" height="6" rx="1.5" fill="#78c6dc"/><path d="M37 40V27" stroke="#4b9870" strokeWidth="2.5" strokeLinecap="round"/><path d="M37 34c-8 0-9-6-9-6 7-1 9 6 9 6Zm0-4c7 0 8-8 8-8-8 1-8 8-8 8Z" fill="#72c285"/></>}
    {kind === 'beauty' && <><rect x="9" y="23" width="22" height="18" rx="5" fill={paint}/><rect x="13" y="17" width="14" height="8" rx="2" fill={accent}/><rect x="17" y="12" width="6" height="7" rx="2" fill="#a66080"/><path d="M20 13V9h10" stroke="#a66080" strokeWidth="3" strokeLinecap="round"/><rect x="14" y="29" width="12" height="7" rx="2" fill="#ffe9ed"/><path d="M32 26h9v15h-9V26Z" fill="#b66087"/><path d="M33 17a2 2 0 0 1 1-2l5-3a1 1 0 0 1 1 1v14h-7V17Z" fill="#f57885"/><rect x="31" y="27" width="11" height="4" rx="1" fill="#f6c883"/><path d="m36 5 1.5 3L41 9l-3.5 1-1.5 3-1-3L32 9l3-1 1-3Z" fill="#f8c66b"/></>}
    {kind === 'auto' && <><path d="m8 25 4-12a4 4 0 0 1 4-3h16a4 4 0 0 1 4 3l4 12H8Z" fill={paint}/><path d="m16 14-3 9h22l-3-9H16Z" fill="#c5e9f5"/><path d="m27 14-5 9h13l-3-9h-5Z" fill="#9ac7e5"/><rect x="6" y="23" width="36" height="14" rx="5" fill={paint}/><rect x="9" y="34" width="7" height="7" rx="2" fill="#435675"/><rect x="32" y="34" width="7" height="7" rx="2" fill="#435675"/><rect x="10" y="27" width="7" height="4" rx="2" fill="#fff0c6"/><rect x="31" y="27" width="7" height="4" rx="2" fill="#fff0c6"/><rect x="20" y="32" width="8" height="3" rx="1" fill="#d9e9f4"/><path d="m34 5-4 5 3 4 5-2 2-6-4 3-2-1V5Z" fill="#ffc374"/></>}
    {kind === 'sport' && <><path d="M8 34 20 11a3 3 0 0 1 5 0l16 28H9a3 3 0 0 1-1-5Z" fill={paint}/><path d="m23 12 3 27H11l12-27Z" fill="#d5f1b6"/><path d="m23 23 3 16H15l8-16Z" fill="#3e7d65"/><path d="M10 40h32" stroke="#ce9a64" strokeWidth="3" strokeLinecap="round"/><path d="M35 35V15" stroke="#986a44" strokeWidth="2.5" strokeLinecap="round"/><path d="m35 11-8 13h16l-8-13Z" fill="#247d68"/><path d="m35 18-10 13h20L35 18Z" fill="#399b76"/><circle cx="10" cy="10" r="4" fill="#ffc869"/></>}
    {kind === 'food' && <><ellipse cx="22" cy="39" rx="18" ry="3" fill="#d6a878"/><path d="M31 20h5a6 6 0 0 1 0 12h-4v-4h4a2 2 0 0 0 0-4h-5v-4Z" fill="#cd8155"/><path d="M9 18h25v13a8 8 0 0 1-8 8h-9a8 8 0 0 1-8-8V18Z" fill={paint}/><ellipse cx="21.5" cy="18" rx="12.5" ry="4" fill="#ffe6bb"/><ellipse cx="21.5" cy="18" rx="9" ry="2.5" fill="#88563d"/><path d="M15 8c-3 3 3 4 0 7m8-10c-3 3 3 5 0 8m7-5c-2 2 2 3 0 5" stroke="#cfab8c" strokeWidth="2" strokeLinecap="round"/><path d="M15 24v6a5 5 0 0 0 3 4" stroke="#ffe5bc" strokeWidth="2.5" strokeLinecap="round"/></>}
    {kind === 'culture' && <><path d="M5 13c7-3 12-2 19 2 7-4 12-5 19-2v25c-8-3-13-2-19 2-6-4-11-5-19-2V13Z" fill="#3c7d9f"/><path d="M7 10c6-2 11-1 17 3v24c-6-4-11-5-17-3V10Z" fill={accent}/><path d="M24 13c6-4 11-5 17-3v24c-6-2-11-1-17 3V13Z" fill="#fff6df"/><path d="M24 13v24" stroke="#d7bc92" strokeWidth="2"/><path d="M11 17c3-1 6 0 9 2m-9 4c3-1 6 0 9 2m9-7c3-2 5-2 8-2m-8 8c3-2 5-2 8-2" stroke="#cfb28d" strokeWidth="2" strokeLinecap="round"/><path d="M32 7v15l3-2 3 1V6l-6 1Z" fill={paint}/></>}
    {kind === 'jewelry' && <><path d="M18 7a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3l2 10H16l2-10Zm-2 25h16l-2 9a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3l-2-9Z" fill="#aa7b58"/><rect x="13" y="12" width="23" height="25" rx="9" fill={paint}/><rect x="17" y="16" width="15" height="17" rx="6" fill="#fff3d7"/><path d="M24 20v5l4 2" stroke="#a37843" strokeWidth="2.5" strokeLinecap="round"/><rect x="35" y="22" width="3" height="6" rx="1" fill="#d9a955"/><path d="m39 7 1.5 3 3.5 1-3.5 1-1.5 3-1-3-3-1 3-1 1-3Z" fill="#f5c45c"/></>}
  </svg>
}

const icon = kind => function ShopIcon(props) { return <Illustration {...props} kind={kind}/> }
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
