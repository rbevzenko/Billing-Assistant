import { loadOne, save } from './storage'
import type { LawyerProfile, LawyerProfileUpdate } from '@/types'

const KEY = 'profile'

export const profileService = {
  get: (): Promise<LawyerProfile | null> =>
    Promise.resolve(loadOne<LawyerProfile>(KEY)),

  upsert: (data: LawyerProfileUpdate): Promise<LawyerProfile> => {
    const existing = loadOne<LawyerProfile>(KEY)
    const profile: LawyerProfile = {
      id: existing?.id ?? 1,
      full_name: data.full_name ?? existing?.full_name ?? '',
      company_name: data.company_name ?? existing?.company_name ?? '',
      inn: data.inn ?? existing?.inn ?? '',
      address: data.address ?? existing?.address ?? '',
      bank_name: data.bank_name ?? existing?.bank_name ?? '',
      bik: data.bik ?? existing?.bik ?? '',
      checking_account: data.checking_account ?? existing?.checking_account ?? '',
      correspondent_account: data.correspondent_account ?? existing?.correspondent_account ?? '',
      email: data.email ?? existing?.email ?? '',
      phone: data.phone ?? existing?.phone ?? '',
      default_hourly_rate: data.default_hourly_rate ?? existing?.default_hourly_rate ?? '',
      logo_path: data.logo_path ?? existing?.logo_path ?? null,
    }
    save(KEY, profile)
    return Promise.resolve(profile)
  },
}
