import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const N8N_WEBHOOK = 'https://n8n-bahaymo.onrender.com/webhook/bamo-video-generate'

/**
 * POST /api/creatives/generate
 * Authenticated proxy in front of the n8n Creatomate webhook.
 * Why: the webhook was previously called directly from the browser with no
 * auth — anyone could trigger renders and burn Creatomate credits.
 */
export async function POST(req: NextRequest) {
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

  const body = await req.json()

  // client_admin may only generate for their own client
  if (profile.role === 'client_admin') {
    body.client_id = profile.client_id
  }
  if (!body.client_id) {
    return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
  }
  if (!body.template_id) {
    return NextResponse.json({ error: 'template_id is required' }, { status: 400 })
  }

  const res = await fetch(N8N_WEBHOOK, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bamo-secret': process.env.N8N_WEBHOOK_SECRET ?? '',
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  if (!res.ok) {
    return NextResponse.json({ error: `Generation webhook error ${res.status}: ${text.slice(0, 300)}` }, { status: 502 })
  }

  try {
    return NextResponse.json(JSON.parse(text))
  } catch {
    return NextResponse.json({ error: 'Invalid response from generation webhook' }, { status: 502 })
  }
}
