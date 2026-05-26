'use client'
import { ExternalLink } from 'lucide-react'

export default function MarketplaceBanner({ count }: { count: number }) {
  return (
    <div className="bg-[#1A2E5A] rounded-xl px-5 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center text-white text-lg">
          🏪
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Connected to BaMo Marketplace</div>
          <div className="text-xs text-white/60 mt-0.5">
            bahaymo.com · {count} listing{count !== 1 ? 's' : ''} · Synced from Marketplace
          </div>
        </div>
      </div>
      <a
        href="https://bahaymo.com"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 bg-[#E8660A] text-white text-xs font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
      >
        <ExternalLink size={12} /> View Marketplace
      </a>
    </div>
  )
}
