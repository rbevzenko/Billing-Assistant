import api from './api'
import type { LawyerProfile, LawyerProfileUpdate } from '@/types'
import { AxiosError } from 'axios'

export const profileService = {
  get: () =>
    api.get<LawyerProfile>('/profile').then(r => r.data).catch((err: AxiosError) => {
      if (err.response?.status === 404) return null
      throw err
    }),

  upsert: (data: LawyerProfileUpdate) =>
    api.put<LawyerProfile>('/profile', data).then(r => r.data),
}
