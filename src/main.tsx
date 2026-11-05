import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './lib/registerSw'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// オフラインでもアプリが開くよう、本番ビルドでのみ Service Worker を登録する
registerServiceWorker({
  isProd: import.meta.env.PROD,
  base: import.meta.env.BASE_URL,
  container:
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator
      ? navigator.serviceWorker
      : null,
})
