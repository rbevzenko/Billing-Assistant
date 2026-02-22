import type { Page } from '@/types'

const PREFIX = 'billing_'

export function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function loadOne<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function save<T>(key: string, value: T): void {
  localStorage.setItem(PREFIX + key, JSON.stringify(value))
}

export function nextId(items: { id: number }[]): number {
  return items.length === 0 ? 1 : Math.max(...items.map(i => i.id)) + 1
}

export function nowISO(): string {
  return new Date().toISOString()
}

export function paginate<T>(items: T[], page = 1, size = 20): Page<T> {
  const total = items.length
  const pages = Math.max(1, Math.ceil(total / size))
  const start = (page - 1) * size
  return { items: items.slice(start, start + size), total, page, size, pages }
}
