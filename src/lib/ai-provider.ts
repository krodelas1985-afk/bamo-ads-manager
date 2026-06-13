const AI_PROVIDER = process.env.AI_PROVIDER ?? 'openai'
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o'
const OPENAI_KEY = process.env.OPENAI_API_KEY ?? ''
const ANTHROPIC_KEY = (process.env.ANTHROPIC_API_KEY ?? '').replace(/[^\x21-\x7E]/g, '')

export interface GenerateTextParams {
  /** Optional system prompt. When absent no system message is sent. */
  system?: string
  prompt: string
  maxTokens?: number
}

/**
 * Single entry-point for AI text generation.
 * Routes to OpenAI or Anthropic based on AI_PROVIDER env var (default "openai").
 * Returns the raw text content from the model.
 */
export async function generateText({ system, prompt, maxTokens = 1000 }: GenerateTextParams): Promise<string> {
  if (AI_PROVIDER === 'anthropic') {
    return callAnthropic({ system, prompt, maxTokens })
  }
  return callOpenAI({ system, prompt, maxTokens })
}

async function callOpenAI({ system, prompt, maxTokens }: Required<Pick<GenerateTextParams, 'prompt' | 'maxTokens'>> & { system?: string }): Promise<string> {
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY is missing — add it in Vercel env vars')

  const messages: { role: string; content: string }[] = []
  if (system) messages.push({ role: 'system', content: system })
  messages.push({ role: 'user', content: prompt })

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI error: ${err.slice(0, 300)}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

async function callAnthropic({ system, prompt, maxTokens }: Required<Pick<GenerateTextParams, 'prompt' | 'maxTokens'>> & { system?: string }): Promise<string> {
  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY is missing or contains invalid characters — add it in Vercel env vars')

  const body: Record<string, unknown> = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  }
  if (system) body.system = system

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic error: ${err.slice(0, 300)}`)
  }
  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}
