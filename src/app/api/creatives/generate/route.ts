import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const N8N_WEBHOOK = 'https://n8n-bahaymo.onrender.com/webhook/bamo-video-generate'

/**
 * POST /api/creatives/generate
 * Inserts a pending creative_jobs row, fires n8n async (5s timeout),
 * returns 202 immediately. Render status is tracked via
 * GET /api/creatives/[id]/status.
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

  if (profile.role === 'client_admin') {
    body.client_id = profile.client_id
  }
  if (!body.client_id) {
    return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
  }
  if (!body.template_id) {
    return NextResponse.json({ error: 'template_id is required' }, { status: 400 })
  }

  // Insert pending job row before calling n8n — gives us a stable ID to
  // return to the browser regardless of how long n8n takes.
  const { data: job, error: insertError } = await supabase
    .from('creative_jobs')
    .insert({
      client_id: body.client_id,
      job_type: 'creatomate_video',
      request_payload: body,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertError || !job) {
    return NextResponse.json({ error: 'Failed to create job record' }, { status: 500 })
  }

  // Call n8n with a 5-second timeout — just long enough to confirm it
  // accepted the job. n8n should be configured to respond immediately
  // (see manual n8n step in the async render migration notes).
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)

  try {
    const res = await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bamo-secret': process.env.N8N_WEBHOOK_SECRET ?? '',
      },
      body: JSON.stringify({ ...body, creative_job_id: job.id }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      await supabase
        .from('creative_jobs')
        .update({ status: 'failed', error_message: 'Failed to dispatch render job' })
        .eq('id', job.id)
      return NextResponse.json(
        { error: `Generation webhook error ${res.status}` },
        { status: 502 }
      )
    }
  } catch {
    clearTimeout(timeoutId)
    await supabase
      .from('creative_jobs')
      .update({ status: 'failed', error_message: 'Failed to dispatch render job' })
      .eq('id', job.id)
    return NextResponse.json(
      { error: 'Could not reach render service — please try again.' },
      { status: 502 }
    )
  }

  // n8n acknowledged — mark processing and hand the job ID to the client
  await supabase
    .from('creative_jobs')
    .update({ status: 'processing' })
    .eq('id', job.id)

  return NextResponse.json(
    { creativeId: job.id, status: 'processing' },
    { status: 202 }
  )
}
