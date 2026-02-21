import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
      }}
    >
      <h1 style={{ fontSize: '4rem', color: '#9ca3af' }}>404</h1>
      <p style={{ color: '#6b7280' }}>Страница не найдена</p>
      <Link to="/">На главную</Link>
    </div>
  )
}

export default NotFoundPage
