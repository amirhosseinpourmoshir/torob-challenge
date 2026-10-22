import React from 'react'
import { createRoot } from 'react-dom/client'
const App = React.lazy(() => import('./App.jsx'))
const AdminPanel = React.lazy(() => import('./AdminPanel.jsx'))
const AgentStudio = React.lazy(() => import('./AgentStudio.jsx'))
import './index.css'
import './light-theme.css'
import './shops.css'

const page = window.location.pathname.replace(/\/$/, '')
createRoot(document.getElementById('root')).render(<React.StrictMode><React.Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>در حال آماده شدن…</div>}>{page === '/panel' ? <AdminPanel/> : page === '/agent-ui' ? <AgentStudio/> : <App/>}</React.Suspense></React.StrictMode>)
