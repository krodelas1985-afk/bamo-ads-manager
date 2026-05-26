import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import SettingsClient from '@/components/settings/SettingsClient'

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, clients(name, ads_plan, ads_plan_started_at)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const clientFilter = profile.role === 'client_admin' ? { client_id: profile.client_id } : {}

  const [
    { data: socialAccounts },
    { data: teamMembers },
    { data: usage },
    { data: clients },
  ] = await Promise.all([
    supabase.from('ad_social_accounts').select('*').match(clientFilter),
    supabase.from('profiles')
      .select('id, full_name, email, role, client_id')
      .match(profile.role === 'client_admin' ? { client_id: profile.client_id } : {}),
    supabase.from('ad_usage_limits').select('*').match({
      ...clientFilter,
      month: new Date().toISOString().slice(0, 7),
    }).single(),
    profile.role === 'baymo_admin'
      ? supabase.from('clients').select('*, profiles(id, full_name, email, role)').order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  const planLimits: Record<string, { images: number; videos: number; campaigns: number }> = {
    starter: { images: 20, videos: 5, campaigns: 2 },
    growth: { images: 60, videos: 20, campaigns: 10 },
    pro: { images: 999, videos: 60, campaigns: 999 },
  }
  const plan = profile.clients?.ads_plan ?? 'starter'
  const limits = planLimits[plan] ?? planLimits.starter
  const initials = (profile.full_name ?? 'KR').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Settings" role={profile.role} plan={plan} userInitials={initials} />
      <div className="flex-1 overflow-hidden">
        <SettingsClient
          profile={profile}
          socialAccounts={socialAccounts ?? []}
          teamMembers={teamMembers ?? []}
          usage={usage ?? null}
          limits={limits}
          clients={clients ?? []}
          plan={plan}
        />
      </div>
    </div>
  )
}
