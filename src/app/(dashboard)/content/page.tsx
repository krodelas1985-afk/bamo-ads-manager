import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import Link from 'next/link'
import { Plus, History } from 'lucide-react'
import ContentLibrary from '@/components/content/ContentLibrary'

export default async function ContentPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, clients(name, ads_plan)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const clientFilter = profile.role === 'client_admin' ? { client_id: profile.client_id } : {}

  const { data: contents } = await supabase
    .from('ad_content')
    .select('*')
    .match(clientFilter)
    .order('created_at', { ascending: false })
    .limit(20)

  const initials = (profile.full_name ?? 'KR').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="Content Studio"
        role={profile.role}
        plan={profile.clients?.ads_plan ?? undefined}
        userInitials={initials}
        actions={
          <Link href="/content/new" className="btn-ghost text-sm">
            <History size={13} /> Content Library
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[#1A2E5A]">Content Studio</h1>
            <p className="text-xs text-gray-500 mt-0.5">Generate AI-powered copy or write your own — then send to Creatives.</p>
          </div>
          <Link href="/content/new" className="btn-orange text-sm">
            <Plus size={14} /> New Content
          </Link>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total content', value: contents?.length ?? 0, color: 'text-[#1A2E5A]' },
            { label: 'Approved', value: contents?.filter(c => c.status === 'approved').length ?? 0, color: 'text-[#3B6D11]' },
            { label: 'Drafts', value: contents?.filter(c => c.status === 'draft').length ?? 0, color: 'text-[#854F0B]' },
            { label: 'AI generated', value: contents?.filter(c => c.ai_generated).length ?? 0, color: 'text-[#185FA5]' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bamo-card p-4">
              <div className={`text-2xl font-semibold ${color}`}>{value}</div>
              <div className="text-xs text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Content library */}
        <ContentLibrary contents={contents ?? []} />
      </div>
    </div>
  )
}
