import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { generateText } from '@/lib/ai-provider'
import { fetchUrlContent, URL_WARNING_MESSAGES } from '@/lib/fetch-url-content'
import {
  fetchReferenceDocuments,
  buildReferenceDocumentBlocks,
  MAX_REFERENCE_DOCUMENTS,
} from '@/lib/reference-documents'

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

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  english: 'Write in natural, professional English suited to Philippine real estate marketing.',
  taglish: 'Write in conversational Taglish — natural code-switching between Filipino and English the way real estate agents actually post on Facebook in the Philippines. Not forced or mechanical alternation sentence-by-sentence.',
  tagalog: 'Sumulat sa natural na conversational Filipino — hindi pormal o parang textbook; everyday spoken register.',
}

export async function POST(request: NextRequest) {
  try {
    // Auth gate — this route was previously open to the internet,
    // letting anyone burn the AI API key.
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, client_id')
      .eq('id', user.id)
      .single()
    if (!profile || (profile.role !== 'baymo_admin' && profile.role !== 'client_admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { prompt, language, goal, referenceUrl, referenceDocumentIds, clientId: bodyClientId } = await request.json()
    if (!prompt) return NextResponse.json({ error: 'No prompt' }, { status: 400 })
    const goalEntry = GOALS[goal as string]
    if (!goal || !goalEntry) {
      return NextResponse.json({ error: `goal is required. Valid values: ${Object.keys(GOALS).join(', ')}` }, { status: 400 })
    }

    const langInstruction = LANGUAGE_INSTRUCTIONS[language as string] ?? LANGUAGE_INSTRUCTIONS.english

    // URL reference — fetch if provided, never blocks generation on failure
    let referenceBlock = ''
    let warning: string | undefined
    let urlRefChars = 0
    if (referenceUrl && typeof referenceUrl === 'string' && referenceUrl.trim()) {
      const result = await fetchUrlContent(referenceUrl.trim())
      if (result.ok) {
        referenceBlock = `REFERENCE SOURCE (facts only — do not invent details not present here, do not contradict these facts):\n${result.text}`
        urlRefChars = result.text.length
      } else {
        warning = URL_WARNING_MESSAGES[result.reason]
      }
    }

    // Reference documents — saved docs from the client's Asset Library.
    let documentBlock = ''
    let docWarning: string | undefined
    const docIds: string[] = Array.isArray(referenceDocumentIds)
      ? referenceDocumentIds.filter((x: unknown): x is string => typeof x === 'string' && x.length > 0)
      : []
    if (docIds.length > 0) {
      if (docIds.length > MAX_REFERENCE_DOCUMENTS) {
        return NextResponse.json({ error: `At most ${MAX_REFERENCE_DOCUMENTS} reference documents per generation` }, { status: 400 })
      }
      const clientId = profile.role === 'client_admin' ? profile.client_id : bodyClientId
      if (!clientId) {
        return NextResponse.json({ error: 'clientId is required when using reference documents' }, { status: 400 })
      }
      const fetched = await fetchReferenceDocuments(docIds, clientId)
      if (!fetched.ok) {
        return NextResponse.json({ error: fetched.error }, { status: 403 })
      }
      const built = buildReferenceDocumentBlocks(fetched.docs, urlRefChars)
      documentBlock = built.block
      docWarning = built.warning
    }

    const fullPrompt = [
      prompt,
      `GOAL: ${goalEntry.instruction}`,
      `STYLE: Use language that feels ${goalEntry.adjectives}. The factual content comes from the reference and the focus/audience inputs — these adjectives describe the register, not new facts.`,
      `LANGUAGE: ${langInstruction}`,
      referenceBlock,
      documentBlock,
    ].filter(Boolean).join('\n\n')

    let text: string
    try {
      text = await generateText({ prompt: fullPrompt, maxTokens: 1000 })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI generation failed'
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    // Parse JSON from response (fence-strip kept for Anthropic fallback)
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    const combinedWarning = [warning, docWarning].filter(Boolean).join(' ')
    return NextResponse.json(combinedWarning ? { ...parsed, warning: combinedWarning } : parsed)
  } catch (error) {
    console.error('Content generation error:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
