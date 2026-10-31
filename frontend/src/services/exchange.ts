import type { Currency } from '@/types'

interface CbrResponse {
  Date: string
  Valute: Record<string, { CharCode: string; Nominal: number; Value: number }>
}

// In-memory cache: {date → {EUR: 95.1, USD: 88.3}}
const cache: Record<string, Record<string, number>> = {}

async function fetchCbr(today: string): Promise<Record<string, number>> {
  const res = await fetch('https://www.cbr-xml-daily.ru/daily_json.js', { signal: AbortSignal.timeout(4000) })
  if (!res.ok) throw new Error('CBR API error')
  const data: CbrResponse = await res.json()
  const rates: Record<string, number> = {}
  for (const v of Object.values(data.Valute)) {
    rates[v.CharCode] = v.Value / v.Nominal
  }
  cache[today] = rates
  return rates
}

async function fetchFrankfurter(today: string): Promise<Record<string, number>> {
  const res = await fetch('https://api.frankfurter.app/latest?from=RUB', { signal: AbortSignal.timeout(6000) })
  if (!res.ok) throw new Error('Frankfurter API error')
  const data: { rates: Record<string, number> } = await res.json()
  // data.rates gives X units of foreign currency per 1 RUB
  // We need RUB per 1 foreign unit → invert
  const rates: Record<string, number> = {}
  for (const [code, perRub] of Object.entries(data.rates)) {
    rates[code] = 1 / perRub
  }
  cache[today] = rates
  return rates
}

/** Returns rate: how many RUB per 1 unit of `currency`.
 *  Returns 1 for RUB. */
export async function getRateToRub(currency: Currency): Promise<number> {
  if (currency === 'RUB') return 1

  const today = new Date().toISOString().slice(0, 10)
  if (cache[today]?.[currency] !== undefined) {
    return cache[today][currency]
  }

  let rates: Record<string, number> | null = null

  try {
    rates = await fetchCbr(today)
  } catch {
    // CBR unavailable (e.g. geo-blocked outside Russia) — try fallback
    try {
      rates = await fetchFrankfurter(today)
    } catch {
      // Both failed — use yesterday's cached value if available
      for (const day of Object.keys(cache).sort().reverse()) {
        if (cache[day][currency] !== undefined) return cache[day][currency]
      }
      throw new Error(`Не удалось получить курс ${currency}`)
    }
  }

  return rates[currency] ?? (() => { throw new Error(`Курс ${currency} не найден`) })()
}

/** Returns rate: how many `to` per 1 `from` (e.g. getRate('EUR','RUB') ≈ 100). */
export async function getRate(from: Currency, to: Currency): Promise<number> {
  if (from === to) return 1
  const fromRub = await getRateToRub(from)
  const toRub = await getRateToRub(to)
  return fromRub / toRub
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
