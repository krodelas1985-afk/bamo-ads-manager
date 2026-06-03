import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import Link from 'next/link'
import { Plus, Upload } from 'lucide-react'
import CreativesGrid from '@/components/creatives/CreativesGrid'
import UsageBars from '@/components/creatives/UsageBars'

export default async function CreativesPage() {
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

  const thisMonth = new Date().toISOString().slice(0, 7)
  const { data: usage } = await supabase
    .from('ad_usage_limits')
    .select('images_generated, videos_generated, carousel_generated')
    .match({ ...clientFilter, month: thisMonth })
    .single()

  const { data: creatives } = await supabase
    .from('creatives')
    .select('id, creative_type, generation_method, asset_url, thumbnail_url, job_status, duration_seconds, created_at')
    .match(clientFilter)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(40)

  const initials = (profile.full_name ?? 'KR').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  const planLimits: Record<string, { images: number; videos: number; carousels: number }> = {
    starter: { images: 20, videos: 5, carousels: 20 },
    growth:  { images: 60, videos: 20, carousels: 60 },
    pro:     { images: 999, videos: 60, carousels: 999 },
  }
  const plan = profile.clients?.ads_plan ?? 'starter'
  const limits = planLimits[plan] ?? planLimits.starter

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="Creatives"
        role={profile.role}
        plan={profile.clients?.ads_plan ?? undefined}
        userInitials={initials}
        actions={
          <Link href="/assets" className="btn-ghost text-sm">
            <Upload size={13} /> Upload Asset
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[#1A2E5A]">Creatives</h1>
            <p className="text-xs text-gray-500 mt-0.5">Generate images and videos from your listings and content.</p>
          </div>
          <Link href="/creatives/new" className="btn-orange text-sm">
            <Plus size={14} /> Generate Creative
          </Link>
        </div>

        <UsageBars
          imagesUsed={usage?.images_generated ?? 0}
          videosUsed={usage?.videos_generated ?? 0}
          carouselUsed={usage?.carousel_generated ?? 0}
          imageLimit={limits.images}
          videoLimit={limits.videos}
          carouselLimit={limits.carousels}
        />

        <CreativesGrid creatives={creatives ?? []} />
      </div>
    </div>
  )
}
