'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Facebook, Instagram, Send, Calendar,
  BarChart2, Edit, Clock, Copy, Trash2, CheckCircle, AlertTriangle, RotateCcw, X, Sparkles, Image as ImageIcon
} from 'lucide-react'
import AssetPicker, { type PickerItem } from './AssetPicker'

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-[#E8EBF3] text-[#1A2E5A]',
  publishing: 'bg-[#FDE8D8] text-[#E8660A]',
  published: 'bg-[#EAF3DE] text-[#3B6D11]',
  draft: 'bg-[#F1EFE8] text-[#5F5E5A]',
  failed: 'bg-[#FCEBEB] text-[#A32D2D]',
  cancelled: 'bg-[#F1EFE8] text-[#5F5E5A]',
}

const PLATFORM_CONFIG: Record<string, { icon: any; bg: string; color: string }> = {
  facebook: { icon: Facebook, bg: 'bg-[#E8EBF3]', color: 'text-[#1A2E5A]' },
  instagram: { icon: Instagram, bg: 'bg-[#FDE8D8]', color: 'text-[#E8660A]' },
}

const POST_TYPES = [
  { id: 'feed', enabled: true },
  { id: 'carousel', enabled: true },
  { id: 'reel', enabled: false },
  { id: 'story', enabled: false },
]
const PLATFORMS = ['facebook', 'instagram']

interface Post {
  id: string
  client_id: string | null
  social_account_id: string | null
  creative_id: string | null
  content_id: string | null
  platform: string
  post_type: string | null
  status: string
  message: string | null
  link_url: string | null
  media_urls: string[] | null
  error_message: string | null
  scheduled_at: string | null
  published_at: string | null
  meta_post_id: string | null
  created_at: string
}

interface SocialAccount {
  id: string
  client_id: string | null
  platform: string
  account_id: string
  account_name: string | null
}

interface Creative {
  id: string
  client_id: string
  creative_type: string
  asset_url: string
  thumbnail_url: string | null
}

interface Content {
  id: string
  client_id: string
  title: string | null
  caption: string | null
  hook: string | null
  hashtags: string[] | null
}

interface Listing {
  id: string
  client_id: string | null
  property_name: string | null
  price: number | null
  city: string | null
  listing_url: string | null
}

interface Asset {
  id: string
  client_id: string | null
  file_type: string
  public_url: string
  thumbnail_url: string | null
  file_name: string
}

interface Props {
  role: string
  posts: Post[]
  socialAccounts: SocialAccount[]
  creatives: Creative[]
  contents: Content[]
  listings: Listing[]
  clients: { id: string; name: string }[]
  assets: Asset[]
  defaultClientId: string | null
}

export default function PostsClient({
  role, posts: initialPosts, socialAccounts, creatives, contents, listings, clients, assets, defaultClientId,
}: Props) {
  const router = useRouter()
  const isAdmin = role === 'baymo_admin'

  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Compose form state
  const [selectedClientId, setSelectedClientId] = useState<string>(
    defaultClientId ?? clients[0]?.id ?? ''
  )
  const [platforms, setPlatforms] = useState<string[]>(['facebook'])
  const [postType, setPostType] = useState('feed')
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [creativeId, setCreativeId] = useState('')
  const [mediaItems, setMediaItems] = useState<PickerItem[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const skipMediaClear = useRef(false)
  const [contentId, setContentId] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('09:00')
  const [editingId, setEditingId] = useState<string | null>(null)

  // Compose-with-AI state
  const [aiOpen, setAiOpen] = useState(false)
  const [aiGoal, setAiGoal] = useState('listing_promotion')
  const [aiTone, setAiTone] = useState('friendly')
  const [aiLanguage, setAiLanguage] = useState<'english' | 'taglish' | 'tagalog'>('english')
  const [aiListingId, setAiListingId] = useState('')
  const [aiInstructions, setAiInstructions] = useState('')
  const [generating, setGenerating] = useState(false)

  // Per-client filtered options
  const clientAccounts = useMemo(
    () => socialAccounts.filter(a => !isAdmin || a.client_id === selectedClientId),
    [socialAccounts, selectedClientId, isAdmin]
  )
  const fbAccount = clientAccounts.find(a => a.platform === 'facebook')
  const clientCreatives = useMemo(
    () => creatives.filter(c => !isAdmin || c.client_id === selectedClientId),
    [creatives, selectedClientId, isAdmin]
  )
  const clientAssets = useMemo(
    () => assets.filter(a => !isAdmin || a.client_id === selectedClientId),
    [assets, selectedClientId, isAdmin]
  )
  const pickerItems = useMemo<PickerItem[]>(() => [
    ...clientAssets.map(a => ({
      id: `asset-${a.id}`,
      url: a.public_url,
      thumb: a.thumbnail_url ?? (a.file_type === 'image' ? a.public_url : null),
      type: (a.file_type === 'video' ? 'video' : 'image') as 'image' | 'video',
      label: a.file_name,
      source: 'upload' as const,
    })),
    ...clientCreatives.map(c => ({
      id: `creative-${c.id}`,
      url: c.asset_url,
      thumb: c.thumbnail_url ?? (c.creative_type !== 'video' ? c.asset_url : null),
      type: (c.creative_type === 'video' ? 'video' : 'image') as 'image' | 'video',
      label: `${c.creative_type} · ${c.id.slice(0, 8)}`,
      source: 'creative' as const,
    })),
  ], [clientAssets, clientCreatives])

  // Media belongs to a client — switching clients clears the selection.
  // skipMediaClear lets loadIntoForm restore another client's post without being wiped.
  useEffect(() => {
    if (skipMediaClear.current) { skipMediaClear.current = false; return }
    setMediaItems([])
    setCreativeId('')
  }, [selectedClientId])

  const clientContents = useMemo(
    () => contents.filter(c => !isAdmin || c.client_id === selectedClientId),
    [contents, selectedClientId, isAdmin]
  )
  const clientListings = useMemo(
    () => listings.filter(l => !isAdmin || l.client_id === selectedClientId),
    [listings, selectedClientId, isAdmin]
  )
  const visiblePosts = useMemo(
    () => posts.filter(p => !isAdmin || !selectedClientId || p.client_id === selectedClientId),
    [posts, selectedClientId, isAdmin]
  )

  const filtered = visiblePosts.filter(p => {
    const matchFilter = filter === 'all' ? true : p.status === filter
    const text = `${p.platform} ${p.message ?? ''}`.toLowerCase()
    const matchSearch = search ? text.includes(search.toLowerCase()) : true
    return matchFilter && matchSearch
  })

  function togglePlatform(p: string) {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  function autoFillFromContent(id: string) {
    const c = clientContents.find(c => c.id === id)
    if (c) {
      setCaption(c.caption ?? c.hook ?? '')
      setHashtags(c.hashtags?.join(' ') ?? '')
    }
    setContentId(id)
  }

  function resetForm() {
    setCaption(''); setHashtags(''); setLinkUrl('')
    setScheduledDate(''); setCreativeId(''); setContentId('')
    setMediaItems([])
    setEditingId(null)
  }

  function loadIntoForm(p: Post) {
    setEditingId(p.id)
    setPlatforms([p.platform])
    setPostType(p.post_type ?? 'feed')
    setCaption(p.message ?? '')
    setLinkUrl(p.link_url ?? '')
    setCreativeId(p.creative_id ?? '')
    setContentId(p.content_id ?? '')
    setMediaItems((p.media_urls ?? []).map((url, i) => {
      const isVid = /\.(mp4|mov|webm)(\?|$)/i.test(url)
      return {
        id: `existing-${i}`,
        url,
        thumb: isVid ? null : url,
        type: (isVid ? 'video' : 'image') as 'image' | 'video',
        label: `media ${i + 1}`,
        source: 'upload' as const,
      }
    }))
    if (p.scheduled_at) {
      const d = new Date(p.scheduled_at)
      setScheduledDate(d.toISOString().slice(0, 10))
      setScheduledTime(d.toTimeString().slice(0, 5))
    } else {
      setScheduledDate('')
    }
    if (isAdmin && p.client_id) {
      skipMediaClear.current = true
      setSelectedClientId(p.client_id)
    }
  }

  async function generateWithAI() {
    if (isAdmin && !selectedClientId) { setNotice('Select a client first'); return }
    setGenerating(true)
    setNotice(null)
    try {
      const res = await fetch('/api/posts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: isAdmin ? selectedClientId : undefined,
          goal: aiGoal,
          tone: aiTone,
          language: aiLanguage,
          platform: platforms.includes('facebook') ? 'facebook' : 'instagram',
          post_type: postType,
          listing_id: aiListingId || null,
          instructions: aiInstructions || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Generation failed')
      setCaption(json.caption ?? '')
      setHashtags((json.hashtags ?? []).join(' '))
      if (json.suggested_link && !linkUrl) setLinkUrl(json.suggested_link)
      if (json.content_id) setContentId(json.content_id)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const fullMessage = () =>
    hashtags.trim() ? `${caption.trim()}\n\n${hashtags.trim()}` : caption.trim()

  async function handleSubmit(action: 'draft' | 'schedule' | 'publish') {
    if (!caption.trim() && !creativeId && mediaItems.length === 0) { setNotice('Add a caption, media, or a creative first'); return }
    const carouselImages = mediaItems.filter(m => m.type === 'image').length
    if (postType === 'carousel' && carouselImages < 2) { setNotice('A carousel needs 2–10 images — choose them from the Asset Library'); return }
    if (platforms.length === 0) { setNotice('Select at least one platform'); return }
    if (isAdmin && !selectedClientId) { setNotice('Select a client first'); return }
    if (action === 'schedule' && !scheduledDate) { setNotice('Pick a date to schedule'); return }

    setSaving(true)
    setNotice(null)
    try {
      const scheduledAt = action === 'schedule'
        ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
        : null

      if (editingId) {
        // Update the existing post
        const res = await fetch(`/api/posts/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: fullMessage(),
            link_url: linkUrl || null,
            creative_id: creativeId || null,
            content_id: contentId || null,
            media_urls: mediaItems.map(m => m.url),
            post_type: postType,
            scheduled_at: scheduledAt,
            status: action === 'schedule' ? 'scheduled' : 'draft',
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Update failed')
        let updated: Post = json.post
        if (action === 'publish') {
          const pubRes = await fetch(`/api/posts/${editingId}/publish`, { method: 'POST' })
          const pub = await pubRes.json()
          if (!pub.ok) setNotice(`Publish failed: ${pub.error}`)
          const fresh = await fetch(`/api/posts?status=`).then(r => r.json()).catch(() => null)
          if (fresh?.posts) { setPosts(fresh.posts); resetForm(); return }
        }
        setPosts(prev => prev.map(p => (p.id === updated.id ? updated : p)))
        resetForm()
        return
      }

      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: isAdmin ? selectedClientId : undefined,
          social_account_id: fbAccount?.id ?? null,
          platforms,
          post_type: postType,
          message: fullMessage(),
          link_url: linkUrl || null,
          creative_id: creativeId || null,
          content_id: contentId || null,
          media_urls: mediaItems.map(m => m.url),
          action,
          scheduled_at: scheduledAt,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed')

      setPosts(prev => [...(json.posts ?? []), ...prev])
      if (json.instagram_note) setNotice(json.instagram_note)
      const failedPublish = (json.publish_results ?? []).find((r: any) => !r.ok)
      if (failedPublish) setNotice(`Publish failed: ${failedPublish.error}`)
      resetForm()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Failed to save post')
    } finally {
      setSaving(false)
    }
  }

  async function publishNow(id: string) {
    setActionLoading(id)
    setNotice(null)
    try {
      const res = await fetch(`/api/posts/${id}/publish`, { method: 'POST' })
      const json = await res.json()
      if (!json.ok) setNotice(`Publish failed: ${json.error}`)
      const fresh = await fetch('/api/posts').then(r => r.json())
      if (fresh.posts) setPosts(fresh.posts)
    } catch {
      setNotice('Publish request failed')
    } finally {
      setActionLoading(null)
    }
  }

  async function deletePost(id: string) {
    if (!confirm('Delete this post?')) return
    setActionLoading(id)
    try {
      const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) { setNotice(json.error ?? 'Delete failed'); return }
      setPosts(prev => prev.filter(p => p.id !== id))
      if (editingId === id) resetForm()
    } finally {
      setActionLoading(null)
    }
  }

  function duplicatePost(p: Post) {
    setEditingId(null)
    setPlatforms([p.platform])
    setPostType(p.post_type ?? 'feed')
    setCaption(p.message ?? '')
    setLinkUrl(p.link_url ?? '')
    setCreativeId(p.creative_id ?? '')
    setScheduledDate('')
    setNotice('Copied into composer — adjust and post')
  }

  // Calendar helpers
  const today = new Date()
  const calDays = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), 1)
    d.setDate(d.getDate() - d.getDay() + i)
    return d
  })

  const postsByDate = visiblePosts.reduce((acc, p) => {
    const d = (p.scheduled_at ?? p.published_at)?.slice(0, 10)
    if (d) { acc[d] = acc[d] ?? []; acc[d].push(p) }
    return acc
  }, {} as Record<string, Post[]>)

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* Compose panel */}
      <div className="w-1/2 min-w-[360px] max-w-[640px] bg-white border-r border-black/10 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-black/8 flex items-center justify-between flex-shrink-0">
          <div className="text-sm font-semibold text-[#1A2E5A] flex items-center gap-1.5">
            ✏️ {editingId ? 'Edit Post' : 'New Post'}
          </div>
          {editingId ? (
            <button onClick={resetForm} className="text-[10px] text-gray-400 hover:text-[#A32D2D] flex items-center gap-0.5">
              <X size={10} /> Cancel
            </button>
          ) : (
            <div className="text-[10px] text-gray-400">Organic</div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">

          {/* Admin: client selector */}
          {isAdmin && (
            <div>
              <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Client</label>
              <select
                className="bamo-input text-xs"
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {!fbAccount && (
                <div className="text-[10px] text-[#A32D2D] mt-1">
                  No Facebook page connected for this client
                </div>
              )}
            </div>
          )}

          {/* Platform */}
          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Platform</label>
            <div className="flex gap-1.5">
              {PLATFORMS.map(p => {
                const conf = PLATFORM_CONFIG[p]
                const Icon = conf.icon
                const on = platforms.includes(p)
                return (
                  <button
                    key={p}
                    onClick={() => togglePlatform(p)}
                    className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border text-[10px] font-medium capitalize transition-colors ${
                      on ? `${conf.bg} ${conf.color} border-transparent` : 'border-black/10 text-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={16} />
                    {p}
                  </button>
                )
              })}
            </div>
            {platforms.includes('instagram') && (
              <div className="text-[10px] text-gray-400 mt-1">
                Instagram saves as draft — publishing arrives in v1.1
              </div>
            )}
          </div>

          {/* Post type */}
          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Post type</label>
            <div className="flex flex-wrap gap-1.5">
              {POST_TYPES.map(t => (
                <button
                  key={t.id}
                  onClick={() => t.enabled && setPostType(t.id)}
                  disabled={!t.enabled}
                  title={t.enabled ? undefined : 'Coming in v1.1'}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium capitalize transition-colors ${
                    postType === t.id
                      ? 'bg-[#1A2E5A] text-white'
                      : t.enabled
                        ? 'border border-black/10 text-gray-500 hover:bg-gray-50'
                        : 'border border-black/5 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  {t.id}
                </button>
              ))}
            </div>
          </div>

          {/* Content pull */}
          {clientContents.length > 0 && (
            <div>
              <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">
                Pull from Content <span className="text-gray-400 font-normal">optional</span>
              </label>
              <select
                className="bamo-input text-xs"
                value={contentId}
                onChange={e => autoFillFromContent(e.target.value)}
              >
                <option value="">Select content...</option>
                {clientContents.map(c => (
                  <option key={c.id} value={c.id}>{c.title ?? c.hook ?? 'Untitled'}</option>
                ))}
              </select>
            </div>
          )}

          {/* Compose with AI */}
          <div className="rounded-lg border border-[#E8660A]/30 bg-[#FDE8D8]/30">
            <button
              onClick={() => setAiOpen(o => !o)}
              className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-[#E8660A]"
            >
              <span className="flex items-center gap-1.5"><Sparkles size={13} /> Compose with AI</span>
              <span className="text-[10px]">{aiOpen ? '▲' : '▼'}</span>
            </button>
            {aiOpen && (
              <div className="px-3 pb-3 flex flex-col gap-2">
                <div>
                  <label className="text-[10px] font-medium text-[#1A2E5A] mb-1 block">Goal</label>
                  <select className="bamo-input text-xs" value={aiGoal} onChange={e => setAiGoal(e.target.value)}>
                    <option value="listing_promotion">Listing Promotion</option>
                    <option value="open_house">Open House</option>
                    <option value="tripping_invite">Tripping Invite</option>
                    <option value="event_promotion">Event Promotion</option>
                    <option value="brand_awareness">Brand Awareness</option>
                    <option value="lead_magnet">Lead Magnet</option>
                    <option value="social_proof">Testimonial / Social Proof</option>
                    <option value="lifestyle">Lifestyle / Engagement</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-[#1A2E5A] mb-1 block">Tone</label>
                  <div className="flex flex-wrap gap-1">
                    {['professional', 'friendly', 'urgent', 'luxury'].map(t => (
                      <button
                        key={t}
                        onClick={() => setAiTone(t)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${
                          aiTone === t ? 'bg-[#E8660A] text-white' : 'border border-black/10 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-[#1A2E5A] mb-1 block">Language</label>
                  <div className="flex gap-1">
                    {([
                      { value: 'english', label: 'English' },
                      { value: 'taglish', label: 'Taglish' },
                      { value: 'tagalog', label: 'Filipino' },
                    ] as const).map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => setAiLanguage(value)}
                        className={`flex-1 py-0.5 rounded-full text-[10px] font-medium ${
                          aiLanguage === value ? 'bg-[#1F3C88] text-white' : 'border border-black/10 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {clientListings.length > 0 && (
                  <div>
                    <label className="text-[10px] font-medium text-[#1A2E5A] mb-1 block">
                      Listing <span className="text-gray-400 font-normal">optional</span>
                    </label>
                    <select className="bamo-input text-xs" value={aiListingId} onChange={e => setAiListingId(e.target.value)}>
                      <option value="">No listing — brand-level post</option>
                      {clientListings.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.property_name ?? 'Untitled'}{l.city ? ` · ${l.city}` : ''}{l.price ? ` · ₱${Number(l.price).toLocaleString('en-PH')}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <input
                  className="bamo-input text-xs"
                  type="text"
                  placeholder="Anything else? (e.g. mention free site visit)"
                  value={aiInstructions}
                  onChange={e => setAiInstructions(e.target.value)}
                />
                <button
                  onClick={generateWithAI}
                  disabled={generating}
                  className="btn-orange w-full justify-center py-1.5 text-xs disabled:opacity-50"
                >
                  <Sparkles size={11} /> {generating ? 'Generating...' : caption ? 'Regenerate' : 'Generate'}
                </button>
              </div>
            )}
          </div>

          {/* Caption */}
          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Caption</label>
            <textarea
              className="bamo-input text-xs resize-none"
              rows={5}
              placeholder="Write your caption..."
              value={caption}
              onChange={e => setCaption(e.target.value)}
            />
          </div>

          {/* Creative */}
          {/* Media — Asset Library picker */}
          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">
              Media <span className="text-gray-400 font-normal">optional · up to 10 photos or 1 video</span>
            </label>
            <button
              onClick={() => {
                if (isAdmin && !selectedClientId) { setNotice('Select a client first'); return }
                setPickerOpen(true)
              }}
              className="bamo-input text-xs text-left flex items-center gap-2 w-full hover:border-[#E8660A]/60"
            >
              <ImageIcon size={13} className="text-[#E8660A] flex-shrink-0" />
              {mediaItems.length === 0 ? 'Choose from Asset Library…' : `${mediaItems.length} selected — change`}
            </button>
            {mediaItems.length > 0 && (
              <div className="mt-1.5 grid grid-cols-5 gap-1.5">
                {mediaItems.map(m => (
                  <div key={m.url} className="relative group">
                    {m.type === 'video' ? (
                      <div className="w-full h-12 rounded-md border border-black/10 bg-[#1A2E5A] flex items-center justify-center text-white text-[8px] font-semibold">VIDEO</div>
                    ) : (
                      <img src={m.thumb ?? m.url} alt={m.label} className="w-full h-12 rounded-md border border-black/10 object-cover" />
                    )}
                    <button
                      onClick={() => setMediaItems(prev => prev.filter(x => x.url !== m.url))}
                      className="absolute -top-1 -right-1 bg-[#A32D2D] text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={9} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {mediaItems.length > 0 && (
              <div className="text-[10px] text-gray-400 mt-1">Asset media is used instead of a Creative — picking one clears the other.</div>
            )}
          </div>

          {clientCreatives.length > 0 && (
            <div>
              <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">
                Creative <span className="text-gray-400 font-normal">optional</span>
              </label>
              <select
                className="bamo-input text-xs"
                value={creativeId}
                onChange={e => {
                  if (e.target.value) setMediaItems([])
                  setCreativeId(e.target.value)
                }}
              >
                <option value="">No creative selected</option>
                {clientCreatives.map(c => (
                  <option key={c.id} value={c.id}>{c.creative_type} · {c.id.slice(0, 8)}</option>
                ))}
              </select>
              {creativeId && (
                <img
                  src={clientCreatives.find(c => c.id === creativeId)?.thumbnail_url
                    ?? clientCreatives.find(c => c.id === creativeId)?.asset_url}
                  alt="creative preview"
                  className="mt-1.5 rounded-lg border border-black/10 max-h-24 object-cover w-full"
                />
              )}
            </div>
          )}

          {/* Link */}
          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">
              Link <span className="text-gray-400 font-normal">optional</span>
            </label>
            <input
              className="bamo-input text-xs"
              type="url"
              placeholder="https://bahaymo.com/listing/..."
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
            />
          </div>

          {/* Schedule */}
          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">
              Schedule <span className="text-gray-400 font-normal">leave blank to post now</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <input className="bamo-input text-xs" type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
              <input className="bamo-input text-xs" type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} />
            </div>
          </div>

          {/* Hashtags */}
          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">
              Hashtags <span className="text-gray-400 font-normal">optional</span>
            </label>
            <input
              className="bamo-input text-xs"
              type="text"
              placeholder="#RealEstate #BaMo #CALABARZON"
              value={hashtags}
              onChange={e => setHashtags(e.target.value)}
            />
          </div>

          {notice && (
            <div className="text-[11px] text-[#A32D2D] bg-[#FCEBEB] rounded-lg px-2.5 py-2 flex items-start gap-1.5">
              <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
              {notice}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3 border-t border-black/8 flex flex-col gap-1.5 flex-shrink-0">
          <button
            onClick={() => handleSubmit('publish')}
            disabled={saving || (platforms.length === 1 && platforms[0] === 'instagram')}
            className="btn-navy w-full justify-center py-2 text-xs disabled:opacity-40"
          >
            <Send size={12} /> {saving ? 'Working...' : editingId ? 'Save & Publish' : 'Post Now'}
          </button>
          <div className="flex gap-1.5">
            <button
              onClick={() => handleSubmit('draft')}
              disabled={saving}
              className="btn-ghost flex-1 justify-center text-xs py-2"
            >
              {editingId ? 'Save Draft' : 'Save Draft'}
            </button>
            <button
              onClick={() => handleSubmit('schedule')}
              disabled={saving || !scheduledDate}
              className="btn-orange flex-1 justify-center text-xs py-2 disabled:opacity-40"
            >
              <Calendar size={11} /> Schedule
            </button>
          </div>
        </div>
      </div>

      <AssetPicker
        open={pickerOpen}
        items={pickerItems}
        initialSelected={mediaItems.map(m => m.url)}
        onClose={() => setPickerOpen(false)}
        onConfirm={sel => {
          setMediaItems(sel)
          if (sel.length > 0) setCreativeId('')
          setPickerOpen(false)
        }}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden p-5 gap-3">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-semibold text-[#1A2E5A]">Posts</div>
            <div className="text-xs text-gray-500 mt-0.5">Schedule and publish to Facebook — Instagram coming in v1.1.</div>
          </div>
          <div className="flex gap-1 bg-white rounded-lg border border-black/10 p-1">
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${view === 'list' ? 'bg-[#1A2E5A] text-white' : 'text-gray-500 hover:text-[#1A2E5A]'}`}
            >
              ☰ List
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${view === 'calendar' ? 'bg-[#1A2E5A] text-white' : 'text-gray-500 hover:text-[#1A2E5A]'}`}
            >
              <Calendar size={12} /> Calendar
            </button>
          </div>
        </div>

        {/* Social accounts bar */}
        <div className="bamo-card px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="text-xs font-semibold text-[#1A2E5A]">Connected:</div>
          {clientAccounts.length > 0 ? clientAccounts.map(a => {
            const conf = PLATFORM_CONFIG[a.platform]
            const Icon = conf?.icon ?? Facebook
            return (
              <div key={a.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-black/10">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center ${conf?.bg ?? 'bg-gray-100'}`}>
                  <Icon size={14} className={conf?.color ?? 'text-gray-500'} />
                </div>
                <div>
                  <div className="text-xs font-medium text-[#1A2E5A]">{a.account_name}</div>
                  <div className="text-[10px] text-[#3B6D11] flex items-center gap-1">
                    <CheckCircle size={9} /> Connected
                  </div>
                </div>
              </div>
            )
          }) : (
            <div className="text-xs text-gray-400">No accounts connected — run the Meta connect flow in Settings</div>
          )}
        </div>

        {/* Filter row (list view only) */}
        {view === 'list' && (
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-white rounded-lg border border-black/10 px-3 py-1.5">
              <span className="text-gray-400">🔍</span>
              <input
                type="text"
                placeholder="Search posts..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent text-sm outline-none flex-1"
              />
            </div>
            {['all', 'scheduled', 'published', 'draft', 'failed'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                  filter === f ? 'bg-[#1A2E5A] text-white' : 'border border-black/10 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {/* List view */}
        {view === 'list' && (
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="bamo-card flex flex-col items-center justify-center py-16 gap-3">
                <div className="text-3xl">📅</div>
                <div className="text-sm font-semibold text-[#1A2E5A]">No posts yet</div>
                <div className="text-xs text-gray-500">Compose your first post in the panel on the left</div>
              </div>
            ) : (
              <div className="bamo-card divide-y divide-black/5">
                {filtered.map(p => {
                  const conf = PLATFORM_CONFIG[p.platform]
                  const Icon = conf?.icon ?? Facebook
                  const isLoading = actionLoading === p.id

                  return (
                    <div key={p.id}>
                      <div className="flex items-start gap-3 px-4 py-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${conf?.bg ?? 'bg-gray-100'}`}>
                          <Icon size={18} className={conf?.color ?? 'text-gray-500'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${conf?.bg ?? 'bg-gray-100'} ${conf?.color ?? 'text-gray-500'}`}>
                              {p.platform}
                            </span>
                            {p.post_type && (
                              <span className="text-[10px] text-gray-400 capitalize">{p.post_type}</span>
                            )}
                          </div>
                          {p.message && (
                            <div className="text-xs text-[#1A2E5A] truncate mb-0.5">{p.message}</div>
                          )}
                          <div className="text-xs text-gray-600">
                            {p.scheduled_at && p.status === 'scheduled'
                              ? `Scheduled: ${new Date(p.scheduled_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                              : p.published_at
                                ? `Published: ${new Date(p.published_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                                : p.status.charAt(0).toUpperCase() + p.status.slice(1)
                            }
                          </div>
                          {p.status === 'failed' && p.error_message && (
                            <div className="text-[10px] text-[#A32D2D] mt-1 flex items-start gap-1">
                              <AlertTriangle size={10} className="mt-0.5 flex-shrink-0" />
                              {p.error_message}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-500'}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                          </span>
                          {p.status === 'published' && (
                            <span className="text-[10px] text-[#3B6D11]">↑ Live</span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex border-t border-black/5">
                        {p.status === 'published' ? (
                          <>
                            <button className="flex-1 py-2 text-[11px] font-medium text-gray-400 cursor-default flex items-center justify-center gap-1" title="Stats arrive with the Analytics wiring">
                              <BarChart2 size={11} /> Stats
                            </button>
                            <div className="w-px bg-black/5" />
                            <button
                              onClick={() => duplicatePost(p)}
                              className="flex-1 py-2 text-[11px] font-medium text-gray-500 hover:bg-[#F4F5F7] flex items-center justify-center gap-1"
                            >
                              <Copy size={11} /> Duplicate
                            </button>
                          </>
                        ) : p.status === 'failed' ? (
                          <>
                            <button
                              onClick={() => publishNow(p.id)}
                              disabled={isLoading || p.platform === 'instagram'}
                              className="flex-1 py-2 text-[11px] font-semibold text-[#E8660A] hover:bg-[#FDE8D8] flex items-center justify-center gap-1 disabled:opacity-40"
                            >
                              <RotateCcw size={11} /> {isLoading ? 'Retrying...' : 'Retry'}
                            </button>
                            <div className="w-px bg-black/5" />
                            <button
                              onClick={() => loadIntoForm(p)}
                              className="flex-1 py-2 text-[11px] font-medium text-gray-500 hover:bg-[#F4F5F7] flex items-center justify-center gap-1"
                            >
                              <Edit size={11} /> Edit
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => loadIntoForm(p)}
                              className="flex-1 py-2 text-[11px] font-medium text-gray-500 hover:bg-[#F4F5F7] flex items-center justify-center gap-1"
                            >
                              <Edit size={11} /> Edit
                            </button>
                            <div className="w-px bg-black/5" />
                            <button
                              onClick={() => loadIntoForm(p)}
                              className="flex-1 py-2 text-[11px] font-medium text-gray-500 hover:bg-[#F4F5F7] flex items-center justify-center gap-1"
                            >
                              <Clock size={11} /> Reschedule
                            </button>
                            <div className="w-px bg-black/5" />
                            <button
                              onClick={() => publishNow(p.id)}
                              disabled={isLoading || p.platform === 'instagram'}
                              title={p.platform === 'instagram' ? 'IG publishing arrives in v1.1' : undefined}
                              className="flex-1 py-2 text-[11px] font-semibold text-[#E8660A] hover:bg-[#FDE8D8] flex items-center justify-center gap-1 disabled:opacity-40"
                            >
                              <Send size={11} /> {isLoading ? 'Posting...' : 'Post Now'}
                            </button>
                          </>
                        )}
                        <div className="w-px bg-black/5" />
                        <button
                          onClick={() => deletePost(p.id)}
                          disabled={isLoading || p.status === 'published'}
                          title={p.status === 'published' ? 'Published posts are kept as history' : undefined}
                          className="flex-1 py-2 text-[11px] font-medium text-[#A32D2D] hover:bg-[#FCEBEB] flex items-center justify-center gap-1 disabled:opacity-40"
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Calendar view */}
        {view === 'calendar' && (
          <div className="flex-1 overflow-y-auto">
            <div className="bamo-card p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-[#1A2E5A]">
                  {today.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}
                </div>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {calDays.map((d, i) => {
                  const dateStr = d.toISOString().slice(0, 10)
                  const isToday = dateStr === today.toISOString().slice(0, 10)
                  const isCurrentMonth = d.getMonth() === today.getMonth()
                  const dayPosts = postsByDate[dateStr] ?? []

                  return (
                    <div
                      key={i}
                      className={`rounded-lg border p-1.5 min-h-14 ${
                        isToday ? 'border-[#E8660A] border-[1.5px]' : 'border-black/8'
                      } ${!isCurrentMonth ? 'opacity-40' : 'bg-white'}`}
                    >
                      <div className={`text-[11px] font-medium mb-1 ${isToday ? 'text-[#E8660A]' : 'text-[#1A2E5A]'}`}>
                        {d.getDate()}
                      </div>
                      {dayPosts.slice(0, 2).map(p => (
                        <div
                          key={p.id}
                          className={`text-[9px] font-semibold rounded px-1 py-0.5 mb-0.5 truncate ${
                            p.status === 'published' ? 'bg-[#EAF3DE] text-[#3B6D11]' :
                            p.status === 'failed' ? 'bg-[#FCEBEB] text-[#A32D2D]' :
                            'bg-[#E8EBF3] text-[#1A2E5A]'
                          }`}
                        >
                          {p.platform} · {p.post_type}
                        </div>
                      ))}
                      {dayPosts.length > 2 && (
                        <div className="text-[9px] text-gray-400">+{dayPosts.length - 2} more</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
