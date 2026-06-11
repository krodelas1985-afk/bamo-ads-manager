import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const FB_OAUTH_VERSION = 'v21.0'

/**
 * GET /api/auth/meta/login
 * Starts the operator OAuth flow. baymo_admin only.
 *
 * Scopes now include page publishing (pages_manage_posts) and the
 * Instagram publishing pair. In dev mode these are grantable to app
 * users without App Review, and they work on any page where the
 * operator holds a page role.
 */
export async function GET(request: Request) {
  const appId = process.env.META_APP_ID
  if (!appId) {
    return NextResponse.json({ error: 'META_APP_ID not configured' }, { status: 500 })
  }

  // Gate: only baymo_admin may connect the operator token
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'baymo_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // CSRF state
  const state = crypto.randomUUID()
  const cookieStore = await cookies()
  cookieStore.set('meta_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin}/api/auth/meta/callback`

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    scope: [
      // Marketing API
      'ads_management',
      'ads_read',
      'business_management',
      // Pages — listing, reading, and publishing
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      // Messenger (keeps Campaign Engine grant explicit)
      'pages_messaging',
      // Instagram publishing (placeholder until IG accounts are linked)
      'instagram_basic',
      'instagram_content_publish',
    ].join(','),
    response_type: 'code',
  })

  return NextResponse.redirect(
    `https://www.facebook.com/${FB_OAUTH_VERSION}/dialog/oauth?${params.toString()}`
  )
}
