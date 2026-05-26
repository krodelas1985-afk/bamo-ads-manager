import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ListingForm from '@/components/listings/ListingForm'

export default async function NewListingPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, clients(name, ads_plan)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const initials = (profile.full_name ?? 'KR').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="Listings — Add New"
        role={profile.role}
        plan={profile.clients?.ads_plan ?? undefined}
        userInitials={initials}
        actions={
          <Link href="/listings" className="btn-ghost text-sm">
            <ArrowLeft size={13} /> Back
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        <ListingForm clientId={profile.client_id ?? profile.id} />
      </div>
    </div>
  )
}
