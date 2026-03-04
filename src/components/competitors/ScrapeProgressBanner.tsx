'use client'

import { useEffect, useState, useRef } from 'react'
import type { ScrapeProgressEvent } from '@/types/scrape'

interface ScrapeProgressBannerProps {
  competitorId: string
  jobId?: string
  onComplete?: () => void
}

export default function ScrapeProgressBanner({
  competitorId,
  jobId,
  onComplete,
}: ScrapeProgressBannerProps) {
  const [messages, setMessages] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const [workerWarning, setWorkerWarning] = useState(false)
  const doneRef = useRef(false)
  const startedAtRef = useRef<number>(Date.now())

  // SSE — real-time events from Redis pub/sub
  useEffect(() => {
    if (!jobId) return

    startedAtRef.current = Date.now()
    const url = `/api/competitors/${competitorId}/progress?jobId=${jobId}`
    const es = new EventSource(url)

    es.onmessage = (e) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = JSON.parse(e.data) as any
        if (raw.type === 'connected') return
        const event = raw as ScrapeProgressEvent
        if (event.message) {
          setMessages((prev) => [...prev.slice(-20), event.message])
        }
        if (event.type === 'status') {
          if (event.status === 'COMPLETE' || event.status === 'PARTIAL' || event.status === 'FAILED') {
            doneRef.current = true
            setDone(true)
            es.close()
            onComplete?.()
          }
        }
      } catch {}
    }

    es.onerror = () => {
      es.close()
    }

    return () => es.close()
  }, [jobId, competitorId, onComplete])

  // Polling fallback — checks DB status every 5s
  // Covers: worker not running, race condition, SSE connection failure
  useEffect(() => {
    if (!jobId) return

    const interval = setInterval(async () => {
      if (doneRef.current) {
        clearInterval(interval)
        return
      }

      try {
        const res = await fetch(`/api/competitors/${competitorId}/scrape?jobId=${jobId}`)
        if (!res.ok) return
        const job = await res.json()
        const elapsed = Date.now() - startedAtRef.current

        // Show worker warning if still PENDING after 30s
        setWorkerWarning(job.status === 'PENDING' && elapsed > 30000)

        // Handle terminal states (fallback when SSE misses the final event)
        if (job.status === 'COMPLETE' || job.status === 'PARTIAL' || job.status === 'FAILED') {
          if (!doneRef.current) {
            doneRef.current = true
            setDone(true)
            clearInterval(interval)
            onComplete?.()
          }
        }

        // If RUNNING but no SSE messages received, show a generic progress line
        if (job.status === 'RUNNING') {
          setMessages((prev) => prev.length > 0 ? prev : ['Procesando...'])
        }
      } catch {}
    }, 5000)

    return () => clearInterval(interval)
  }, [jobId, competitorId, onComplete])

  if (!jobId || done) return null

  return (
    <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 mb-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
        <p className="text-sm font-semibold text-violet-800">Scraping en progreso...</p>
      </div>
      <div className="bg-white rounded-xl border border-violet-100 p-3 max-h-32 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-xs text-slate-400">Iniciando...</p>
        ) : (
          messages.map((msg, i) => (
            <p key={i} className="text-xs text-slate-600 leading-relaxed">{msg}</p>
          ))
        )}
      </div>

      {workerWarning && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-amber-800 mb-1">El worker no parece estar activo</p>
          <p className="text-xs text-amber-700 mb-1.5">
            Abre una segunda terminal en la carpeta del proyecto y ejecuta:
          </p>
          <code className="block text-xs bg-amber-100 text-amber-900 rounded-lg px-3 py-1.5 font-mono">
            npm run worker
          </code>
        </div>
      )}
    </div>
  )
}
