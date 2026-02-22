import { createContext, useContext, useEffect, useState } from 'react'

interface StoredTimer {
  startTime: number
  projectId: number
}

interface TimerContextValue {
  isRunning: boolean
  projectId: number | null
  elapsed: number // seconds
  startTimer: (projectId: number) => void
  stopTimer: () => number // returns hours rounded to 0.1
}

const TimerContext = createContext<TimerContextValue>({
  isRunning: false,
  projectId: null,
  elapsed: 0,
  startTimer: () => {},
  stopTimer: () => 0,
})

const STORAGE_KEY = 'billing_timer'

function readStorage(): StoredTimer | null {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    return s ? (JSON.parse(s) as StoredTimer) : null
  } catch {
    return null
  }
}

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [stored, setStored] = useState<StoredTimer | null>(readStorage)
  const [elapsed, setElapsed] = useState<number>(() => {
    const s = readStorage()
    return s ? Math.floor((Date.now() - s.startTime) / 1000) : 0
  })

  useEffect(() => {
    if (!stored) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - stored.startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [stored])

  const startTimer = (projectId: number) => {
    const entry: StoredTimer = { startTime: Date.now(), projectId }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry))
    setStored(entry)
    setElapsed(0)
  }

  const stopTimer = (): number => {
    const seconds = stored
      ? Math.floor((Date.now() - stored.startTime) / 1000)
      : elapsed
    const hours = Math.max(0.1, Math.round((seconds / 3600) * 10) / 10)
    localStorage.removeItem(STORAGE_KEY)
    setStored(null)
    setElapsed(0)
    return hours
  }

  return (
    <TimerContext.Provider
      value={{
        isRunning: !!stored,
        projectId: stored?.projectId ?? null,
        elapsed,
        startTimer,
        stopTimer,
      }}
    >
      {children}
    </TimerContext.Provider>
  )
}

export function useTimer() {
  return useContext(TimerContext)
}
