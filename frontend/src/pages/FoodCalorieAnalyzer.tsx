import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface FoodItem {
  name: string
  amount: string
  calories: number
}

interface Macros {
  protein: number
  carbs: number
  fat: number
}

interface AnalysisResult {
  dish: string
  totalCalories: number
  confidence: 'low' | 'medium' | 'high'
  items: FoodItem[]
  macros: Macros
  tip: string
}

type AppState = 'idle' | 'loading' | 'result' | 'error'

interface DailyMeal {
  id: string
  dish: string
  calories: number
  time: string
}

interface DailyLog {
  date: string
  meals: DailyMeal[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // strip "data:image/...;base64," prefix
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function getMediaType(file: File): string {
  return file.type || 'image/jpeg'
}

async function analyzeImage(file: File): Promise<AnalysisResult> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY is not set in the environment.')

  const base64 = await fileToBase64(file)
  const mediaType = getMediaType(file)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-calls': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system:
        'You are a nutrition expert. Analyze the food in this image and return ONLY valid JSON (no markdown) in this exact format: { "dish": "name", "totalCalories": 450, "confidence": "medium", "items": [{ "name": "chicken breast", "amount": "150g", "calories": 165 }], "macros": { "protein": 35, "carbs": 40, "fat": 12 }, "tip": "short health tip" }',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            { type: 'text', text: 'Analyze this food image.' },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`API error ${response.status}: ${err}`)
  }

  const data = await response.json()
  const text: string = data.content[0].text
  return JSON.parse(text) as AnalysisResult
}

// ── Daily log helpers ──────────────────────────────────────────────────────────

const DAILY_GOAL = 2000
const STORAGE_KEY = 'foodscan_daily_log'

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function loadDailyLog(): DailyLog {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: DailyLog = JSON.parse(raw)
      if (parsed.date === todayStr()) return parsed
    }
  } catch {}
  return { date: todayStr(), meals: [] }
}

function saveDailyLog(log: DailyLog): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log))
}

// ── Sub-components (all inline in one file) ────────────────────────────────────

function ConfidenceBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  const styles: Record<string, string> = {
    low: 'bg-red-100 text-red-700',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-green-100 text-green-700',
  }
  return (
    <span
      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${styles[level]}`}
    >
      {level} confidence
    </span>
  )
}

function MacroBar({
  label,
  value,
  total,
  color,
}: {
  label: string
  value: number
  total: number
  color: string
}) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-gray-600">{label}</span>
        <span className="text-gray-800 font-semibold">{value}g</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5">
        <div
          className={`${color} h-2.5 rounded-full transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4 w-full max-w-md mx-auto">
      <div className="h-6 bg-green-100 rounded-xl w-2/3 mx-auto" />
      <div className="h-20 bg-green-50 rounded-2xl" />
      <div className="space-y-2">
        <div className="h-4 bg-green-100 rounded w-full" />
        <div className="h-4 bg-green-100 rounded w-5/6" />
        <div className="h-4 bg-green-100 rounded w-4/6" />
      </div>
      <div className="space-y-2 pt-2">
        <div className="h-3 bg-green-100 rounded w-full" />
        <div className="h-3 bg-green-100 rounded w-full" />
        <div className="h-3 bg-green-100 rounded w-full" />
      </div>
      <div className="h-12 bg-green-50 rounded-xl" />
    </div>
  )
}

function ResultCard({
  result,
  imageUrl,
  onReset,
}: {
  result: AnalysisResult
  imageUrl: string
  onReset: () => void
}) {
  const macroTotal = result.macros.protein + result.macros.carbs + result.macros.fat

  return (
    <div className="w-full max-w-md mx-auto space-y-4 pb-8">
      {/* Image preview */}
      <div className="rounded-2xl overflow-hidden shadow-md">
        <img src={imageUrl} alt="Analyzed food" className="w-full object-cover max-h-56" />
      </div>

      {/* Main card */}
      <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{result.dish}</h2>
            <div className="mt-1">
              <ConfidenceBadge level={result.confidence} />
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-4xl font-extrabold text-green-600 leading-none">
              {result.totalCalories}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">kcal</div>
          </div>
        </div>

        <hr className="border-green-50" />

        {/* Ingredients */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Ingredients
          </h3>
          <ul className="space-y-1.5">
            {result.items.map((item, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-gray-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                  <span>{item.name}</span>
                  <span className="text-gray-400 text-xs">({item.amount})</span>
                </div>
                <span className="font-semibold text-gray-800 shrink-0">{item.calories} kcal</span>
              </li>
            ))}
          </ul>
        </div>

        <hr className="border-green-50" />

        {/* Macros */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Macronutrients
          </h3>
          <div className="space-y-3">
            <MacroBar label="Protein" value={result.macros.protein} total={macroTotal} color="bg-green-400" />
            <MacroBar label="Carbs" value={result.macros.carbs} total={macroTotal} color="bg-blue-300" />
            <MacroBar label="Fat" value={result.macros.fat} total={macroTotal} color="bg-yellow-300" />
          </div>
        </div>

        <hr className="border-green-50" />

        {/* Health tip */}
        <div className="bg-green-50 rounded-xl p-3 flex gap-2">
          <span className="text-green-500 text-lg shrink-0">💡</span>
          <p className="text-sm text-green-800">{result.tip}</p>
        </div>
      </div>

      {/* Reset button */}
      <button
        onClick={onReset}
        className="w-full py-3 rounded-2xl bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-semibold text-sm transition-colors shadow-sm"
      >
        Analyze Another
      </button>
    </div>
  )
}

function DailyCounter({ log, onClear }: { log: DailyLog; onClear: () => void }) {
  const total = log.meals.reduce((sum, m) => sum + m.calories, 0)
  const pct = Math.min(100, (total / DAILY_GOAL) * 100)
  const over = total > DAILY_GOAL

  return (
    <div className="w-full max-w-md mx-auto mb-6 bg-white rounded-2xl shadow-sm border border-green-100 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-600">Today's calories</span>
        <button
          onClick={onClear}
          className="text-xs text-gray-500 underline hover:text-red-500 transition-colors"
        >
          Reset day
        </button>
      </div>

      <div className="flex items-end gap-1 mb-2">
        <span className={`text-3xl font-extrabold leading-none ${over ? 'text-red-500' : 'text-green-600'}`}>
          {total}
        </span>
        <span className="text-gray-400 text-sm mb-0.5">/ {DAILY_GOAL} kcal</span>
      </div>

      <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
        <div
          className={`h-2 rounded-full transition-all duration-700 ${over ? 'bg-red-400' : 'bg-green-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {log.meals.length > 0 ? (
        <ul className="space-y-1">
          {log.meals.map((m) => (
            <li key={m.id} className="flex justify-between text-xs text-gray-500">
              <span className="truncate mr-2">{m.dish}</span>
              <span className="shrink-0 font-medium text-gray-700">{m.calories} kcal · {m.time}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-400 text-center">No meals logged yet today</p>
      )}
    </div>
  )
}

function UploadZone({
  onFile,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  onFile: (f: File) => void
  isDragging: boolean
  onDragOver: (e: DragEvent<HTMLDivElement>) => void
  onDragLeave: () => void
  onDrop: (e: DragEvent<HTMLDivElement>) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center gap-3
          border-2 border-dashed rounded-2xl p-10 cursor-pointer
          transition-all duration-200 select-none
          ${isDragging
            ? 'border-green-500 bg-green-50 scale-[1.02]'
            : 'border-green-200 bg-white hover:border-green-400 hover:bg-green-50'
          }
        `}
      >
        <div className="text-5xl">🥗</div>
        <div className="text-center">
          <p className="font-semibold text-gray-700">Drop your food photo here</p>
          <p className="text-sm text-gray-400 mt-1">or click to browse</p>
        </div>
        <p className="text-xs text-gray-300">PNG, JPG, WEBP, HEIC supported</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const f = e.target.files?.[0]
            if (f) onFile(f)
          }}
        />
      </div>

      {/* Camera capture — mobile friendly */}
      <button
        onClick={() => cameraInputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-green-200 bg-white hover:bg-green-50 active:bg-green-100 text-green-700 font-semibold text-sm transition-colors"
      >
        <span className="text-lg">📷</span>
        Take a Photo
      </button>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
        }}
      />
    </div>
  )
}

// ── Main Page Component ────────────────────────────────────────────────────────

export default function FoodCalorieAnalyzer() {
  const [state, setState] = useState<AppState>('idle')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [imageUrl, setImageUrl] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [isDragging, setIsDragging] = useState(false)
  const [dailyLog, setDailyLog] = useState<DailyLog>(() => loadDailyLog())

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please upload an image file.')
      setState('error')
      return
    }

    const url = URL.createObjectURL(file)
    setImageUrl(url)
    setState('loading')
    setErrorMsg('')

    try {
      const data = await analyzeImage(file)
      setResult(data)
      setState('result')
      setDailyLog((prev) => {
        const updated: DailyLog = {
          ...prev,
          meals: [
            ...prev.meals,
            {
              id: Date.now().toString(),
              dish: data.dish,
              calories: data.totalCalories,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ],
        }
        saveDailyLog(updated)
        return updated
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      setErrorMsg(msg)
      setState('error')
    }
  }, [])

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => setIsDragging(false), [])

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handleClearDay = useCallback(() => {
    const fresh: DailyLog = { date: todayStr(), meals: [] }
    saveDailyLog(fresh)
    setDailyLog(fresh)
  }, [])

  const handleReset = useCallback(() => {
    setResult(null)
    setImageUrl('')
    setErrorMsg('')
    setState('idle')
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 py-8 px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight">
          Food Calorie Analyzer
        </h1>
        <p className="text-gray-400 mt-1 text-sm">
          Upload a food photo — get instant nutrition insights
        </p>
      </div>

      {/* Daily counter */}
      <DailyCounter log={dailyLog} onClear={handleClearDay} />

      {/* Content */}
      <div className="w-full max-w-md mx-auto">
        {state === 'idle' && (
          <UploadZone
            onFile={handleFile}
            isDragging={isDragging}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          />
        )}

        {state === 'loading' && (
          <div className="space-y-6">
            {imageUrl && (
              <div className="rounded-2xl overflow-hidden shadow-md">
                <img src={imageUrl} alt="Uploaded food" className="w-full object-cover max-h-56" />
              </div>
            )}
            <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-6">
              <p className="text-center text-sm text-green-600 font-medium mb-4">
                Analyzing your food...
              </p>
              <Skeleton />
            </div>
          </div>
        )}

        {state === 'result' && result && (
          <ResultCard result={result} imageUrl={imageUrl} onReset={handleReset} />
        )}

        {state === 'error' && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
              <div className="text-3xl mb-2">⚠️</div>
              <p className="text-red-700 font-semibold">Analysis Failed</p>
              <p className="text-red-500 text-sm mt-1">{errorMsg}</p>
            </div>
            <button
              onClick={handleReset}
              className="w-full py-3 rounded-2xl bg-green-500 hover:bg-green-600 text-white font-semibold text-sm transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
