'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Megaphone, Plus, BarChart2, Edit, Play, Pause, Trash2, Rocket } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-[#EAF3DE] text-[#3B6D11]',
  draft: 'bg-[#F1EFE8] text-[#5F5E5A]',
  paused: 'bg-[#FAEEDA] text-[#854F0B]',
  failed: 'bg-[#FCEBEB] text-[#A32D2D]',
  completed: 'bg-[#E8EBF3] text-[#1A2E5A]',
}

const ICON_COLORS = [
  'bg-[#FDE8D8] text-[#E8660A]',
  'bg-[#E8EBF3] text-[#1A2E5A]',
  'bg-[#EAF3DE] text-[#3B6D11]',
  'bg-[#E6F1FB] text-[#185FA5]',
  'bg-[#FAEEDA] text-[#854F0B]',
]

interface Campaign {
  id: string
  name: string
  status: string
  objective: string | null
  budget_daily: number | null
  budget_total: number | null
  placement: string[] | null
  meta_campaign_id: string | null
  starts_at: string | null
  ends_at: string | null
  launched_at: string | null
  created_at: string
  ad_analytics: any[]
}

export default function CampaignList({ campaigns }: { campaigns: Campaign[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState<string | null>(null)

  const filtered = campaigns.filter(c => {
    const matchFilter = filter === 'all' ? true : c.status === filter
    const matchSearch = search ? c.name.toLowerCase().includes(search.toLowerCase()) : true
    return matchFilter && matchSearch
  })

  async function updateStatus(id: string, status: string) {
    setLoading(id)
    await supabase.from('ad_campaigns').update({ status }).eq('id', id)
    router.refresh()
    setLoading(null)
  }

  async function deleteCampaign(id: string) {
    if (!confirm('Delete this campaign? This cannot be undone.')) return
    setLoading(id)
    await supabase.from('ad_campaigns').delete().eq('id', id)
    router.refresh()
    setLoading(null)
  }

  function getCampaignMetrics(c: Campaign) {
    const analytics = Array.isArray(c.ad_analytics) ? c.ad_analytics : []
    return {
      spend: analytics.reduce((s, a) => s + (Number(a.spend) || 0), 0),
      leads: analytics.reduce((s, a) => s + (Number(a.leads) || 0), 0),
      reach: analytics.reduce((s, a) => s + (Number(a.reach) || 0), 0),
      cpl: 0, // calculated below
    }
  }

  if (campaigns.length === 0) {
    return (
      <div className="bamo-card flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-14 h-14 rounded-full bg-[#FDE8D8] flex items-center justify-center">
          <Megaphone size={24} className="text-[#E8660A]" />
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold text-[#1A2E5A]">No campaigns yet</div>
          <div className="text-xs text-gray-500 mt-1">Create your first ad campaign to start generating leads</div>
        </div>
        <Link href="/campaigns/new" className="btn-orange text-sm">
          <Plus size={14} /> New Campaign
        </Link>
      </div>
    )
  }

  return (
    <div className="bamo-card flex flex-col">
      {/* Filter bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-black/5">
        <div className="flex-1 flex items-center gap-2 bg-[#F4F5F7] rounded-lg px-3 py-1.5">
          <span className="text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Search campaigns..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none flex-1"
          />
        </div>
        {['all', 'active', 'draft', 'paused', 'completed'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
              filter === f ? 'bg-[#1A2E5A] text-white' : 'border border-black/10 text-gray-500 hover:bg-gray-50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Campaign rows */}
      {filtered.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-xs text-gray-400">
          No campaigns match this filter
        </div>
      ) : (
        <div className="divide-y divide-black/5">
          {filtered.map((c, i) => {
            const metrics = getCampaignMetrics(c)
            const cpl = metrics.leads > 0 ? Math.round(metrics.spend / metrics.leads) : 0
            const isLoading = loading === c.id

            return (
              <div key={c.id}>
                <div className="flex items-center gap-3 px-4 py-4">
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${ICON_COLORS[i % ICON_COLORS.length]}`}>
                    <Megaphone size={18} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#1A2E5A] truncate">{c.name}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                      </span>
                      {c.objective && (
                        <span className="text-[10px] text-gray-400 capitalize">{c.objective.replace('_', ' ')}</span>
                      )}
                      {c.placement && c.placement.length > 0 && (
                        <span className="text-[10px] text-gray-400">{c.placement.slice(0, 2).join(' + ')}</span>
                      )}
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="flex gap-4 flex-shrink-0">
                    {[
                      { label: 'Spend', value: metrics.spend > 0 ? `₱${metrics.spend.toLocaleString()}` : '—' },
                      { label: 'Leads', value: metrics.leads > 0 ? metrics.leads : '—' },
                      { label: 'CPL', value: cpl > 0 ? `₱${cpl.toLocaleString()}` : '—' },
                      { label: 'Reach', value: metrics.reach > 0 ? `${(metrics.reach / 1000).toFixed(1)}K` : '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="text-right">
                        <div className="text-sm font-semibold text-[#1A2E5A]">{value}</div>
                        <div className="text-[10px] text-gray-400">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action bar */}
                <div className="flex border-t border-black/5">
                  <Link href={`/analytics?campaign=${c.id}`} className="flex-1 py-2 flex items-center justify-center gap-1.5 text-[11px] font-medium text-gray-500 hover:bg-[#F4F5F7] transition-colors">
                    <BarChart2 size={12} /> Analytics
                  </Link>
                  <div className="w-px bg-black/5" />
                  <Link href={`/campaigns/${c.id}/edit`} className="flex-1 py-2 flex items-center justify-center gap-1.5 text-[11px] font-medium text-gray-500 hover:bg-[#F4F5F7] transition-colors">
                    <Edit size={12} /> Edit
                  </Link>
                  <div className="w-px bg-black/5" />
                  {c.status === 'draft' && (
                    <>
                      <button
                        onClick={() => updateStatus(c.id, 'active')}
                        disabled={isLoading}
                        className="flex-1 py-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#E8660A] hover:bg-[#FDE8D8] transition-colors disabled:opacity-50"
                      >
                        <Rocket size={12} /> Launch Now
                      </button>
                      <div className="w-px bg-black/5" />
                    </>
                  )}
                  {c.status === 'active' && (
                    <>
                      <button
                        onClick={() => updateStatus(c.id, 'paused')}
                        disabled={isLoading}
                        className="flex-1 py-2 flex items-center justify-center gap-1.5 text-[11px] font-medium text-[#854F0B] hover:bg-[#FAEEDA] transition-colors disabled:opacity-50"
                      >
                        <Pause size={12} /> Pause
                      </button>
                      <div className="w-px bg-black/5" />
                    </>
                  )}
                  {c.status === 'paused' && (
                    <>
                      <button
                        onClick={() => updateStatus(c.id, 'active')}
                        disabled={isLoading}
                        className="flex-1 py-2 flex items-center justify-center gap-1.5 text-[11px] font-medium text-[#3B6D11] hover:bg-[#EAF3DE] transition-colors disabled:opacity-50"
                      >
                        <Play size={12} /> Resume
                      </button>
                      <div className="w-px bg-black/5" />
                    </>
                  )}
                  <button
                    onClick={() => deleteCampaign(c.id)}
                    disabled={isLoading}
                    className="flex-1 py-2 flex items-center justify-center gap-1.5 text-[11px] font-medium text-[#A32D2D] hover:bg-[#FCEBEB] transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
