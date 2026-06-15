'use client'
import { useEffect, useState } from 'react'
import { FileText, AlertTriangle, Check } from 'lucide-react'

interface DocOption {
  id: string
  filename: string
  file_type: string
  extracted_chars: number
  truncated: boolean
}

interface Props {
  clientId: string | null
  selectedIds: string[]
  onChange: (ids: string[]) => void
  max?: number
  compact?: boolean
}

export default function ReferenceDocumentSelect({
  clientId,
  selectedIds,
  onChange,
  max = 3,
  compact = false,
}: Props) {
  const [docs, setDocs] = useState<DocOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!clientId) { setDocs([]); return }
    let cancelled = false
    setLoading(true)
    fetch(`/api/reference-documents?clientId=${encodeURIComponent(clientId)}`)
      .then(r => r.json())
      .then(json => { if (!cancelled) setDocs(json.documents ?? []) })
      .catch(() => { if (!cancelled) setDocs([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [clientId])

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(x => x !== id))
    } else {
      if (selectedIds.length >= max) return
      onChange([...selectedIds, id])
    }
  }

  const labelClass = compact ? 'text-[10px]' : 'text-xs'
  const helperClass = compact ? 'text-[9px]' : 'text-[10px]'

  return (
    <div>
      <label className={`${labelClass} font-medium text-[#1A2E5A] mb-1.5 block`}>
        Reference Documents <span className="text-gray-400 font-normal">optional · max {max}</span>
      </label>
      {!clientId ? (
        <div className={`${helperClass} text-gray-400 italic`}>Select a client to see saved documents.</div>
      ) : loading ? (
        <div className={`${helperClass} text-gray-400`}>Loading…</div>
      ) : docs.length === 0 ? (
        <div className={`${helperClass} text-gray-400 leading-snug`}>
          No saved documents for this client.{' '}
          <a href="/assets" className="text-[#E8660A] font-medium hover:underline">Upload one</a>{' '}
          in the Asset Library &gt; Documents.
        </div>
      ) : (
        <div className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-1">
          {docs.map(d => {
            const checked = selectedIds.includes(d.id)
            const disabled = !checked && selectedIds.length >= max
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => toggle(d.id)}
                disabled={disabled}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md border text-left transition-colors ${
                  checked
                    ? 'border-[#E8660A] bg-[#FDE8D8]'
                    : disabled
                      ? 'border-black/5 bg-gray-50 opacity-50 cursor-not-allowed'
                      : 'border-black/10 hover:border-[#E8660A]/40 hover:bg-[#FDE8D8]/30'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${
                  checked ? 'bg-[#E8660A] border-[#E8660A]' : 'border-gray-300'
                }`}>
                  {checked && <Check size={9} className="text-white" />}
                </div>
                <FileText size={12} className="text-[#185FA5] flex-shrink-0" />
                <span className={`${labelClass} font-medium text-[#1A2E5A] truncate flex-1`} title={d.filename}>
                  {d.filename}
                </span>
                <span className={`${helperClass} text-[#185FA5] bg-[#E6F1FB] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0`}>
                  {d.extracted_chars.toLocaleString()} ch
                </span>
                {d.truncated && (
                  <AlertTriangle size={11} className="text-amber-600 flex-shrink-0" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
