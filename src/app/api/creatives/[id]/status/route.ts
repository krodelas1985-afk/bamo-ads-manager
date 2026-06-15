import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, client_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['baymo_admin', 'client_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const query = supabase
    .from('creative_jobs')
    .select('id, status, result_url, error_message, creative_id, updated_at, client_id')
    .eq('id', id)

  // client_admin may only see their own jobs
  if (profile.role === 'client_admin') {
    query.eq('client_id', profile.client_id)
  }

  const { data: job, error } = await query.single()

  if (error || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  let renderUrl: string | undefined
  let thumbnailUrl: string | undefined

  if (job.status === 'completed' && job.creative_id) {
    const { data: creative } = await supabase
      .from('creatives')
      .select('asset_url, thumbnail_url')
      .eq('id', job.creative_id)
      .single()
    renderUrl = creative?.asset_url ?? job.result_url ?? undefined
    thumbnailUrl = creative?.thumbnail_url ?? undefined
  } else {
    renderUrl = job.result_url ?? undefined
  }

  return NextResponse.json(
    {
      id: job.id,
      status: job.status,
      renderUrl,
      thumbnailUrl,
      errorMessage: job.error_message ?? undefined,
      updatedAt: job.updated_at,
    },
    {
      headers: { 'Cache-Control': 'no-store' },
    }
  )
}
