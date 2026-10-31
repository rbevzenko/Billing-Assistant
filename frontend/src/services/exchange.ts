import type { Currency } from '@/types'

interface CbrResponse {
  Date: string
  Valute: Record<string, { CharCode: string; Nominal: number; Value: number }>
}

// In-memory cache: {date → {EUR: 95.1, USD: 88.3}}
const cache: Record<string, Record<string, number>> = {}

// CDN-hosted currency API — CORS-open, updated daily, no API key needed
async function fetchJsdelivr(today: string): Promise<Record<string, number>> {
  const res = await fetch(
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/rub.json',
    { signal: AbortSignal.timeout(8000) },
  )
  if (!res.ok) throw new Error('jsdelivr currency-api error')
  const data: { rub: Record<string, number> } = await res.json()
  // data.rub[code] = X units of `code` per 1 RUB → invert to get RUB per 1 unit
  const rates: Record<string, number> = {}
  for (const [code, perRub] of Object.entries(data.rub)) {
    if (perRub > 0) rates[code.toUpperCase()] = 1 / perRub
  }
  cache[today] = rates
  return rates
}

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

/** Returns rate: how many RUB per 1 unit of `currency`.
 *  Returns 1 for RUB. */
export async function getRateToRub(currency: Currency): Promise<number> {
  if (currency === 'RUB') return 1

  const today = new Date().toISOString().slice(0, 10)
  if (cache[today]?.[currency] !== undefined) {
    return cache[today][currency]
  }

  let rates: Record<string, number> | null = null

  // Try CDN first (CORS-friendly everywhere), then CBR as fallback
  try {
    rates = await fetchJsdelivr(today)
  } catch {
    try {
      rates = await fetchCbr(today)
    } catch {
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
