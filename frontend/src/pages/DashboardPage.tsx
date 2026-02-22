export function DashboardPage() {
  return (
    <div>
      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-label">Клиенты</div>
          <div className="stat-value">—</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Активные проекты</div>
          <div className="stat-value">—</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Часов в этом месяце</div>
          <div className="stat-value">—</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Счета к оплате</div>
          <div className="stat-value">—</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <h2 className="card-title">Добро пожаловать</h2>
        </div>
        <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
          Система учёта рабочего времени и биллинга для юристов.
          Начните с заполнения <a href="/profile">профиля</a>,
          добавьте <a href="/clients">клиентов</a> и <a href="/projects">проекты</a>,
          затем ведите <a href="/time-entries">учёт времени</a> и выставляйте <a href="/invoices">счета</a>.
        </p>
      </div>
    </div>
  )
}
