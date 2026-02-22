import { load, save, nextId } from './storage'
import type { LawyerProfile, LawyerProfileUpdate } from '@/types'

const KEY = 'profiles'
const ACTIVE_KEY = 'active_profile_id'

function migrateOldProfile(): LawyerProfile[] {
  try {
    const raw = localStorage.getItem('billing_profile')
    if (!raw) return []
    const old = JSON.parse(raw)
    const profile: LawyerProfile = {
      id: 1,
      label: 'Российский профиль',
      type: 'ru',
      language: 'ru',
      full_name: old.full_name ?? '',
      company_name: old.company_name ?? '',
      address: old.address ?? '',
      email: old.email ?? '',
      phone: old.phone ?? '',
      default_hourly_rate: old.default_hourly_rate ?? '',
      default_currency: 'RUB',
      vat_type: 'none',
      logo_path: old.logo_path ?? null,
      inn: old.inn,
      bank_name: old.bank_name,
      bik: old.bik,
      checking_account: old.checking_account,
      correspondent_account: old.correspondent_account,
    }
    localStorage.removeItem('billing_profile')
    return [profile]
  } catch {
    return []
  }
}

function getProfiles(): LawyerProfile[] {
  const profiles = load<LawyerProfile>(KEY)
  if (profiles.length > 0) return profiles
  const migrated = migrateOldProfile()
  if (migrated.length > 0) {
    save(KEY, migrated)
    return migrated
  }
  return []
}

export const profileService = {
  list: (): Promise<LawyerProfile[]> =>
    Promise.resolve(getProfiles()),

  getActive: (): Promise<LawyerProfile | null> => {
    const profiles = getProfiles()
    if (profiles.length === 0) return Promise.resolve(null)
    const activeId = localStorage.getItem('billing_' + ACTIVE_KEY)
    const active = activeId ? profiles.find(p => p.id === Number(activeId)) : null
    return Promise.resolve(active ?? profiles[0])
  },

  // Legacy compat used by InvoiceDetailPage
  get: (): Promise<LawyerProfile | null> => profileService.getActive(),

  getById: (id: number): Promise<LawyerProfile | null> =>
    Promise.resolve(getProfiles().find(p => p.id === id) ?? null),

  setActive: (id: number): void => {
    localStorage.setItem('billing_' + ACTIVE_KEY, String(id))
  },

  upsert: (data: LawyerProfileUpdate, id?: number): Promise<LawyerProfile> => {
    const profiles = getProfiles()
    if (id !== undefined) {
      const idx = profiles.findIndex(p => p.id === id)
      if (idx === -1) return Promise.reject(new Error('Профиль не найден'))
      profiles[idx] = { ...profiles[idx], ...data }
      save(KEY, profiles)
      return Promise.resolve(profiles[idx])
    }
    const profile: LawyerProfile = {
      id: nextId(profiles),
      label: data.label ?? 'Новый профиль',
      type: data.type ?? 'ru',
      language: data.language ?? 'ru',
      full_name: data.full_name ?? '',
      company_name: data.company_name ?? '',
      address: data.address ?? '',
      email: data.email ?? '',
      phone: data.phone ?? '',
      default_hourly_rate: data.default_hourly_rate ?? '',
      default_currency: data.default_currency ?? 'RUB',
      vat_type: data.vat_type ?? 'none',
      logo_path: data.logo_path ?? null,
      ...data,
    }
    save(KEY, [...profiles, profile])
    return Promise.resolve(profile)
  },

  delete: (id: number): Promise<void> => {
    const profiles = getProfiles()
    if (profiles.length <= 1) return Promise.reject(new Error('Нельзя удалить единственный профиль'))
    save(KEY, profiles.filter(p => p.id !== id))
    return Promise.resolve()
  },
}
