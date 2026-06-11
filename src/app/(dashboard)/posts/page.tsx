import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import PostsClient from '@/components/posts/PostsClient'

export default async function PostsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, clients(name, ads_plan)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const isAdmin = profile.role === 'baymo_admin'
  const clientFilter = profile.role === 'client_admin' ? { client_id: profile.client_id } : {}

  const [{ data: posts }, { data: socialAccounts }, { data: creatives }, { data: contents }, { data: listings }, { data: clients }, { data: assetRows }] =
    await Promise.all([
      supabase.from('ad_posts')
        .select('*')
        .match(clientFilter)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('ad_social_accounts')
        .select('id, client_id, platform, account_id, account_name, is_active')
        .match(clientFilter)
        .eq('is_active', true),
      supabase.from('creatives')
        .select('id, client_id, creative_type, asset_url, thumbnail_url')
        .match(clientFilter)
        .eq('job_status', 'completed')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(40),
      supabase.from('ad_content')
        .select('id, client_id, title, caption, hook, hashtags')
        .match(clientFilter)
        .order('created_at', { ascending: false })
        .limit(40),
      supabase.from('ad_listings')
        .select('id, client_id, property_name, price, city, listing_url')
        .match(clientFilter)
        .order('snapshotted_at', { ascending: false })
        .limit(40),
      isAdmin
        ? supabase.from('clients').select('id, name').eq('is_active', true).order('name')
        : Promise.resolve({ data: null }),
      supabase.from('client_assets')
        .select('id, client_id, file_type, public_url, thumbnail_url, file_name')
        .match(clientFilter)
        .order('created_at', { ascending: false })
        .limit(100),
    ])

  const initials = (profile.full_name ?? 'KR').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="Posts"
        role={profile.role}
        plan={profile.clients?.ads_plan ?? undefined}
        userInitials={initials}
      />
      <div className="flex-1 overflow-hidden flex">
        <PostsClient
          role={profile.role}
          posts={posts ?? []}
          socialAccounts={socialAccounts ?? []}
          creatives={creatives ?? []}
          contents={contents ?? []}
          listings={listings ?? []}
          clients={clients ?? []}
          assets={assetRows ?? []}
          defaultClientId={profile.client_id ?? null}
        />
      </div>
    </div>
  )
}
