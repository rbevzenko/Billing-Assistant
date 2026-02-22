import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { ToastContainer } from '@/components/ui/Toast'

export function Layout() {
  return (
    <div className="layout">
      <Sidebar />
      <div className="main">
        <Header />
        <main className="page">
          <Outlet />
        </main>
      </div>
      <ToastContainer />
    </div>
  )
}
