import { createAdminClient } from '@/lib/supabase-admin'

const GRAPH = 'https://graph.facebook.com/v21.0'

export type PublishResult =
  | { ok: true; post_id: string; meta_post_id: string }
  | { ok: false; post_id: string; error: string }

/**
 * Publishes a single ad_posts row to Facebook and manages its full
 * state transition: -> publishing -> published | failed.
 *
 * Used by:
 *  - POST /api/posts (action=publish)
 *  - POST /api/posts/[id]/publish (manual publish / retry)
 *  - POST /api/posts/run-scheduler (n8n cron)
 *
 * Instagram is intentionally not implemented in v1 — rows with
 * platform=instagram are rejected before any state change.
 */
export async function publishPost(postId: string): Promise<PublishResult> {
  const admin = createAdminClient()

  // Load the post
  const { data: post, error: loadErr } = await admin
    .from('ad_posts')
    .select('*')
    .eq('id', postId)
    .single()
  if (loadErr || !post) {
    return { ok: false, post_id: postId, error: loadErr?.message ?? 'Post not found' }
  }

  if (post.platform === 'instagram') {
    return { ok: false, post_id: postId, error: 'Instagram publishing is not yet enabled (v1.1)' }
  }
  if (post.status === 'published') {
    return { ok: false, post_id: postId, error: 'Post is already published' }
  }

  // Optimistic lock: only proceed if we win the transition to 'publishing'.
  // Protects against the scheduler and a manual click racing each other.
  const { data: locked } = await admin
    .from('ad_posts')
    .update({ status: 'publishing', updated_at: new Date().toISOString() })
    .eq('id', postId)
    .in('status', ['draft', 'scheduled', 'failed'])
    .select('id')
  if (!locked || locked.length === 0) {
    return { ok: false, post_id: postId, error: 'Post is already being published' }
  }

  try {
    // Resolve the page + token
    const { pageId, pageToken } = await resolvePage(admin, post)

    // Resolve media: explicit media_urls win; otherwise inherit from creative
    let mediaUrls: string[] = post.media_urls ?? []
    let isVideo = false
    if (mediaUrls.length === 0 && post.creative_id) {
      const { data: creative } = await admin
        .from('creatives')
        .select('asset_url, creative_type')
        .eq('id', post.creative_id)
        .single()
      if (creative?.asset_url) {
        mediaUrls = [creative.asset_url]
        isVideo = creative.creative_type === 'video'
      }
    } else if (mediaUrls.length === 1) {
      isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(mediaUrls[0])
    }

    const metaPostId = await publishToFacebook({
      pageId,
      pageToken,
      message: post.message ?? '',
      linkUrl: post.link_url ?? null,
      mediaUrls,
      isVideo,
    })

    await admin
      .from('ad_posts')
      .update({
        status: 'published',
        meta_post_id: metaPostId,
        published_at: new Date().toISOString(),
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)

    return { ok: true, post_id: postId, meta_post_id: metaPostId }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown publish error'
    await admin
      .from('ad_posts')
      .update({
        status: 'failed',
        error_message: message.slice(0, 500),
        retry_count: (post.retry_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)
    return { ok: false, post_id: postId, error: message }
  }
}

async function resolvePage(
  admin: ReturnType<typeof createAdminClient>,
  post: { social_account_id: string | null; client_id: string | null }
): Promise<{ pageId: string; pageToken: string }> {
  // Preferred: the explicit social account on the post
  if (post.social_account_id) {
    const { data: acct } = await admin
      .from('ad_social_accounts')
      .select('account_id, access_token, is_active, platform')
      .eq('id', post.social_account_id)
      .single()
    if (acct?.access_token && acct.is_active && acct.platform === 'facebook') {
      return { pageId: acct.account_id, pageToken: acct.access_token }
    }
  }
  // Fallback: the client's facebook page row
  if (post.client_id) {
    const { data: acct } = await admin
      .from('ad_social_accounts')
      .select('account_id, access_token')
      .eq('client_id', post.client_id)
      .eq('platform', 'facebook')
      .eq('is_active', true)
      .maybeSingle()
    if (acct?.access_token) {
      return { pageId: acct.account_id, pageToken: acct.access_token }
    }
  }
  throw new Error('No active Facebook page connected for this post — check Settings / re-run the Meta connect flow')
}

async function publishToFacebook(args: {
  pageId: string
  pageToken: string
  message: string
  linkUrl: string | null
  mediaUrls: string[]
  isVideo: boolean
}): Promise<string> {
  const { pageId, pageToken, message, linkUrl, mediaUrls, isVideo } = args

  // VIDEO
  if (isVideo && mediaUrls.length === 1) {
    const json = await graphPost(`${pageId}/videos`, {
      file_url: mediaUrls[0],
      description: message,
      access_token: pageToken,
    })
    return json.id
  }

  // SINGLE PHOTO
  if (mediaUrls.length === 1) {
    const json = await graphPost(`${pageId}/photos`, {
      url: mediaUrls[0],
      caption: message,
      access_token: pageToken,
    })
    return json.post_id ?? json.id
  }

  // MULTI-PHOTO: upload each unpublished, then attach to one feed post
  if (mediaUrls.length > 1) {
    const photoIds: string[] = []
    for (const url of mediaUrls.slice(0, 10)) {
      const json = await graphPost(`${pageId}/photos`, {
        url,
        published: 'false',
        access_token: pageToken,
      })
      photoIds.push(json.id)
    }
    const params: Record<string, string> = { message, access_token: pageToken }
    photoIds.forEach((id, i) => {
      params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id })
    })
    const json = await graphPost(`${pageId}/feed`, params)
    return json.id
  }

  // LINK or PLAIN TEXT
  const params: Record<string, string> = { message, access_token: pageToken }
  if (linkUrl) params.link = linkUrl
  const json = await graphPost(`${pageId}/feed`, params)
  return json.id
}

async function graphPost(path: string, params: Record<string, string>) {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })
  const json = await res.json()
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Graph API error on /${path}`)
  }
  return json
}
