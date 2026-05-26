'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Building, Home, Map, Store, MapPin, Bed, Bath, Ruler, User, Plus, Megaphone, Image as ImageIcon, FileText, X } from 'lucide-react'

const TYPE_CONFIG: Record<string, { color: string; bg: string; icon: any }> = {
  condo: { color: 'text-[#1A2E5A]', bg: 'bg-[#E8EBF3]', icon: Building },
  house_lot: { color: 'text-[#3B6D11]', bg: 'bg-[#EAF3DE]', icon: Home },
  lot: { color: 'text-[#854F0B]', bg: 'bg-[#FAEEDA]', icon: Map },
  commercial: { color: 'text-[#185FA5]', bg: 'bg-[#E6F1FB]', icon: Store },
}

const TYPE_LABELS: Record<string, string> = {
  condo: 'Condo',
  house_lot: 'House & Lot',
  lot: 'Lot',
  commercial: 'Commercial',
}

interface Listing {
  id: string
  property_name: string | null
  property_type: string | null
  description: string | null
  price: number | null
  location: string | null
  city: string | null
  bedrooms: number | null
  bathrooms: number | null
  floor_area: number | null
  lot_area: number | null
  primary_photo_url: string | null
  listing_url: string | null
  agent_name: string | null
  agent_prc_number: string | null
  agent_email: string | null
  agent_phone: string | null
  snapshotted_at: string
}

interface ListingGridProps {
  listings: Listing[]
  campaignCounts: Record<string, number>
}

export default function ListingGrid({ listings, campaignCounts }: ListingGridProps) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Listing | null>(null)

  const filters = ['all', 'condo', 'house_lot', 'lot', 'commercial']

  const filtered = listings.filter(l => {
    const matchType = filter === 'all' ? true : l.property_type === filter
    const matchSearch = search
      ? [l.property_name, l.city, l.location].some(v => v?.toLowerCase().includes(search.toLowerCase()))
      : true
    return matchType && matchSearch
  })

  if (listings.length === 0) {
    return (
      <div className="bamo-card flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-14 h-14 rounded-full bg-[#E8EBF3] flex items-center justify-center">
          <Building size={24} className="text-[#1A2E5A]" />
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold text-[#1A2E5A]">No listings yet</div>
          <div className="text-xs text-gray-500 mt-1">Add listings from BaMo Marketplace or manually</div>
        </div>
        <Link href="/listings/new" className="btn-orange text-sm">
          <Plus size={14} /> Add Listing
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">

      {/* Detail panel */}
      {selected && (
        <div className="bamo-card border-[1.5px] border-[#E8660A]">
          <div className="bg-[#FDE8D8] px-4 py-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-[#E8660A] flex items-center gap-2">
              <Building size={15} /> {selected.property_name ?? 'Listing Detail'}
            </div>
            <button onClick={() => setSelected(null)} className="text-[#E8660A]">
              <X size={16} />
            </button>
          </div>
          <div className="p-4 grid grid-cols-4 gap-3">
            {[
              { label: 'Price', value: selected.price ? `₱${Number(selected.price).toLocaleString()}` : '—' },
              { label: 'Type', value: TYPE_LABELS[selected.property_type ?? ''] ?? selected.property_type ?? '—' },
              { label: 'Location', value: selected.city ?? selected.location ?? '—' },
              { label: 'Floor area', value: selected.floor_area ? `${selected.floor_area} sqm` : '—' },
              { label: 'Bedrooms', value: selected.bedrooms ? `${selected.bedrooms} BR` : '—' },
              { label: 'Bathrooms', value: selected.bathrooms ? `${selected.bathrooms} Bath` : '—' },
              { label: 'Agent', value: selected.agent_name ?? '—' },
              { label: 'PRC No.', value: selected.agent_prc_number ?? '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</div>
                <div className="text-sm font-medium text-[#1A2E5A] mt-0.5">{value}</div>
              </div>
            ))}
            {selected.description && (
              <div className="col-span-4">
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Description</div>
                <div className="text-xs text-gray-600 leading-relaxed">{selected.description}</div>
              </div>
            )}
          </div>
          <div className="flex gap-2 px-4 py-3 border-t border-black/5">
            <Link href={`/content/new?listing_id=${selected.id}`} className="btn-ghost text-xs">
              <FileText size={12} /> Use in Content
            </Link>
            <Link href={`/creatives/new?listing_id=${selected.id}`} className="btn-ghost text-xs">
              <ImageIcon size={12} /> Create Creative
            </Link>
            <Link href={`/campaigns/new?listing_id=${selected.id}`} className="btn-orange text-xs">
              <Megaphone size={12} /> Use in Campaign
            </Link>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 bg-white rounded-lg border border-black/10 px-3 py-1.5">
          <span className="text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Search listings..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none flex-1"
          />
        </div>
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
              filter === f ? 'bg-[#1A2E5A] text-white' : 'border border-black/10 text-gray-500 hover:bg-gray-50'
            }`}
          >
            {f === 'house_lot' ? 'House & Lot' : f}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="bamo-card flex items-center justify-center py-12 text-xs text-gray-400">
          No listings match this filter
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {filtered.map(l => {
            const typeConf = TYPE_CONFIG[l.property_type ?? ''] ?? TYPE_CONFIG.condo
            const Icon = typeConf.icon
            const campaignCount = campaignCounts[l.id] ?? 0
            const isSelected = selected?.id === l.id

            return (
              <div
                key={l.id}
                onClick={() => setSelected(isSelected ? null : l)}
                className={`bamo-card cursor-pointer transition-all hover:border-[#1A2E5A] ${isSelected ? 'border-[1.5px] border-[#E8660A]' : ''}`}
              >
                {/* Thumb */}
                <div className={`h-28 flex items-center justify-center relative ${typeConf.bg}`}>
                  {l.primary_photo_url ? (
                    <img src={l.primary_photo_url} alt={l.property_name ?? ''} className="w-full h-full object-cover" />
                  ) : (
                    <Icon size={36} className={`${typeConf.color} opacity-30`} />
                  )}
                  <span className={`absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeConf.bg} ${typeConf.color}`}>
                    {TYPE_LABELS[l.property_type ?? ''] ?? l.property_type}
                  </span>
                  {campaignCount > 0 && (
                    <span className="absolute top-2 right-2 text-[9px] font-bold bg-[#1A2E5A]/80 text-white px-1.5 py-0.5 rounded-full">
                      {campaignCount} campaign{campaignCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <div className="text-sm font-semibold text-[#1A2E5A] truncate">{l.property_name ?? 'Unnamed listing'}</div>
                  {l.price && <div className="text-sm font-semibold text-[#E8660A] mt-0.5">₱{Number(l.price).toLocaleString()}</div>}
                  {(l.city || l.location) && (
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                      <MapPin size={11} /> {l.city ?? l.location}
                    </div>
                  )}
                  <div className="flex gap-3 mt-2 pt-2 border-t border-black/5">
                    {l.bedrooms && <span className="text-[11px] text-gray-500 flex items-center gap-1"><Bed size={11} />{l.bedrooms} BR</span>}
                    {l.bathrooms && <span className="text-[11px] text-gray-500 flex items-center gap-1"><Bath size={11} />{l.bathrooms}</span>}
                    {l.floor_area && <span className="text-[11px] text-gray-500 flex items-center gap-1"><Ruler size={11} />{l.floor_area}sqm</span>}
                  </div>
                  {l.agent_name && (
                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-black/5">
                      <div className="w-5 h-5 rounded-full bg-[#E8EBF3] flex items-center justify-center text-[9px] font-semibold text-[#1A2E5A]">
                        {l.agent_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-medium text-[#1A2E5A] truncate">{l.agent_name}</div>
                        {l.agent_prc_number && <div className="text-[10px] text-gray-400">{l.agent_prc_number}</div>}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex border-t border-black/5">
                  <button className="flex-1 py-2 text-[10px] font-medium text-gray-500 hover:bg-[#F4F5F7] transition-colors flex items-center justify-center gap-1">
                    <ImageIcon size={11} /> Creative
                  </button>
                  <div className="w-px bg-black/5" />
                  <Link
                    href={`/campaigns/new?listing_id=${l.id}`}
                    onClick={e => e.stopPropagation()}
                    className="flex-1 py-2 text-[10px] font-semibold text-[#E8660A] hover:bg-[#FDE8D8] transition-colors flex items-center justify-center gap-1"
                  >
                    <Megaphone size={11} /> Use in Ad
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
