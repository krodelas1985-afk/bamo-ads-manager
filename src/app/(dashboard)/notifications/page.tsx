import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import NotificationsClient from '@/components/notifications/NotificationsClient'

export default async function NotificationsPage() {
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

  const { data: notifications } = await supabase
    .from('ad_notifications')
    .select('*')
    .match(clientFilter)
    .order('created_at', { ascending: false })
    .limit(50)

  const unreadCount = notifications?.filter(n => !n.is_read).length ?? 0

  const initials = (profile.full_name ?? 'KR').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="Notifications"
        role={profile.role}
        plan={profile.clients?.ads_plan ?? undefined}
        userInitials={initials}
      />
      <div className="flex-1 overflow-hidden">
        <NotificationsClient
          notifications={notifications ?? []}
          unreadCount={unreadCount}
        />
      </div>
    </div>
  )
}
