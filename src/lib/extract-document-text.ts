/**
 * Server-only text extractors for reference documents.
 * pdf-parse and mammoth must never reach the client bundle.
 */
import 'server-only'

export type ExtractFileType = 'pdf' | 'docx' | 'txt' | 'md'

const MIME_TO_TYPE: Record<string, ExtractFileType> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
  'text/markdown': 'md',
}

export function detectFileType(mime: string, filename: string): ExtractFileType | null {
  if (MIME_TO_TYPE[mime]) return MIME_TO_TYPE[mime]
  const lower = filename.toLowerCase()
  if (lower.endsWith('.pdf')) return 'pdf'
  if (lower.endsWith('.docx')) return 'docx'
  if (lower.endsWith('.md')) return 'md'
  if (lower.endsWith('.txt')) return 'txt'
  return null
}

export async function extractDocumentText(buffer: Buffer, type: ExtractFileType): Promise<string> {
  if (type === 'pdf') {
    const pdfParse = (await import('pdf-parse')).default
    const result = await pdfParse(buffer)
    return result.text ?? ''
  }
  if (type === 'docx') {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value ?? ''
  }
  return buffer.toString('utf-8')
}

export const EXTRACTED_TEXT_CAP = 16000
