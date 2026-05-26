'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Rocket, Building, Image as ImageIcon, Video } from 'lucide-react'

const PLACEMENTS = [
  { id: 'facebook_feed', label: 'FB Feed' },
  { id: 'facebook_reels', label: 'FB Reels' },
  { id: 'instagram_feed', label: 'IG Feed' },
  { id: 'instagram_reels', label: 'IG Reels' },
  { id: 'instagram_stories', label: 'IG Stories' },
  { id: 'audience_network', label: 'Audience Network' },
]

const OBJECTIVES = [
  { id: 'lead_generation', label: 'Lead generation' },
  { id: 'traffic', label: 'Traffic' },
  { id: 'awareness', label: 'Awareness' },
]

interface CampaignFormProps {
  clientId: string
  listings: any[]
  creatives: any[]
  socialAccounts: any[]
  defaultCreativeId?: string
  defaultListingId?: string
}

export default function CampaignForm({
  clientId, listings, creatives, socialAccounts, defaultCreativeId, defaultListingId,
}: CampaignFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState('')
  const [objective, setObjective] = useState('lead_generation')
  const [listingId, setListingId] = useState(defaultListingId ?? listings[0]?.id ?? '')
  const [creativeId, setCreativeId] = useState(defaultCreativeId ?? creatives[0]?.id ?? '')
  const [socialAccountId, setSocialAccountId] = useState(socialAccounts[0]?.id ?? '')
  const [budgetDaily, setBudgetDaily] = useState('')
  const [budgetTotal, setBudgetTotal] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [placements, setPlacements] = useState<string[]>(['facebook_feed', 'facebook_reels', 'instagram_reels'])
  const [location, setLocation] = useState('CALABARZON, Metro Manila')
  const [ageMin, setAgeMin] = useState('25')
  const [ageMax, setAgeMax] = useState('54')
  const [interests, setInterests] = useState('Real estate, OFW, housing')
  const [saving, setSaving] = useState(false)
  const [launching, setLaunching] = useState(false)

  const estimatedTotal = budgetDaily && startDate && endDate
    ? Math.round(Number(budgetDaily) * Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000))
    : budgetDaily
      ? Math.round(Number(budgetDaily) * 30)
      : 0

  function togglePlacement(id: string) {
    setPlacements(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  async function handleSave(launch: boolean) {
    if (!name.trim()) { alert('Please enter a campaign name'); return }
    launch ? setLaunching(true) : setSaving(true)

    try {
      const payload = {
        client_id: clientId,
        name: name.trim(),
        objective,
        listing_id: listingId || null,
        creative_id: creativeId || null,
        social_account_id: socialAccountId || null,
        budget_daily: budgetDaily ? Number(budgetDaily) : null,
        budget_total: budgetTotal ? Number(budgetTotal) : null,
        placement: placements,
        audience_config: {
          location,
          age_min: Number(ageMin),
          age_max: Number(ageMax),
          interests,
        },
        starts_at: startDate ? new Date(startDate).toISOString() : null,
        ends_at: endDate ? new Date(endDate).toISOString() : null,
        status: launch ? 'active' : 'draft',
        launched_at: launch ? new Date().toISOString() : null,
      }

      const { error } = await supabase.from('ad_campaigns').insert(payload)
      if (error) throw error

      router.push('/campaigns')
      router.refresh()
    } catch (err) {
      console.error(err)
      alert('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
      setLaunching(false)
    }
  }

  return (
    <div className="max-w-3xl flex flex-col gap-4">

      {/* Card 1 — Campaign info */}
      <div className="bamo-card">
        <div className="px-4 py-3 border-b border-black/5 text-sm font-semibold text-[#1A2E5A] flex items-center gap-2">
          📋 Campaign Info
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Campaign name *</label>
            <input
              className="bamo-input"
              type="text"
              placeholder="e.g. Laguna Condo May Launch"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Objective</label>
            <select className="bamo-input" value={objective} onChange={e => setObjective(e.target.value)}>
              {OBJECTIVES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Social account</label>
            {socialAccounts.length > 0 ? (
              <select className="bamo-input" value={socialAccountId} onChange={e => setSocialAccountId(e.target.value)}>
                {socialAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.account_name} ({a.platform})</option>
                ))}
              </select>
            ) : (
              <div className="bamo-input text-xs text-gray-400 cursor-default bg-[#F4F5F7]">
                No accounts connected — go to Settings → Social Accounts
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Listing</label>
            <select className="bamo-input" value={listingId} onChange={e => setListingId(e.target.value)}>
              <option value="">No listing selected</option>
              {listings.map(l => (
                <option key={l.id} value={l.id}>
                  {l.property_name ?? 'Unnamed'}{l.city ? ` · ${l.city}` : ''}{l.price ? ` · ₱${Number(l.price).toLocaleString()}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Creative</label>
            <select className="bamo-input" value={creativeId} onChange={e => setCreativeId(e.target.value)}>
              <option value="">No creative selected</option>
              {creatives.map(c => (
                <option key={c.id} value={c.id}>
                  {c.source.replace('_', '.')} · {c.type}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Card 2 — Budget */}
      <div className="bamo-card">
        <div className="px-4 py-3 border-b border-black/5 text-sm font-semibold text-[#1A2E5A] flex items-center gap-2">
          💰 Budget & Schedule
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Daily budget (₱)</label>
            <input
              className="bamo-input"
              type="number"
              placeholder="e.g. 500"
              value={budgetDaily}
              onChange={e => setBudgetDaily(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Total budget (₱) <span className="text-gray-400 font-normal">optional</span></label>
            <input
              className="bamo-input"
              type="number"
              placeholder="Leave blank for no cap"
              value={budgetTotal}
              onChange={e => setBudgetTotal(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Start date</label>
            <input className="bamo-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">End date <span className="text-gray-400 font-normal">optional</span></label>
            <input className="bamo-input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>

          {estimatedTotal > 0 && (
            <div className="col-span-2 bg-[#E8EBF3] rounded-lg px-3 py-2 text-xs text-[#1A2E5A]">
              Est. total: <strong>₱{estimatedTotal.toLocaleString()}</strong>
              {startDate && endDate ? ' for campaign duration' : ' for 30 days'}
            </div>
          )}
        </div>
      </div>

      {/* Card 3 — Placements */}
      <div className="bamo-card">
        <div className="px-4 py-3 border-b border-black/5 text-sm font-semibold text-[#1A2E5A] flex items-center gap-2">
          📱 Placements
        </div>
        <div className="p-4">
          <div className="flex flex-wrap gap-2">
            {PLACEMENTS.map(p => (
              <button
                key={p.id}
                onClick={() => togglePlacement(p.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  placements.includes(p.id)
                    ? 'bg-[#1A2E5A] text-white'
                    : 'border border-black/10 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Card 4 — Audience */}
      <div className="bamo-card">
        <div className="px-4 py-3 border-b border-black/5 text-sm font-semibold text-[#1A2E5A] flex items-center gap-2">
          🎯 Audience Targeting
        </div>
        <div className="p-4 grid grid-cols-3 gap-3">
          <div className="col-span-3">
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Location</label>
            <input
              className="bamo-input"
              type="text"
              placeholder="e.g. CALABARZON, Metro Manila"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Min age</label>
            <input className="bamo-input" type="number" value={ageMin} onChange={e => setAgeMin(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Max age</label>
            <input className="bamo-input" type="number" value={ageMax} onChange={e => setAgeMax(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Interests</label>
            <input
              className="bamo-input"
              type="text"
              placeholder="Real estate, OFW, housing"
              value={interests}
              onChange={e => setInterests(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between py-2">
        <div className="text-xs text-gray-400">
          {placements.length} placement{placements.length !== 1 ? 's' : ''} selected
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleSave(false)}
            disabled={saving || launching}
            className="btn-ghost"
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving || launching}
            className="btn-orange"
          >
            <Rocket size={14} />
            {launching ? 'Launching...' : 'Launch Campaign'}
          </button>
        </div>
      </div>

    </div>
  )
}
