'use client'
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Search, MapPin, Bed, Bath, Ruler, ExternalLink, Check, Loader2 } from 'lucide-react'

export interface MarketplaceListing {
  marketplace_id: string
  property_name: string | null
  price: number | null
  property_type: string | null
  city: string | null
  location: string | null
  bedrooms: number | null
  bathrooms: number | null
  floor_area: number | null
  lot_area: number | null
  description: string | null
  primary_photo_url: string | null
  agent_name: string | null
  agent_prc_number: string | null
  agent_email: string | null
  agent_phone: string | null
  listing_url: string
}

const TYPE_LABELS: Record<string, string> = {
  condo: 'Condo',
  house_lot: 'House & Lot',
  lot: 'Lot',
  commercial: 'Commercial',
}

const TYPE_COLORS: Record<string, string> = {
  condo: 'bg-[#E8EBF3] text-[#1A2E5A]',
  house_lot: 'bg-[#EAF3DE] text-[#3B6D11]',
  lot: 'bg-[#FAEEDA] text-[#854F0B]',
  commercial: 'bg-[#E6F1FB] text-[#185FA5]',
}

interface MarketplacePickerProps {
  onSelect: (listing: MarketplaceListing) => void
  onClose: () => void
}

export default function MarketplacePicker({ onSelect, onClose }: MarketplacePickerProps) {
  const [search, setSearch] = useState('')
  const [listings, setListings] = useState<MarketplaceListing[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<MarketplaceListing | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const fetchListings = useCallback(async (q: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '30' })
      if (q) params.set('search', q)
      const res = await fetch(`/api/marketplace-listings?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load')
      setListings(data.listings ?? [])
    } catch (err: any) {
      setError(err.message ?? 'Could not load marketplace listings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchListings('') }, [fetchListings])

  useEffect(() => {
    const t = setTimeout(() => { if (search.length !== 1) fetchListings(search) }, 400)
    return () => clearTimeout(t)
  }, [search, fetchListings])

  function handleSelect() {
    if (selected) onSelect(selected)
  }

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">

        <div className="flex items-center justify-between px-5 py-4 border-b border-black/8">
          <div>
            <div className="text-sm font-semibold text-[#1A2E5A] flex items-center gap-2">
              🏪 BaMo Marketplace
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              Choose a listing from bahaymo.com to generate content for
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-[#F4F5F7] flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-black/5">
          <div className="flex items-center gap-2 bg-[#F4F5F7] rounded-lg px-3 py-2">
            <Search size={14} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search by name, city, or location..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-sm outline-none flex-1 text-[#1A2E5A] placeholder:text-gray-400"
              autoFocus
            />
            {loading && <Loader2 size={14} className="text-gray-400 animate-spin" />}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {error ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <div className="text-2xl">⚠️</div>
              <div className="text-sm font-medium text-[#1A2E5A]">Marketplace not connected</div>
              <div className="text-xs text-gray-400 max-w-xs">{error}</div>
              <div className="text-xs text-gray-400 mt-1">
                Add <code className="bg-gray-100 px-1 rounded">MARKETPLACE_SUPABASE_URL</code> and{' '}
                <code className="bg-gray-100 px-1 rounded">MARKETPLACE_SUPABASE_ANON_KEY</code>{' '}
                to your environment variables.
              </div>
            </div>
          ) : listings.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
              <div className="text-2xl">🔍</div>
              <div className="text-sm text-gray-500">No listings found</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {listings.map(l => {
                const typeKey = l.property_type ?? 'condo'
                const typeColor = TYPE_COLORS[typeKey] ?? TYPE_COLORS.condo
                const isSelected = selected?.marketplace_id === l.marketplace_id
                return (
                  <div
                    key={l.marketplace_id}
                    onClick={() => setSelected(isSelected ? null : l)}
                    className={`rounded-xl border cursor-pointer transition-all overflow-hidden ${isSelected ? 'border-[#E8660A] shadow-[0_0_0_2px_rgba(232,102,10,0.15)]' : 'border-black/8 hover:border-[#1A2E5A]/30'}`}
                  >
                    <div className="relative h-28 bg-[#F4F5F7]">
                      {l.primary_photo_url ? (
                        <img src={l.primary_photo_url} alt={l.property_name ?? ''} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl opacity-20">🏠</div>
                      )}
                      <span className={`absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeColor}`}>
                        {TYPE_LABELS[typeKey] ?? typeKey}
                      </span>
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#E8660A] flex items-center justify-center">
                          <Check size={11} className="text-white" />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="text-sm font-semibold text-[#1A2E5A] truncate">{l.property_name ?? 'Unnamed listing'}</div>
                      {l.price && <div className="text-sm font-semibold text-[#E8660A] mt-0.5">₱{Number(l.price).toLocaleString()}</div>}
                      {(l.city || l.location) && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                          <MapPin size={10} /> {l.city ?? l.location}
                        </div>
                      )}
                      <div className="flex gap-3 mt-1.5 pt-1.5 border-t border-black/5">
                        {l.bedrooms && <span className="text-[10px] text-gray-500 flex items-center gap-1"><Bed size={10} />{l.bedrooms} BR</span>}
                        {l.bathrooms && <span className="text-[10px] text-gray-500 flex items-center gap-1"><Bath size={10} />{l.bathrooms}</span>}
                        {l.floor_area && <span className="text-[10px] text-gray-500 flex items-center gap-1"><Ruler size={10} />{l.floor_area}sqm</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-black/8 bg-[#F8F9FB]">
          <div className="text-xs text-gray-400">
            {listings.length > 0 && !loading ? `${listings.length} listing${listings.length !== 1 ? 's' : ''} from bahaymo.com` : ''}
            {selected && <span className="ml-3 text-[#E8660A] font-medium">✓ {selected.property_name ?? 'Selected'}</span>}
          </div>
          <div className="flex gap-2">
            <a href="https://bahaymo.com" target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs">
              <ExternalLink size={11} /> View Marketplace
            </a>
            <button onClick={onClose} className="btn-ghost text-xs">Cancel</button>
            <button onClick={handleSelect} disabled={!selected} className="btn-orange text-xs disabled:opacity-40">
              <Check size={12} /> Use This Listing
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
