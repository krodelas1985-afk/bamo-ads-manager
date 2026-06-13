import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { generateText } from '@/lib/ai-provider'

export async function POST(request: NextRequest) {
  try {
    // Auth gate — this route was previously open to the internet,
    // letting anyone burn the AI API key.
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!profile || (profile.role !== 'baymo_admin' && profile.role !== 'client_admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { prompt } = await request.json()
    if (!prompt) return NextResponse.json({ error: 'No prompt' }, { status: 400 })

    let text: string
    try {
      text = await generateText({ prompt, maxTokens: 1000 })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI generation failed'
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    // Parse JSON from response (fence-strip kept for Anthropic fallback)
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Content generation error:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
