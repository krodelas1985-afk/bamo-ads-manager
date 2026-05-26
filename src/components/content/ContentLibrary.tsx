'use client'
import { useState } from 'react'
import Link from 'next/link'
import { FileText, Wand2, Plus, Facebook, Instagram, Linkedin } from 'lucide-react'

const platformIcons: Record<string, any> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
}

const platformColors: Record<string, string> = {
  facebook: 'bg-[#E8EBF3] text-[#1A2E5A]',
  instagram: 'bg-[#FDE8D8] text-[#E8660A]',
  linkedin: 'bg-[#E6F1FB] text-[#185FA5]',
}

const statusColors: Record<string, string> = {
  approved: 'bg-[#EAF3DE] text-[#3B6D11]',
  draft: 'bg-[#F1EFE8] text-[#5F5E5A]',
  archived: 'bg-[#F1EFE8] text-[#5F5E5A]',
}

interface Content {
  id: string
  title: string | null
  platform: string | null
  tone: string | null
  caption: string | null
  hook: string | null
  hashtags: string[] | null
  cta: string | null
  status: string
  ai_generated: boolean
  created_at: string
}

export default function ContentLibrary({ contents }: { contents: Content[] }) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const filters = ['all', 'approved', 'draft', 'ai']

  const filtered = contents.filter(c => {
    const matchFilter = filter === 'all' ? true
      : filter === 'ai' ? c.ai_generated
      : c.status === filter
    const matchSearch = search
      ? (c.title ?? c.caption ?? '').toLowerCase().includes(search.toLowerCase())
      : true
    return matchFilter && matchSearch
  })

  if (contents.length === 0) {
    return (
      <div className="bamo-card flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-14 h-14 rounded-full bg-[#FDE8D8] flex items-center justify-center">
          <FileText size={24} className="text-[#E8660A]" />
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold text-[#1A2E5A]">No content yet</div>
          <div className="text-xs text-gray-500 mt-1">Create your first piece of content or let BaMo generate it</div>
        </div>
        <Link href="/content/new" className="btn-orange text-sm">
          <Plus size={14} /> Create Content
        </Link>
      </div>
    )
  }

  return (
    <div className="bamo-card flex flex-col">
      {/* Filter bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-black/5">
        <div className="flex-1 flex items-center gap-2 bg-[#F4F5F7] rounded-lg px-3 py-1.5">
          <span className="text-gray-400">🔍</span>
          <input
            type="text"
            placeholder="Search content..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none flex-1 text-gray-700"
          />
        </div>
        <div className="flex gap-1.5">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${
                filter === f
                  ? 'bg-[#1A2E5A] text-white'
                  : 'border border-black/10 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {f === 'ai' ? 'AI Generated' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Content grid */}
      {filtered.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-xs text-gray-400">
          No content matches this filter
        </div>
      ) : (
        <div className="divide-y divide-black/5">
          {filtered.map(c => {
            const PlatformIcon = c.platform ? platformIcons[c.platform] : FileText
            return (
              <div key={c.id} className="flex items-start gap-3 px-4 py-4 hover:bg-[#F4F5F7] transition-colors">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${c.platform ? platformColors[c.platform] : 'bg-[#E8EBF3] text-[#1A2E5A]'}`}>
                  <PlatformIcon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-sm font-medium text-[#1A2E5A] truncate">
                      {c.title ?? c.hook ?? 'Untitled'}
                    </div>
                    {c.ai_generated && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-[#E8EBF3] text-[#1A2E5A] px-2 py-0.5 rounded-full flex-shrink-0">
                        <Wand2 size={9} /> AI
                      </span>
                    )}
                    <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statusColors[c.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {c.status}
                    </span>
                  </div>
                  {c.caption && (
                    <div className="text-xs text-gray-500 line-clamp-2">{c.caption}</div>
                  )}
                  {c.hashtags && c.hashtags.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {c.hashtags.slice(0, 4).map(h => (
                        <span key={h} className="text-[10px] text-[#185FA5] bg-[#E6F1FB] px-1.5 py-0.5 rounded-full">{h}</span>
                      ))}
                    </div>
                  )}
                  <div className="text-[10px] text-gray-400 mt-1.5 capitalize">
                    {c.platform} · {c.tone} · {new Date(c.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <Link href={`/creatives/new?content_id=${c.id}`} className="text-xs px-2.5 py-1.5 rounded-lg border border-black/10 text-gray-600 hover:bg-gray-50 transition-colors">
                    Creative
                  </Link>
                  <Link href={`/content/${c.id}`} className="text-xs px-2.5 py-1.5 rounded-lg bg-[#1A2E5A] text-white hover:opacity-90 transition-opacity">
                    Edit
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
