import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import WebsiteBuilder from '@/components/website/WebsiteBuilder'

export default async function WebsitePage() {
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

  const [{ data: website }, { data: builds }, { data: listings }] = await Promise.all([
    supabase.from('client_bamo_website').select('*').match(clientFilter).maybeSingle(),
    supabase.from('client_website_builds').select('*').match(clientFilter).order('started_at', { ascending: false }).limit(5),
    supabase.from('ad_listings').select('id, property_name, price, city, property_type').match(clientFilter).limit(20),
  ])

  const initials = (profile.full_name ?? 'KR').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="Website Builder"
        role={profile.role}
        plan={profile.clients?.ads_plan ?? undefined}
        userInitials={initials}
      />
      <div className="flex-1 overflow-hidden">
        <WebsiteBuilder
          website={website ?? null}
          builds={builds ?? []}
          listings={listings ?? []}
          clientId={profile.client_id ?? profile.id}
          clientName={profile.clients?.name ?? 'My Site'}
        />
      </div>
    </div>
  )
}
