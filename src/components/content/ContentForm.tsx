'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Wand2, Sparkles, Building, Save, Image as ImageIcon, Globe, ChevronDown } from 'lucide-react'
import MarketplacePicker, { type MarketplaceListing } from './MarketplacePicker'

const PLATFORMS = ['facebook', 'instagram', 'linkedin']
const TONES = ['professional', 'casual', 'urgent', 'aspirational']

interface Listing {
  id: string
  property_name: string | null
  price: number | null
  city: string | null
  property_type: string | null
}

interface ContentFormProps {
  clientId: string
  listings: Listing[]
}

type ListingSource = 'local' | 'marketplace'

export default function ContentForm({ clientId, listings }: ContentFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const [platform, setPlatform] = useState('facebook')
  const [tone, setTone] = useState('professional')
  const [audience, setAudience] = useState('')
  const [topic, setTopic] = useState('')
  const [selectedListing, setSelectedListing] = useState<Listing | null>(listings[0] ?? null)
  const [listingSource, setListingSource] = useState<ListingSource>('local')
  const [marketplaceListing, setMarketplaceListing] = useState<MarketplaceListing | null>(null)
  const [showMarketplacePicker, setShowMarketplacePicker] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generated, setGenerated] = useState<{
    hook: string
    caption: string
    hashtags: string[]
    cta: string
  } | null>(null)
  const [editCaption, setEditCaption] = useState('')
  const [editHook, setEditHook] = useState('')

  const activeListing = listingSource === 'marketplace' && marketplaceListing
    ? {
        id: marketplaceListing.marketplace_id,
        property_name: marketplaceListing.property_name,
        price: marketplaceListing.price,
        city: marketplaceListing.city,
        property_type: marketplaceListing.property_type,
      }
    : selectedListing

  async function handleGenerate() {
    setGenerating(true)
    try {
      const prompt = `You are a real estate marketing expert for the Philippine market.\nGenerate social media content for a ${platform} post.\n\nProperty: ${activeListing?.property_name ?? 'Property'} in ${activeListing?.city ?? 'Philippines'}\nPrice: ₱${activeListing?.price?.toLocaleString() ?? 'Contact for price'}\nType: ${activeListing?.property_type ?? 'Property'}\nTone: ${tone}\nTarget audience: ${audience || 'Filipino homebuyers and investors'}\nFocus: ${topic || 'Highlight key property features and call to action'}\n\nReturn ONLY a JSON object with exactly these keys:\n{\n  "hook": "attention-grabbing opening line in Filipino/English mix",\n  "caption": "full post caption 3-4 paragraphs with emojis, key features and benefits",\n  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5", "hashtag6"],\n  "cta": "short call to action text"\n}\nNo markdown, no explanation, just the JSON.`

      const response = await fetch('/api/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })

      if (!response.ok) throw new Error('Generation failed')
      const data = await response.json()
      setGenerated(data)
      setEditCaption(data.caption)
      setEditHook(data.hook)
    } catch (err) {
      console.error(err)
      const sample = {
        hook: `Ang dream home mo sa ${activeListing?.city ?? 'Pilipinas'} — handa ka na ba? 🏡`,
        caption: `Introducing a stunning ${activeListing?.property_name ?? 'property'} — perfect for growing families, OFW investors, and first-time homebuyers.\n\n✅ Ready for occupancy\n✅ Prime location\n✅ Flexible payment terms available`,
        hashtags: [`#${activeListing?.city?.replace(/\s/g, '') ?? 'PH'}RealEstate`, '#CondoForSale', '#OFWInvestment', '#BaMo', '#PHProperty', '#DreamHome'],
        cta: '💬 Message us now for a free site visit!',
      }
      setGenerated(sample)
      setEditCaption(sample.caption)
      setEditHook(sample.hook)
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave(status: 'draft' | 'approved') {
    if (!generated && !editCaption) return
    setSaving(true)
    try {
      let resolvedListingId: string | null = selectedListing?.id ?? null
      if (listingSource === 'marketplace' && marketplaceListing) {
        const { data: upserted } = await supabase
          .from('ad_listings')
          .upsert({
            client_id: clientId,
            marketplace_listing_id: marketplaceListing.marketplace_id,
            property_name: marketplaceListing.property_name,
            property_type: marketplaceListing.property_type,
            description: marketplaceListing.description,
            price: marketplaceListing.price,
            city: marketplaceListing.city,
            location: marketplaceListing.location,
            bedrooms: marketplaceListing.bedrooms,
            bathrooms: marketplaceListing.bathrooms,
            floor_area: marketplaceListing.floor_area,
            lot_area: marketplaceListing.lot_area,
            primary_photo_url: marketplaceListing.primary_photo_url,
            listing_url: marketplaceListing.listing_url,
            agent_name: marketplaceListing.agent_name,
            agent_prc_number: marketplaceListing.agent_prc_number,
            agent_email: marketplaceListing.agent_email,
            agent_phone: marketplaceListing.agent_phone,
          }, { onConflict: 'client_id,marketplace_listing_id' })
          .select('id')
          .single()
        resolvedListingId = upserted?.id ?? null
      }

      const { error } = await supabase.from('ad_content').insert({
        client_id: clientId,
        platform,
        tone,
        target_audience: audience || null,
        hook: editHook || generated?.hook || null,
        caption: editCaption || generated?.caption || null,
        hashtags: generated?.hashtags ?? [],
        cta: generated?.cta ?? null,
        ai_generated: !!generated,
        listing_id: resolvedListingId,
        status,
      })
      if (error) throw error
      router.push('/content')
      router.refresh()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-2 gap-4 max-w-6xl">

      {/* LEFT — Form */}
      <div className="bamo-card flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#1A2E5A]">
            <Wand2 size={15} className="text-[#E8660A]" /> Create Content
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-[#E8EBF3] text-[#1A2E5A] px-2 py-0.5 rounded-full">
            <Sparkles size={9} /> AI-powered
          </span>
        </div>

        <div className="p-4 flex flex-col gap-4">

          {/* Let BaMo Decide banner */}
          <div className="bg-[#1A2E5A] rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center text-white">🤖</div>
              <div>
                <div className="text-sm font-semibold text-white">Let BaMo Decide</div>
                <div className="text-[11px] text-white/60 mt-0.5">BaMo generates everything from your listing</div>
              </div>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="bg-[#E8660A] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Sparkles size={12} />
              {generating ? 'Generating...' : 'Generate'}
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-black/8" />
            <span className="text-xs text-gray-400">or fill in manually</span>
            <div className="flex-1 h-px bg-black/8" />
          </div>

          {/* Listing selector with source toggle */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-[#1A2E5A]">Listing</label>
              <div className="flex items-center gap-1 bg-[#F4F5F7] rounded-lg p-0.5">
                <button
                  onClick={() => setListingSource('local')}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors ${
                    listingSource === 'local'
                      ? 'bg-white text-[#1A2E5A] shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Building size={9} className="inline mr-1" />My Listings
                </button>
                <button
                  onClick={() => setListingSource('marketplace')}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors ${
                    listingSource === 'marketplace'
                      ? 'bg-white text-[#E8660A] shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Globe size={9} className="inline mr-1" />Marketplace
                </button>
              </div>
            </div>

            {/* Local listings dropdown */}
            {listingSource === 'local' && (
              listings.length > 0 ? (
                <div className="flex items-center gap-3 bg-[#F4F5F7] rounded-lg px-3 py-2.5">
                  <Building size={16} className="text-[#1A2E5A] flex-shrink-0" />
                  <select
                    className="flex-1 bg-transparent text-sm text-[#1A2E5A] outline-none"
                    value={selectedListing?.id ?? ''}
                    onChange={e => {
                      const l = listings.find(l => l.id === e.target.value)
                      setSelectedListing(l ?? null)
                    }}
                  >
                    {listings.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.property_name ?? 'Unnamed'} — {l.city} {l.price ? `· ₱${Number(l.price).toLocaleString()}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="bg-[#F4F5F7] rounded-lg px-3 py-3 text-xs text-gray-400 text-center">
                  No listings yet.{' '}
                  <a href="/listings/new" className="text-[#E8660A] font-medium hover:underline">Add one</a>
                  {' '}or switch to Marketplace.
                </div>
              )
            )}

            {/* Marketplace picker trigger */}
            {listingSource === 'marketplace' && (
              <div>
                {marketplaceListing ? (
                  <div className="flex items-center gap-3 bg-[#FDE8D8] border border-[#E8660A]/30 rounded-lg px-3 py-2.5">
                    <Globe size={15} className="text-[#E8660A] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#1A2E5A] truncate">
                        {marketplaceListing.property_name ?? 'Unnamed'}
                      </div>
                      <div className="text-[10px] text-gray-500 truncate">
                        {marketplaceListing.city} {marketplaceListing.price ? `· ₱${Number(marketplaceListing.price).toLocaleString()}` : ''} · bahaymo.com
                      </div>
                    </div>
                    <button
                      onClick={() => setShowMarketplacePicker(true)}
                      className="text-[10px] text-[#E8660A] font-semibold hover:underline flex-shrink-0"
                    >
                      Change <ChevronDown size={10} className="inline" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowMarketplacePicker(true)}
                    className="w-full flex items-center gap-3 bg-[#F4F5F7] border border-dashed border-[#1A2E5A]/20 rounded-lg px-3 py-2.5 hover:border-[#E8660A]/40 hover:bg-[#FDE8D8]/30 transition-colors"
                  >
                    <Globe size={16} className="text-[#E8660A] flex-shrink-0" />
                    <div className="text-left">
                      <div className="text-sm font-medium text-[#1A2E5A]">Browse BaMo Marketplace</div>
                      <div className="text-[10px] text-gray-400">Pick a listing from bahaymo.com</div>
                    </div>
                    <ChevronDown size={14} className="text-gray-400 ml-auto" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Platform */}
          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Platform</label>
            <div className="flex gap-2">
              {PLATFORMS.map(p => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize transition-colors ${
                    platform === p ? 'bg-[#1A2E5A] text-white' : 'border border-black/10 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Tone */}
          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Tone</label>
            <div className="flex flex-wrap gap-1.5">
              {TONES.map(t => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                    tone === t ? 'bg-[#E8660A] text-white' : 'border border-black/10 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Audience */}
          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">
              Target audience <span className="text-gray-400 font-normal">optional</span>
            </label>
            <input
              className="bamo-input text-sm"
              type="text"
              placeholder="e.g. OFW families, first-time buyers, investors"
              value={audience}
              onChange={e => setAudience(e.target.value)}
            />
          </div>

          {/* Topic */}
          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">
              Topic / Focus <span className="text-gray-400 font-normal">optional</span>
            </label>
            <input
              className="bamo-input text-sm"
              type="text"
              placeholder="e.g. highlight low down payment, near schools"
              value={topic}
              onChange={e => setTopic(e.target.value)}
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-orange w-full justify-center py-2.5"
          >
            <Sparkles size={14} />
            {generating ? 'Generating...' : 'Generate Content'}
          </button>

        </div>
      </div>

      {/* RIGHT — Preview */}
      <div className="bamo-card flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
          <div className="text-sm font-semibold text-[#1A2E5A] flex items-center gap-2">
            👁 Preview
          </div>
          <div className="text-xs text-gray-400">
            {generated ? '✅ Generated by BaMo AI' : 'Waiting for generation...'}
          </div>
        </div>

        {!generated ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400 p-8">
            <div className="text-4xl">📝</div>
            <div className="text-sm text-center">Your generated content will appear here</div>
            <div className="text-xs text-center">Fill in the form or click "Let BaMo Decide"</div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">

            <div className="flex gap-1.5">
              {PLATFORMS.map(p => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${
                    platform === p ? 'bg-[#1A2E5A] text-white' : 'border border-black/10 text-gray-500'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="bg-[#F4F5F7] rounded-lg p-3">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Hook</div>
              <textarea
                className="w-full bg-transparent text-sm font-semibold text-[#1A2E5A] outline-none resize-none leading-snug"
                rows={2}
                value={editHook}
                onChange={e => setEditHook(e.target.value)}
              />
            </div>

            <div className="bg-[#F4F5F7] rounded-lg p-3">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Caption</div>
              <textarea
                className="w-full bg-transparent text-xs text-gray-700 outline-none resize-none leading-relaxed"
                rows={6}
                value={editCaption}
                onChange={e => setEditCaption(e.target.value)}
              />
            </div>

            <div className="bg-[#F4F5F7] rounded-lg p-3">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Hashtags</div>
              <div className="flex flex-wrap gap-1.5">
                {generated.hashtags.map(h => (
                  <span key={h} className="text-[11px] text-[#185FA5] bg-[#E6F1FB] px-2 py-0.5 rounded-full">{h}</span>
                ))}
              </div>
            </div>

            <div className="bg-[#FDE8D8] rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-[#E8660A]">{generated.cta}</span>
              <span className="text-[#E8660A]">→</span>
            </div>

            <div className="flex gap-2 mt-1">
              <button onClick={handleGenerate} disabled={generating} className="btn-ghost text-xs flex-1 justify-center">
                🔄 Regenerate
              </button>
              <button onClick={() => handleSave('draft')} disabled={saving} className="btn-ghost text-xs flex-1 justify-center">
                <Save size={12} /> Save Draft
              </button>
              <button onClick={() => handleSave('approved')} disabled={saving} className="btn-orange text-xs flex-1 justify-center">
                <ImageIcon size={12} />
                {saving ? 'Saving...' : 'Save & Create Creative'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Marketplace picker modal */}
      {showMarketplacePicker && (
        <MarketplacePicker
          onSelect={listing => {
            setMarketplaceListing(listing)
            setShowMarketplacePicker(false)
          }}
          onClose={() => setShowMarketplacePicker(false)}
        />
      )}
    </div>
  )
}
