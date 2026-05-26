import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import AssetLibraryClient from '@/components/assets/AssetLibraryClient'

export default async function AssetsPage() {
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

  const { data: assets } = await supabase
    .from('client_assets')
    .select('*')
    .match(clientFilter)
    .order('created_at', { ascending: false })

  // Storage used (sum of file sizes)
  const storageUsed = assets?.reduce((sum, a) => sum + (a.file_size_bytes ?? 0), 0) ?? 0
  const storageGB = (storageUsed / (1024 ** 3)).toFixed(2)

  const initials = (profile.full_name ?? 'KR').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="Asset Library"
        role={profile.role}
        plan={profile.clients?.ads_plan ?? undefined}
        userInitials={initials}
      />
      <div className="flex-1 overflow-hidden flex">
        <AssetLibraryClient
          assets={assets ?? []}
          clientId={profile.client_id ?? profile.id}
          storageUsedGB={Number(storageGB)}
          storageMaxGB={5}
        />
      </div>
    </div>
  )
}
