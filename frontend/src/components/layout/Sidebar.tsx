import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/', label: 'Дашборд', icon: '◈', end: true },
  { to: '/time-entries', label: 'Учёт времени', icon: '◷' },
  { to: '/clients', label: 'Клиенты', icon: '◉' },
  { to: '/projects', label: 'Проекты', icon: '◧' },
  { to: '/invoices', label: 'Счета', icon: '◻' },
  { to: '/reports', label: 'Отчёты', icon: '◔' },
] as const

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-logo-icon">⚖</span>
        <span className="sidebar-logo-text">BillingAssist</span>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={'end' in item ? item.end : false}
            className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
          >
            <span className="sidebar-link-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <NavLink
          to="/profile"
          className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
        >
          <span className="sidebar-link-icon">◍</span>
          <span>Профиль</span>
        </NavLink>
      </div>
    </aside>
  )
}
