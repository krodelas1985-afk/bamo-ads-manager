import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { publishPost } from '@/lib/meta-publish'

export const maxDuration = 60

/**
 * POST /api/posts/run-scheduler
 * Called by the n8n cron workflow every 15 minutes.
 * Auth: X-Scheduler-Secret header must match env SCHEDULER_SECRET.
 *
 * Scans for facebook posts with status=scheduled and scheduled_at in
 * the past, publishes each via the shared library (which handles the
 * publishing -> published/failed transitions and optimistic locking),
 * and returns a summary for n8n's execution log.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.SCHEDULER_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'SCHEDULER_SECRET not configured' }, { status: 500 })
  }
  if (request.headers.get('x-scheduler-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: due, error } = await admin
    .from('ad_posts')
    .select('id')
    .eq('status', 'scheduled')
    .eq('platform', 'facebook')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!due || due.length === 0) {
    return NextResponse.json({ checked_at: new Date().toISOString(), due: 0, results: [] })
  }

  const results = []
  for (const row of due) {
    results.push(await publishPost(row.id))
  }

  return NextResponse.json({
    checked_at: new Date().toISOString(),
    due: due.length,
    published: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    results,
  })
}
