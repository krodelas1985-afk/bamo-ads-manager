import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ContentForm from '@/components/content/ContentForm'

export default async function NewContentPage() {
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
    .select('id, client_id, property_name, price, city, property_type')
    .match(clientFilter)
    .limit(20)

  const { data: clients } = profile.role === 'baymo_admin'
    ? await supabase.from('clients').select('id, name').order('name')
    : { data: null }

  const initials = (profile.full_name ?? 'KR').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="Content Studio — New"
        role={profile.role}
        plan={profile.clients?.ads_plan ?? undefined}
        userInitials={initials}
        actions={
          <Link href="/content" className="btn-ghost text-sm">
            <ArrowLeft size={13} /> Back
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        <ContentForm
          clientId={profile.client_id ?? null}
          clients={clients ?? []}
          listings={listings ?? []}
        />
      </div>
    </div>
  )
}
