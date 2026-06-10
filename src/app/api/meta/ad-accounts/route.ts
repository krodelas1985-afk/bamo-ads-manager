import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

const GRAPH = 'https://graph.facebook.com/v21.0'

/**
 * GET /api/meta/ad-accounts
 * baymo_admin only. Returns operator connection status and the list of
 * Meta ad accounts the operator token can access — used in Settings to
 * map clients.ad_account_id.
 */
export async function GET() {
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

  const admin = createAdminClient()
  const { data: token } = await admin
    .from('ad_operator_tokens')
    .select('access_token, fb_user_name, expires_at, scopes')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!token) {
    return NextResponse.json({ connected: false, ad_accounts: [] })
  }

  const daysLeft = token.expires_at
    ? Math.floor((new Date(token.expires_at).getTime() - Date.now()) / 86_400_000)
    : null

  try {
    const res = await fetch(
      `${GRAPH}/me/adaccounts?fields=id,account_id,name,account_status,currency&limit=100&access_token=${token.access_token}`
    )
    const json = await res.json()
    if (!res.ok) throw new Error(json.error?.message ?? 'Graph API error')

    return NextResponse.json({
      connected: true,
      operator: token.fb_user_name,
      token_days_left: daysLeft,
      scopes: token.scopes,
      ad_accounts: (json.data ?? []).map((a: Record<string, unknown>) => ({
        id: a.id, // act_XXXX
        account_id: a.account_id, // numeric — store this in clients.ad_account_id
        name: a.name,
        status: a.account_status,
        currency: a.currency,
      })),
    })
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json(
      { connected: true, operator: token.fb_user_name, token_days_left: daysLeft, error: reason, ad_accounts: [] },
      { status: 502 }
    )
  }
}
