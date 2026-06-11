import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import AssetLibraryClient from '@/components/assets/AssetLibraryClient'
import ClientSelector from '@/components/analytics/ClientSelector'

function parseDimensions(dim: string | null): { width: number | null; height: number | null } {
  if (!dim) return { width: null, height: null }
  const m = dim.match(/^(\d+)\s*[xX×]\s*(\d+)$/)
  return m ? { width: Number(m[1]), height: Number(m[2]) } : { width: null, height: null }
}

export default async function AssetsPage({
  searchParams,
}: {
  searchParams?: { client_id?: string }
}) {
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
  const selectedClientId = isAdmin ? (searchParams?.client_id ?? null) : profile.client_id
  const clientFilter = selectedClientId ? { client_id: selectedClientId } : {}

  const [{ data: uploads }, { data: creatives }, { data: clientList }] = await Promise.all([
    supabase
      .from('client_assets')
      .select('*')
      .match(clientFilter)
      .order('created_at', { ascending: false }),
    supabase
      .from('creatives')
      .select('id, client_id, creative_type, asset_url, thumbnail_url, original_filename, dimensions, file_size_bytes, duration_seconds, created_at')
      .match(clientFilter)
      .is('deleted_at', null)
      .not('asset_url', 'is', null)
      .order('created_at', { ascending: false }),
    isAdmin
      ? supabase.from('clients').select('id, name').order('name')
      : Promise.resolve({ data: null }),
  ])

  const uploadAssets = (uploads ?? []).map(a => ({ ...a, source: 'upload' as const }))

  const creativeAssets = (creatives ?? []).map(c => {
    const { width, height } = parseDimensions(c.dimensions)
    return {
      id: `creative-${c.id}`,
      file_name: c.original_filename ?? `Generated ${c.creative_type ?? 'creative'}`,
      file_type: c.creative_type === 'video' ? 'video' : 'image',
      mime_type: null,
      file_size_bytes: c.file_size_bytes ?? null,
      public_url: c.asset_url as string,
      storage_path: '',
      width,
      height,
      duration_seconds: c.duration_seconds ?? null,
      thumbnail_url: c.thumbnail_url ?? null,
      folder: 'generated',
      tags: [] as string[],
      used_in_creatives: false,
      used_in_website: false,
      used_in_posts: false,
      usage_count: 0,
      created_at: c.created_at,
      source: 'creative' as const,
    }
  })

  const assets = [...uploadAssets, ...creativeAssets].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  // Storage used: uploaded files only (creatives live on external/Creatomate URLs)
  const storageUsed = uploadAssets.reduce((sum, a) => sum + (a.file_size_bytes ?? 0), 0)
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
      {isAdmin && (
        <div className="px-5 pt-4">
          <ClientSelector clients={clientList ?? []} />
        </div>
      )}
      <div className="flex-1 overflow-hidden flex">
        <AssetLibraryClient
          key={selectedClientId ?? 'all'}
          assets={assets}
          clientId={selectedClientId}
          storageUsedGB={Number(storageGB)}
          storageMaxGB={5}
        />
      </div>
    </div>
  )
}
