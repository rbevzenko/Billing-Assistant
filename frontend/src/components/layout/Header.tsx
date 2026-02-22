import { useLocation } from 'react-router-dom'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Дашборд',
  '/time-entries': 'Учёт времени',
  '/clients': 'Клиенты',
  '/projects': 'Проекты',
  '/invoices': 'Счета',
  '/reports': 'Отчёты',
  '/profile': 'Профиль',
}

export function Header() {
  const location = useLocation()
  const path = location.pathname

  let title = PAGE_TITLES[path]
  if (!title && path.startsWith('/invoices/')) title = 'Счёт'
  if (!title) title = 'Billing Assistant'

  return (
    <header className="header">
      <h1 className="header-title">{title}</h1>
    </header>
  )
}
