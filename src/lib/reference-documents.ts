import 'server-only'
import { createAdminClient } from '@/lib/supabase-admin'

export const MAX_REFERENCE_DOCUMENTS = 3
export const COMBINED_REFERENCE_CHAR_BUDGET = 40000

export interface FetchedReferenceDoc {
  id: string
  filename: string
  extracted_text: string
}

/**
 * Fetches reference documents by id, in the order requested, and verifies they all
 * belong to `clientId`. Returns { docs } on success or { error } on auth/lookup failure.
 */
export type FetchReferenceDocumentsResult =
  | { ok: true; docs: FetchedReferenceDoc[] }
  | { ok: false; error: string }

export async function fetchReferenceDocuments(
  ids: string[],
  clientId: string,
): Promise<FetchReferenceDocumentsResult> {
  if (ids.length === 0) return { ok: true, docs: [] }
  if (ids.length > MAX_REFERENCE_DOCUMENTS) {
    return { ok: false, error: `At most ${MAX_REFERENCE_DOCUMENTS} reference documents per generation` }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('client_reference_documents')
    .select('id, client_id, filename, extracted_text')
    .in('id', ids)

  if (error) return { ok: false, error: error.message }
  if (!data || data.length !== ids.length) {
    return { ok: false, error: 'One or more reference documents not found' }
  }
  if (data.some(d => d.client_id !== clientId)) {
    return { ok: false, error: 'Reference document does not belong to this client' }
  }

  const byId = new Map(data.map(d => [d.id, d]))
  const ordered = ids.map(id => byId.get(id)!).map(d => ({
    id: d.id,
    filename: d.filename,
    extracted_text: d.extracted_text,
  }))
  return { ok: true, docs: ordered }
}

/**
 * Builds the REFERENCE DOCUMENT blocks, applying the combined character budget.
 * URL ref and earlier docs are never truncated mid-flight — only the last
 * document(s) shrink (or drop) when the budget is exceeded.
 *
 * Returns the joined block string (empty string if no docs survive) and a warning
 * when truncation happened.
 */
export function buildReferenceDocumentBlocks(
  docs: FetchedReferenceDoc[],
  urlRefChars: number,
): { block: string; warning?: string } {
  if (docs.length === 0) return { block: '' }

  let remaining = COMBINED_REFERENCE_CHAR_BUDGET - urlRefChars
  const out: string[] = []
  let truncatedAny = false
  let droppedAny = false

  for (let i = 0; i < docs.length; i++) {
    const d = docs[i]
    if (remaining <= 0) { droppedAny = true; continue }
    let text = d.extracted_text
    if (text.length > remaining) {
      // Only truncate the LAST in-budget doc — preserve earlier ones intact.
      text = text.slice(0, remaining)
      truncatedAny = true
    }
    remaining -= text.length
    out.push(
      `REFERENCE DOCUMENT — ${d.filename} (facts only — do not invent details not present here, do not contradict these facts):\n${text}`
    )
  }

  const block = out.join('\n\n')
  let warning: string | undefined
  if (droppedAny || truncatedAny) {
    warning = `Some reference documents were truncated or skipped to fit the ${COMBINED_REFERENCE_CHAR_BUDGET.toLocaleString()}-character prompt budget.`
  }
  return { block, warning }
}
