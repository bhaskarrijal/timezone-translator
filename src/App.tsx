"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"

function App() {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const handler = () => {
      inputRef.current?.focus()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [output, setOutput] = useState<string>("")
  const [displayedOutput, setDisplayedOutput] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setOutput("")

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: input }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to translate')
      }

      const data = await response.json()
      setOutput(data.translation)
    } catch (err: any) {
      setError(err.message || "An error occurred.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (output) {
      setDisplayedOutput("")
      let idx = 0
      const speed = 10 // per char ko speed
      const interval = setInterval(() => {
        setDisplayedOutput(output.slice(0, idx + 1))
        idx++
        if (idx >= output.length) clearInterval(interval)
      }, speed)
      return () => clearInterval(interval)
    }
  }, [output])

  return (
    <>
      <style>
        {`
          .app-container {
            line-height: 1.5;
            font-family: serif;
            font-size: 16px;
            margin: 50px auto;
            max-width: 590px;
            padding: 0 16px;
          }
          @media (min-width: 768px) {
            .app-container {
              padding: 0;
            }
          }
        `}
      </style>
      <div className="app-container">
        <main style={{ marginTop: '70px' }}>
          <header>
            <h1 style={{ 
              fontSize: '25px', 
              marginBottom: '0',
              fontWeight: 'bold'
            }}>
              Timezone Translator
            </h1>
            <p style={{ marginTop: '0' }}>
              Quickly convert times across any timezones with NLP-powered accuracy.
            </p>
          </header>

          <section>
            <form onSubmit={handleSubmit} style={{ marginTop: '30px' }}>
              <div style={{ marginBottom: '20px' }}>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="e.g. 3PM EST to Nepal time"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 0',
                    fontSize: '16px',
                    border: 'none',
                    borderBottom: '1px solid #000',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  fontSize: '16px',
                  backgroundColor: '#000',
                  color: '#fff',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  fontFamily: 'inherit'
                }}
              >
                {loading ? 'Translating...' : 'Translate'}
              </button>
            </form>
          </section>

          {displayedOutput && (
            <section style={{ marginTop: '40px' }}>
              <p style={{ 
                whiteSpace: 'pre-wrap',
                // fontFamily: 'monospace',
                fontSize: '14px',
                // lineHeight: '1.5',
                margin: '0',
                padding: '5px',
                backgroundColor: '#0000ff',
                color: '#fff',
              }}>
                {displayedOutput}
              </p>
            </section>
          )}

          {error && (
            <section style={{ marginTop: '20px' }}>
              <p style={{ 
                color: '#d32f2f',
                margin: '0'
              }}>
                {error}
              </p>
            </section>
          )}

          <footer style={{ marginTop: '40px' }}>
                <hr style={{ borderTop: '1px solid #ebebeb' }}/>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '-10px' }}>
                    <p style={{ fontSize: '12px' }}>
                        Built by <a href="https://bhaskarrijal.me" target="_blank" rel="noopener">Bhaskar Rijal</a> / 07.31.2025
                    </p>
                    <p style={{ fontSize: '12px', display: 'flex', gap: '5px', alignItems: 'center' }}>
                        <span>open for collaborations</span> 
                        <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="15px" width="15px" xmlns="http://www.w3.org/2000/svg"><path d="M12 4m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"></path><path d="M4 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"></path><path d="M20 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"></path><path d="M12 20m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"></path><path d="M5.5 5.5l3 3"></path><path d="M15.5 15.5l3 3"></path><path d="M18.5 5.5l-3 3"></path><path d="M8.5 15.5l-3 3"></path></svg>
                    </p>
                </div>
            </footer>
        </main>
      </div>
    </>
  )
}

export default App
