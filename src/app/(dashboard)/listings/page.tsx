import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import Link from 'next/link'
import { RefreshCw, Plus } from 'lucide-react'
import ListingGrid from '@/components/listings/ListingGrid'
import MarketplaceBanner from '@/components/listings/MarketplaceBanner'

export default async function ListingsPage() {
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

  const { data: listings } = await supabase
    .from('ad_listings')
    .select('*')
    .match(clientFilter)
    .order('snapshotted_at', { ascending: false })

  // Get campaign usage per listing
  const { data: campaignListings } = await supabase
    .from('ad_campaigns')
    .select('listing_id')
    .match(clientFilter)
    .not('listing_id', 'is', null)

  const campaignCountByListing: Record<string, number> = {}
  campaignListings?.forEach(c => {
    if (c.listing_id) {
      campaignCountByListing[c.listing_id] = (campaignCountByListing[c.listing_id] ?? 0) + 1
    }
  })

  const initials = (profile.full_name ?? 'KR').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="Listings"
        role={profile.role}
        plan={profile.clients?.ads_plan ?? undefined}
        userInitials={initials}
        actions={
          <div className="flex gap-2">
            <Link href="/listings/new" className="btn-ghost text-sm">
              <Plus size={13} /> Add Listing
            </Link>
            <Link href="/listings?sync=true" className="btn-ghost text-sm">
              <RefreshCw size={13} /> Sync Marketplace
            </Link>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#1A2E5A]">Listings</h1>
          <p className="text-xs text-gray-500 mt-0.5">Pick a listing from BaMo Marketplace to use in your ads and creatives.</p>
        </div>

        <MarketplaceBanner count={listings?.length ?? 0} />

        <ListingGrid
          listings={listings ?? []}
          campaignCounts={campaignCountByListing}
        />
      </div>
    </div>
  )
}
