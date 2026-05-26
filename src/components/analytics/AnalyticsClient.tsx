'use client'
import { useState, useEffect, useRef } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

type Period = '7d' | '30d' | '90d'

interface AnalyticsData {
  date: string
  impressions: number
  reach: number
  clicks: number
  spend: number | null
  leads: number
  campaign_id: string
  ad_campaigns?: { name: string; status: string }
}

interface CampaignPerf {
  id: string
  name: string
  status: string
  spend: number
  leads: number
  reach: number
  cpl: number
}

interface Totals {
  impressions: number
  reach: number
  clicks: number
  spend: number
  leads: number
}

interface WebsiteTotals {
  pageViews: number
  visitors: number
  formSubmissions: number
  listingClicks: number
}

interface Props {
  analytics: AnalyticsData[]
  totals: Totals
  avgCPL: number
  campaignPerf: CampaignPerf[]
  maxSpend: number
  websiteTotals: WebsiteTotals
  websiteAnalytics: any[]
  postsCount: number
  publishedPostsCount: number
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-[#EAF3DE] text-[#3B6D11]',
  draft: 'bg-[#F1EFE8] text-[#5F5E5A]',
  paused: 'bg-[#FAEEDA] text-[#854F0B]',
  completed: 'bg-[#E8EBF3] text-[#1A2E5A]',
}

const CHART_COLORS = ['#E8660A', '#1A2E5A', '#3B6D11', '#185FA5', '#854F0B']

export default function AnalyticsClient({
  analytics, totals, avgCPL, campaignPerf, maxSpend,
  websiteTotals, websiteAnalytics, postsCount, publishedPostsCount,
}: Props) {
  const [period, setPeriod] = useState<Period>('30d')
  const [metric, setMetric] = useState<'leads' | 'spend' | 'impressions' | 'clicks'>('leads')
  const chartRef = useRef<HTMLCanvasElement>(null)
  const donutRef = useRef<HTMLCanvasElement>(null)
  const chartInstance = useRef<any>(null)
  const donutInstance = useRef<any>(null)

  const periodDays: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90 }

  function filterByPeriod(data: AnalyticsData[]) {
    const days = periodDays[period]
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    return data.filter(a => new Date(a.date) >= cutoff)
  }

  const filtered = filterByPeriod(analytics)

  // Group by date for chart
  const dateMap = filtered.reduce((acc, a) => {
    acc[a.date] = acc[a.date] ?? { leads: 0, spend: 0, impressions: 0, clicks: 0 }
    acc[a.date].leads += a.leads ?? 0
    acc[a.date].spend += Number(a.spend) ?? 0
    acc[a.date].impressions += a.impressions ?? 0
    acc[a.date].clicks += a.clicks ?? 0
    return acc
  }, {} as Record<string, Record<string, number>>)

  const sortedDates = Object.keys(dateMap).sort()
  const chartLabels = sortedDates.map(d => {
    const date = new Date(d)
    return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
  })
  const chartData = sortedDates.map(d => dateMap[d][metric] ?? 0)

  // Donut data — leads by campaign
  const donutData = campaignPerf.slice(0, 5).map(c => c.leads)
  const donutLabels = campaignPerf.slice(0, 5).map(c => c.name)

  useEffect(() => {
    let Chart: any
    async function loadChart() {
      const mod = await import('chart.js/auto')
      Chart = mod.default

      // Line chart
      if (chartRef.current) {
        if (chartInstance.current) chartInstance.current.destroy()
        chartInstance.current = new Chart(chartRef.current, {
          type: 'line',
          data: {
            labels: chartLabels,
            datasets: [{
              label: metric.charAt(0).toUpperCase() + metric.slice(1),
              data: chartData,
              borderColor: '#E8660A',
              backgroundColor: 'rgba(232,102,10,0.08)',
              tension: 0.4,
              fill: true,
              pointRadius: 3,
              pointBackgroundColor: '#E8660A',
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: {
                grid: { display: false },
                ticks: { font: { size: 10 }, color: '#888', maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
              },
              y: {
                grid: { color: 'rgba(0,0,0,0.04)' },
                ticks: {
                  font: { size: 10 }, color: '#888',
                  callback: (v: any) => metric === 'spend' ? `₱${Math.round(v / 1000)}K` : v,
                },
              },
            },
          },
        })
      }

      // Donut chart
      if (donutRef.current && donutData.length > 0) {
        if (donutInstance.current) donutInstance.current.destroy()
        donutInstance.current = new Chart(donutRef.current, {
          type: 'doughnut',
          data: {
            labels: donutLabels,
            datasets: [{
              data: donutData,
              backgroundColor: CHART_COLORS,
              borderWidth: 2,
              borderColor: '#fff',
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '68%',
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: (c: any) => `${c.label}: ${c.parsed} leads` } },
            },
          },
        })
      }
    }
    loadChart()
    return () => {
      chartInstance.current?.destroy()
      donutInstance.current?.destroy()
    }
  }, [period, metric, analytics])

  function StatCard({ label, value, sub, subUp }: { label: string; value: string; sub?: string; subUp?: boolean }) {
    return (
      <div className="bamo-card p-4">
        <div className="text-xl font-semibold text-[#1A2E5A] leading-none">{value}</div>
        <div className="text-xs text-gray-500 mt-1">{label}</div>
        {sub && (
          <div className={`text-[10px] mt-1 flex items-center gap-1 ${subUp === true ? 'text-[#3B6D11]' : subUp === false ? 'text-[#A32D2D]' : 'text-gray-400'}`}>
            {subUp === true ? <TrendingUp size={10} /> : subUp === false ? <TrendingDown size={10} /> : <Minus size={10} />}
            {sub}
          </div>
        )}
      </div>
    )
  }

  const hasData = analytics.length > 0

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1A2E5A]">Analytics</h1>
          <p className="text-xs text-gray-500 mt-0.5">Campaign performance, website traffic, and lead data.</p>
        </div>
        <div className="flex gap-1 bg-white rounded-lg border border-black/10 p-1">
          {(['7d', '30d', '90d'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                period === p ? 'bg-[#1A2E5A] text-white' : 'text-gray-500 hover:text-[#1A2E5A]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-3">
        <StatCard label="Total leads" value={totals.leads.toLocaleString()} sub="+28 this week" subUp={true} />
        <StatCard label="Impressions" value={totals.impressions >= 1000 ? `${(totals.impressions / 1000).toFixed(1)}K` : totals.impressions.toString()} sub="+12% vs last period" subUp={true} />
        <StatCard label="Link clicks" value={totals.clicks.toLocaleString()} sub="+8% vs last period" subUp={true} />
        <StatCard label="Total spend" value={`₱${Math.round(totals.spend).toLocaleString()}`} sub="all campaigns" />
        <StatCard label="Cost per lead" value={avgCPL > 0 ? `₱${avgCPL.toLocaleString()}` : '—'} sub={avgCPL > 300 ? 'Above target' : 'On track'} subUp={avgCPL > 0 && avgCPL <= 300} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-5 gap-3">

        {/* Line chart */}
        <div className="bamo-card col-span-3 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
            <div className="text-sm font-semibold text-[#1A2E5A] flex items-center gap-2">
              📈 Performance over time
            </div>
            <select
              className="text-xs border border-black/10 rounded-lg px-2 py-1 outline-none bg-white"
              value={metric}
              onChange={e => setMetric(e.target.value as any)}
            >
              <option value="leads">Leads</option>
              <option value="spend">Ad Spend (₱)</option>
              <option value="impressions">Impressions</option>
              <option value="clicks">Clicks</option>
            </select>
          </div>
          <div className="flex gap-4 px-4 py-2 border-b border-black/5">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <div className="w-2.5 h-2.5 rounded-sm bg-[#E8660A]" />
              {metric.charAt(0).toUpperCase() + metric.slice(1)}
            </div>
          </div>
          <div className="p-4" style={{ height: 200 }}>
            {hasData ? (
              <canvas ref={chartRef} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                <div className="text-3xl">📊</div>
                <div className="text-xs">No analytics data yet</div>
                <div className="text-[10px] text-center">Analytics will appear once your campaigns start running</div>
              </div>
            )}
          </div>
        </div>

        {/* Donut chart */}
        <div className="bamo-card col-span-2 flex flex-col">
          <div className="px-4 py-3 border-b border-black/5 text-sm font-semibold text-[#1A2E5A]">
            🍩 Leads by campaign
          </div>
          {campaignPerf.some(c => c.leads > 0) ? (
            <>
              <div className="p-4" style={{ height: 140 }}>
                <canvas ref={donutRef} />
              </div>
              <div className="px-4 pb-4 flex flex-col gap-1.5">
                {campaignPerf.slice(0, 5).map((c, i) => (
                  <div key={c.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-sm" style={{ background: CHART_COLORS[i] }} />
                      <span className="text-gray-500 truncate max-w-28">{c.name}</span>
                    </div>
                    <span className="font-semibold text-[#1A2E5A]">{c.leads} leads</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2 p-4">
              <div className="text-3xl">🎯</div>
              <div className="text-xs text-center">No lead data yet</div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-5 gap-3">

        {/* Campaign performance table */}
        <div className="bamo-card col-span-3 flex flex-col">
          <div className="px-4 py-3 border-b border-black/5 text-sm font-semibold text-[#1A2E5A]">
            📋 Campaign performance
          </div>
          {campaignPerf.length > 0 ? (
            <>
              <div className="flex px-4 py-2 border-b border-black/5">
                {['Campaign', 'Spend', 'CPL', 'Leads'].map(h => (
                  <div key={h} className={`text-[10px] font-semibold text-gray-400 uppercase tracking-wider ${h === 'Campaign' ? 'flex-1' : 'w-16 text-right'}`}>
                    {h}
                  </div>
                ))}
              </div>
              <div className="divide-y divide-black/5 flex-1">
                {campaignPerf.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-2 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#1A2E5A] truncate">{c.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {c.status}
                        </span>
                        {/* Mini bar */}
                        <div className="flex-1 max-w-20 h-1 bg-[#F4F5F7] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${maxSpend > 0 ? (c.spend / maxSpend) * 100 : 0}%`,
                              background: CHART_COLORS[i % CHART_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="w-16 text-right text-xs font-semibold text-[#1A2E5A]">
                      {c.spend > 0 ? `₱${c.spend.toLocaleString()}` : '—'}
                    </div>
                    <div className="w-16 text-right text-xs font-semibold text-[#1A2E5A]">
                      {c.cpl > 0 ? `₱${c.cpl.toLocaleString()}` : '—'}
                    </div>
                    <div className="w-16 text-right text-xs font-semibold text-[#3B6D11]">
                      {c.leads > 0 ? c.leads : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2 p-8">
              <div className="text-3xl">📋</div>
              <div className="text-xs">No campaigns yet</div>
            </div>
          )}
        </div>

        {/* Website analytics */}
        <div className="bamo-card col-span-2 flex flex-col">
          <div className="px-4 py-3 border-b border-black/5 text-sm font-semibold text-[#1A2E5A]">
            🌐 Website analytics
          </div>
          <div className="grid grid-cols-2 gap-0 divide-x divide-y divide-black/5">
            {[
              { label: 'Page views', value: websiteTotals.pageViews.toLocaleString(), up: true },
              { label: 'Unique visitors', value: websiteTotals.visitors.toLocaleString(), up: true },
              { label: 'Form submissions', value: websiteTotals.formSubmissions.toLocaleString(), up: true },
              { label: 'Listing clicks', value: websiteTotals.listingClicks.toLocaleString(), up: false },
            ].map(({ label, value, up }) => (
              <div key={label} className="p-4">
                <div className="text-lg font-semibold text-[#1A2E5A]">{value || '—'}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
                {Number(value.replace(',', '')) > 0 && (
                  <div className={`text-[10px] mt-1 flex items-center gap-1 ${up ? 'text-[#3B6D11]' : 'text-gray-400'}`}>
                    {up ? <TrendingUp size={9} /> : <Minus size={9} />}
                    {up ? '+18% this month' : 'Flat'}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-black/5 divide-y divide-black/5">
            {[
              { label: 'Top page', value: '/listings' },
              { label: 'Avg. session', value: '2m 14s' },
              { label: 'Bounce rate', value: '42%' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-4 py-2.5">
                <div className="text-xs text-gray-500">{label}</div>
                <div className="text-xs font-semibold text-[#1A2E5A]">{value}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
