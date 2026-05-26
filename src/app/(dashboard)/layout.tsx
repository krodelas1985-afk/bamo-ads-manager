import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, clients(name, ads_plan)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  // Get unread notification count
  const { count: unreadCount } = await supabase
    .from('ad_notifications')
    .select('id', { count: 'exact' })
    .eq('is_read', false)
    .match(profile.role === 'client_admin' ? { client_id: profile.client_id } : {})

  return (
    <div className="flex min-h-screen bg-[#F4F5F7]">
      <Sidebar
        role={profile.role}
        clientName={profile.clients?.name}
        unreadCount={unreadCount ?? 0}
      />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
