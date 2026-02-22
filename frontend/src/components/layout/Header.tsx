import { useLocation } from 'react-router-dom'
import { useLanguage } from '@/i18n/translations'

export function Header() {
  const location = useLocation()
  const { t } = useLanguage()
  const path = location.pathname

  let title = t.header[path as keyof typeof t.header]
  if (!title && path.startsWith('/invoices/')) title = t.header['/invoices/:id']
  if (!title) title = 'Billing Assistant'

  return (
    <header className="header">
      <h1 className="header-title">{title}</h1>
    </header>
  )
}
