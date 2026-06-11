import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import AnalyticsClient from '@/components/analytics/AnalyticsClient'
import WeeklyReport from '@/components/analytics/WeeklyReport'

export default async function AnalyticsPage() {
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

  // Fetch analytics data
  const [
    { data: analytics },
    { data: campaigns },
    { data: websiteAnalytics },
    { data: posts },
    { data: latestReport },
  ] = await Promise.all([
    supabase
      .from('ad_analytics')
      .select('*, ad_campaigns(name, status)')
      .match(clientFilter)
      .order('date', { ascending: true })
      .limit(90),
    supabase
      .from('ad_campaigns')
      .select('id, name, status, budget_daily, budget_total')
      .match(clientFilter)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('client_website_analytics')
      .select('*')
      .match(clientFilter)
      .order('date', { ascending: false })
      .limit(30),
    supabase
      .from('ad_posts')
      .select('id, status, platform')
      .match(clientFilter),
    supabase
      .from('ad_reports')
      .select('*')
      .match(clientFilter)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  // Aggregate totals
  const totals = (analytics ?? []).reduce((acc, a) => ({
    impressions: acc.impressions + (a.impressions ?? 0),
    reach: acc.reach + (a.reach ?? 0),
    clicks: acc.clicks + (a.clicks ?? 0),
    spend: acc.spend + (Number(a.spend) ?? 0),
    leads: acc.leads + (a.leads ?? 0),
  }), { impressions: 0, reach: 0, clicks: 0, spend: 0, leads: 0 })

  const avgCPL = totals.leads > 0 ? Math.round(totals.spend / totals.leads) : 0

  // Website totals
  const websiteTotals = (websiteAnalytics ?? []).reduce((acc, w) => ({
    pageViews: acc.pageViews + (w.page_views ?? 0),
    visitors: acc.visitors + (w.unique_visitors ?? 0),
    formSubmissions: acc.formSubmissions + (w.lead_form_submissions ?? 0),
    listingClicks: acc.listingClicks + (w.listing_clicks ?? 0),
  }), { pageViews: 0, visitors: 0, formSubmissions: 0, listingClicks: 0 })

  // Per-campaign analytics
  const campaignPerf = campaigns?.map(c => {
    const campAnalytics = (analytics ?? []).filter(a => a.campaign_id === c.id)
    const spend = campAnalytics.reduce((s, a) => s + (Number(a.spend) ?? 0), 0)
    const leads = campAnalytics.reduce((s, a) => s + (a.leads ?? 0), 0)
    const reach = campAnalytics.reduce((s, a) => s + (a.reach ?? 0), 0)
    const cpl = leads > 0 ? Math.round(spend / leads) : 0
    return { ...c, spend, leads, reach, cpl }
  }) ?? []

  const maxSpend = Math.max(...campaignPerf.map(c => c.spend), 1)

  const initials = (profile.full_name ?? 'KR').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="Analytics"
        role={profile.role}
        plan={profile.clients?.ads_plan ?? undefined}
        userInitials={initials}
        actions={
          <button className="btn-ghost text-sm">
            ⬇ Export Report
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 pt-6">
          <WeeklyReport
            initialReport={latestReport ?? null}
            canGenerate={true}
            clientId={profile.role === 'client_admin' ? profile.client_id : null}
          />
        </div>
        <AnalyticsClient
          analytics={analytics ?? []}
          totals={totals}
          avgCPL={avgCPL}
          campaignPerf={campaignPerf}
          maxSpend={maxSpend}
          websiteTotals={websiteTotals}
          websiteAnalytics={websiteAnalytics ?? []}
          postsCount={posts?.length ?? 0}
          publishedPostsCount={posts?.filter(p => p.status === 'published').length ?? 0}
        />
      </div>
    </div>
  )
}
