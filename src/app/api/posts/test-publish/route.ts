import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

const GRAPH = 'https://graph.facebook.com/v21.0'

// BaMo house page (clients row "BaMo", REPH Innovation Corp)
const DEFAULT_PAGE_ID = '939438402575577'

/**
 * POST /api/posts/test-publish
 * baymo_admin only. One-shot connectivity test: publishes a plain
 * text post to a page (defaults to BaMo's own page) to verify that
 * pages_manage_posts actually works in dev mode before the full
 * Posts module is built on top of it.
 *
 * Body (optional): { "page_id": "...", "message": "..." }
 *
 * DELETE THIS ROUTE once Handoff 2 (real publish endpoint) lands.
 */
export async function POST(request: NextRequest) {
  // Gate: baymo_admin only
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'baymo_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { page_id?: string; message?: string } = {}
  try {
    body = await request.json()
  } catch {
    // empty body is fine — defaults apply
  }
  const pageId = body.page_id ?? DEFAULT_PAGE_ID
  const message =
    body.message ??
    `BaMo Ads Manager connectivity test — ${new Date().toISOString()}. Safe to delete this post.`

  // Token: ad_social_accounts first, clients.fb_page_token fallback
  const admin = createAdminClient()
  let pageToken: string | null = null

  const { data: acct } = await admin
    .from('ad_social_accounts')
    .select('access_token')
    .eq('platform', 'facebook')
    .eq('account_id', pageId)
    .eq('is_active', true)
    .maybeSingle()
  pageToken = acct?.access_token ?? null

  if (!pageToken) {
    const { data: client } = await admin
      .from('clients')
      .select('fb_page_token')
      .eq('fb_page_id', pageId)
      .maybeSingle()
    pageToken = client?.fb_page_token ?? null
  }

  if (!pageToken) {
    return NextResponse.json(
      { error: `No page token found for page ${pageId}. Re-run the Meta connect flow first.` },
      { status: 400 }
    )
  }

  // Publish
  const res = await fetch(`${GRAPH}/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ message, access_token: pageToken }),
  })
  const json = await res.json()

  if (!res.ok || !json.id) {
    return NextResponse.json(
      {
        ok: false,
        graph_error: json.error ?? json,
        hint:
          json.error?.code === 200 || json.error?.code === 10
            ? 'Permission error: the page token likely predates pages_manage_posts. Re-run /api/auth/meta/login and try again.'
            : undefined,
      },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true, post_id: json.id, page_id: pageId })
}
