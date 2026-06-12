import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import CreativeForm from '@/components/creatives/CreativeForm'

export default async function NewCreativePage({
  searchParams,
}: {
  searchParams: Promise<{ content_id?: string }>
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

  const [{ data: listings }, { data: contents }, { data: assets }, { data: clients }, { data: templates }] = await Promise.all([
    supabase.from('ad_listings').select('id, client_id, property_name, price, city, property_type, primary_photo_url').match(clientFilter).limit(40),
    supabase.from('ad_content').select('id, client_id, title, hook, caption').match(clientFilter).eq('status', 'approved').limit(40),
    supabase.from('client_assets').select('id, client_id, file_name, public_url, file_type, thumbnail_url').match(clientFilter).eq('file_type', 'image').limit(60),
    profile.role === 'baymo_admin'
      ? supabase.from('clients').select('id, name').order('name')
      : Promise.resolve({ data: null }),
    supabase.from('ad_templates')
      .select('id, client_id, name, type, source, template_id, thumbnail_url, is_default')
      .eq('source', 'creatomate')
      .order('is_default', { ascending: false }),
  ])

  const initials = (profile.full_name ?? 'KR').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="Creatives — Generate New"
        role={profile.role}
        plan={profile.clients?.ads_plan ?? undefined}
        userInitials={initials}
        actions={
          <Link href="/creatives" className="btn-ghost text-sm">
            <ArrowLeft size={13} /> Back
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        <CreativeForm
          clientId={profile.client_id ?? null}
          clientName={profile.clients?.name ?? null}
          clients={clients ?? []}
          templates={templates ?? []}
          listings={listings ?? []}
          contents={contents ?? []}
          assets={assets ?? []}
          defaultContentId={params.content_id}
        />
      </div>
    </div>
  )
}
