'use client'
import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  Building, Sparkles, Image as ImageIcon, Video,
  Layout, Upload, Save, Plus, X, ExternalLink, Check
} from 'lucide-react'
import Link from 'next/link'

const GENERATE_ENDPOINT = '/api/creatives/generate'
const POLL_INTERVAL_MS    = 3000
const MAX_POLL_ATTEMPTS   = 40

const SOURCES = [
  { id: 'canva',      label: 'Canva',      sub: 'Branded template', icon: Layout,    ready: false },
  { id: 'fal',        label: 'Fal.ai',     sub: 'AI-generated',     icon: Sparkles,  ready: false },
  { id: 'creatomate', label: 'Creatomate', sub: 'Video template',   icon: Video,     ready: true  },
  { id: 'upload',     label: 'Upload',     sub: 'Your own asset',   icon: Upload,    ready: false },
]

const FORMATS = ['Square 1:1', 'Portrait 4:5', 'Story 9:16', 'Landscape 16:9']
const TYPES   = ['image', 'video', 'carousel']

const PHOTO_SLOTS = [
  { key: 'photo1', label: 'Photo 1' },
  { key: 'photo2', label: 'Photo 2' },
  { key: 'photo3', label: 'Photo 3' },
  { key: 'photo4', label: 'Photo 4' },
  { key: 'photo5', label: 'Photo 5' },
  { key: 'agentPhoto', label: 'Agent' },
] as const

type PhotoKey = typeof PHOTO_SLOTS[number]['key']

interface Asset {
  id: string
  file_name: string
  public_url: string
  file_type: string
  thumbnail_url: string | null
}

interface Template {
  id: string
  client_id: string | null
  name: string
  template_id: string
  thumbnail_url: string | null
  is_default: boolean | null
}

interface CreativeFormProps {
  clientId: string | null
  clientName: string | null
  clients?: { id: string; name: string }[]
  templates: Template[]
  listings: any[]
  contents: any[]
  assets: Asset[]
  defaultContentId?: string
}

interface CreativeResult { url: string; thumb?: string; id?: string }

type DataSource = 'listing' | 'assets'

export default function CreativeForm({ clientId, clientName, clients = [], templates, listings, contents, assets, defaultContentId }: CreativeFormProps) {
  const router   = useRouter()
  const supabase = createClient()
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [activeClientId, setActiveClientId] = useState<string | null>(clientId ?? clients[0]?.id ?? null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    templates.find(t => t.is_default)?.template_id ?? templates[0]?.template_id ?? ''
  )
  const [creativeType,   setCreativeType]   = useState('image')
  const [source,         setSource]         = useState('canva')
  const [format,         setFormat]         = useState('Square 1:1')
  const [dataSource,     setDataSource]     = useState<DataSource>('listing')
  const [listingId,      setListingId]      = useState('')
  const [contentId,      setContentId]      = useState(defaultContentId ?? '')
  const [prompt,         setPrompt]         = useState('')

  // Asset picker state
  const [selectedPhotos, setSelectedPhotos] = useState<Record<PhotoKey, string>>({
    photo1: '', photo2: '', photo3: '', photo4: '', photo5: '', agentPhoto: '',
  })
  const [activePicker, setActivePicker] = useState<PhotoKey | null>(null)
  const [manualInfo, setManualInfo] = useState({
    address: '', details1: '', details2: '', agentName: '', agentEmail: '', agentPhone: '',
  })

  // Generation state
  const [generating,     setGenerating]     = useState(false)
  const [generatingStep, setGeneratingStep] = useState('')
  const [generated,      setGenerated]      = useState(false)
  const [creativeResult, setCreativeResult] = useState<CreativeResult | null>(null)
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState<string | null>(null)

  const isAdmin = clients.length > 0
  const activeClientName = isAdmin
    ? (clients.find(c => c.id === activeClientId)?.name ?? 'BaMo Realty')
    : (clientName ?? 'BaMo Realty')
  const visibleTemplates = templates.filter(t => t.client_id === null || t.client_id === activeClientId)
  const scopedListings = isAdmin ? listings.filter((l: any) => l.client_id === activeClientId) : listings
  const scopedAssets = isAdmin ? assets.filter((a: any) => (a as any).client_id === activeClientId) : assets

  const isCreatomateVideo = source === 'creatomate' && creativeType === 'video'
  const selectedListing   = scopedListings.find((l: any) => l.id === listingId)
  const imageAssets       = scopedAssets.filter((a: any) => a.file_type === 'image')

  useEffect(() => {
    setListingId(scopedListings[0]?.id ?? '')
    setSelectedPhotos({ photo1: '', photo2: '', photo3: '', photo4: '', photo5: '', agentPhoto: '' })
  }, [activeClientId]) // eslint-disable-line react-hooks/exhaustive-deps

  function pickPhoto(key: PhotoKey, url: string) {
    setSelectedPhotos((prev: Record<PhotoKey, string>) => ({ ...prev, [key]: url }))
    setActivePicker(null)
  }

  function clearSlot(key: PhotoKey, e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    setSelectedPhotos((prev: Record<PhotoKey, string>) => ({ ...prev, [key]: '' }))
    if (activePicker === key) setActivePicker(null)
  }

  // ── Polling ────────────────────────────────────────────────────────────────
  function pollJob(renderJobId: string, attempts = 0) {
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
        setGeneratingStep('Sending to Creatomate...')

        if (!activeClientId) throw new Error('Select a client first.')
        if (!selectedTemplateId) throw new Error('Select a template first.')

        const payload: Record<string, any> = {
          client_id:   activeClientId,
          template_id: selectedTemplateId,
          prompt_id:   null,
          brand_name:  activeClientName,
        }

        if (dataSource === 'listing' && listingId) {
          payload.data_source = 'listing'
          payload.listing_id  = listingId
        } else {
          payload.data_source  = 'manual'
          payload.manual_data  = {
            photo1:     selectedPhotos.photo1,
            photo2:     selectedPhotos.photo2,
            photo3:     selectedPhotos.photo3,
            photo4:     selectedPhotos.photo4,
            photo5:     selectedPhotos.photo5,
            agentPhoto: selectedPhotos.agentPhoto,
            address:    manualInfo.address,
            details1:   manualInfo.details1,
            details2:   manualInfo.details2,
            agentName:  manualInfo.agentName,
            agentEmail: manualInfo.agentEmail,
            agentPhone: manualInfo.agentPhone,
            brandName:  activeClientName,
          }
        }

        const res = await fetch(GENERATE_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
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
        // Simulated path for other sources
        const steps = ['Preparing template...', 'Applying listing data...', 'Generating creative...', 'Almost done...']
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
        router.push('/creatives')
        router.refresh()
        return
      }
      await supabase.from('creatives').insert({
        client_id: activeClientId, creative_type: creativeType, generation_method: source,
        asset_url: creativeResult?.url ?? '/placeholder-creative.jpg',
        thumbnail_url: creativeResult?.thumb ?? null, job_status: 'completed',
      })
      router.push('/creatives')
      router.refresh()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
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
              <span key={s.id} className="text-[10px] font-semibold bg-[#EAF3DE] text-[#3B6D11] px-2 py-0.5 rounded-full">{s.label} ✓</span>
            ))}
            {SOURCES.filter(s => !s.ready).map(s => (
              <span key={s.id} className="text-[10px] font-semibold bg-[#E8EBF3] text-[#1A2E5A] px-2 py-0.5 rounded-full">{s.label}</span>
            ))}
          </div>
        </div>

        <div className="p-4 flex flex-col gap-4">

          {/* Client selector — baymo_admin only */}
          {isAdmin && (
            <div>
              <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Client</label>
              <div className="flex items-center gap-3 bg-[#F4F5F7] rounded-lg px-3 py-2.5">
                <select
                  className="flex-1 bg-transparent text-sm text-[#1A2E5A] outline-none"
                  value={activeClientId ?? ''}
                  onChange={e => setActiveClientId(e.target.value || null)}
                >
                  <option value="">Select a client…</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Creative type */}
          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Creative type</label>
            <div className="flex gap-2">
              {TYPES.map(t => (
                <button key={t} onClick={() => setCreativeType(t)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize transition-colors flex items-center justify-center gap-1.5 ${
                    creativeType === t ? 'bg-[#1A2E5A] text-white' : 'border border-black/10 text-gray-500 hover:bg-gray-50'
                  }`}>
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
              {SOURCES.map(({ id, label, sub, icon: Icon, ready }) => (
                <button key={id} onClick={() => setSource(id)}
                  className={`p-3 rounded-lg border text-left transition-colors relative ${
                    source === id ? 'border-[#E8660A] bg-[#FDE8D8]' : 'border-black/10 hover:bg-gray-50'
                  }`}>
                  <Icon size={18} className={source === id ? 'text-[#E8660A]' : 'text-[#1A2E5A]'} />
                  <div className={`text-xs font-semibold mt-1.5 ${source === id ? 'text-[#E8660A]' : 'text-[#1A2E5A]'}`}>{label}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>
                  {!ready && (
                    <span className="absolute top-1.5 right-1.5 text-[9px] font-bold bg-[#E8EBF3] text-[#8a93ad] px-1.5 py-0.5 rounded-full">SOON</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── Creatomate-specific: template ── */}
          {isCreatomateVideo && (
            <div>
              <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Template</label>
              {visibleTemplates.length === 0 ? (
                <div className="bg-[#F4F5F7] rounded-lg px-3 py-3 text-xs text-gray-400 text-center">
                  No video templates registered yet.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {visibleTemplates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplateId(t.template_id)}
                      className={`rounded-lg border text-left overflow-hidden transition-colors ${
                        selectedTemplateId === t.template_id ? 'border-[#E8660A] bg-[#FDE8D8]' : 'border-black/10 hover:bg-gray-50'
                      }`}
                    >
                      {t.thumbnail_url ? (
                        <img src={t.thumbnail_url} alt={t.name} className="w-full h-20 object-cover" />
                      ) : (
                        <div className="w-full h-20 bg-[#1A2E5A] flex items-center justify-center text-white">
                          <Video size={18} />
                        </div>
                      )}
                      <div className="px-2.5 py-1.5">
                        <div className={`text-[11px] font-semibold truncate ${selectedTemplateId === t.template_id ? 'text-[#E8660A]' : 'text-[#1A2E5A]'}`}>
                          {t.name}
                        </div>
                        <div className="text-[9px] text-gray-400">
                          {t.client_id === null ? 'Global' : 'Client-exclusive'}{t.is_default ? ' · Default' : ''}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Creatomate-specific: data source ── */}
          {isCreatomateVideo && (
            <div>
              <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Photo source</label>
              <div className="flex gap-2 mb-3">
                <button onClick={() => setDataSource('listing')}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    dataSource === 'listing' ? 'bg-[#1A2E5A] text-white' : 'border border-black/10 text-gray-500 hover:bg-gray-50'
                  }`}>
                  <Building size={13} /> From Listing
                </button>
                <button onClick={() => setDataSource('assets')}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    dataSource === 'assets' ? 'bg-[#1A2E5A] text-white' : 'border border-black/10 text-gray-500 hover:bg-gray-50'
                  }`}>
                  <ImageIcon size={13} /> Pick from Library
                </button>
              </div>

              {/* From Listing */}
              {dataSource === 'listing' && scopedListings.length > 0 && (
                <div className="flex items-center gap-2 bg-[#F4F5F7] rounded-lg px-3 py-2.5">
                  <Building size={15} className="text-[#1A2E5A] flex-shrink-0" />
                  <select className="flex-1 bg-transparent text-sm text-[#1A2E5A] outline-none"
                    value={listingId} onChange={e => setListingId(e.target.value)}>
                    {scopedListings.map((l: any) => (
                      <option key={l.id} value={l.id}>
                        {l.property_name ?? 'Unnamed'}{l.price ? ` — ₱${Number(l.price).toLocaleString()}` : ''}{l.city ? ` · ${l.city}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Pick from Library */}
              {dataSource === 'assets' && (
                <div className="flex flex-col gap-3">

                  {/* Photo slots */}
                  <div className="grid grid-cols-3 gap-2">
                    {PHOTO_SLOTS.map(({ key, label }) => {
                      const url = selectedPhotos[key]
                      const isActive = activePicker === key
                      return (
                        <div key={key}>
                          <div className="text-[10px] font-medium text-gray-500 mb-1">{label}</div>
                          <button
                            onClick={() => setActivePicker(isActive ? null : key)}
                            className={`w-full aspect-square rounded-lg border-2 flex items-center justify-center overflow-hidden relative transition-all ${
                              isActive ? 'border-[#E8660A]' : url ? 'border-[#1A2E5A]' : 'border-dashed border-black/15 hover:border-[#E8660A] bg-[#F4F5F7]'
                            }`}>
                            {url ? (
                              <>
                                <img src={url} alt={label} className="w-full h-full object-cover" />
                                <button onClick={e => clearSlot(key, e)}
                                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center hover:bg-red-500 transition-colors">
                                  <X size={10} className="text-white" />
                                </button>
                                {isActive && (
                                  <div className="absolute inset-0 bg-[#E8660A]/20 flex items-center justify-center">
                                    <Check size={18} className="text-[#E8660A]" />
                                  </div>
                                )}
                              </>
                            ) : (
                              <Plus size={20} className={isActive ? 'text-[#E8660A]' : 'text-gray-300'} />
                            )}
                          </button>
                        </div>
                      )
                    })}
                  </div>

                  {/* Inline asset picker */}
                  {activePicker !== null && (
                    <div className="border border-black/10 rounded-xl bg-[#F8F9FC] p-3">
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="text-xs font-semibold text-[#1A2E5A]">
                          Pick for {PHOTO_SLOTS.find(s => s.key === activePicker)?.label}
                        </div>
                        <Link href="/assets" target="_blank"
                          className="text-[10px] text-[#E8660A] font-medium flex items-center gap-1 hover:underline">
                          Manage Library <ExternalLink size={10} />
                        </Link>
                      </div>

                      {imageAssets.length === 0 ? (
                        <div className="text-center py-6">
                          <div className="text-2xl mb-1.5">📂</div>
                          <div className="text-xs text-gray-500 mb-2">No images uploaded yet</div>
                          <Link href="/assets" target="_blank" className="btn-orange text-xs py-1.5 px-3">
                            <Upload size={11} /> Go to Asset Library
                          </Link>
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                          {imageAssets.map(asset => {
                            const isChosen = selectedPhotos[activePicker] === asset.public_url
                            return (
                              <button key={asset.id} onClick={() => pickPhoto(activePicker, asset.public_url)}
                                className={`aspect-square rounded-lg overflow-hidden border-2 transition-all relative ${
                                  isChosen ? 'border-[#E8660A]' : 'border-transparent hover:border-[#1A2E5A]'
                                }`}>
                                <img
                                  src={asset.thumbnail_url ?? asset.public_url}
                                  alt={asset.file_name}
                                  className="w-full h-full object-cover"
                                />
                                {isChosen && (
                                  <div className="absolute inset-0 bg-[#E8660A]/20 flex items-center justify-center">
                                    <Check size={16} className="text-[#E8660A]" />
                                  </div>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Manual info fields */}
                  <div className="border-t border-black/5 pt-3">
                    <div className="text-xs font-medium text-[#1A2E5A] mb-2">Property & Agent Info</div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'address',   label: 'Address',      placeholder: 'Lipa City, Batangas' },
                        { key: 'details2',  label: 'Price',        placeholder: 'PHP 5,000,000' },
                        { key: 'details1',  label: 'Details',      placeholder: '120 sqm · 3 Bed · 2 Bath' },
                        { key: 'agentName', label: 'Agent Name',   placeholder: 'Your Name' },
                        { key: 'agentEmail',label: 'Agent Email',  placeholder: 'you@email.com' },
                        { key: 'agentPhone',label: 'Agent Phone',  placeholder: '0917 000 0000' },
                      ].map(({ key, label, placeholder }) => (
                        <label key={key} className="block">
                          <div className="text-[10px] font-semibold text-gray-500 mb-1">{label}</div>
                          <input
                            className="bamo-input text-xs"
                            placeholder={placeholder}
                            value={manualInfo[key as keyof typeof manualInfo]}
                            onChange={e => setManualInfo((prev: typeof manualInfo) => ({ ...prev, [key]: e.target.value }))}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Non-Creatomate: listing dropdown */}
          {!isCreatomateVideo && scopedListings.length > 0 && (
            <div>
              <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Listing</label>
              <div className="flex items-center gap-2 bg-[#F4F5F7] rounded-lg px-3 py-2.5">
                <Building size={15} className="text-[#1A2E5A] flex-shrink-0" />
                <select className="flex-1 bg-transparent text-sm text-[#1A2E5A] outline-none"
                  value={listingId} onChange={e => setListingId(e.target.value)}>
                  {scopedListings.map((l: any) => (
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
                Content <span className="text-gray-400 font-normal">optional</span>
              </label>
              <select className="bamo-input text-sm" value={contentId} onChange={e => setContentId(e.target.value)}>
                <option value="">No content selected</option>
                {contents.map(c => (
                  <option key={c.id} value={c.id}>{c.title ?? c.hook ?? 'Untitled content'}</option>
                ))}
              </select>
            </div>
          )}

          {/* Format */}
          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Format</label>
            <div className="flex flex-wrap gap-1.5">
              {FORMATS.map(f => (
                <button key={f} onClick={() => setFormat(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    format === f ? 'bg-[#1A2E5A] text-white' : 'border border-black/10 text-gray-500 hover:bg-gray-50'
                  }`}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">
              Extra notes <span className="text-gray-400 font-normal">optional</span>
            </label>
            <input className="bamo-input text-sm" type="text"
              placeholder="e.g. bright natural light, modern interior"
              value={prompt} onChange={e => setPrompt(e.target.value)} />
          </div>

          {error && (
            <div className="bg-[#FCEBEB] text-[#A32D2D] text-xs rounded-lg px-3 py-2.5">{error}</div>
          )}

          <button onClick={handleGenerate} disabled={generating} className="btn-orange w-full justify-center py-2.5">
            <Sparkles size={14} />
            {generating ? generatingStep : 'Generate Creative'}
          </button>
        </div>
      </div>

      {/* RIGHT — Preview */}
      <div className="bamo-card col-span-2 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
          <div className="text-sm font-semibold text-[#1A2E5A]">Preview</div>
          {generated  && <span className="text-xs text-[#3B6D11]">✅ Ready</span>}
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
              isCreatomateVideo ? (
                <video src={creativeResult.url} poster={creativeResult.thumb} controls
                  className="w-full h-full object-contain bg-black" />
              ) : (
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
                <button onClick={handleGenerate} className="btn-ghost text-xs flex-1 justify-center py-2">🔄 Redo</button>
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
