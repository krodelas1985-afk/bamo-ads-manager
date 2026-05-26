'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Building, Sparkles, Image as ImageIcon, Video, Layout, Upload, Save } from 'lucide-react'

const SOURCES = [
  { id: 'canva', label: 'Canva', sub: 'Branded template', icon: Layout },
  { id: 'fal_ai', label: 'Fal.ai', sub: 'AI-generated', icon: Sparkles },
  { id: 'creatomate', label: 'Creatomate', sub: 'Video template', icon: Video },
  { id: 'upload', label: 'Upload', sub: 'Your own asset', icon: Upload },
]

const FORMATS = ['Square 1:1', 'Portrait 4:5', 'Story 9:16', 'Landscape 16:9']
const TYPES = ['image', 'video', 'carousel']

interface CreativeFormProps {
  clientId: string
  listings: any[]
  contents: any[]
  assets: any[]
  defaultContentId?: string
}

export default function CreativeForm({ clientId, listings, contents, assets, defaultContentId }: CreativeFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const [creativeType, setCreativeType] = useState('image')
  const [source, setSource] = useState('canva')
  const [format, setFormat] = useState('Square 1:1')
  const [listingId, setListingId] = useState(listings[0]?.id ?? '')
  const [contentId, setContentId] = useState(defaultContentId ?? '')
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatingStep, setGeneratingStep] = useState('')
  const [generated, setGenerated] = useState(false)
  const [saving, setSaving] = useState(false)

  const steps = [
    'Preparing template...',
    'Applying listing data...',
    'Generating creative...',
    'Almost done...',
  ]

  async function handleGenerate() {
    setGenerating(true)
    setGenerated(false)

    for (const step of steps) {
      setGeneratingStep(step)
      await new Promise(r => setTimeout(r, 700))
    }

    setGenerating(false)
    setGenerated(true)
  }

  async function handleSave() {
    if (!generated) return
    setSaving(true)
    try {
      const { error } = await supabase.from('ad_creatives').insert({
        client_id: clientId,
        content_id: contentId || null,
        type: creativeType,
        source,
        asset_url: '/placeholder-creative.jpg', // would be real URL after generation
        status: 'ready',
      })
      if (error) throw error

      // Update usage — wrapped so a missing RPC doesn't block save
      try {
        const thisMonth = new Date().toISOString().slice(0, 7)
        await supabase.rpc('increment_usage', {
          p_client_id: clientId,
          p_month: thisMonth,
          p_type: creativeType === 'video' ? 'video' : 'image',
        })
      } catch {
        // RPC not set up yet — ignore
      }

      router.push('/creatives')
      router.refresh()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const selectedListing = listings.find(l => l.id === listingId)

  return (
    <div className="grid grid-cols-5 gap-4 max-w-5xl">

      {/* LEFT — Config */}
      <div className="bamo-card col-span-3 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
          <div className="text-sm font-semibold text-[#1A2E5A] flex items-center gap-2">
            <Sparkles size={15} className="text-[#E8660A]" /> Generate Creative
          </div>
          <div className="flex gap-1.5">
            {['Canva', 'Fal.ai', 'Creatomate'].map(s => (
              <span key={s} className="text-[10px] font-semibold bg-[#E8EBF3] text-[#1A2E5A] px-2 py-0.5 rounded-full">{s}</span>
            ))}
          </div>
        </div>

        <div className="p-4 flex flex-col gap-4">

          {/* Listing */}
          {listings.length > 0 && (
            <div>
              <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Listing</label>
              <div className="flex items-center gap-2 bg-[#F4F5F7] rounded-lg px-3 py-2.5">
                <Building size={15} className="text-[#1A2E5A] flex-shrink-0" />
                <select
                  className="flex-1 bg-transparent text-sm text-[#1A2E5A] outline-none"
                  value={listingId}
                  onChange={e => setListingId(e.target.value)}
                >
                  {listings.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.property_name ?? 'Unnamed'}{l.price ? ` — ₱${Number(l.price).toLocaleString()}` : ''}{l.city ? ` · ${l.city}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Content */}
          {contents.length > 0 && (
            <div>
              <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">
                Content <span className="text-gray-400 font-normal">optional — use generated copy</span>
              </label>
              <select
                className="bamo-input text-sm"
                value={contentId}
                onChange={e => setContentId(e.target.value)}
              >
                <option value="">No content selected</option>
                {contents.map(c => (
                  <option key={c.id} value={c.id}>{c.title ?? c.hook ?? 'Untitled content'}</option>
                ))}
              </select>
            </div>
          )}

          {/* Creative type */}
          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Creative type</label>
            <div className="flex gap-2">
              {TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => setCreativeType(t)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize transition-colors flex items-center justify-center gap-1.5 ${
                    creativeType === t ? 'bg-[#1A2E5A] text-white' : 'border border-black/10 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {t === 'image' && <ImageIcon size={13} />}
                  {t === 'video' && <Video size={13} />}
                  {t === 'carousel' && <Layout size={13} />}
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Source */}
          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Generation source</label>
            <div className="grid grid-cols-2 gap-2">
              {SOURCES.map(({ id, label, sub, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setSource(id)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    source === id
                      ? 'border-[#E8660A] bg-[#FDE8D8]'
                      : 'border-black/10 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={18} className={source === id ? 'text-[#E8660A]' : 'text-[#1A2E5A]'} />
                  <div className={`text-xs font-semibold mt-1.5 ${source === id ? 'text-[#E8660A]' : 'text-[#1A2E5A]'}`}>{label}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Format */}
          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Format</label>
            <div className="flex flex-wrap gap-1.5">
              {FORMATS.map(f => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    format === f ? 'bg-[#1A2E5A] text-white' : 'border border-black/10 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt */}
          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">
              Extra notes <span className="text-gray-400 font-normal">optional</span>
            </label>
            <input
              className="bamo-input text-sm"
              type="text"
              placeholder="e.g. bright natural light, modern interior, warm colors"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-orange w-full justify-center py-2.5"
          >
            <Sparkles size={14} />
            {generating ? generatingStep : 'Generate Creative'}
          </button>

        </div>
      </div>

      {/* RIGHT — Preview */}
      <div className="bamo-card col-span-2 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
          <div className="text-sm font-semibold text-[#1A2E5A]">Preview</div>
          {generated && <span className="text-xs text-[#3B6D11]">✅ Ready</span>}
        </div>

        {/* Preview area */}
        <div className="flex-1 p-4 flex flex-col gap-3">
          <div className={`w-full aspect-square rounded-xl flex flex-col items-center justify-center border-2 transition-all ${
            generating ? 'border-[#E8660A] border-dashed' : generated ? 'border-[#E8EBF3]' : 'border-dashed border-black/10 bg-[#F4F5F7]'
          }`}>
            {generating ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-[#FDE8D8] border-t-[#E8660A] rounded-full animate-spin" />
                <div className="text-xs text-gray-500">{generatingStep}</div>
              </div>
            ) : generated ? (
              <div className="w-full h-full bg-[#E8EBF3] rounded-xl flex flex-col items-center justify-center gap-2 relative overflow-hidden">
                <Building size={40} className="text-[#1A2E5A] opacity-30" />
                {selectedListing && (
                  <>
                    <div className="text-xs font-semibold text-[#1A2E5A] text-center px-3">{selectedListing.property_name}</div>
                    <div className="text-[10px] text-gray-500">{selectedListing.city}</div>
                  </>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-[#E8660A] py-2 text-center">
                  <div className="text-[10px] font-semibold text-white">Message us for a free site visit!</div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <ImageIcon size={32} className="opacity-30" />
                <div className="text-xs text-center">Preview appears here after generation</div>
              </div>
            )}
          </div>

          {generated && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button onClick={handleGenerate} className="btn-ghost text-xs flex-1 justify-center py-2">
                  🔄 Redo
                </button>
                <button onClick={handleSave} disabled={saving} className="btn-navy text-xs flex-1 justify-center py-2">
                  <Save size={12} /> {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
              <button onClick={handleSave} disabled={saving} className="btn-orange text-xs w-full justify-center py-2">
                Use in Campaign →
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
