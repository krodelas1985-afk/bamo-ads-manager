import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import Link from 'next/link'
import { Megaphone, Image, Send, TrendingUp, Plus, Wand2, Building } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, clients(name, ads_plan)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const clientFilter = profile.role === 'client_admin' ? { client_id: profile.client_id } : {}

  const [
    { count: totalCampaigns },
    { data: campaigns },
    { count: totalCreatives },
    { count: totalPosts },
    { data: notifications },
  ] = await Promise.all([
    supabase.from('ad_campaigns').select('id', { count: 'exact' }).match(clientFilter),
    supabase.from('ad_campaigns').select('id, name, status, budget_daily, client_id').match(clientFilter).order('created_at', { ascending: false }).limit(4),
    supabase.from('ad_creatives').select('id', { count: 'exact' }).match(clientFilter),
    supabase.from('ad_posts').select('id', { count: 'exact' }).match(clientFilter),
    supabase.from('ad_notifications').select('*').match(clientFilter).eq('is_read', false).order('created_at', { ascending: false }).limit(4),
  ])

  const activeCampaigns = campaigns?.filter(c => c.status === 'active').length ?? 0

  const stats = [
    { label: 'Total campaigns', value: totalCampaigns ?? 0, sub: `${activeCampaigns} active`, icon: Megaphone, iconBg: 'bg-[#FDE8D8]', iconColor: 'text-[#E8660A]' },
    { label: 'Active campaigns', value: activeCampaigns, sub: 'running now', icon: TrendingUp, iconBg: 'bg-[#EAF3DE]', iconColor: 'text-[#3B6D11]' },
    { label: 'Creatives made', value: totalCreatives ?? 0, sub: 'images & videos', icon: Image, iconBg: 'bg-[#E8EBF3]', iconColor: 'text-[#1A2E5A]' },
    { label: 'Posts scheduled', value: totalPosts ?? 0, sub: 'organic posts', icon: Send, iconBg: 'bg-[#E6F1FB]', iconColor: 'text-[#185FA5]' },
  ]

  const notifIconMap: Record<string, string> = {
    campaign_live: 'bg-[#FDE8D8] text-[#E8660A]',
    lead_received: 'bg-[#EAF3DE] text-[#3B6D11]',
    post_published: 'bg-[#E8EBF3] text-[#1A2E5A]',
    budget_low: 'bg-[#FCEBEB] text-[#A32D2D]',
  }

  const statusColors: Record<string, string> = {
    active: 'bg-[#EAF3DE] text-[#3B6D11]',
    draft: 'bg-[#F1EFE8] text-[#5F5E5A]',
    paused: 'bg-[#FAEEDA] text-[#854F0B]',
    failed: 'bg-[#FCEBEB] text-[#A32D2D]',
    completed: 'bg-[#E8EBF3] text-[#1A2E5A]',
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="Dashboard"
        role={profile.role}
        plan={profile.clients?.ads_plan ?? undefined}
        userInitials={(profile.full_name ?? 'KR').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[#1A2E5A]">
              Good morning{profile.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''} 👋
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Here's what's happening with your campaigns today.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/content/new" className="btn-ghost text-sm">
              <Plus size={14} /> New Content
            </Link>
            <Link href="/campaigns/new" className="btn-orange text-sm">
              <Megaphone size={14} /> New Campaign
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {stats.map(({ label, value, sub, icon: Icon, iconBg, iconColor }) => (
            <div key={label} className="bamo-card p-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${iconBg}`}>
                <Icon size={18} className={iconColor} />
              </div>
              <div className="text-2xl font-semibold text-[#1A2E5A] leading-none">{value}</div>
              <div className="text-xs text-gray-500 mt-1">{label}</div>
              <div className="text-[10px] text-[#3B6D11] mt-1">{sub}</div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { href: '/content/new', icon: Wand2, color: 'text-[#E8660A]', bg: 'bg-[#FDE8D8]', title: 'Generate Content', sub: 'Let BaMo write your caption + hooks' },
            { href: '/creatives/new', icon: Image, color: 'text-[#1A2E5A]', bg: 'bg-[#E8EBF3]', title: 'Create Creative', sub: 'AI image or video from listing' },
            { href: '/listings', icon: Building, color: 'text-[#185FA5]', bg: 'bg-[#E6F1FB]', title: 'Pick a Listing', sub: 'From BaMo Marketplace' },
          ].map(({ href, icon: Icon, color, bg, title, sub }) => (
            <Link key={href} href={href} className="bamo-card p-4 hover:border-[#E8660A] transition-colors cursor-pointer">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${bg}`}>
                <Icon size={18} className={color} />
              </div>
              <div className="text-sm font-semibold text-[#1A2E5A]">{title}</div>
              <div className="text-xs text-gray-500 mt-1">{sub}</div>
            </Link>
          ))}
        </div>

        {/* Bottom grid */}
        <div className="grid grid-cols-5 gap-3 flex-1">

          {/* Campaigns */}
          <div className="bamo-card col-span-3 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
              <div className="text-sm font-semibold text-[#1A2E5A]">Active Campaigns</div>
              <Link href="/campaigns" className="text-xs text-[#E8660A]">View all →</Link>
            </div>
            <div className="flex-1">
              {campaigns && campaigns.length > 0 ? campaigns.map((camp) => (
                <div key={camp.id} className="flex items-center gap-3 px-4 py-3 border-b border-black/5 last:border-0">
                  <div className="w-9 h-9 rounded-lg bg-[#E8EBF3] flex items-center justify-center flex-shrink-0">
                    <Megaphone size={16} className="text-[#1A2E5A]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#1A2E5A] truncate">{camp.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[camp.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {camp.status.charAt(0).toUpperCase() + camp.status.slice(1)}
                      </span>
                      {camp.budget_daily && (
                        <span className="text-[10px] text-gray-400">₱{Number(camp.budget_daily).toLocaleString()}/day</span>
                      )}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                  <Megaphone size={24} className="mb-2 opacity-30" />
                  <div className="text-xs">No campaigns yet</div>
                  <Link href="/campaigns/new" className="text-xs text-[#E8660A] mt-1">Create your first →</Link>
                </div>
              )}
            </div>
          </div>

          {/* Notifications */}
          <div className="bamo-card col-span-2 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
              <div className="text-sm font-semibold text-[#1A2E5A]">Notifications</div>
              <Link href="/notifications" className="text-xs text-[#E8660A]">See all</Link>
            </div>
            <div className="flex-1">
              {notifications && notifications.length > 0 ? notifications.map((n) => (
                <div key={n.id} className="flex items-start gap-2.5 px-4 py-3 border-b border-black/5 last:border-0 bg-[#FDE8D8]/30">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm ${notifIconMap[n.type] ?? 'bg-[#E8EBF3] text-[#1A2E5A]'}`}>
                    <span>🔔</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-[#1A2E5A]">{n.title}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{n.message}</div>
                  </div>
                </div>
              )) : (
                <div className="flex items-center justify-center h-32 text-xs text-gray-400">
                  All caught up!
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
