import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ToastProvider } from './context/ToastContext'
import { TimerProvider } from './context/TimerContext'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <TimerProvider>
          <App />
        </TimerProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
