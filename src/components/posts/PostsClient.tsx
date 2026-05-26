'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  Facebook, Instagram, Linkedin, Send, Calendar,
  BarChart2, Edit, Clock, Copy, Trash2, CheckCircle, Plus, X
} from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-[#E8EBF3] text-[#1A2E5A]',
  published: 'bg-[#EAF3DE] text-[#3B6D11]',
  draft: 'bg-[#F1EFE8] text-[#5F5E5A]',
  failed: 'bg-[#FCEBEB] text-[#A32D2D]',
}

const PLATFORM_CONFIG: Record<string, { icon: any; bg: string; color: string }> = {
  facebook: { icon: Facebook, bg: 'bg-[#E8EBF3]', color: 'text-[#1A2E5A]' },
  instagram: { icon: Instagram, bg: 'bg-[#FDE8D8]', color: 'text-[#E8660A]' },
  linkedin: { icon: Linkedin, bg: 'bg-[#E6F1FB]', color: 'text-[#185FA5]' },
}

const POST_TYPES = ['feed', 'reel', 'story', 'carousel']
const PLATFORMS = ['facebook', 'instagram', 'linkedin']

interface Post {
  id: string
  platform: string
  post_type: string | null
  status: string
  scheduled_at: string | null
  published_at: string | null
  meta_post_id: string | null
  created_at: string
}

interface SocialAccount {
  id: string
  platform: string
  account_name: string
}

interface Props {
  posts: Post[]
  socialAccounts: SocialAccount[]
  creatives: any[]
  contents: any[]
  clientId: string
}

export default function PostsClient({ posts: initialPosts, socialAccounts, creatives, contents, clientId }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Compose form state
  const [platforms, setPlatforms] = useState<string[]>(['facebook', 'instagram'])
  const [postType, setPostType] = useState('feed')
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [creativeId, setCreativeId] = useState('')
  const [contentId, setContentId] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('09:00')
  const [socialAccountId, setSocialAccountId] = useState(socialAccounts[0]?.id ?? '')

  const filtered = posts.filter(p => {
    const matchFilter = filter === 'all' ? true : p.status === filter
    const matchSearch = search ? p.platform.toLowerCase().includes(search.toLowerCase()) : true
    return matchFilter && matchSearch
  })

  function togglePlatform(p: string) {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  function autoFillFromContent(id: string) {
    const c = contents.find(c => c.id === id)
    if (c) {
      setCaption(c.caption ?? c.hook ?? '')
      setHashtags(c.hashtags?.join(' ') ?? '')
    }
    setContentId(id)
  }

  async function handlePost(schedule: boolean) {
    if (!caption.trim()) { alert('Please add a caption'); return }
    if (platforms.length === 0) { alert('Select at least one platform'); return }

    setSaving(true)
    try {
      const scheduledAt = schedule && scheduledDate
        ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
        : null

      const insertions = platforms.map(platform => ({
        client_id: clientId,
        social_account_id: socialAccountId || null,
        creative_id: creativeId || null,
        platform,
        post_type: postType,
        status: schedule && scheduledAt ? 'scheduled' : schedule ? 'draft' : 'published',
        scheduled_at: scheduledAt,
        published_at: !schedule ? new Date().toISOString() : null,
      }))

      const { data, error } = await supabase.from('ad_posts').insert(insertions).select()
      if (error) throw error

      setPosts(prev => [...(data ?? []), ...prev])

      // Reset form
      setCaption('')
      setHashtags('')
      setScheduledDate('')
      setCreativeId('')
      setContentId('')
    } catch (err) {
      console.error(err)
      alert('Failed to save post. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function deletePost(id: string) {
    if (!confirm('Delete this post?')) return
    setActionLoading(id)
    await supabase.from('ad_posts').delete().eq('id', id)
    setPosts(prev => prev.filter(p => p.id !== id))
    setActionLoading(null)
  }

  // Calendar helpers
  const today = new Date()
  const calDays = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), 1)
    d.setDate(d.getDate() - d.getDay() + i)
    return d
  })

  const postsByDate = posts.reduce((acc, p) => {
    const d = (p.scheduled_at ?? p.published_at)?.slice(0, 10)
    if (d) { acc[d] = acc[d] ?? []; acc[d].push(p) }
    return acc
  }, {} as Record<string, Post[]>)

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* Compose panel */}
      <div className="w-72 min-w-72 bg-white border-r border-black/10 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-black/8 flex items-center justify-between flex-shrink-0">
          <div className="text-sm font-semibold text-[#1A2E5A] flex items-center gap-1.5">
            ✏️ New Post
          </div>
          <div className="text-[10px] text-gray-400">Organic</div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">

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
          </div>

          {/* Post type */}
          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Post type</label>
            <div className="flex flex-wrap gap-1.5">
              {POST_TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => setPostType(t)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium capitalize transition-colors ${
                    postType === t ? 'bg-[#1A2E5A] text-white' : 'border border-black/10 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Content pull */}
          {contents.length > 0 && (
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
                {contents.map(c => (
                  <option key={c.id} value={c.id}>{c.title ?? c.hook ?? 'Untitled'}</option>
                ))}
              </select>
            </div>
          )}

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
          {creatives.length > 0 && (
            <div>
              <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">
                Creative <span className="text-gray-400 font-normal">optional</span>
              </label>
              <select
                className="bamo-input text-xs"
                value={creativeId}
                onChange={e => setCreativeId(e.target.value)}
              >
                <option value="">No creative selected</option>
                {creatives.map(c => (
                  <option key={c.id} value={c.id}>{c.source.replace('_', '.')} · {c.type}</option>
                ))}
              </select>
            </div>
          )}

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

        </div>

        {/* Footer */}
        <div className="p-3 border-t border-black/8 flex flex-col gap-1.5 flex-shrink-0">
          <button
            onClick={() => handlePost(false)}
            disabled={saving}
            className="btn-navy w-full justify-center py-2 text-xs"
          >
            <Send size={12} /> {saving ? 'Posting...' : 'Post Now'}
          </button>
          <div className="flex gap-1.5">
            <button
              onClick={() => handlePost(true)}
              disabled={saving}
              className="btn-ghost flex-1 justify-center text-xs py-2"
            >
              Save Draft
            </button>
            <button
              onClick={() => handlePost(true)}
              disabled={saving || !scheduledDate}
              className="btn-orange flex-1 justify-center text-xs py-2 disabled:opacity-40"
            >
              <Calendar size={11} /> Schedule
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden p-5 gap-3">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-semibold text-[#1A2E5A]">Posts</div>
            <div className="text-xs text-gray-500 mt-0.5">Schedule and publish across FB, IG, and LinkedIn.</div>
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
          {socialAccounts.length > 0 ? socialAccounts.map(a => {
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
            <div className="text-xs text-gray-400">No accounts connected — go to Settings → Social Accounts</div>
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
                          <div className="text-xs text-gray-600">
                            {p.scheduled_at
                              ? `Scheduled: ${new Date(p.scheduled_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                              : p.published_at
                                ? `Published: ${new Date(p.published_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`
                                : 'Draft'
                            }
                          </div>
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
                            <button className="flex-1 py-2 text-[11px] font-medium text-gray-500 hover:bg-[#F4F5F7] flex items-center justify-center gap-1">
                              <BarChart2 size={11} /> Stats
                            </button>
                            <div className="w-px bg-black/5" />
                            <button className="flex-1 py-2 text-[11px] font-medium text-gray-500 hover:bg-[#F4F5F7] flex items-center justify-center gap-1">
                              <Copy size={11} /> Duplicate
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="flex-1 py-2 text-[11px] font-medium text-gray-500 hover:bg-[#F4F5F7] flex items-center justify-center gap-1">
                              <Edit size={11} /> Edit
                            </button>
                            <div className="w-px bg-black/5" />
                            <button className="flex-1 py-2 text-[11px] font-medium text-gray-500 hover:bg-[#F4F5F7] flex items-center justify-center gap-1">
                              <Clock size={11} /> Reschedule
                            </button>
                            <div className="w-px bg-black/5" />
                            <button className="flex-1 py-2 text-[11px] font-semibold text-[#E8660A] hover:bg-[#FDE8D8] flex items-center justify-center gap-1">
                              <Send size={11} /> Post Now
                            </button>
                          </>
                        )}
                        <div className="w-px bg-black/5" />
                        <button
                          onClick={() => deletePost(p.id)}
                          disabled={isLoading}
                          className="flex-1 py-2 text-[11px] font-medium text-[#A32D2D] hover:bg-[#FCEBEB] flex items-center justify-center gap-1 disabled:opacity-50"
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
                <div className="flex gap-1.5">
                  <button className="w-7 h-7 rounded-lg border border-black/10 flex items-center justify-center text-[#1A2E5A] hover:bg-gray-50">←</button>
                  <button className="w-7 h-7 rounded-lg border border-black/10 flex items-center justify-center text-[#1A2E5A] hover:bg-gray-50">→</button>
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
                            p.status === 'published' ? 'bg-[#EAF3DE] text-[#3B6D11]' : 'bg-[#E8EBF3] text-[#1A2E5A]'
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
