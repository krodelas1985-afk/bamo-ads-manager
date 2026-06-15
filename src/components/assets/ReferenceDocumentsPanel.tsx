'use client'
import { useRef, useState } from 'react'
import { FileText, Upload, Trash2, AlertTriangle } from 'lucide-react'

export interface ReferenceDocument {
  id: string
  filename: string
  file_type: string
  size_bytes: number
  extracted_chars: number
  truncated: boolean
  created_at: string
}

interface Props {
  clientId: string | null
  initialDocuments: ReferenceDocument[]
}

const ACCEPT = '.pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

export default function ReferenceDocumentsPanel({ clientId, initialDocuments }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [docs, setDocs] = useState<ReferenceDocument[]>(initialDocuments)
  const [uploading, setUploading] = useState(false)
  const [uploadName, setUploadName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    if (!clientId) {
      setError('Select a client first (Viewing dropdown above) to upload documents.')
      return
    }
    const file = files[0]
    setUploading(true)
    setUploadName(file.name)
    setError(null)
    setWarning(null)
    try {
      const form = new FormData()
      form.set('file', file)
      form.set('clientId', clientId)
      const res = await fetch('/api/reference-documents', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Upload failed')
        return
      }
      setDocs(prev => [json, ...prev])
      if (json.warning) setWarning(json.warning)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      setUploadName('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDelete(doc: ReferenceDocument) {
    if (!confirm(`Delete "${doc.filename}"? This cannot be undone.`)) return
    const res = await fetch(`/api/reference-documents/${doc.id}`, { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json.error ?? 'Delete failed')
      return
    }
    setDocs(prev => prev.filter(d => d.id !== doc.id))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="bamo-card p-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[#1A2E5A]">Reference Documents</div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            Saved PDFs/Word/text the AI can use as source-of-truth in Content Studio &amp; Posts. PDF, DOCX, TXT, MD · max 5 MB.
          </div>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !clientId}
          className="btn-orange text-xs disabled:opacity-50"
        >
          <Upload size={13} /> {uploading ? `Uploading ${uploadName.slice(0, 18)}…` : 'Upload Document'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={e => handleUpload(e.target.files)}
        />
      </div>

      {warning && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertTriangle size={13} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-amber-800 leading-snug">{warning}</p>
        </div>
      )}
      {error && (
        <div className="bg-[#FCEBEB] border border-[#F09595] rounded-lg px-3 py-2 text-[11px] text-[#A32D2D]">
          {error}
        </div>
      )}

      {docs.length === 0 ? (
        <div className="bamo-card p-8 text-center">
          <FileText size={32} className="text-gray-300 mx-auto mb-2" />
          <div className="text-sm text-gray-500">No reference documents yet</div>
          <div className="text-[11px] text-gray-400 mt-1">
            Upload listing brochures, fact sheets, or developer notes to ground AI-generated copy in real facts.
          </div>
        </div>
      ) : (
        <div className="bamo-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F4F5F7] text-[10px] uppercase tracking-wider text-gray-400">
                <th className="text-left font-semibold px-4 py-2.5">Filename</th>
                <th className="text-left font-semibold px-3 py-2.5">Type</th>
                <th className="text-left font-semibold px-3 py-2.5">Size</th>
                <th className="text-left font-semibold px-3 py-2.5">Chars</th>
                <th className="text-left font-semibold px-3 py-2.5">Uploaded</th>
                <th className="text-right font-semibold px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {docs.map(d => (
                <tr key={d.id} className="border-t border-black/5">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-[#185FA5] flex-shrink-0" />
                      <span className="text-xs font-medium text-[#1A2E5A] truncate max-w-[260px]" title={d.filename}>
                        {d.filename}
                      </span>
                      {d.truncated && (
                        <span title="Document was truncated to 16,000 chars" className="inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">
                          <AlertTriangle size={9} /> truncated
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-gray-500 uppercase">{d.file_type}</td>
                  <td className="px-3 py-2.5 text-[11px] text-gray-500">{formatBytes(d.size_bytes)}</td>
                  <td className="px-3 py-2.5 text-[11px]">
                    <span className="bg-[#E6F1FB] text-[#185FA5] px-1.5 py-0.5 rounded-full font-semibold">
                      {d.extracted_chars.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-gray-500">
                    {new Date(d.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => handleDelete(d)}
                      className="text-[#A32D2D] hover:bg-[#FCEBEB] rounded p-1.5 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
