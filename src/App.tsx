import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { MoonSat, SunLight } from 'iconoir-react'
import { PigeonFlight } from './PigeonFlight'

type Option = { value: string; label: string }
type DisplayTime = { start: string; end: string | null }
type ZoneTime = { zone: string; start: string; end: string | null }
type Result =
  | { status: 'ok'; mode: 'conversion'; source: ZoneTime; target: ZoneTime; timeFormat: '12h' | '24h'; display: { source: DisplayTime; target: DisplayTime }; assumptions: { code: string; message: string }[] }
  | { status: 'ok'; mode: 'current'; place: string; source: ZoneTime; target: null; timeFormat: '12h' | '24h'; display: { source: DisplayTime; target: null }; assumptions: { code: string; message: string }[] }
  | { status: 'needs_clarification'; field: string; question: string; inputKind: 'choice' | 'text'; options: Option[] }
  | { status: 'invalid'; code: string; message: string }

const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '')
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function formatDate(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  return `${day} ${monthNames[month - 1]}, ${year}`
}

function placeName(zone: string) {
  return zone.split('/').at(-1)?.replaceAll('_', ' ') ?? zone
}

function offsetLabel(iso: string) {
  return iso.match(/([+-]\d{2}:\d{2})$/)?.[1] ?? '+00:00'
}

function DateTimeFields({ place, zone, start, end, display }: { place?: string; zone: string; start: string; end: string | null; display: DisplayTime }) {
  const rows = [{ label: end ? 'Start' : null, value: start, time: display.start }, ...(end ? [{ label: 'End', value: end, time: display.end }] : [])]
  return <div className="result-side">
    <p className="place">{place ?? placeName(zone)}</p>
    <p className="zone">{zone}</p>
    {rows.map(row => <div className="time-row" key={row.label}>
      {row.label && <span className="row-label">{row.label}</span>}
      <div><strong>{row.time}</strong><span className="offset">UTC{offsetLabel(row.value)}</span></div>
      <div className="date">{formatDate(row.value)}</div>
    </div>)}
  </div>
}

function App() {
  const [prompt, setPrompt] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<Result | null>(null)
  const [textAnswer, setTextAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [networkError, setNetworkError] = useState('')
  const request = useRef<AbortController | null>(null)
  const [isDark, setIsDark] = useState(() => document.documentElement.dataset.theme === 'dark')

  function toggleTheme() {
    const nextDark = !isDark
    setIsDark(nextDark)
    if (nextDark) document.documentElement.dataset.theme = 'dark'
    else delete document.documentElement.dataset.theme
    try {
      if (nextDark) window.localStorage.setItem('timezone-theme', 'dark')
      else window.localStorage.removeItem('timezone-theme')
    } catch { /* Theme still changes when storage is unavailable. */ }
  }

  async function translate(nextAnswers: Record<string, string>) {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setNetworkError('')
    setResult(null)
    try {
      const response = await fetch(`${apiUrl}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          deviceTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          answers: nextAnswers,
        }),
        signal: controller.signal,
      })
      const data: Result = await response.json()
      if (!['ok', 'needs_clarification', 'invalid'].includes(data.status)) throw new Error('Unexpected response from server.')
      setResult(data)
      if (data.status === 'needs_clarification') setTextAnswer('')
    } catch (error) {
      if (controller.signal.aborted) return
      setNetworkError(error instanceof Error ? error.message : 'Could not reach the server.')
    } finally {
      if (request.current === controller) setLoading(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    setAnswers({})
    void translate({})
  }

  function answer(field: string, value: string) {
    const next = { ...answers, [field]: value }
    setAnswers(next)
    void translate(next)
  }

  return <>
    <header className="site-hero">
      <div className="site-hero-inner">
        <h1>Timezone Translator</h1>
        <p>Turn a time request into a clear conversion across cities and timezones.</p>
      </div>
    </header>
    <main className="app">
    <form onSubmit={submit} className="prompt-form">
      <label htmlFor="prompt">Your time request</label>
      <input id="prompt" type="text" value={prompt} maxLength={500} required
        placeholder="5pm Nepal time to London time"
        onChange={event => {
          request.current?.abort()
          setPrompt(event.target.value)
          setAnswers({})
          setResult(null)
          setNetworkError('')
          setLoading(false)
        }} />
      <p className="hint">Also try “UK time”, “5pm SF to London”, or “nepal ma 5 bajda london ma kati bajcha”.</p>
      <div className="translate-row">
      <button className="translate-button" type="submit" disabled={loading} aria-busy={loading}>
        <span className={loading ? 'translate-button-label hidden' : 'translate-button-label'} aria-hidden={loading}>Translate</span>
        {loading && <span className="loading-indicator" role="status" aria-label="loading">
          <svg className="loading-spinner" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <g stroke="currentColor" strokeLinecap="round" strokeWidth="2">
              <path d="M12 2.75V5.25" opacity="0.15" />
              <path d="M16.95 4.08L15.7 6.25" opacity="0.22" />
              <path d="M19.92 7.05L17.75 8.3" opacity="0.32" />
              <path d="M21.25 12H18.75" opacity="0.42" />
              <path d="M19.92 16.95L17.75 15.7" opacity="0.54" />
              <path d="M16.95 19.92L15.7 17.75" opacity="0.66" />
              <path d="M12 21.25V18.75" opacity="0.78" />
              <path d="M7.05 19.92L8.3 17.75" opacity="0.9" />
              <path d="M4.08 16.95L6.25 15.7" opacity="1" />
              <path d="M2.75 12H5.25" opacity="0.86" />
              <path d="M4.08 7.05L6.25 8.3" opacity="0.7" />
              <path d="M7.05 4.08L8.3 6.25" opacity="0.5" />
            </g>
          </svg>
          <span className="sr-only">Loading...</span>
        </span>}
      </button>
      <PigeonFlight />
      </div>
    </form>

    {result?.status === 'needs_clarification' && <section className="response" aria-live="polite">
      <h2>One more detail</h2>
      <p>{result.question}</p>
      {result.inputKind === 'choice' ? <div className="options">
        {result.options.map(option => <button type="button" className="option" key={option.value}
          disabled={loading} onClick={() => answer(result.field, option.value)}>{option.label}</button>)}
      </div> : <form className="answer-form" onSubmit={event => { event.preventDefault(); if (textAnswer.trim()) answer(result.field, textAnswer.trim()) }}>
        <input aria-label={result.question} value={textAnswer} onChange={event => setTextAnswer(event.target.value)} required />
        <button type="submit" disabled={loading}>Continue</button>
      </form>}
    </section>}

    {result?.status === 'ok' && <section className="response conversion" aria-live="polite">
      <h2>{result.mode === 'current' ? 'Current time' : 'Conversion'}</h2>
      <div className={`result-grid${result.mode === 'current' ? ' single' : ''}`}>
        <DateTimeFields place={result.mode === 'current' ? result.place : undefined} {...result.source} display={result.display.source} />
        {result.mode === 'conversion' && <DateTimeFields {...result.target} display={result.display.target} />}
      </div>
      {result.assumptions.length > 0 && <div className="assumptions">
        {result.assumptions.map(item => <p key={item.code}>{item.message}</p>)}
      </div>}
    </section>}

    {result?.status === 'invalid' && <p className="error" role="alert">{result.message}</p>}
    {networkError && <p className="error" role="alert">{networkError}</p>}

    <p className="disclaimer">This app doesn't save your prompt, browser timezone, or clarification answers. They're sent to the server for the calculation, with no account, saved history, or session kept for them. It first cleans up common English and romanized Nepali wording, then reads the time, date, and any range you gave. Place names and shortcuts like SF are matched to IANA timezones. Each time is converted using the offset that applies on its actual date, so daylight saving changes are included rather than treating the difference between two places as fixed all year. If you leave out the date, it uses today in the source timezone. If you leave out the source, it uses the timezone your browser reports and marks that as an assumption. “My time” and “local time” also use your browser timezone. A range that ends earlier than it starts is treated as ending the next day. If a city name, numeric date, AM/PM choice, or repeated daylight saving hour could mean more than one thing, it asks before converting. A local time that never occurs during a clock change is flagged as well. No AI model is involved; the result is calculated with code.</p>

    <footer>
      <span>Built by <a href="https://bhaskarrijal.me" target="_blank" rel="noopener noreferrer">Bhaskar Rijal</a></span>
      <button className="theme-toggle" type="button" onClick={toggleTheme}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
        {isDark ? <SunLight width={16} height={16} strokeWidth={1.7} /> : <MoonSat width={16} height={16} strokeWidth={1.7} />}
      </button>
    </footer>
    </main>
  </>
}

export default App
