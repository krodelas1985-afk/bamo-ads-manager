'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Building, Sparkles, Image as ImageIcon, Video, Layout, Upload, Save } from 'lucide-react'

const CREATOMATE_WEBHOOK   = 'https://n8n-bahaymo.onrender.com/webhook/bamo-video-generate'
const CREATOMATE_TEMPLATE  = '7752bc3f-fde2-4592-b521-101c1bfd69cd'
const POLL_INTERVAL_MS     = 3000
const MAX_POLL_ATTEMPTS    = 40  // ~2 min

const SOURCES = [
  { id: 'canva',       label: 'Canva',      sub: 'Branded template',  icon: Layout,    ready: false },
  { id: 'fal',         label: 'Fal.ai',     sub: 'AI-generated',      icon: Sparkles,  ready: false },
  { id: 'creatomate',  label: 'Creatomate', sub: 'Video template',    icon: Video,     ready: true  },
  { id: 'upload',      label: 'Upload',     sub: 'Your own asset',    icon: Upload,    ready: false },
]

const FORMATS = ['Square 1:1', 'Portrait 4:5', 'Story 9:16', 'Landscape 16:9']
const TYPES   = ['image', 'video', 'carousel']

interface CreativeFormProps {
  clientId: string
  listings:  any[]
  contents:  any[]
  assets:    any[]
  defaultContentId?: string
}

interface CreativeResult {
  url:   string
  thumb?: string
  id?:   string
}

export default function CreativeForm({ clientId, listings, contents, assets, defaultContentId }: CreativeFormProps) {
  const router    = useRouter()
  const supabase  = createClient()
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [creativeType,   setCreativeType]   = useState('image')
  const [source,         setSource]         = useState('canva')
  const [format,         setFormat]         = useState('Square 1:1')
  const [listingId,      setListingId]      = useState(listings[0]?.id ?? '')
  const [contentId,      setContentId]      = useState(defaultContentId ?? '')
  const [prompt,         setPrompt]         = useState('')
  const [generating,     setGenerating]     = useState(false)
  const [generatingStep, setGeneratingStep] = useState('')
  const [generated,      setGenerated]      = useState(false)
  const [creativeResult, setCreativeResult] = useState<CreativeResult | null>(null)
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState<string | null>(null)

  const selectedListing = listings.find(l => l.id === listingId)
  const isCreatomateVideo = source === 'creatomate' && creativeType === 'video'

  // ── Polling helper ─────────────────────────────────────────────────────────
  const pollJob = (renderJobId: string, attempts = 0) => {
    if (attempts >= MAX_POLL_ATTEMPTS) {
      setGenerating(false)
      setError('Render timed out — check your Creatomate dashboard.')
      return
    }
    pollTimer.current = setTimeout(async () => {
      const { data: job } = await supabase
        .from('creative_jobs')
        .select('status, error_message')
        .eq('job_id', renderJobId)
        .maybeSingle()

      if (job?.status === 'completed') {
        const { data: creative } = await supabase
          .from('creatives')
          .select('id, asset_url, thumbnail_url')
          .eq('job_id', renderJobId)
          .maybeSingle()
        setCreativeResult({ url: creative?.asset_url ?? '', thumb: creative?.thumbnail_url ?? undefined, id: creative?.id })
        setGenerating(false)
        setGenerated(true)
      } else if (job?.status === 'failed') {
        setGenerating(false)
        setError(job.error_message ?? 'Creatomate render failed.')
      } else {
        pollJob(renderJobId, attempts + 1)
      }
    }, POLL_INTERVAL_MS)
  }

  // ── Generate ───────────────────────────────────────────────────────────────
  async function handleGenerate() {
    setGenerating(true)
    setGenerated(false)
    setCreativeResult(null)
    setError(null)

    try {
      if (isCreatomateVideo) {
        // ── Real webhook path ────────────────────────────────────────────────
        setGeneratingStep('Sending to Creatomate...')

        const res = await fetch(CREATOMATE_WEBHOOK, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id:   clientId,
            data_source: listingId ? 'listing' : 'manual',
            listing_id:  listingId || undefined,
            template_id: CREATOMATE_TEMPLATE,
            prompt_id:   null,
            brand_name:  'BaMo Realty',
          }),
        })

        if (!res.ok) {
          const body = await res.text()
          throw new Error(`Webhook error ${res.status}: ${body}`)
        }

        const data = await res.json()
        if (!data.creatomate_render_id) throw new Error('No render ID returned from webhook.')

        setGeneratingStep('Rendering video… this takes ~30–60s')
        pollJob(data.creatomate_render_id)

      } else {
        // ── Simulated path (Canva / Fal.ai / Upload — backend not yet built) ─
        const steps = [
          'Preparing template...',
          'Applying listing data...',
          'Generating creative...',
          'Almost done...',
        ]
        for (const step of steps) {
          setGeneratingStep(step)
          await new Promise(r => setTimeout(r, 700))
        }
        setGenerating(false)
        setGenerated(true)
      }

    } catch (err: any) {
      setGenerating(false)
      setError(err?.message ?? 'Something went wrong.')
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!generated) return
    setSaving(true)
    try {
      if (isCreatomateVideo && creativeResult?.id) {
        // Row already created by the n8n completion webhook — nothing to insert.
        router.push('/creatives')
        router.refresh()
        return
      }

      // For other sources (mocked), save a placeholder row.
      const { error: dbErr } = await supabase.from('creatives').insert({
        client_id:         clientId,
        creative_type:     creativeType,
        generation_method: source,
        asset_url:         creativeResult?.url ?? '/placeholder-creative.jpg',
        thumbnail_url:     creativeResult?.thumb ?? null,
        job_status:        'completed',
      })
      if (dbErr) throw dbErr

      router.push('/creatives')
      router.refresh()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-5 gap-4 max-w-5xl">

      {/* LEFT — Config */}
      <div className="bamo-card col-span-3 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
          <div className="text-sm font-semibold text-[#1A2E5A] flex items-center gap-2">
            <Sparkles size={15} className="text-[#E8660A]" /> Generate Creative
          </div>
          <div className="flex gap-1.5">
            {SOURCES.filter(s => s.ready).map(s => (
              <span key={s.id} className="text-[10px] font-semibold bg-[#EAF3DE] text-[#3B6D11] px-2 py-0.5 rounded-full">
                {s.label} ✓
              </span>
            ))}
            {SOURCES.filter(s => !s.ready).map(s => (
              <span key={s.id} className="text-[10px] font-semibold bg-[#E8EBF3] text-[#1A2E5A] px-2 py-0.5 rounded-full">
                {s.label}
              </span>
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

          {/* Content (optional) */}
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
                  {t === 'image'    && <ImageIcon size={13} />}
                  {t === 'video'    && <Video size={13} />}
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
              {SOURCES.map(({ id, label, sub, icon: Icon, ready }) => (
                <button
                  key={id}
                  onClick={() => setSource(id)}
                  className={`p-3 rounded-lg border text-left transition-colors relative ${
                    source === id
                      ? 'border-[#E8660A] bg-[#FDE8D8]'
                      : 'border-black/10 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={18} className={source === id ? 'text-[#E8660A]' : 'text-[#1A2E5A]'} />
                  <div className={`text-xs font-semibold mt-1.5 ${source === id ? 'text-[#E8660A]' : 'text-[#1A2E5A]'}`}>
                    {label}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>
                  {!ready && (
                    <span className="absolute top-1.5 right-1.5 text-[9px] font-bold bg-[#E8EBF3] text-[#8a93ad] px-1.5 py-0.5 rounded-full">
                      SOON
                    </span>
                  )}
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

          {/* Prompt / notes */}
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

          {/* Error */}
          {error && (
            <div className="bg-[#FCEBEB] text-[#A32D2D] text-xs rounded-lg px-3 py-2.5">{error}</div>
          )}

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
          {generating && <span className="text-xs text-[#854F0B]">⏳ Processing</span>}
        </div>

        <div className="flex-1 p-4 flex flex-col gap-3">
          <div className={`w-full aspect-square rounded-xl flex flex-col items-center justify-center border-2 transition-all overflow-hidden ${
            generating ? 'border-[#E8660A] border-dashed' : generated ? 'border-[#E8EBF3]' : 'border-dashed border-black/10 bg-[#F4F5F7]'
          }`}>
            {generating ? (
              <div className="flex flex-col items-center gap-3 p-4 text-center">
                <div className="w-8 h-8 border-2 border-[#FDE8D8] border-t-[#E8660A] rounded-full animate-spin" />
                <div className="text-xs text-gray-500">{generatingStep}</div>
                {isCreatomateVideo && (
                  <div className="text-[10px] text-gray-400">Creatomate is encoding your video reel</div>
                )}
              </div>
            ) : generated && creativeResult ? (
              // ── Real Creatomate video preview ──
              isCreatomateVideo ? (
                <video
                  src={creativeResult.url}
                  poster={creativeResult.thumb}
                  controls
                  className="w-full h-full object-contain bg-black"
                />
              ) : (
                // ── Mock preview for other sources ──
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
              )
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
