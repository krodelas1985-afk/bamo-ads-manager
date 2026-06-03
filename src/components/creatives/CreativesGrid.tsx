'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Image, Video, Plus, Clock } from 'lucide-react'

const methodLabels: Record<string, string> = {
  canva: 'Canva',
  fal: 'Fal.ai',
  creatomate: 'Creatomate',
  upload: 'Upload',
  pexels: 'Pexels',
}

// Map new job_status values to display styles
const statusStyles: Record<string, string> = {
  completed:  'bg-[#EAF3DE]',
  processing: 'bg-[#FAEEDA]',
  pending:    'bg-[#FAEEDA]',
  failed:     'bg-[#FCEBEB]',
}

interface Creative {
  id: string
  creative_type: string
  generation_method: string
  asset_url: string
  thumbnail_url: string | null
  job_status: string
  duration_seconds: number | null
  created_at: string
}

export default function CreativesGrid({ creatives }: { creatives: Creative[] }) {
  const [tab, setTab] = useState<'generate' | 'library'>('library')
  const [typeFilter, setTypeFilter] = useState('all')

  const filtered = creatives.filter(c =>
    typeFilter === 'all' ? true : c.creative_type === typeFilter
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Tab row */}
      <div className="flex gap-1 bg-white rounded-xl border border-black/10 p-1.5 w-fit">
        {(['library', 'generate'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-[#1A2E5A] text-white' : 'text-gray-500 hover:text-[#1A2E5A]'
            }`}
          >
            {t === 'library' ? 'Creative Library' : 'Generate New'}
          </button>
        ))}
      </div>

      {tab === 'generate' ? (
        <Link href="/creatives/new" className="bamo-card p-8 flex flex-col items-center gap-3 hover:border-[#E8660A] transition-colors cursor-pointer">
          <div className="w-14 h-14 rounded-full bg-[#FDE8D8] flex items-center justify-center">
            <Plus size={24} className="text-[#E8660A]" />
          </div>
          <div className="text-sm font-semibold text-[#1A2E5A]">Generate a new creative</div>
          <div className="text-xs text-gray-500">Images from Canva or Fal.ai · Videos from Creatomate</div>
          <span className="btn-orange text-sm">Start Generating</span>
        </Link>
      ) : (
        <>
          {/* Filter row */}
          <div className="flex gap-2">
            {['all', 'image', 'video', 'carousel'].map(f => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                  typeFilter === f
                    ? 'bg-[#1A2E5A] text-white'
                    : 'border border-black/10 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Grid */}
          {filtered.length === 0 ? (
            <div className="bamo-card flex flex-col items-center justify-center py-16 gap-3">
              <div className="text-4xl">🎨</div>
              <div className="text-sm font-semibold text-[#1A2E5A]">No creatives yet</div>
              <div className="text-xs text-gray-500">Generate your first image or video creative</div>
              <Link href="/creatives/new" className="btn-orange text-sm">
                <Plus size={14} /> Generate Creative
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {filtered.map(c => (
                <div key={c.id} className="bamo-card hover:border-[#1A2E5A] transition-colors cursor-pointer group">
                  {/* Thumb */}
                  <div className={`aspect-square flex items-center justify-center relative ${
                    c.creative_type === 'video' ? 'bg-[#FDE8D8]' : 'bg-[#E8EBF3]'
                  }`}>
                    {c.thumbnail_url || c.asset_url ? (
                      <img
                        src={c.thumbnail_url ?? c.asset_url}
                        alt="Creative"
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      c.creative_type === 'video'
                        ? <Video size={32} className="text-[#E8660A] opacity-40" />
                        : <Image size={32} className="text-[#1A2E5A] opacity-40" />
                    )}

                    {/* Type badge */}
                    <span className="absolute top-1.5 left-1.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-[#1A2E5A]/80 text-white">
                      {c.creative_type}
                    </span>

                    {/* Status dot */}
                    <div className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${statusStyles[c.job_status] ?? 'bg-gray-200'}`} />

                    {/* Video duration */}
                    {c.creative_type === 'video' && c.duration_seconds && (
                      <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold bg-black/50 text-white px-1.5 py-0.5 rounded">
                        {Math.floor(c.duration_seconds / 60)}:{String(c.duration_seconds % 60).padStart(2, '0')}
                      </span>
                    )}

                    {/* Processing overlay */}
                    {(c.job_status === 'pending' || c.job_status === 'processing') && (
                      <div className="absolute inset-0 bg-[#FAEEDA]/70 flex items-center justify-center">
                        <Clock size={20} className="text-[#854F0B]" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-2.5">
                    <div className="text-xs font-medium text-[#1A2E5A] truncate capitalize">
                      {methodLabels[c.generation_method] ?? c.generation_method} · {c.creative_type}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(c.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex border-t border-black/5">
                    <a
                      href={c.asset_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 py-1.5 text-[10px] font-medium text-gray-500 hover:bg-[#F4F5F7] transition-colors text-center"
                    >
                      Preview
                    </a>
                    <div className="w-px bg-black/5" />
                    <Link
                      href={`/campaigns/new?creative_id=${c.id}`}
                      className="flex-1 py-1.5 text-[10px] font-medium text-[#E8660A] hover:bg-[#FDE8D8] transition-colors text-center"
                    >
                      Use
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
