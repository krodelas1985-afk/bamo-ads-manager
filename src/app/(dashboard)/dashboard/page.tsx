import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Megaphone, Image, Send, TrendingUp } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*, clients(*)').eq('id', user!.id).single()

  // Fetch summary counts scoped by role
  const clientFilter = profile.role === 'client_admin' ? { client_id: profile.client_id } : {}

  const [campaigns, creatives, posts] = await Promise.all([
    supabase.from('ad_campaigns').select('id, status', { count: 'exact' }).match(clientFilter),
    supabase.from('ad_creatives').select('id', { count: 'exact' }).match(clientFilter),
    supabase.from('ad_posts').select('id', { count: 'exact' }).match(clientFilter),
  ])

  const stats = [
    { label: 'Total Campaigns', value: campaigns.count ?? 0, icon: Megaphone, color: 'bg-blue-50 text-blue-600' },
    { label: 'Active Campaigns', value: campaigns.data?.filter(c => c.status === 'active').length ?? 0, icon: TrendingUp, color: 'bg-green-50 text-green-600' },
    { label: 'Creatives Generated', value: creatives.count ?? 0, icon: Image, color: 'bg-orange-50 text-[#E8660A]' },
    { label: 'Posts Scheduled', value: posts.count ?? 0, icon: Send, color: 'bg-purple-50 text-purple-600' },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1A2E5A]">
          {profile.role === 'baymo_admin' ? 'BaMo Ads Manager' : `${profile.clients?.name ?? 'My'} Dashboard`}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {profile.role === 'baymo_admin' ? 'Admin overview — all clients' : 'Your ad campaign overview'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${color}`}>
              <Icon size={20} />
            </div>
            <p className="text-2xl font-bold text-[#1A2E5A]">{value}</p>
            <p className="text-gray-500 text-sm">{label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
        <h2 className="font-semibold text-[#1A2E5A] mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <a href="/content/new" className="bg-[#E8660A] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition">
            + New Content
          </a>
          <a href="/creatives/new" className="bg-[#1A2E5A] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-800 transition">
            + Generate Creative
          </a>
          <a href="/campaigns/new" className="border border-[#1A2E5A] text-[#1A2E5A] px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
            + New Campaign
          </a>
        </div>
      </div>
    </div>
  )
}
