import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import CampaignForm from '@/components/campaigns/CampaignForm'

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ creative_id?: string; listing_id?: string }>
}) {
  const params = await searchParams
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

  const [{ data: listings }, { data: creatives }, { data: socialAccounts }] = await Promise.all([
    supabase.from('ad_listings').select('id, property_name, price, city, property_type').match(clientFilter).limit(20),
    supabase.from('ad_creatives').select('id, type, source, asset_url, thumbnail_url').match(clientFilter).eq('status', 'ready').limit(20),
    supabase.from('ad_social_accounts').select('id, platform, account_name').match(clientFilter).eq('is_active', true),
  ])

  const initials = (profile.full_name ?? 'KR').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="Campaigns — New"
        role={profile.role}
        plan={profile.clients?.ads_plan ?? undefined}
        userInitials={initials}
        actions={
          <Link href="/campaigns" className="btn-ghost text-sm">
            <ArrowLeft size={13} /> Back
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        <CampaignForm
          clientId={profile.client_id ?? profile.id}
          listings={listings ?? []}
          creatives={creatives ?? []}
          socialAccounts={socialAccounts ?? []}
          defaultCreativeId={params.creative_id}
          defaultListingId={params.listing_id}
        />
      </div>
    </div>
  )
}
