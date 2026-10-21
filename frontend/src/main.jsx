import React from 'react'
import { createRoot } from 'react-dom/client'
const App = React.lazy(() => import('./App.jsx'))
const AdminPanel = React.lazy(() => import('./AdminPanel.jsx'))
import './index.css'
import './light-theme.css'
import './shops.css'

createRoot(document.getElementById('root')).render(<React.StrictMode><React.Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>در حال آماده شدن…</div>}>{window.location.pathname.replace(/\/$/, '') === '/panel' ? <AdminPanel/> : <App/>}</React.Suspense></React.StrictMode>)
