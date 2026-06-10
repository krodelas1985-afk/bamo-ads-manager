import { createClient } from '@supabase/supabase-js'

/**
 * Service-role client. SERVER ONLY — bypasses RLS.
 * Used exclusively for ad_operator_tokens (RLS on, no policies).
 * Never import this in a client component.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured')
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
