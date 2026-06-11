import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

/**
 * /api/analytics/report
 *
 * GET  -> latest report for the caller's client (baymo_admin may pass ?client_id=)
 * POST -> generate a report now.
 *         Auth: session (client_admin = own client, baymo_admin = body.client_id or all)
 *         OR header x-cron-secret === REPORT_CRON_SECRET (n8n weekly cron; body {"all": true})
 *
 * Single source of truth for report generation — the n8n cron calls this route,
 * it does not duplicate the logic.
 */

const REPORT_MODEL = 'claude-sonnet-4-20250514'
const PERIOD_DAYS = 7

type AdAggregate = {
  meta_ad_id: string
  ad_name: string
  meta_campaign_name: string | null
  impressions: number
  reach: number
  clicks: number
  spend: number
  leads: number
  link_clicks: number
  days_active: number
}

async function resolveCaller(request: NextRequest) {
  const cronSecret = process.env.REPORT_CRON_SECRET
  const headerSecret = request.headers.get('x-cron-secret')
  if (cronSecret && headerSecret && headerSecret === cronSecret) {
    return { kind: 'cron' as const }
  }
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { kind: 'unauthorized' as const }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, client_id')
    .eq('id', user.id)
    .single()
  if (!profile) return { kind: 'unauthorized' as const }
  return { kind: 'session' as const, role: profile.role as string, clientId: profile.client_id as string | null }
}

async function aggregateWeek(clientId: string) {
  const admin = createAdminClient()
  const since = new Date(Date.now() - PERIOD_DAYS * 86400000)
  const sinceStr = since.toISOString().slice(0, 10)

  const { data: rows, error } = await admin
    .from('ad_analytics')
    .select('meta_ad_id, meta_ad_name, meta_campaign_name, date, impressions, reach, clicks, spend, leads, link_clicks')
    .eq('client_id', clientId)
    .not('meta_ad_id', 'is', null)
    .gte('date', sinceStr)
  if (error) throw new Error(error.message)

  const byAd = new Map<string, AdAggregate>()
  for (const r of rows ?? []) {
    const key = r.meta_ad_id as string
    const agg = byAd.get(key) ?? {
      meta_ad_id: key,
      ad_name: (r.meta_ad_name as string) ?? key,
      meta_campaign_name: (r.meta_campaign_name as string) ?? null,
      impressions: 0, reach: 0, clicks: 0, spend: 0, leads: 0, link_clicks: 0, days_active: 0,
    }
    agg.impressions += r.impressions ?? 0
    agg.reach += r.reach ?? 0
    agg.clicks += r.clicks ?? 0
    agg.spend += Number(r.spend) || 0
    agg.leads += r.leads ?? 0
    agg.link_clicks += r.link_clicks ?? 0
    agg.days_active += 1
    byAd.set(key, agg)
  }
  return { ads: Array.from(byAd.values()), sinceStr }
}

async function generateReport(clientId: string) {
  const admin = createAdminClient()
  const { ads, sinceStr } = await aggregateWeek(clientId)
  const today = new Date().toISOString().slice(0, 10)

  const totals = ads.reduce(
    (a, x) => ({
      spend: a.spend + x.spend,
      impressions: a.impressions + x.impressions,
      clicks: a.clicks + x.clicks,
      leads: a.leads + x.leads,
      ads_count: a.ads_count + 1,
    }),
    { spend: 0, impressions: 0, clicks: 0, leads: 0, ads_count: 0 }
  )

  if (ads.length === 0) {
    const { data: report, error } = await admin
      .from('ad_reports')
      .insert({
        client_id: clientId,
        period_start: sinceStr,
        period_end: today,
        status: 'no_data',
        summary: 'No ad activity recorded this period.',
        verdicts: [],
        totals,
        model: null,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return report
  }

  const adLines = ads.map(a => {
    const ctr = a.impressions > 0 ? ((a.clicks / a.impressions) * 100).toFixed(2) : '0.00'
    const cpl = a.leads > 0 ? (a.spend / a.leads).toFixed(2) : 'n/a'
    return `- id:${a.meta_ad_id} | "${a.ad_name}" | campaign:"${a.meta_campaign_name ?? 'unknown'}" | ${a.days_active}d active | spend PHP ${a.spend.toFixed(2)} | impressions ${a.impressions} | clicks ${a.clicks} | CTR ${ctr}% | leads ${a.leads} | CPL ${cpl}`
  }).join('\n')

  const prompt = `You are an ad performance analyst for Philippine real estate Facebook ads. Analyze last ${PERIOD_DAYS} days of ad-level data and return ONLY a JSON object, no markdown, no other text:
{
  "summary": "<2-3 sentence plain-language overview an agent without ads expertise understands>",
  "verdicts": [
    {
      "meta_ad_id": "<id>",
      "ad_name": "<name>",
      "verdict": "working" | "watch" | "fatiguing" | "kill",
      "reason": "<one sentence, reference the numbers>",
      "suggested_fix": "<one concrete action; for working ads suggest how to scale>"
    }
  ]
}

Verdict guide: working = healthy CTR/CPL, keep or scale. watch = too little data or mixed signals. fatiguing = declining efficiency or high frequency signs (low CTR despite impressions). kill = spending with no results.
Philippine context: CPL under PHP 150 is good for real estate lead gen; CTR above 1% is healthy; spend with zero leads after PHP 500+ is a kill signal.

Ads:
${adLines}`

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: REPORT_MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!aiRes.ok) throw new Error('Anthropic API error: ' + (await aiRes.text()).slice(0, 300))
  const aiJson = await aiRes.json()
  const text: string = aiJson.content?.[0]?.text ?? '{}'
  const clean = text.replace(/```json|```/g, '').trim()

  let parsed: { summary?: string; verdicts?: Array<Record<string, unknown>> } = {}
  try {
    parsed = JSON.parse(clean)
  } catch {
    throw new Error('AI returned unparseable report')
  }

  // Attach the raw numbers to each verdict so the UI needs no second lookup
  const statsByAd = new Map(ads.map(a => [a.meta_ad_id, a]))
  const verdicts = (parsed.verdicts ?? []).map(v => {
    const s = statsByAd.get(String(v.meta_ad_id))
    return {
      ...v,
      spend: s ? Number(s.spend.toFixed(2)) : null,
      leads: s?.leads ?? null,
      impressions: s?.impressions ?? null,
      clicks: s?.clicks ?? null,
    }
  })

  const { data: report, error } = await admin
    .from('ad_reports')
    .insert({
      client_id: clientId,
      period_start: sinceStr,
      period_end: today,
      status: 'completed',
      summary: parsed.summary ?? null,
      verdicts,
      totals,
      model: REPORT_MODEL,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)

  await admin.from('ad_notifications').insert({
    client_id: clientId,
    type: 'weekly_report_ready',
    title: 'Weekly ad report ready',
    message: `Your ad performance report for ${sinceStr} to ${today} is ready in Analytics.`,
    entity_type: 'analytics',
  })

  return report
}

export async function GET(request: NextRequest) {
  const caller = await resolveCaller(request)
  if (caller.kind === 'unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (caller.kind === 'cron') return NextResponse.json({ error: 'Use POST' }, { status: 405 })

  const { searchParams } = new URL(request.url)
  let clientId = caller.clientId
  if (caller.role === 'baymo_admin' && searchParams.get('client_id')) {
    clientId = searchParams.get('client_id')
  }
  if (!clientId) return NextResponse.json({ report: null })

  const admin = createAdminClient()
  const { data: report } = await admin
    .from('ad_reports')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ report: report ?? null })
}

export async function POST(request: NextRequest) {
  const caller = await resolveCaller(request)
  if (caller.kind === 'unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { client_id?: string; all?: boolean } = {}
  try { body = await request.json() } catch { /* empty body ok */ }

  const admin = createAdminClient()

  try {
    // Cron or baymo_admin: generate for all active clients with a mapped ad account
    if ((caller.kind === 'cron' || caller.role === 'baymo_admin') && body.all) {
      const { data: clients } = await admin
        .from('clients')
        .select('id, name')
        .not('ad_account_id', 'is', null)
        .eq('is_active', true)
      const results = []
      for (const c of clients ?? []) {
        try {
          const r = await generateReport(c.id)
          results.push({ client_id: c.id, status: r.status })
        } catch (e) {
          results.push({ client_id: c.id, status: 'failed', error: e instanceof Error ? e.message : 'unknown' })
        }
      }
      return NextResponse.json({ generated: results })
    }

    // Single client
    let clientId: string | null = null
    if (caller.kind === 'cron') {
      clientId = body.client_id ?? null
    } else if (caller.role === 'baymo_admin') {
      clientId = body.client_id ?? null
    } else {
      clientId = caller.clientId // client_admin: own client only, ignore body
    }
    if (!clientId) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

    const report = await generateReport(clientId)
    return NextResponse.json({ report })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
