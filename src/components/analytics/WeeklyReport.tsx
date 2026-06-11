'use client'

import { useState } from 'react'

type Verdict = {
  meta_ad_id: string
  ad_name: string
  verdict: 'working' | 'watch' | 'fatiguing' | 'kill'
  reason: string
  suggested_fix: string
  spend: number | null
  leads: number | null
  impressions: number | null
  clicks: number | null
}

type Report = {
  id: string
  period_start: string
  period_end: string
  status: 'completed' | 'no_data' | 'failed'
  summary: string | null
  verdicts: Verdict[]
  totals: { spend?: number; impressions?: number; clicks?: number; leads?: number; ads_count?: number }
  created_at: string
}

const VERDICT_STYLES: Record<Verdict['verdict'], { label: string; badge: string }> = {
  working: { label: 'Working', badge: 'bg-green-100 text-green-700' },
  watch: { label: 'Watch', badge: 'bg-blue-100 text-blue-700' },
  fatiguing: { label: 'Fatiguing', badge: 'bg-amber-100 text-amber-700' },
  kill: { label: 'Kill', badge: 'bg-red-100 text-red-700' },
}

export default function WeeklyReport({
  initialReport,
  canGenerate,
  clientId,
}: {
  initialReport: Report | null
  canGenerate: boolean
  clientId: string | null
}) {
  const [report, setReport] = useState<Report | null>(initialReport)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientId ? { client_id: clientId } : { all: true }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Generation failed')
      if (json.report) {
        setReport(json.report)
      } else {
        // all-clients generation (admin view): reload so the server refetches the latest report
        window.location.reload()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold text-[#1A2E5A]">AI Weekly Report</h2>
          {report && (
            <p className="text-xs text-gray-500">
              {report.period_start} → {report.period_end}
            </p>
          )}
        </div>
        {canGenerate && (
          <button
            onClick={generate}
            disabled={loading}
            className="text-sm px-3 py-1.5 rounded-lg bg-[#E8660A] text-white disabled:opacity-50"
          >
            {loading ? 'Analyzing…' : 'Generate now'}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      {!report && !error && (
        <p className="text-sm text-gray-500">
          No report yet. Reports are generated automatically every Monday morning once ad data is syncing.
        </p>
      )}

      {report?.status === 'no_data' && (
        <p className="text-sm text-gray-500">No ad activity recorded for this period.</p>
      )}

      {report?.status === 'completed' && (
        <>
          {report.summary && <p className="text-sm text-gray-700 mb-4">{report.summary}</p>}
          <div className="grid gap-3 md:grid-cols-2">
            {report.verdicts.map(v => {
              const style = VERDICT_STYLES[v.verdict] ?? VERDICT_STYLES.watch
              return (
                <div key={v.meta_ad_id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900 truncate pr-2">{v.ad_name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${style.badge}`}>
                      {style.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-1">
                    ₱{(v.spend ?? 0).toLocaleString()} spend · {v.impressions ?? 0} impressions · {v.clicks ?? 0} clicks · {v.leads ?? 0} leads
                  </p>
                  <p className="text-xs text-gray-700">{v.reason}</p>
                  <p className="text-xs text-[#1A2E5A] mt-1 font-medium">→ {v.suggested_fix}</p>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
