import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'

const GRAPH = 'https://graph.facebook.com/v21.0'

type FbPage = {
  id: string
  name?: string
  access_token?: string
  instagram_business_account?: { id: string; username?: string }
}

/**
 * GET /api/auth/meta/callback
 * 1. Validates CSRF state
 * 2. Exchanges code -> short-lived token -> long-lived token (~60 days)
 * 3. Fetches FB user identity + granted scopes
 * 4. Deactivates previous operator tokens, inserts the new one
 * 5. NEW: syncs /me/accounts into ad_social_accounts (FB page rows +
 *    IG rows where an IG business account is linked) and refreshes
 *    clients.fb_page_token for matching clients. Page tokens derived
 *    from a long-lived user token do not expire.
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

    // 5. sync pages + IG accounts into ad_social_accounts
    //    Non-fatal: a sync failure should not invalidate the connect flow.
    let syncedPages = 0
    let syncedIg = 0
    try {
      const pagesRes = await fetch(
        `${GRAPH}/me/accounts?` +
          new URLSearchParams({
            fields: 'id,name,access_token,instagram_business_account{id,username}',
            limit: '100',
            access_token: longLivedToken,
          })
      )
      const pagesJson = await pagesRes.json()
      if (!pagesRes.ok) throw new Error(pagesJson.error?.message ?? 'Failed to list pages')
      const pages: FbPage[] = pagesJson.data ?? []

      // client lookup by fb_page_id for client_id mapping
      const { data: clientRows } = await admin
        .from('clients')
        .select('id, fb_page_id')
        .not('fb_page_id', 'is', null)
      const clientByPage = new Map<string, string>(
        (clientRows ?? []).map((c: { id: string; fb_page_id: string }) => [c.fb_page_id, c.id])
      )

      for (const page of pages) {
        if (!page.access_token) continue
        const clientId = clientByPage.get(page.id) ?? null

        await upsertSocialAccount(admin, {
          client_id: clientId,
          platform: 'facebook',
          account_id: page.id,
          account_name: page.name ?? null,
          access_token: page.access_token,
          meta: {},
        })
        syncedPages++

        // refresh the legacy column so Campaign Engine keeps a fresh token
        if (clientId) {
          await admin
            .from('clients')
            .update({ fb_page_token: page.access_token })
            .eq('id', clientId)
        }

        // IG business account linked to this page -> instagram row
        if (page.instagram_business_account?.id) {
          await upsertSocialAccount(admin, {
            client_id: clientId,
            platform: 'instagram',
            account_id: page.instagram_business_account.id,
            account_name: page.instagram_business_account.username ?? null,
            // IG publishing authenticates with the linked page token
            access_token: page.access_token,
            meta: { linked_fb_page_id: page.id },
          })
          syncedIg++
        }
      }
    } catch (syncErr) {
      const reason = syncErr instanceof Error ? syncErr.message : 'page_sync_failed'
      return NextResponse.redirect(settingsUrl(`connected&pages=error&reason=${encodeURIComponent(reason)}`))
    }

    return NextResponse.redirect(settingsUrl(`connected&pages=${syncedPages}&ig=${syncedIg}`))
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown'
    return NextResponse.redirect(settingsUrl(`error&reason=${encodeURIComponent(reason)}`))
  }
}

/**
 * Manual upsert keyed on (platform, account_id). We avoid Postgres
 * ON CONFLICT here because client_id is nullable and NULLs are
 * distinct in unique indexes.
 */
async function upsertSocialAccount(
  admin: ReturnType<typeof createAdminClient>,
  row: {
    client_id: string | null
    platform: 'facebook' | 'instagram'
    account_id: string
    account_name: string | null
    access_token: string
    meta: Record<string, unknown>
  }
) {
  const { data: existing } = await admin
    .from('ad_social_accounts')
    .select('id')
    .eq('platform', row.platform)
    .eq('account_id', row.account_id)
    .maybeSingle()

  if (existing?.id) {
    await admin
      .from('ad_social_accounts')
      .update({
        client_id: row.client_id,
        account_name: row.account_name,
        access_token: row.access_token,
        token_expires_at: null, // page tokens from long-lived user tokens don't expire
        is_active: true,
        meta: row.meta,
      })
      .eq('id', existing.id)
  } else {
    await admin.from('ad_social_accounts').insert({
      client_id: row.client_id,
      platform: row.platform,
      account_id: row.account_id,
      account_name: row.account_name,
      access_token: row.access_token,
      token_expires_at: null,
      is_active: true,
      meta: row.meta,
    })
  }
}
