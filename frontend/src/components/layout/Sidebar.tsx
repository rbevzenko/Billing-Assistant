import { NavLink } from 'react-router-dom'
import { useLanguage } from '@/i18n/translations'

export function Sidebar() {
  const { lang, setLang, t } = useLanguage()

  const NAV_ITEMS = [
    { to: '/', label: t.nav.dashboard, icon: '◈', end: true },
    { to: '/time-entries', label: t.nav.timeEntries, icon: '◷' },
    { to: '/clients', label: t.nav.clients, icon: '◉' },
    { to: '/projects', label: t.nav.projects, icon: '◧' },
    { to: '/invoices', label: t.nav.invoices, icon: '◻' },
    { to: '/reports', label: t.nav.reports, icon: '◔' },
  ]

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
          <span>{t.nav.profile}</span>
        </NavLink>

        {/* Language switcher */}
        <div className="lang-switcher">
          <button
            className={`lang-btn ${lang === 'ru' ? 'lang-btn-active' : ''}`}
            onClick={() => setLang('ru')}
            title="Русский"
          >
            RU
          </button>
          <button
            className={`lang-btn ${lang === 'en' ? 'lang-btn-active' : ''}`}
            onClick={() => setLang('en')}
            title="English"
          >
            EN
          </button>
        </div>
      </div>
    </aside>
  )
}
