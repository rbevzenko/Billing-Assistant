import { useEffect, useState } from 'react'
import { profileService } from '@/services/profile'
import { useToast } from '@/context/ToastContext'
import { Input, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { LawyerProfileUpdate } from '@/types'

const EMPTY: LawyerProfileUpdate = {
  full_name: '',
  company_name: '',
  inn: '',
  address: '',
  bank_name: '',
  bik: '',
  checking_account: '',
  correspondent_account: '',
  email: '',
  phone: '',
  default_hourly_rate: '',
}

export function ProfilePage() {
  const { addToast } = useToast()
  const [form, setForm] = useState<LawyerProfileUpdate>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    profileService.get().then(profile => {
      if (profile) {
        setForm({
          full_name: profile.full_name,
          company_name: profile.company_name,
          inn: profile.inn,
          address: profile.address,
          bank_name: profile.bank_name,
          bik: profile.bik,
          checking_account: profile.checking_account,
          correspondent_account: profile.correspondent_account,
          email: profile.email,
          phone: profile.phone,
          default_hourly_rate: profile.default_hourly_rate,
        })
      }
    }).finally(() => setLoading(false))
  }, [])

  const set = (field: keyof LawyerProfileUpdate) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await profileService.upsert(form)
      addToast('success', 'Профиль сохранён')
    } catch {
      addToast('error', 'Ошибка сохранения профиля')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading-text">Загрузка...</div>

  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <div className="card-header">
        <h2 className="card-title">Реквизиты юриста</h2>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <h3 className="form-section-title">Личные данные</h3>
          <div className="form-grid">
            <Input label="ФИО" value={form.full_name ?? ''} onChange={set('full_name')} required />
            <Input label="Компания" value={form.company_name ?? ''} onChange={set('company_name')} required />
            <Input label="ИНН" value={form.inn ?? ''} onChange={set('inn')} required maxLength={12} />
            <Input label="Email" type="email" value={form.email ?? ''} onChange={set('email')} required />
            <Input label="Телефон" value={form.phone ?? ''} onChange={set('phone')} required />
            <Input
              label="Ставка по умолчанию (руб/час)"
              type="number"
              step="0.01"
              min="0"
              value={form.default_hourly_rate ?? ''}
              onChange={set('default_hourly_rate')}
              required
            />
          </div>
          <Textarea label="Адрес" value={form.address ?? ''} onChange={set('address')} required rows={2} />
        </div>

        <div className="form-section">
          <h3 className="form-section-title">Банковские реквизиты</h3>
          <div className="form-grid">
            <Input label="Банк" value={form.bank_name ?? ''} onChange={set('bank_name')} required />
            <Input label="БИК" value={form.bik ?? ''} onChange={set('bik')} required maxLength={9} />
            <Input label="Расчётный счёт" value={form.checking_account ?? ''} onChange={set('checking_account')} required maxLength={20} />
            <Input label="Корреспондентский счёт" value={form.correspondent_account ?? ''} onChange={set('correspondent_account')} required maxLength={20} />
          </div>
        </div>

        <div className="form-actions">
          <Button type="submit" loading={saving}>Сохранить</Button>
        </div>
      </form>
    </div>
  )
}
