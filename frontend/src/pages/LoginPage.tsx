import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'

export function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg || 'Ошибка соединения с сервером. Проверьте интернет и попробуйте снова.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Billing Assistant</h1>
        <p className="login-subtitle">Войдите в аккаунт</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">Пароль</label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}
          <button
            type="button"
            className="btn btn-primary btn-md"
            style={{ width: '100%', touchAction: 'manipulation' }}
            disabled={loading}
            onClick={() => handleSubmit()}
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}
