import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

async function getCallerAndPost(id: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, client_id')
    .eq('id', user.id)
    .single()
  if (!profile) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const admin = createAdminClient()
  const { data: post } = await admin.from('ad_posts').select('*').eq('id', id).single()
  if (!post) return { error: NextResponse.json({ error: 'Post not found' }, { status: 404 }) }

  if (profile.role === 'client_admin' && post.client_id !== profile.client_id) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  if (profile.role !== 'baymo_admin' && profile.role !== 'client_admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { admin, post, profile }
}

const EDITABLE = ['draft', 'scheduled', 'failed', 'cancelled']

/** PATCH /api/posts/[id] — edit message/media/schedule on unpublished posts */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ctx = await getCallerAndPost(id)
  if ('error' in ctx) return ctx.error
  const { admin, post } = ctx

  if (!EDITABLE.includes(post.status)) {
    return NextResponse.json({ error: `Cannot edit a ${post.status} post` }, { status: 409 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const allowed = [
    'message', 'link_url', 'media_urls', 'creative_id', 'content_id',
    'post_type', 'scheduled_at', 'social_account_id', 'status',
  ]
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  // Status can only move between unpublished states here
  if ('status' in updates && !EDITABLE.includes(String(updates.status))) {
    return NextResponse.json({ error: 'Use the publish endpoint to publish' }, { status: 400 })
  }
  if (updates.status === 'scheduled') {
    const when = updates.scheduled_at ?? post.scheduled_at
    if (!when || new Date(String(when)).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'scheduled_at must be a future datetime' }, { status: 400 })
    }
  }

  updates.updated_at = new Date().toISOString()

  const { data, error } = await admin
    .from('ad_posts')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ post: data })
}

/** DELETE /api/posts/[id] — remove unpublished posts (published rows are history, keep them) */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ctx = await getCallerAndPost(id)
  if ('error' in ctx) return ctx.error
  const { admin, post } = ctx

  if (post.status === 'published' || post.status === 'publishing') {
    return NextResponse.json(
      { error: 'Published posts are kept as history. Delete the post on Facebook itself if needed.' },
      { status: 409 }
    )
  }

  const { error } = await admin.from('ad_posts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: id })
}
