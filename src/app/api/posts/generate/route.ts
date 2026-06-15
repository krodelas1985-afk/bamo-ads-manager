import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { generateText } from '@/lib/ai-provider'
import { fetchUrlContent, URL_WARNING_MESSAGES } from '@/lib/fetch-url-content'

export const maxDuration = 60

const GOALS: Record<string, { instruction: string; adjectives: string }> = {
  listing_promotion: {
    instruction: 'Drive interest in this specific property. Highlight 2-3 standout features. End with a clear CTA to inquire or view.',
    adjectives: 'aspirational, polished, confident, evocative',
  },
  open_house: {
    instruction: 'Invite the reader to a specific open house. Include date/time placeholder if not provided. CTA is to RSVP or attend.',
    adjectives: 'urgent, welcoming, time-sensitive, inviting',
  },
  tripping_invite: {
    instruction: 'Invite the reader to a site visit (tripping). Emphasize seeing the property in person. CTA is to book a tripping schedule.',
    adjectives: 'experiential, sensory, persuasive, action-oriented',
  },
  event_promotion: {
    instruction: 'Promote an event (seminar, launch, expo). Focus on what attendees gain. CTA is to register or attend.',
    adjectives: 'energetic, professional, anticipation-building',
  },
  brand_awareness: {
    instruction: 'No direct sales ask. Build top-of-mind recognition for the agent/brand. Share value or perspective.',
    adjectives: 'thoughtful, authoritative, value-driven',
  },
  lead_magnet: {
    instruction: 'Offer a free resource (guide, computation, checklist). CTA is to message/comment to receive it.',
    adjectives: 'helpful, generous, no-pressure, useful',
  },
  social_proof: {
    instruction: 'Build trust through testimonial or success story framing. CTA is soft — invite the reader to imagine themselves in the same outcome.',
    adjectives: 'credible, warm, story-driven, relatable',
  },
  lifestyle: {
    instruction: 'Community-building or relatable content. No sales ask. Encourage comments and engagement.',
    adjectives: 'warm, relatable, conversational, human',
  },
}

const TONES: Record<string, string> = {
  professional: 'Polished, trustworthy, broker-grade professional English.',
  friendly: 'Warm, approachable, conversational. Like a helpful kapitbahay who knows real estate.',
  urgent: 'Energetic and time-sensitive. Push action without being spammy.',
  luxury: 'Elegant, understated, aspirational. Fewer words, more weight.',
}

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  english: 'Write in natural, professional English suited to Philippine real estate marketing.',
  taglish: 'Write in conversational Taglish — natural code-switching between Filipino and English the way real estate agents actually post on Facebook in the Philippines. Not forced or mechanical alternation sentence-by-sentence.',
  tagalog: 'Sumulat sa natural na conversational Filipino — hindi pormal o parang textbook; everyday spoken register.',
}

/**
 * POST /api/posts/generate
 * Body: { client_id, goal, tone, platform?, post_type?, listing_id?, instructions?, language?, referenceUrl? }
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
    language?: string
    referenceUrl?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const clientId = profile.role === 'client_admin' ? profile.client_id : body.client_id
  if (!clientId) return NextResponse.json({ error: 'client_id is required' }, { status: 400 })

  if (!body.goal || !GOALS[body.goal]) {
    return NextResponse.json({ error: `goal is required. Valid values: ${Object.keys(GOALS).join(', ')}` }, { status: 400 })
  }
  const goal = body.goal
  const goalEntry = GOALS[goal]
  const tone = body.tone && TONES[body.tone] ? body.tone : 'friendly'
  const platform = body.platform === 'instagram' ? 'instagram' : 'facebook'
  const langInstruction = LANGUAGE_INSTRUCTIONS[body.language as string] ?? LANGUAGE_INSTRUCTIONS.english

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

  // URL reference — fetch if provided, never blocks generation on failure
  let referenceBlock = ''
  let warning: string | undefined
  if (body.referenceUrl && body.referenceUrl.trim()) {
    const result = await fetchUrlContent(body.referenceUrl.trim())
    if (result.ok) {
      referenceBlock = `\nREFERENCE SOURCE (facts only — do not invent details not present here, do not contradict these facts):\n${result.text}`
    } else {
      warning = URL_WARNING_MESSAGES[result.reason]
    }
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
${body.instructions?.trim() ? `\nADDITIONAL INSTRUCTIONS FROM THE CLIENT: ${body.instructions.trim()}` : ''}
${listingBlock}

GOAL: ${goalEntry.instruction}
STYLE: Use language that feels ${goalEntry.adjectives}. The factual content comes from the reference and the focus/audience inputs — these adjectives describe the register, not new facts.
TONE: ${TONES[tone]}
LANGUAGE: ${langInstruction}
${referenceBlock}

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
    ...(warning ? { warning } : {}),
  })
}
