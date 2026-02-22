import type { ProjectStatus, InvoiceStatus, TimeEntryStatus } from '@/types'

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
}

export function Badge({ variant = 'neutral', children }: BadgeProps) {
  return <span className={`badge badge-${variant}`}>{children}</span>
}

const PROJECT_STATUS_MAP: Record<ProjectStatus, { variant: BadgeVariant; label: string }> = {
  active: { variant: 'success', label: 'Активный' },
  paused: { variant: 'warning', label: 'Приостановлен' },
  completed: { variant: 'info', label: 'Завершён' },
}

const TIME_STATUS_MAP: Record<TimeEntryStatus, { variant: BadgeVariant; label: string }> = {
  draft: { variant: 'neutral', label: 'Черновик' },
  confirmed: { variant: 'success', label: 'Подтверждён' },
  billed: { variant: 'purple', label: 'Выставлен' },
}

const INVOICE_STATUS_MAP: Record<InvoiceStatus, { variant: BadgeVariant; label: string }> = {
  draft: { variant: 'neutral', label: 'Черновик' },
  sent: { variant: 'warning', label: 'Отправлен' },
  paid: { variant: 'success', label: 'Оплачен' },
  overdue: { variant: 'danger', label: 'Просрочен' },
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const { variant, label } = PROJECT_STATUS_MAP[status]
  return <Badge variant={variant}>{label}</Badge>
}

export function TimeStatusBadge({ status }: { status: TimeEntryStatus }) {
  const { variant, label } = TIME_STATUS_MAP[status]
  return <Badge variant={variant}>{label}</Badge>
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { variant, label } = INVOICE_STATUS_MAP[status]
  return <Badge variant={variant}>{label}</Badge>
}
