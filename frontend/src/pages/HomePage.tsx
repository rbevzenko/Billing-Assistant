import { useEffect, useState } from 'react'
import api from '../services/api'

interface HelloResponse {
  message: string
}

function HomePage() {
  const [message, setMessage] = useState<string>('Загрузка...')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<HelloResponse>('/hello')
      .then((res) => setMessage(res.data.message))
      .catch(() => setError('Не удалось подключиться к API'))
  }, [])

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Billing Assistant</h1>
        <p style={styles.subtitle}>Учёт рабочего времени и биллинг юриста</p>
        <hr style={styles.divider} />
        <div style={styles.apiBlock}>
          <span style={styles.label}>Ответ от API:</span>
          {error ? (
            <span style={styles.error}>{error}</span>
          ) : (
            <span style={styles.success}>{message}</span>
          )}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  card: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '2.5rem 3rem',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    maxWidth: '480px',
    width: '100%',
    textAlign: 'center',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 700,
    color: '#1a1a2e',
    marginBottom: '0.5rem',
  },
  subtitle: {
    color: '#6b7280',
    fontSize: '1rem',
  },
  divider: {
    border: 'none',
    borderTop: '1px solid #e5e7eb',
    margin: '1.5rem 0',
  },
  apiBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  label: {
    fontSize: '0.85rem',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  success: {
    color: '#16a34a',
    fontWeight: 600,
    fontSize: '1.05rem',
  },
  error: {
    color: '#dc2626',
    fontWeight: 600,
    fontSize: '1.05rem',
  },
}

export default HomePage
