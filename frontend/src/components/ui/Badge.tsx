import { useLanguage } from '@/i18n/translations'
import type { ProjectStatus, InvoiceStatus, TimeEntryStatus } from '@/types'

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
}

export function Badge({ variant = 'neutral', children }: BadgeProps) {
  return <span className={`badge badge-${variant}`}>{children}</span>
}

const PROJECT_STATUS_MAP: Record<ProjectStatus, { variant: BadgeVariant; ru: string; en: string }> = {
  active:    { variant: 'success',  ru: 'Активный',      en: 'Active' },
  paused:    { variant: 'warning',  ru: 'Приостановлен', en: 'On hold' },
  completed: { variant: 'info',     ru: 'Завершён',      en: 'Completed' },
}

const TIME_STATUS_MAP: Record<TimeEntryStatus, { variant: BadgeVariant; ru: string; en: string }> = {
  draft:     { variant: 'neutral', ru: 'Черновик',    en: 'Draft' },
  confirmed: { variant: 'success', ru: 'Подтверждён', en: 'Confirmed' },
  billed:    { variant: 'purple',  ru: 'Выставлен',   en: 'Billed' },
}

const INVOICE_STATUS_MAP: Record<InvoiceStatus, { variant: BadgeVariant; ru: string; en: string }> = {
  draft:   { variant: 'neutral', ru: 'Черновик',  en: 'Draft' },
  sent:    { variant: 'warning', ru: 'Отправлен', en: 'Sent' },
  paid:    { variant: 'success', ru: 'Оплачен',   en: 'Paid' },
  overdue: { variant: 'danger',  ru: 'Просрочен', en: 'Overdue' },
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const { lang } = useLanguage()
  const { variant, ru, en } = PROJECT_STATUS_MAP[status]
  return <Badge variant={variant}>{lang === 'en' ? en : ru}</Badge>
}

export function TimeStatusBadge({ status }: { status: TimeEntryStatus }) {
  const { lang } = useLanguage()
  const { variant, ru, en } = TIME_STATUS_MAP[status]
  return <Badge variant={variant}>{lang === 'en' ? en : ru}</Badge>
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { lang } = useLanguage()
  const { variant, ru, en } = INVOICE_STATUS_MAP[status]
  return <Badge variant={variant}>{lang === 'en' ? en : ru}</Badge>
}
