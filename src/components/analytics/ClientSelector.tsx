'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type ClientOption = { id: string; name: string }

/**
 * baymo_admin only: filter the current page to one client or view all.
 * Sets ?client_id= on the URL; the server component re-fetches scoped data.
 */
export default function ClientSelector({ clients }: { clients: ClientOption[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selected = searchParams.get('client_id') ?? ''

  const onChange = (value: string) => {
    if (value) {
      router.push(`${pathname}?client_id=${value}`)
    } else {
      router.push(pathname)
    }
  }

  return (
    <div className="flex items-center gap-2 mb-4">
      <label className="text-sm text-gray-600">Viewing:</label>
      <select
        value={selected}
        onChange={e => onChange(e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-[#1A2E5A] focus:outline-none focus:ring-2 focus:ring-[#E8660A]/30"
      >
        <option value="">All clients</option>
        {clients.map(c => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  )
}
