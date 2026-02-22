import type { Currency } from '@/types'

interface CbrResponse {
  Date: string
  Valute: Record<string, { CharCode: string; Nominal: number; Value: number }>
}

// In-memory cache: {date → {EUR: 95.1, USD: 88.3}}
const cache: Record<string, Record<string, number>> = {}

/** Returns rate: how many RUB per 1 unit of `currency`.
 *  Returns 1 for RUB. */
export async function getRateToRub(currency: Currency): Promise<number> {
  if (currency === 'RUB') return 1

  const today = new Date().toISOString().slice(0, 10)
  if (cache[today]?.[currency] !== undefined) {
    return cache[today][currency]
  }

  try {
    const res = await fetch('https://www.cbr-xml-daily.ru/daily_json.js')
    if (!res.ok) throw new Error('CBR API error')
    const data: CbrResponse = await res.json()
    cache[today] = {}
    for (const v of Object.values(data.Valute)) {
      cache[today][v.CharCode] = v.Value / v.Nominal
    }
    return cache[today][currency] ?? null
  } catch {
    // Fallback: try to use yesterday's cache
    for (const day of Object.keys(cache).reverse()) {
      if (cache[day][currency]) return cache[day][currency]
    }
    throw new Error(`Не удалось получить курс ${currency}`)
  }
}

/** Returns rate: how many units of `from` per 1 unit of `to`. */
export async function getRate(from: Currency, to: Currency): Promise<number> {
  if (from === to) return 1
  const fromRub = await getRateToRub(from)
  const toRub = await getRateToRub(to)
  return toRub / fromRub
}

export function formatCurrency(amount: number, currency: Currency, lang: 'ru' | 'en' = 'ru'): string {
  return amount.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  RUB: '₽',
  USD: '$',
  EUR: '€',
}
