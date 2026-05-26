'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const TYPE_CONFIG: Record<string, { icon: string; bg: string; color: string }> = {
  campaign_live:   { icon: '📣', bg: 'bg-[#FDE8D8]', color: 'text-[#E8660A]' },
  lead_received:   { icon: '👤', bg: 'bg-[#EAF3DE]', color: 'text-[#3B6D11]' },
  post_published:  { icon: '📤', bg: 'bg-[#E8EBF3]', color: 'text-[#1A2E5A]' },
  budget_low:      { icon: '💰', bg: 'bg-[#FCEBEB]', color: 'text-[#A32D2D]' },
  creative_ready:  { icon: '🎨', bg: 'bg-[#E6F1FB]', color: 'text-[#185FA5]' },
  website_live:    { icon: '🌐', bg: 'bg-[#FDE8D8]', color: 'text-[#E8660A]' },
  appointment:     { icon: '📅', bg: 'bg-[#EAF3DE]', color: 'text-[#3B6D11]' },
  post_failed:     { icon: '⚠️', bg: 'bg-[#FCEBEB]', color: 'text-[#A32D2D]' },
}

const DEFAULT_TYPE = { icon: '🔔', bg: 'bg-[#E8EBF3]', color: 'text-[#1A2E5A]' }

interface Notification {
  id: string
  type: string
  title: string
  message: string | null
  is_read: boolean
  entity_type: string | null
  entity_id: string | null
  created_at: string
}

export default function NotificationsClient({
  notifications: initial, unreadCount: initialUnread,
}: {
  notifications: Notification[]
  unreadCount: number
}) {
  const supabase = createClient()
  const router = useRouter()

  const [notifications, setNotifications] = useState<Notification[]>(initial)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [marking, setMarking] = useState(false)

  const filtered = filter === 'unread'
    ? notifications.filter(n => !n.is_read)
    : notifications

  const unread = notifications.filter(n => !n.is_read).length

  async function markAllRead() {
    setMarking(true)
    const ids = notifications.filter(n => !n.is_read).map(n => n.id)
    if (ids.length > 0) {
      await supabase.from('ad_notifications').update({ is_read: true }).in('id', ids)
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      router.refresh()
    }
    setMarking(false)
  }

  async function markRead(id: string) {
    await supabase.from('ad_notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  async function deleteNotification(id: string) {
    await supabase.from('ad_notifications').delete().eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
  }

  const groupedByDate = filtered.reduce((acc, n) => {
    const date = new Date(n.created_at)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)

    let group: string
    if (date.toDateString() === today.toDateString()) group = 'Today'
    else if (date.toDateString() === yesterday.toDateString()) group = 'Yesterday'
    else group = date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })

    acc[group] = acc[group] ?? []
    acc[group].push(n)
    return acc
  }, {} as Record<string, Notification[]>)

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-4 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1A2E5A] flex items-center gap-2">
            Notifications
            {unread > 0 && (
              <span className="bg-[#E8660A] text-white text-xs font-bold px-2 py-0.5 rounded-full">{unread}</span>
            )}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Your recent alerts and updates.</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 bg-white rounded-lg border border-black/10 p-1">
            {(['all', 'unread'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                  filter === f ? 'bg-[#1A2E5A] text-white' : 'text-gray-500 hover:text-[#1A2E5A]'
                }`}
              >
                {f} {f === 'unread' && unread > 0 ? `(${unread})` : ''}
              </button>
            ))}
          </div>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              disabled={marking}
              className="btn-ghost text-xs"
            >
              {marking ? 'Marking...' : '✓ Mark all read'}
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="bamo-card flex flex-col items-center justify-center py-16 gap-3">
          <div className="text-4xl">🔔</div>
          <div className="text-sm font-semibold text-[#1A2E5A]">
            {filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
          </div>
          <div className="text-xs text-gray-500 text-center">
            {filter === 'unread'
              ? 'You have no unread notifications.'
              : 'Notifications will appear here when campaigns go live, leads are received, and posts are published.'
            }
          </div>
        </div>
      )}

      {/* Grouped notifications */}
      {Object.entries(groupedByDate).map(([group, items]) => (
        <div key={group} className="flex flex-col gap-2">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">{group}</div>
          <div className="bamo-card divide-y divide-black/5">
            {items.map(n => {
              const conf = TYPE_CONFIG[n.type] ?? DEFAULT_TYPE
              return (
                <div
                  key={n.id}
                  onClick={() => !n.is_read && markRead(n.id)}
                  className={`flex items-start gap-3 px-4 py-4 transition-colors ${
                    !n.is_read ? 'bg-[#FDE8D8]/30 hover:bg-[#FDE8D8]/50 cursor-pointer' : 'hover:bg-[#F4F5F7]'
                  }`}
                >
                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-base ${conf.bg}`}>
                    {conf.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className={`text-sm font-semibold ${!n.is_read ? 'text-[#1A2E5A]' : 'text-gray-700'}`}>
                        {n.title}
                      </div>
                      {!n.is_read && (
                        <div className="w-2 h-2 rounded-full bg-[#E8660A] flex-shrink-0" />
                      )}
                    </div>
                    {n.message && (
                      <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.message}</div>
                    )}
                    <div className="text-[10px] text-gray-400 mt-1">{timeAgo(n.created_at)}</div>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={e => { e.stopPropagation(); deleteNotification(n.id) }}
                    className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0 text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}

    </div>
  )
}
