import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import CampaignStats from '@/components/campaigns/CampaignStats'
import CampaignList from '@/components/campaigns/CampaignList'

export default async function CampaignsPage() {
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

  const { data: campaigns } = await supabase
    .from('ad_campaigns')
    .select(`
      *,
      ad_analytics(impressions, reach, clicks, spend, leads)
    `)
    .match(clientFilter)
    .order('created_at', { ascending: false })

  // Aggregate analytics
  const totalSpend = campaigns?.reduce((sum, c) => {
    const analytics = Array.isArray(c.ad_analytics) ? c.ad_analytics : []
    return sum + analytics.reduce((s: number, a: any) => s + (Number(a.spend) || 0), 0)
  }, 0) ?? 0

  const totalLeads = campaigns?.reduce((sum, c) => {
    const analytics = Array.isArray(c.ad_analytics) ? c.ad_analytics : []
    return sum + analytics.reduce((s: number, a: any) => s + (Number(a.leads) || 0), 0)
  }, 0) ?? 0

  const activeCampaigns = campaigns?.filter(c => c.status === 'active').length ?? 0
  const avgCPL = totalLeads > 0 ? Math.round(totalSpend / totalLeads) : 0

  const initials = (profile.full_name ?? 'KR').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="Campaigns"
        role={profile.role}
        plan={profile.clients?.ads_plan ?? undefined}
        userInitials={initials}
        actions={
          <Link href="/campaigns/new" className="btn-orange text-sm">
            <Plus size={14} /> New Campaign
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#1A2E5A]">Campaigns</h1>
          <p className="text-xs text-gray-500 mt-0.5">Create, launch, and monitor your Meta ad campaigns.</p>
        </div>

        <CampaignStats
          total={campaigns?.length ?? 0}
          active={activeCampaigns}
          totalSpend={totalSpend}
          totalLeads={totalLeads}
          avgCPL={avgCPL}
        />

        <CampaignList campaigns={campaigns ?? []} />
      </div>
    </div>
  )
}
