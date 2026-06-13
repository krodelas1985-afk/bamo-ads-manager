import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { generateText } from '@/lib/ai-provider'

export const maxDuration = 60

const GOALS: Record<string, string> = {
  new_listing: 'Announce a property that just hit the market. Create excitement and urgency to inquire or book a viewing.',
  open_house: 'Invite people to an open house / tripping. Emphasize the date, ease of visiting, and what they will see.',
  price_drop: 'Announce a price improvement. Emphasize the new value and that serious buyers should move quickly.',
  lead_generation: 'Generate inquiries. End with a clear, low-friction call to action (message us, comment, send a DM).',
  brand_authority: 'Position the agent/brokerage as a trusted local expert. Educational or insight-driven, soft sell only.',
  market_update: 'Share a brief, useful real estate market insight relevant to Filipino buyers and sellers. Build trust.',
  greeting: 'A warm holiday or occasion greeting from the brand. No selling. Keep it short and sincere.',
}

const TONES: Record<string, string> = {
  professional: 'Polished, trustworthy, broker-grade professional English.',
  friendly: 'Warm, approachable, conversational. Like a helpful kapitbahay who knows real estate.',
  taglish: 'Natural Taglish — conversational Filipino-English mix the way Metro Manila and CALABARZON agents actually post. Keep it tasteful, not cringe.',
  urgent: 'Energetic and time-sensitive. Push action without being spammy.',
  luxury: 'Elegant, understated, aspirational. Fewer words, more weight.',
}

/**
 * POST /api/posts/generate
 * Body: { client_id, goal, tone, platform?, post_type?, listing_id?, instructions? }
 * Builds the prompt server-side, calls the AI provider, saves the result to
 * ad_content (so it appears in "Pull from Content" and stays traceable),
 * and returns the generated fields for the composer.
 */
export async function POST(request: NextRequest) {
  try {
    return await handle(request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Generation crashed: ${message.slice(0, 300)}` }, { status: 500 })
  }
}

async function handle(request: NextRequest) {
  // Auth
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, client_id')
    .eq('id', user.id)
    .single()
  if (!profile || (profile.role !== 'baymo_admin' && profile.role !== 'client_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    client_id?: string
    goal?: string
    tone?: string
    platform?: string
    post_type?: string
    listing_id?: string | null
    instructions?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const clientId = profile.role === 'client_admin' ? profile.client_id : body.client_id
  if (!clientId) return NextResponse.json({ error: 'client_id is required' }, { status: 400 })

  const goal = body.goal && GOALS[body.goal] ? body.goal : 'lead_generation'
  const tone = body.tone && TONES[body.tone] ? body.tone : 'friendly'
  const platform = body.platform === 'instagram' ? 'instagram' : 'facebook'

  const admin = createAdminClient()

  // Brand context
  const { data: client } = await admin
    .from('clients')
    .select('name, company_name')
    .eq('id', clientId)
    .single()
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // Listing context (optional)
  let listing: Record<string, unknown> | null = null
  if (body.listing_id) {
    const { data } = await admin
      .from('ad_listings')
      .select('id, client_id, property_name, property_type, description, price, location, city, bedrooms, bathrooms, floor_area, lot_area, listing_url, primary_photo_url, agent_name')
      .eq('id', body.listing_id)
      .single()
    if (!data) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    if (profile.role === 'client_admin' && data.client_id !== profile.client_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    listing = data
  }

  const listingBlock = listing
    ? `
PROPERTY DETAILS (use the real numbers, do not invent any):
- Name: ${listing.property_name ?? 'N/A'}
- Type: ${listing.property_type ?? 'N/A'}
- Price: ${listing.price ? `PHP ${Number(listing.price).toLocaleString('en-PH')}` : 'Price upon inquiry'}
- Location: ${[listing.location, listing.city].filter(Boolean).join(', ') || 'N/A'}
- Bedrooms: ${listing.bedrooms ?? 'N/A'} | Bathrooms: ${listing.bathrooms ?? 'N/A'}
- Floor area: ${listing.floor_area ? `${listing.floor_area} sqm` : 'N/A'} | Lot area: ${listing.lot_area ? `${listing.lot_area} sqm` : 'N/A'}
- Agent: ${listing.agent_name ?? 'N/A'}
- Description: ${listing.description ?? 'N/A'}`
    : 'No specific property attached — write at the brand level.'

  const prompt = `You are the social media copywriter for "${client.name}"${client.company_name ? ` (${client.company_name})` : ''}, a Philippine real estate brand. Write one organic ${platform} post.

GOAL: ${GOALS[goal]}
TONE: ${TONES[tone]}
${listingBlock}
${body.instructions?.trim() ? `ADDITIONAL INSTRUCTIONS FROM THE CLIENT: ${body.instructions.trim()}` : ''}

RULES:
- Philippine market context: prices in PHP, local geography, Pag-IBIG/bank financing references only if relevant.
- Never invent prices, sizes, or features not given above.
- Caption length: 60-150 words for facebook, 40-100 for instagram.
- 5-8 hashtags, mixing brand, location, and category tags.
- No emojis in the hook; caption may use 2-4 emojis naturally placed.

Respond with ONLY a JSON object, no markdown fences, in exactly this shape:
{"title": "short internal label for this content", "hook": "first line that stops the scroll", "caption": "the full post caption including the hook as its first line", "hashtags": ["#tag1", "#tag2"], "cta": "the closing call to action used"}`

  // Call AI provider
  let text: string
  try {
    text = await generateText({ prompt, maxTokens: 1000 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI generation failed'
    return NextResponse.json({ error: `AI generation failed: ${msg.slice(0, 200)}` }, { status: 502 })
  }

  let parsed: { title?: string; hook?: string; caption?: string; hashtags?: string[]; cta?: string }
  try {
    parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    return NextResponse.json({ error: 'AI returned unparseable output — try again' }, { status: 502 })
  }
  if (!parsed.caption) {
    return NextResponse.json({ error: 'AI returned no caption — try again' }, { status: 502 })
  }

  // Persist to ad_content for traceability + reuse
  const { data: content, error: insertErr } = await admin
    .from('ad_content')
    .insert({
      client_id: clientId,
      title: parsed.title ?? `AI: ${goal} (${new Date().toISOString().slice(0, 10)})`,
      platform,
      tone,
      caption: parsed.caption,
      hook: parsed.hook ?? null,
      hashtags: parsed.hashtags ?? [],
      cta: parsed.cta ?? null,
      ai_generated: true,
      listing_id: listing ? String(listing.id) : null,
      status: 'approved',
      created_by: profile.id,
    })
    .select('id')
    .single()
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({
    content_id: content.id,
    title: parsed.title ?? null,
    hook: parsed.hook ?? null,
    caption: parsed.caption,
    hashtags: parsed.hashtags ?? [],
    cta: parsed.cta ?? null,
    suggested_link: listing?.listing_url ?? null,
    suggested_media: listing?.primary_photo_url ?? null,
  })
}
