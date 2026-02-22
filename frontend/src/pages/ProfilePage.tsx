import { useEffect, useState } from 'react'
import { profileService } from '@/services/profile'
import { useToast } from '@/context/ToastContext'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import type { Currency, LawyerProfile, LawyerProfileUpdate, ProfileType, VatType, AppLanguage } from '@/types'

const CURRENCY_OPTIONS: { value: Currency; label: string }[] = [
  { value: 'RUB', label: 'RUB — Российский рубль' },
  { value: 'USD', label: 'USD — Доллар США' },
  { value: 'EUR', label: 'EUR — Евро' },
]

const VAT_OPTIONS: { value: VatType; label: string }[] = [
  { value: 'none', label: 'Без НДС' },
  { value: 'exempt', label: 'НДС не облагается (ст. 149 НК РФ)' },
  { value: 'vat0', label: 'НДС 0%' },
  { value: 'vat10', label: 'НДС 10%' },
  { value: 'vat22', label: 'НДС 22%' },
]

const LANG_OPTIONS: { value: AppLanguage; label: string }[] = [
  { value: 'ru', label: 'Русский — документы на русском' },
  { value: 'en', label: 'English — documents in English' },
]

function emptyProfile(type: ProfileType): LawyerProfileUpdate {
  return {
    label: type === 'ru' ? 'Российский профиль' : 'European profile',
    type,
    language: type === 'ru' ? 'ru' : 'en',
    full_name: '',
    company_name: '',
    address: '',
    email: '',
    phone: '',
    default_hourly_rate: '',
    default_currency: type === 'ru' ? 'RUB' : 'EUR',
    vat_type: 'none',
  }
}

function ProfileForm({
  profile,
  onSave,
  onDelete,
  canDelete,
}: {
  profile: LawyerProfile | null
  onSave: (data: LawyerProfileUpdate, id?: number) => Promise<void>
  onDelete?: () => void
  canDelete: boolean
}) {
  const type: ProfileType = profile?.type ?? 'ru'
  const [form, setForm] = useState<LawyerProfileUpdate>(profile ? { ...profile } : emptyProfile(type))
  const [saving, setSaving] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  const set = (field: keyof LawyerProfileUpdate) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try { await onSave(form, profile?.id) }
    finally { setSaving(false) }
  }

  const isEu = form.type === 'eu'

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-section">
        <h3 className="form-section-title">Настройки профиля</h3>
        <div className="form-grid">
          <Input label="Название профиля" value={form.label ?? ''} onChange={set('label')} required />
          <Select
            label="Язык документов"
            value={form.language ?? 'ru'}
            onChange={e => setForm(p => ({ ...p, language: e.target.value as AppLanguage }))}
            options={LANG_OPTIONS}
          />
          <Select
            label="Валюта по умолчанию"
            value={form.default_currency ?? 'RUB'}
            onChange={e => setForm(p => ({ ...p, default_currency: e.target.value as Currency }))}
            options={CURRENCY_OPTIONS}
          />
          <Input
            label="Ставка по умолчанию (в час)"
            type="number"
            step="0.01"
            min="0"
            value={form.default_hourly_rate ?? ''}
            onChange={set('default_hourly_rate')}
            required
          />
        </div>
        <Select
          label="НДС по умолчанию"
          value={form.vat_type ?? 'none'}
          onChange={e => setForm(p => ({ ...p, vat_type: e.target.value as VatType }))}
          options={VAT_OPTIONS}
        />
      </div>

      <div className="form-section">
        <h3 className="form-section-title">{isEu ? 'Personal / Company' : 'Личные данные'}</h3>
        <div className="form-grid">
          <Input label="ФИО / Full name" value={form.full_name ?? ''} onChange={set('full_name')} required />
          <Input label={isEu ? 'Company name' : 'Компания'} value={form.company_name ?? ''} onChange={set('company_name')} required />
          <Input label="Email" type="email" value={form.email ?? ''} onChange={set('email')} required />
          <Input label={isEu ? 'Phone' : 'Телефон'} value={form.phone ?? ''} onChange={set('phone')} required />
          {!isEu && <Input label="ИНН" value={form.inn ?? ''} onChange={set('inn')} maxLength={12} />}
          {isEu && <Input label="EU VAT Number" value={form.vat_number ?? ''} onChange={set('vat_number')} placeholder="DE123456789" />}
        </div>
        <Textarea label={isEu ? 'Address' : 'Адрес'} value={form.address ?? ''} onChange={set('address')} required rows={2} />
      </div>

      <div className="form-section">
        <h3 className="form-section-title">{isEu ? 'Bank Details' : 'Банковские реквизиты'}</h3>
        {isEu ? (
          <div className="form-grid">
            <Input label="IBAN" value={form.iban ?? ''} onChange={set('iban')} placeholder="DE89 3704 0044 0532 0130 00" />
            <Input label="SWIFT / BIC" value={form.swift ?? ''} onChange={set('swift')} placeholder="COBADEFFXXX" />
            <Input label="Bank name" value={form.bank_name ?? ''} onChange={set('bank_name')} />
            <Input label="Bank country" value={form.bank_country ?? ''} onChange={set('bank_country')} placeholder="Germany" />
          </div>
        ) : (
          <div className="form-grid">
            <Input label="Банк" value={form.bank_name ?? ''} onChange={set('bank_name')} />
            <Input label="БИК" value={form.bik ?? ''} onChange={set('bik')} maxLength={9} />
            <Input label="Расчётный счёт" value={form.checking_account ?? ''} onChange={set('checking_account')} maxLength={20} />
            <Input label="Корреспондентский счёт" value={form.correspondent_account ?? ''} onChange={set('correspondent_account')} maxLength={20} />
          </div>
        )}
      </div>

      <div className="form-actions" style={{ justifyContent: 'space-between', display: 'flex' }}>
        <div>
          {canDelete && onDelete && (
            <Button type="button" variant="danger" onClick={() => setShowDelete(true)}>Удалить профиль</Button>
          )}
        </div>
        <Button type="submit" loading={saving}>Сохранить</Button>
      </div>

      <ConfirmModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => { setShowDelete(false); onDelete?.() }}
        title="Удалить профиль"
        message={`Удалить профиль «${profile?.label}»?`}
        loading={false}
      />
    </form>
  )
}

export function ProfilePage() {
  const { addToast } = useToast()
  const [profiles, setProfiles] = useState<LawyerProfile[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<number | 'new_ru' | 'new_eu'>('new_ru')

  const reload = () => {
    setLoading(true)
    profileService.list().then(list => {
      setProfiles(list)
      if (list.length > 0) setTab(prev => typeof prev === 'number' && list.find(p => p.id === prev) ? prev : list[0].id)
    }).finally(() => setLoading(false))
    profileService.getActive().then(p => setActiveId(p?.id ?? null))
  }

  useEffect(() => { reload() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (data: LawyerProfileUpdate, id?: number) => {
    try {
      const saved = await profileService.upsert(data, id)
      addToast('success', 'Профиль сохранён')
      setTab(saved.id)
      reload()
    } catch (err: any) {
      addToast('error', err.message || 'Ошибка сохранения')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await profileService.delete(id)
      addToast('success', 'Профиль удалён')
      reload()
    } catch (err: any) {
      addToast('error', err.message || 'Ошибка удаления')
    }
  }

  const handleSetActive = (id: number) => {
    profileService.setActive(id)
    setActiveId(id)
    addToast('success', 'Активный профиль обновлён')
  }

  if (loading) return <div className="loading-text">Загрузка...</div>

  const currentProfile = typeof tab === 'number' ? profiles.find(p => p.id === tab) ?? null : null
  const newType: ProfileType | null = tab === 'new_ru' ? 'ru' : tab === 'new_eu' ? 'eu' : null

  return (
    <div>
      <div className="page-toolbar" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div className="filter-bar" style={{ flexWrap: 'wrap', gap: 6 }}>
          {profiles.map(p => (
            <button
              key={p.id}
              className={`btn btn-sm ${tab === p.id ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setTab(p.id)}
            >
              {p.type === 'eu' ? '🌍' : '🇷🇺'} {p.label}{activeId === p.id ? ' ✓' : ''}
            </button>
          ))}
          {!profiles.find(p => p.type === 'ru') && (
            <button className={`btn btn-sm ${tab === 'new_ru' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('new_ru')}>
              + 🇷🇺 Российский
            </button>
          )}
          {!profiles.find(p => p.type === 'eu') && (
            <button className={`btn btn-sm ${tab === 'new_eu' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('new_eu')}>
              + 🌍 Европейский
            </button>
          )}
        </div>
        {currentProfile && activeId !== currentProfile.id && (
          <Button size="sm" variant="secondary" onClick={() => handleSetActive(currentProfile.id)}>
            Сделать активным
          </Button>
        )}
      </div>

      <div className="card" style={{ maxWidth: 760 }}>
        <div className="card-header">
          <h2 className="card-title">
            {currentProfile
              ? currentProfile.label
              : newType === 'eu' ? '🌍 Новый европейский профиль' : '🇷🇺 Новый российский профиль'}
          </h2>
          {currentProfile && activeId === currentProfile.id && (
            <span className="badge badge-success" style={{ fontSize: 12 }}>Активный</span>
          )}
        </div>

        <ProfileForm
          key={String(tab)}
          profile={newType ? null : currentProfile}
          onSave={handleSave}
          onDelete={currentProfile ? () => handleDelete(currentProfile.id) : undefined}
          canDelete={profiles.length > 1}
        />
      </div>
    </div>
  )
}
