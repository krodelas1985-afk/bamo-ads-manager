import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { publishPost } from '@/lib/meta-publish'

type Action = 'draft' | 'schedule' | 'publish'

async function getCaller() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, client_id')
    .eq('id', user.id)
    .single()
  return profile ?? null
}

/** GET /api/posts?client_id=&status= — role-scoped list */
export async function GET(request: NextRequest) {
  const caller = await getCaller()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const admin = createAdminClient()

  let q = admin.from('ad_posts').select('*').order('created_at', { ascending: false }).limit(200)

  if (caller.role === 'client_admin') {
    q = q.eq('client_id', caller.client_id)
  } else if (searchParams.get('client_id')) {
    q = q.eq('client_id', searchParams.get('client_id'))
  }
  if (searchParams.get('status')) q = q.eq('status', searchParams.get('status'))

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data })
}

/**
 * POST /api/posts
 * Body: {
 *   client_id, social_account_id?, platforms: ['facebook','instagram'],
 *   post_type, message, link_url?, creative_id?, content_id?,
 *   media_urls?, action: 'draft'|'schedule'|'publish', scheduled_at?
 * }
 * Creates one row per platform. Rules:
 *  - instagram rows are always created as drafts (publishing is v1.1)
 *  - schedule requires scheduled_at in the future
 *  - publish fires immediately (facebook only) via the shared library
 */
export async function POST(request: NextRequest) {
  const caller = await getCaller()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    client_id?: string
    social_account_id?: string | null
    platforms?: string[]
    post_type?: string
    message?: string
    link_url?: string | null
    creative_id?: string | null
    content_id?: string | null
    media_urls?: string[]
    action?: Action
    scheduled_at?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Resolve and authorize client
  const clientId = caller.role === 'client_admin' ? caller.client_id : body.client_id
  if (!clientId) {
    return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
  }
  if (caller.role !== 'baymo_admin' && caller.role !== 'client_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const platforms = (body.platforms ?? []).filter(p => p === 'facebook' || p === 'instagram')
  if (platforms.length === 0) {
    return NextResponse.json({ error: 'Select at least one platform (facebook or instagram)' }, { status: 400 })
  }
  if (!body.message?.trim() && !body.creative_id && !(body.media_urls?.length)) {
    return NextResponse.json({ error: 'Post needs a message or media' }, { status: 400 })
  }

  const action: Action = body.action ?? 'draft'
  if (action === 'schedule') {
    if (!body.scheduled_at || new Date(body.scheduled_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'scheduled_at must be a future datetime' }, { status: 400 })
    }
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const rows = platforms.map(platform => {
    // Instagram: drafts only in v1
    const effective: Action = platform === 'instagram' ? 'draft' : action
    return {
      client_id: clientId,
      social_account_id: platform === 'facebook' ? body.social_account_id ?? null : null,
      content_id: body.content_id ?? null,
      creative_id: body.creative_id ?? null,
      platform,
      post_type: body.post_type ?? 'feed',
      message: body.message ?? null,
      link_url: body.link_url ?? null,
      media_urls: body.media_urls ?? [],
      status: effective === 'schedule' ? 'scheduled' : 'draft',
      scheduled_at: effective === 'schedule' ? body.scheduled_at : null,
      created_by: caller.id,
      created_at: now,
      updated_at: now,
    }
  })

  const { data: inserted, error } = await admin.from('ad_posts').insert(rows).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Immediate publish (facebook rows only)
  const results = []
  if (action === 'publish') {
    for (const row of inserted ?? []) {
      if (row.platform === 'facebook') {
        results.push(await publishPost(row.id))
      }
    }
  }

  // Return fresh rows so the UI gets post-publish statuses
  const ids = (inserted ?? []).map(r => r.id)
  const { data: fresh } = await admin.from('ad_posts').select('*').in('id', ids)

  return NextResponse.json({
    posts: fresh ?? inserted,
    publish_results: results,
    instagram_note: platforms.includes('instagram') && action !== 'draft'
      ? 'Instagram rows were saved as drafts — IG publishing arrives in v1.1'
      : undefined,
  })
}
