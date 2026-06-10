import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'

const GRAPH = 'https://graph.facebook.com/v21.0'

/**
 * GET /api/auth/meta/callback
 * 1. Validates CSRF state
 * 2. Exchanges code -> short-lived token -> long-lived token (~60 days)
 * 3. Fetches FB user identity + granted scopes
 * 4. Deactivates previous operator tokens, inserts the new one
 */
export async function GET(request: NextRequest) {
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) {
    return NextResponse.json({ error: 'Meta app credentials not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const fbError = searchParams.get('error_description') ?? searchParams.get('error')

  const settingsUrl = (q: string) =>
    new URL(`/settings?meta=${q}`, process.env.NEXT_PUBLIC_APP_URL ?? request.url)

  if (fbError) return NextResponse.redirect(settingsUrl(`error&reason=${encodeURIComponent(fbError)}`))
  if (!code) return NextResponse.redirect(settingsUrl('error&reason=missing_code'))

  // CSRF check
  const cookieStore = await cookies()
  const savedState = cookieStore.get('meta_oauth_state')?.value
  cookieStore.delete('meta_oauth_state')
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(settingsUrl('error&reason=state_mismatch'))
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin}/api/auth/meta/callback`

  try {
    // 1. code -> short-lived token
    const tokenRes = await fetch(
      `${GRAPH}/oauth/access_token?` +
        new URLSearchParams({
          client_id: appId,
          client_secret: appSecret,
          redirect_uri: redirectUri,
          code,
        })
    )
    const tokenJson = await tokenRes.json()
    if (!tokenRes.ok || !tokenJson.access_token) {
      throw new Error(tokenJson.error?.message ?? 'Token exchange failed')
    }

    // 2. short-lived -> long-lived (~60 days)
    const longRes = await fetch(
      `${GRAPH}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: tokenJson.access_token,
        })
    )
    const longJson = await longRes.json()
    if (!longRes.ok || !longJson.access_token) {
      throw new Error(longJson.error?.message ?? 'Long-lived exchange failed')
    }
    const longLivedToken: string = longJson.access_token
    const expiresAt = longJson.expires_in
      ? new Date(Date.now() + longJson.expires_in * 1000).toISOString()
      : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() // assume 60 days

    // 3. identity + granted scopes
    const meRes = await fetch(`${GRAPH}/me?fields=id,name&access_token=${longLivedToken}`)
    const me = await meRes.json()
    if (!meRes.ok || !me.id) throw new Error(me.error?.message ?? 'Failed to fetch identity')

    const permRes = await fetch(`${GRAPH}/me/permissions?access_token=${longLivedToken}`)
    const perms = await permRes.json()
    const grantedScopes: string[] = (perms.data ?? [])
      .filter((p: { status: string }) => p.status === 'granted')
      .map((p: { permission: string }) => p.permission)

    // 4. store — deactivate old, insert new (service role, RLS bypass)
    const admin = createAdminClient()
    await admin.from('ad_operator_tokens').update({ is_active: false }).eq('is_active', true)
    const { error: insertError } = await admin.from('ad_operator_tokens').insert({
      fb_user_id: me.id,
      fb_user_name: me.name ?? null,
      access_token: longLivedToken,
      token_type: 'long_lived_user',
      scopes: grantedScopes,
      expires_at: expiresAt,
      is_active: true,
    })
    if (insertError) throw new Error(insertError.message)

    return NextResponse.redirect(settingsUrl('connected'))
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown'
    return NextResponse.redirect(settingsUrl(`error&reason=${encodeURIComponent(reason)}`))
  }
}
