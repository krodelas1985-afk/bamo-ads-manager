import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { publishPost } from '@/lib/meta-publish'

/** POST /api/posts/[id]/publish — publish now (or retry a failed post) */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, client_id')
    .eq('id', user.id)
    .single()
  if (!profile || (profile.role !== 'baymo_admin' && profile.role !== 'client_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Ownership check for client_admin
  const admin = createAdminClient()
  const { data: post } = await admin.from('ad_posts').select('id, client_id').eq('id', id).single()
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  if (profile.role === 'client_admin' && post.client_id !== profile.client_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await publishPost(id)
  return NextResponse.json(result, { status: result.ok ? 200 : 422 })
}
