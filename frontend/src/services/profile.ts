import { supabase } from '@/lib/supabase'
import type { LawyerProfile, LawyerProfileUpdate } from '@/types'

const TABLE = 'lawyer_profiles'
const ACTIVE_KEY = 'billing_active_profile_id'

export const profileService = {
  list: async (): Promise<LawyerProfile[]> => {
    const { data, error } = await supabase.from(TABLE).select('*').order('id')
    if (error) throw error
    return (data ?? []) as LawyerProfile[]
  },

  getActive: async (): Promise<LawyerProfile | null> => {
    const { data: profiles, error } = await supabase.from(TABLE).select('*').order('id')
    if (error || !profiles || profiles.length === 0) return null
    const activeId = localStorage.getItem(ACTIVE_KEY)
    const active = activeId ? profiles.find(p => p.id === Number(activeId)) : null
    return (active ?? profiles[0]) as LawyerProfile
  },

  // Legacy compat used by InvoiceDetailPage
  get: (): Promise<LawyerProfile | null> => profileService.getActive(),

  getById: async (id: number): Promise<LawyerProfile | null> => {
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single()
    if (error) return null
    return data as LawyerProfile
  },

  setActive: (id: number): void => {
    localStorage.setItem(ACTIVE_KEY, String(id))
  },

  upsert: async (data: LawyerProfileUpdate, id?: number): Promise<LawyerProfile> => {
    if (id !== undefined) {
      const { data: updated, error } = await supabase.from(TABLE).update(data).eq('id', id).select().single()
      if (error) throw new Error('Профиль не найден')
      return updated as LawyerProfile
    }
    const profile = {
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
    const { data: created, error } = await supabase.from(TABLE).insert(profile).select().single()
    if (error) throw error
    return created as LawyerProfile
  },

  delete: async (id: number): Promise<void> => {
    const { data: profiles } = await supabase.from(TABLE).select('id')
    if ((profiles ?? []).length <= 1) throw new Error('Нельзя удалить единственный профиль')
    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    if (error) throw error
  },
}
