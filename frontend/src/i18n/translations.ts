import { createContext, useContext } from 'react'

export type AppLanguage = 'ru' | 'en'

const ru = {
  nav: {
    dashboard: 'Дашборд',
    timeEntries: 'Учёт времени',
    clients: 'Клиенты',
    projects: 'Проекты',
    invoices: 'Счета',
    reports: 'Отчёты',
    profile: 'Профиль',
  },
  header: {
    '/': 'Дашборд',
    '/time-entries': 'Учёт времени',
    '/clients': 'Клиенты',
    '/projects': 'Проекты',
    '/invoices': 'Счета',
    '/reports': 'Отчёты',
    '/profile': 'Профиль',
    '/invoices/:id': 'Счёт',
  },
  status: {
    draft: 'Черновик',
    confirmed: 'Подтверждён',
    billed: 'Выставлен',
    sent: 'Отправлен',
    paid: 'Оплачен',
    overdue: 'Просрочен',
    active: 'Активный',
    paused: 'Приостановлен',
    completed: 'Завершён',
  },
  vat: {
    none: 'Без НДС',
    exempt: 'НДС не облагается',
    vat0: 'НДС 0%',
    vat10: 'НДС 10%',
    vat20: 'НДС 20%',
  },
  invoice: {
    invoice: 'Счёт',
    issuer: 'Исполнитель',
    client: 'Заказчик',
    issueDate: 'Дата выставления',
    dueDate: 'Срок оплаты',
    date: 'Дата',
    project: 'Проект',
    description: 'Описание',
    hours: 'Часы',
    rate: 'Ставка',
    amount: 'Сумма',
    subtotal: 'Итого без НДС',
    vatAmount: 'НДС',
    total: 'ИТОГО К ОПЛАТЕ',
    notes: 'Примечания',
    paymentTotal: 'К оплате в',
    atRate: 'курс',
    inn: 'ИНН',
    bik: 'БИК',
    account: 'Р/с',
    corrAccount: 'К/с',
    iban: 'IBAN',
    swift: 'SWIFT/BIC',
    country: 'Страна',
    vatNumber: 'VAT №',
    notFilled: 'Профиль не заполнен',
  },
}

const en: typeof ru = {
  nav: {
    dashboard: 'Dashboard',
    timeEntries: 'Time Tracking',
    clients: 'Clients',
    projects: 'Projects',
    invoices: 'Invoices',
    reports: 'Reports',
    profile: 'Profile',
  },
  header: {
    '/': 'Dashboard',
    '/time-entries': 'Time Tracking',
    '/clients': 'Clients',
    '/projects': 'Projects',
    '/invoices': 'Invoices',
    '/reports': 'Reports',
    '/profile': 'Profile',
    '/invoices/:id': 'Invoice',
  },
  status: {
    draft: 'Draft',
    confirmed: 'Confirmed',
    billed: 'Billed',
    sent: 'Sent',
    paid: 'Paid',
    overdue: 'Overdue',
    active: 'Active',
    paused: 'On hold',
    completed: 'Completed',
  },
  vat: {
    none: 'No VAT',
    exempt: 'VAT exempt',
    vat0: 'VAT 0%',
    vat10: 'VAT 10%',
    vat20: 'VAT 20%',
  },
  invoice: {
    invoice: 'Invoice',
    issuer: 'From',
    client: 'Bill To',
    issueDate: 'Issue Date',
    dueDate: 'Due Date',
    date: 'Date',
    project: 'Project',
    description: 'Description',
    hours: 'Hours',
    rate: 'Rate',
    amount: 'Amount',
    subtotal: 'Subtotal',
    vatAmount: 'VAT',
    total: 'TOTAL DUE',
    notes: 'Notes',
    paymentTotal: 'Payment amount in',
    atRate: 'rate',
    inn: 'TIN',
    bik: 'BIC',
    account: 'Account',
    corrAccount: 'Corr. Account',
    iban: 'IBAN',
    swift: 'SWIFT/BIC',
    country: 'Country',
    vatNumber: 'VAT No.',
    notFilled: 'Profile not filled',
  },
}

export const TRANSLATIONS = { ru, en } as const
export type Translations = typeof ru

// ── Context ────────────────────────────────────────────────────────────────────

export interface LanguageContextValue {
  lang: AppLanguage
  setLang: (l: AppLanguage) => void
  t: Translations
}

export const LanguageContext = createContext<LanguageContextValue>({
  lang: 'ru',
  setLang: () => {},
  t: ru,
})

export function useLanguage() {
  return useContext(LanguageContext)
}

// Re-export LanguageProvider from the .tsx file
export { LanguageProvider } from './LanguageContext'
