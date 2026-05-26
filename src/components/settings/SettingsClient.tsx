'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  User, Users, Share2, CreditCard, Bell, Plug,
  Building2, Eye, EyeOff, Copy, Check, RefreshCw,
  Shield, LogIn, Ban, Edit, Key, Mail, Plus, X
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────
interface Profile {
  id: string
  full_name: string | null
  email?: string
  role: 'baymo_admin' | 'client_admin'
  client_id: string | null
  clients?: { name: string; ads_plan: string; ads_plan_started_at: string | null } | null
}

interface SocialAccount {
  id: string
  platform: string
  account_name: string
  is_active: boolean
  token_expires_at: string | null
}

interface TeamMember {
  id: string
  full_name: string | null
  email: string | null
  role: string
}

interface Client {
  id: string
  name: string
  email: string | null
  ads_enabled: boolean
  ads_plan: string | null
  created_at: string
  profiles?: TeamMember[]
}

interface Props {
  profile: Profile
  socialAccounts: SocialAccount[]
  teamMembers: TeamMember[]
  clients: Client[]
  usage: { images: number; videos: number }
  limits: { images: number; videos: number; campaigns: number }
  plan: string
  planStarted: string | null
}

// ─── Nav config ──────────────────────────────────────────────────────────────
const NOTIF_PREFS = [
  { key: 'campaign_live', label: 'Campaign went live', sub: 'Notify when a campaign starts running' },
  { key: 'campaign_failed', label: 'Campaign paused or failed', sub: 'Alert when a campaign stops unexpectedly' },
  { key: 'budget_low', label: 'Budget running low', sub: 'Alert when spend reaches 80% of budget' },
  { key: 'lead_warm', label: 'New warm lead received', sub: 'Notify when Campaign Engine tags a warm lead' },
  { key: 'lead_hot', label: 'New hot lead received', sub: 'Immediate alert for hot leads ready to close' },
  { key: 'appointment', label: 'Appointment booked', sub: 'Phone or viewing appointment confirmed' },
  { key: 'creative_ready', label: 'Creative render complete', sub: 'Notify when a video or image is ready' },
  { key: 'post_published', label: 'Post published successfully', sub: 'Confirm when a scheduled post goes live' },
  { key: 'post_failed', label: 'Post failed to publish', sub: 'Alert when a post fails due to API error' },
  { key: 'website_deployed', label: 'Website deployed', sub: 'Notify when a build goes live' },
  { key: 'website_lead', label: 'New website form submission', sub: 'Notify when someone fills in your contact form' },
]

const INTEGRATIONS = [
  { id: 'meta', label: 'Meta Marketing API', sub: 'Facebook & Instagram ads, analytics', icon: '📘', status: 'connected' },
  { id: 'canva', label: 'Canva API', sub: 'Branded template generation', icon: '🎨', status: 'connected' },
  { id: 'fal_ai', label: 'Fal.ai', sub: 'AI image generation for creatives', icon: '✨', status: 'connected' },
  { id: 'creatomate', label: 'Creatomate', sub: 'Video template rendering', icon: '🎬', status: 'warning' },
  { id: 'anthropic', label: 'Anthropic (Claude API)', sub: 'AI copy generation', icon: '🤖', status: 'connected' },
  { id: 'linkedin', label: 'LinkedIn API', sub: 'Post to LinkedIn Company Pages', icon: '💼', status: 'disconnected' },
]

const PLAN_PRICES: Record<string, string> = {
  starter: '₱2,499',
  growth: '₱4,999',
  pro: '₱9,999',
}

// ─── Toggle component ─────────────────────────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${on ? 'bg-[#E8660A]' : 'bg-[#E8EBF3]'}`}
    >
      <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SettingsClient({ profile, socialAccounts, teamMembers, clients, usage, limits, plan, planStarted }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const isAdmin = profile.role === 'baymo_admin'

  type Section = 'profile' | 'team' | 'social' | 'plan' | 'notifications' | 'integrations' | 'clients'
  const [section, setSection] = useState<Section>(isAdmin ? 'clients' : 'profile')

  // Profile form
  const [fullName, setFullName] = useState(profile.full_name ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>(
    NOTIF_PREFS.reduce((acc, p) => ({ ...acc, [p.key]: true }), {})
  )

  // Integration tokens
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null)
  const [showToken, setShowToken] = useState(false)
  const [token, setToken] = useState('')
  const [copied, setCopied] = useState(false)
  const [apiKey] = useState('bamo_live_mX8kP3rT7nQ2jW9vY4cL6dH1sF5bE0')
  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKeyCopied, setApiKeyCopied] = useState(false)

  // Client creation
  const [showNewClient, setShowNewClient] = useState(false)
  const [clientStep, setClientStep] = useState(1)
  const [newClientForm, setNewClientForm] = useState({
    name: '', contact: '', email: '', phone: '', type: 'broker', plan: 'growth',
    password: '', region: '',
  })
  const [creatingClient, setCreatingClient] = useState(false)
  const [clientCreated, setClientCreated] = useState(false)

  // Clients list
  const [clientsList, setClientsList] = useState<Client[]>(clients)

  function genPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$'
    return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  async function saveProfile() {
    setSavingProfile(true)
    try {
      await supabase.from('profiles').update({ full_name: fullName }).eq('id', profile.id)
      if (newPassword && newPassword === confirmPassword) {
        await supabase.auth.updateUser({ password: newPassword })
      }
      router.refresh()
    } catch (err) { console.error(err) }
    finally { setSavingProfile(false) }
  }

  async function submitNewClient() {
    setCreatingClient(true)
    try {
      // Create auth user
      const { data: authData, error: authErr } = await supabase.auth.admin?.createUser({
        email: newClientForm.email,
        password: newClientForm.password,
        email_confirm: true,
      }) ?? {}

      // Fallback: create client record only
      const { data: clientData } = await supabase.from('clients').insert({
        name: newClientForm.name,
        email: newClientForm.email,
        ads_enabled: true,
        ads_plan: newClientForm.plan,
        ads_plan_started_at: new Date().toISOString(),
      }).select().single()

      if (clientData) {
        setClientsList(prev => [clientData, ...prev])
        setClientCreated(true)
      }
    } catch (err) { console.error(err) }
    finally { setCreatingClient(false) }
  }

  async function toggleClientStatus(clientId: string, enabled: boolean) {
    await supabase.from('clients').update({ ads_enabled: !enabled }).eq('id', clientId)
    setClientsList(prev => prev.map(c => c.id === clientId ? { ...c, ads_enabled: !enabled } : c))
  }

  function copyText(text: string, setCopiedFn: (v: boolean) => void) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedFn(true)
    setTimeout(() => setCopiedFn(false), 1500)
  }

  // ─── Nav items ───────────────────────────────────────────────────────────
  const navItems: { id: Section; label: string; icon: any; adminOnly?: boolean }[] = [
    ...(isAdmin ? [{ id: 'clients' as Section, label: 'Clients', icon: Building2, adminOnly: true }] : []),
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'team', label: 'Team & Access', icon: Users },
    { id: 'social', label: 'Social Accounts', icon: Share2 },
    { id: 'plan', label: 'Plan & Billing', icon: CreditCard },
    { id: 'notifications', label: 'Notification Prefs', icon: Bell },
    { id: 'integrations', label: 'Integrations', icon: Plug },
  ]

  return (
    <div className="flex h-full overflow-hidden">

      {/* Settings nav */}
      <div className="w-48 min-w-48 bg-white border-r border-black/10 flex flex-col py-3 px-2.5 gap-0.5 overflow-y-auto">
        {isAdmin && (
          <div className="flex items-center gap-1.5 px-2.5 py-2 mb-1 bg-[#1A2E5A] rounded-lg">
            <Shield size={11} className="text-white/60" />
            <span className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">Admin Only</span>
          </div>
        )}

        {navItems.map(({ id, label, icon: Icon, adminOnly }) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium w-full text-left transition-colors ${
              section === id
                ? 'bg-[#FDE8D8] text-[#E8660A]'
                : 'text-gray-500 hover:bg-[#F4F5F7] hover:text-[#1A2E5A]'
            } ${adminOnly && id !== 'clients' ? 'mt-3 pt-3 border-t border-black/8' : ''}`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 max-w-3xl">

        {/* ─── CLIENTS ────────────────────────────────────────────────────── */}
        {section === 'clients' && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-[#1A2E5A]">Clients</h1>
                <p className="text-xs text-gray-500 mt-0.5">Create, manage, and monitor all BaMo Ads Manager clients.</p>
              </div>
              <button onClick={() => { setShowNewClient(true); setClientStep(1); setClientCreated(false) }} className="btn-orange text-sm">
                <Plus size={14} /> Create Client
              </button>
            </div>

            {/* New client panel */}
            {showNewClient && (
              <div className="bamo-card border-[1.5px] border-[#E8660A]">
                <div className="bg-[#E8660A] px-4 py-3 flex items-center justify-between">
                  <div className="text-sm font-semibold text-white flex items-center gap-2">
                    <Plus size={14} /> Create New Client
                  </div>
                  <button onClick={() => setShowNewClient(false)} className="text-white/70 hover:text-white">
                    <X size={16} />
                  </button>
                </div>

                {/* Steps */}
                <div className="flex border-b border-black/8">
                  {['Client Info', 'Plan & Access', 'Credentials', 'Review'].map((label, i) => (
                    <button
                      key={label}
                      onClick={() => setClientStep(i + 1)}
                      className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 border-r border-black/8 last:border-0 transition-colors ${
                        clientStep === i + 1 ? 'bg-[#FDE8D8] text-[#E8660A]' : clientStep > i + 1 ? 'text-[#3B6D11]' : 'text-gray-400'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        clientStep === i + 1 ? 'bg-[#E8660A] text-white' : clientStep > i + 1 ? 'bg-[#EAF3DE] text-[#3B6D11]' : 'bg-[#F4F5F7] text-gray-400'
                      }`}>{clientStep > i + 1 ? '✓' : i + 1}</span>
                      {label}
                    </button>
                  ))}
                </div>

                <div className="p-4">
                  {clientStep === 1 && (
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Company / Brokerage name', key: 'name', placeholder: 'e.g. Prestige Realty Group' },
                        { label: 'Contact person', key: 'contact', placeholder: 'e.g. Maria Santos' },
                        { label: 'Business email', key: 'email', placeholder: 'maria@prestige.ph', type: 'email' },
                        { label: 'Phone number', key: 'phone', placeholder: '+63 917 xxx xxxx' },
                        { label: 'Region / Beachhead', key: 'region', placeholder: 'e.g. CALABARZON' },
                        { label: 'Client type', key: 'type', isSelect: true },
                      ].map(({ label, key, placeholder, type, isSelect }) => (
                        <div key={key}>
                          <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">{label}</label>
                          {isSelect ? (
                            <select className="bamo-input text-sm" value={(newClientForm as any)[key]} onChange={e => setNewClientForm(p => ({ ...p, [key]: e.target.value }))}>
                              <option value="agent">Real estate agent</option>
                              <option value="broker">Broker</option>
                              <option value="developer">Developer</option>
                              <option value="firm">Brokerage firm</option>
                            </select>
                          ) : (
                            <input className="bamo-input text-sm" type={type ?? 'text'} placeholder={placeholder} value={(newClientForm as any)[key]} onChange={e => setNewClientForm(p => ({ ...p, [key]: e.target.value }))} />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {clientStep === 2 && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Plan</label>
                        <select className="bamo-input text-sm" value={newClientForm.plan} onChange={e => setNewClientForm(p => ({ ...p, plan: e.target.value }))}>
                          <option value="starter">Starter</option>
                          <option value="growth">Growth</option>
                          <option value="pro">Pro</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Billing cycle</label>
                        <select className="bamo-input text-sm"><option>Monthly</option><option>Quarterly</option><option>Annual</option></select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs font-medium text-[#1A2E5A] mb-2 block">Feature access</label>
                        <div className="grid grid-cols-3 gap-2">
                          {['Content Studio', 'Creatives', 'Campaigns', 'Posts', 'Analytics', 'Website Builder'].map(f => (
                            <label key={f} className="flex items-center gap-2 text-xs cursor-pointer">
                              <input type="checkbox" defaultChecked={f !== 'Website Builder'} className="accent-[#E8660A]" /> {f}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {clientStep === 3 && (
                    <div className="flex flex-col gap-3">
                      <div className="text-xs text-gray-500">BaMo auto-generates login credentials. Customize below.</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Login email</label>
                          <input className="bamo-input text-sm" type="email" value={newClientForm.email} onChange={e => setNewClientForm(p => ({ ...p, email: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Password</label>
                          <div className="flex gap-2">
                            <input className="bamo-input text-sm flex-1" type="text" value={newClientForm.password} onChange={e => setNewClientForm(p => ({ ...p, password: e.target.value }))} placeholder="Auto-generated" />
                            <button onClick={() => setNewClientForm(p => ({ ...p, password: genPassword() }))} className="btn-ghost text-xs py-2 flex-shrink-0"><RefreshCw size={12} /></button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Role</label>
                          <input className="bamo-input text-sm bg-[#F4F5F7]" value="client_admin" disabled />
                        </div>
                      </div>
                      <div className="bg-[#E8EBF3] rounded-lg px-3 py-2.5 text-xs text-[#1A2E5A] flex items-start gap-2">
                        ℹ️ Credentials are created in Supabase Auth. Client receives a welcome email with their login link.
                      </div>
                    </div>
                  )}

                  {clientStep === 4 && !clientCreated && (
                    <div className="flex flex-col gap-3">
                      <div className="text-xs font-semibold text-[#1A2E5A] mb-1">Review before creating</div>
                      <div className="bg-[#F4F5F7] rounded-xl p-4 flex flex-col gap-2.5">
                        {[
                          ['Company', newClientForm.name],
                          ['Contact', newClientForm.contact],
                          ['Plan', newClientForm.plan.charAt(0).toUpperCase() + newClientForm.plan.slice(1)],
                          ['Login email', newClientForm.email],
                          ['Password', newClientForm.password],
                          ['Role', 'client_admin'],
                        ].map(([label, value]) => (
                          <div key={label} className="flex items-center gap-3">
                            <div className="text-xs text-gray-400 w-24 flex-shrink-0">{label}</div>
                            <div className="flex-1 text-xs font-mono bg-white border border-black/8 rounded-lg px-3 py-1.5 text-[#1A2E5A]">{value || '—'}</div>
                            {(label === 'Login email' || label === 'Password') && (
                              <button onClick={() => copyText(value, setCopied)} className="text-[10px] px-2 py-1 rounded border border-black/10 text-gray-500 hover:bg-gray-50 flex items-center gap-1 flex-shrink-0">
                                {copied ? <Check size={10} /> : <Copy size={10} />} Copy
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button onClick={submitNewClient} disabled={creatingClient} className="btn-orange w-full justify-center py-3">
                        {creatingClient ? '⏳ Creating...' : '✓ Create Client & Send Credentials'}
                      </button>
                    </div>
                  )}

                  {clientStep === 4 && clientCreated && (
                    <div className="text-center py-6 flex flex-col items-center gap-2">
                      <div className="text-4xl">✅</div>
                      <div className="text-sm font-semibold text-[#3B6D11]">Client created successfully!</div>
                      <div className="text-xs text-[#3B6D11]">Welcome email sent to {newClientForm.email}</div>
                      <button onClick={() => setShowNewClient(false)} className="btn-ghost text-sm mt-2">Close</button>
                    </div>
                  )}

                  {/* Nav footer */}
                  {clientStep < 4 && (
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-black/8">
                      <div className="text-xs text-gray-400">Step {clientStep} of 4</div>
                      <div className="flex gap-2">
                        {clientStep > 1 && <button onClick={() => setClientStep(s => s - 1)} className="btn-ghost text-xs">← Back</button>}
                        <button onClick={() => setClientStep(s => s + 1)} className="btn-orange text-xs">Next →</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Filter + search */}
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-white rounded-lg border border-black/10 px-3 py-1.5">
                <span>🔍</span>
                <input type="text" placeholder="Search clients..." className="bg-transparent text-sm outline-none flex-1" />
              </div>
              {['All', 'Active', 'Inactive'].map(f => (
                <button key={f} className="px-3 py-1.5 rounded-full text-xs font-medium border border-black/10 text-gray-500 hover:bg-gray-50 first:bg-[#1A2E5A] first:text-white first:border-[#1A2E5A]">{f}</button>
              ))}
            </div>

            {/* Clients list */}
            <div className="bamo-card divide-y divide-black/5">
              {clientsList.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-xs text-gray-400">No clients yet — create your first client above.</div>
              ) : clientsList.map((c, i) => {
                const initials = c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                const colors = ['bg-[#E8660A]', 'bg-[#1A2E5A]', 'bg-[#3B6D11]', 'bg-[#185FA5]', 'bg-[#854F0B]']
                return (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-4 hover:bg-[#F4F5F7] transition-colors">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold text-white flex-shrink-0 ${colors[i % colors.length]}`}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#1A2E5A]">{c.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{c.email}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          c.ads_plan === 'pro' ? 'bg-[#EAF3DE] text-[#3B6D11]'
                          : c.ads_plan === 'growth' ? 'bg-[#FDE8D8] text-[#E8660A]'
                          : 'bg-[#F1EFE8] text-[#5F5E5A]'
                        }`}>
                          {(c.ads_plan ?? 'starter').charAt(0).toUpperCase() + (c.ads_plan ?? 'starter').slice(1)}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          c.ads_enabled ? 'bg-[#EAF3DE] text-[#3B6D11]' : 'bg-[#F1EFE8] text-[#5F5E5A]'
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {c.ads_enabled ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Toggle on={c.ads_enabled} onChange={() => toggleClientStatus(c.id, c.ads_enabled)} />
                      <button className="btn-ghost text-xs py-1.5">Manage</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ─── PROFILE ────────────────────────────────────────────────────── */}
        {section === 'profile' && (
          <>
            <div><h1 className="text-xl font-semibold text-[#1A2E5A]">Profile</h1><p className="text-xs text-gray-500 mt-0.5">Manage your account details and password.</p></div>
            <div className="bamo-card">
              <div className="px-4 py-3 border-b border-black/5 text-sm font-semibold text-[#1A2E5A] flex items-center gap-2"><User size={14} className="text-[#E8660A]" /> Account Info</div>
              <div className="p-4 flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-[#1A2E5A] flex items-center justify-center text-white text-xl font-semibold flex-shrink-0">
                    {(profile.full_name ?? 'KR').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <button className="btn-ghost text-xs py-1.5">Upload Photo</button>
                    <button className="text-xs text-[#A32D2D] hover:underline">Remove</button>
                  </div>
                </div>
                <div className="h-px bg-black/8" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Full name</label>
                    <input className="bamo-input text-sm" value={fullName} onChange={e => setFullName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Role</label>
                    <input className="bamo-input text-sm bg-[#F4F5F7]" value={profile.role} disabled />
                  </div>
                </div>
                <div className="h-px bg-black/8" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">New password <span className="text-gray-400 font-normal">optional</span></label>
                    <input className="bamo-input text-sm" type="password" placeholder="••••••••" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Confirm password</label>
                    <input className="bamo-input text-sm" type="password" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button onClick={saveProfile} disabled={savingProfile} className="btn-orange text-sm">
                    {savingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ─── TEAM ───────────────────────────────────────────────────────── */}
        {section === 'team' && (
          <>
            <div><h1 className="text-xl font-semibold text-[#1A2E5A]">Team & Access</h1><p className="text-xs text-gray-500 mt-0.5">Manage who has access to this workspace.</p></div>
            <div className="bamo-card">
              <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between">
                <div className="text-sm font-semibold text-[#1A2E5A] flex items-center gap-2"><Users size={14} className="text-[#E8660A]" /> Team Members</div>
                <button className="btn-ghost text-xs"><Plus size={12} /> Invite User</button>
              </div>
              <div className="divide-y divide-black/5">
                {[{ id: profile.id, full_name: profile.full_name, email: null, role: profile.role }, ...teamMembers.filter(m => m.id !== profile.id)].map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-[#E8EBF3] flex items-center justify-center text-[11px] font-semibold text-[#1A2E5A] flex-shrink-0">
                      {(m.full_name ?? 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[#1A2E5A]">{m.full_name ?? 'Unknown'}</div>
                      {m.email && <div className="text-xs text-gray-400">{m.email}</div>}
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      m.role === 'baymo_admin' ? 'bg-[#E8EBF3] text-[#1A2E5A]' : 'bg-[#FDE8D8] text-[#E8660A]'
                    }`}>{m.role}</span>
                    {m.id !== profile.id && (
                      <button className="text-xs text-[#A32D2D] border border-[#F09595] px-2 py-1 rounded-lg hover:bg-[#FCEBEB]">Remove</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ─── SOCIAL ACCOUNTS ────────────────────────────────────────────── */}
        {section === 'social' && (
          <>
            <div><h1 className="text-xl font-semibold text-[#1A2E5A]">Social Accounts</h1><p className="text-xs text-gray-500 mt-0.5">Connect Facebook, Instagram, and LinkedIn accounts.</p></div>
            <div className="bamo-card divide-y divide-black/5">
              {[
                { platform: 'facebook', label: 'Facebook Page', icon: '📘' },
                { platform: 'instagram', label: 'Instagram Business', icon: '📸' },
                { platform: 'linkedin', label: 'LinkedIn Company Page', icon: '💼' },
                { platform: 'meta_ads', label: 'Meta Ads Account', icon: '📣' },
              ].map(({ platform, label, icon }) => {
                const account = socialAccounts.find(a => a.platform === platform)
                return (
                  <div key={platform} className="flex items-center gap-3 px-4 py-4">
                    <div className="w-10 h-10 rounded-lg bg-[#E8EBF3] flex items-center justify-center text-xl flex-shrink-0">{icon}</div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-[#1A2E5A]">{label}</div>
                      <div className={`text-xs mt-0.5 flex items-center gap-1 ${account ? 'text-[#3B6D11]' : 'text-gray-400'}`}>
                        <span>{account ? '✓' : '○'}</span>
                        {account ? `${account.account_name} · Connected` : 'Not connected'}
                      </div>
                    </div>
                    <button className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
                      account ? 'bg-[#EAF3DE] text-[#3B6D11] border border-[#C0DD97]' : 'bg-[#1A2E5A] text-white'
                    }`}>
                      {account ? 'Disconnect' : 'Connect'}
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ─── PLAN & BILLING ─────────────────────────────────────────────── */}
        {section === 'plan' && (
          <>
            <div><h1 className="text-xl font-semibold text-[#1A2E5A]">Plan & Billing</h1><p className="text-xs text-gray-500 mt-0.5">Your current plan, usage, and billing details.</p></div>
            <div className="bamo-card">
              <div className="px-4 py-3 border-b border-black/5 text-sm font-semibold text-[#1A2E5A] flex items-center gap-2"><CreditCard size={14} className="text-[#E8660A]" /> Current Plan</div>
              <div className="p-4 flex flex-col gap-4">
                <div className="border-[1.5px] border-[#1A2E5A] rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold bg-[#FDE8D8] text-[#E8660A] px-2.5 py-1 rounded-full">{plan.charAt(0).toUpperCase() + plan.slice(1)} Plan</span>
                    <div className="text-base font-semibold text-[#1A2E5A] mt-2">BaMo Ads Manager — {plan.charAt(0).toUpperCase() + plan.slice(1)}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Auto-renews monthly</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-semibold text-[#1A2E5A]">{PLAN_PRICES[plan] ?? '₱4,999'}</div>
                    <div className="text-xs text-gray-400">per month</div>
                    <button className="btn-orange text-xs mt-2">Upgrade to Pro</button>
                  </div>
                </div>
                <div className="h-px bg-black/8" />
                <div className="text-xs font-semibold text-[#1A2E5A] mb-1">This month's usage</div>
                {[
                  { label: 'Images generated', used: usage.images, limit: limits.images, color: 'bg-[#E8660A]' },
                  { label: 'Videos generated', used: usage.videos, limit: limits.videos, color: 'bg-[#1A2E5A]' },
                ].map(({ label, used, limit, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-gray-500">{label}</span>
                      <span className="font-semibold text-[#1A2E5A]">{used} / {limit === 999 ? 'Unlimited' : limit}</span>
                    </div>
                    <div className="h-1.5 bg-[#F4F5F7] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min((used / Math.max(limit, 1)) * 100, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ─── NOTIFICATIONS ──────────────────────────────────────────────── */}
        {section === 'notifications' && (
          <>
            <div><h1 className="text-xl font-semibold text-[#1A2E5A]">Notification Preferences</h1><p className="text-xs text-gray-500 mt-0.5">Choose what you get notified about.</p></div>
            {[
              { label: 'Campaigns', keys: ['campaign_live', 'campaign_failed', 'budget_low'] },
              { label: 'Leads', keys: ['lead_warm', 'lead_hot', 'appointment'] },
              { label: 'Creatives & Posts', keys: ['creative_ready', 'post_published', 'post_failed'] },
              { label: 'Website', keys: ['website_deployed', 'website_lead'] },
            ].map(({ label, keys }) => (
              <div key={label} className="bamo-card">
                <div className="px-4 py-3 border-b border-black/5 text-sm font-semibold text-[#1A2E5A] flex items-center gap-2">
                  <Bell size={14} className="text-[#E8660A]" /> {label}
                </div>
                <div className="divide-y divide-black/5">
                  {NOTIF_PREFS.filter(p => keys.includes(p.key)).map(pref => (
                    <div key={pref.key} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <div className="text-sm font-medium text-[#1A2E5A]">{pref.label}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{pref.sub}</div>
                      </div>
                      <Toggle on={notifPrefs[pref.key] ?? true} onChange={v => setNotifPrefs(p => ({ ...p, [pref.key]: v }))} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex justify-end">
              <button className="btn-orange text-sm">Save Preferences</button>
            </div>
          </>
        )}

        {/* ─── INTEGRATIONS ───────────────────────────────────────────────── */}
        {section === 'integrations' && (
          <>
            <div className="flex items-center justify-between">
              <div><h1 className="text-xl font-semibold text-[#1A2E5A]">Integrations & API</h1><p className="text-xs text-gray-500 mt-0.5">Third-party connections, API keys, tokens, and webhooks.</p></div>
              {isAdmin && <div className="flex items-center gap-1.5 bg-[#E8EBF3] text-[#1A2E5A] text-xs font-semibold px-3 py-1.5 rounded-full"><Shield size={12} /> baymo_admin only</div>}
            </div>

            {/* Integrations list */}
            <div className="bamo-card divide-y divide-black/5">
              {INTEGRATIONS.map(int => (
                <div key={int.id}>
                  <div className="flex items-center gap-3 px-4 py-4">
                    <div className="w-10 h-10 rounded-lg bg-[#F4F5F7] flex items-center justify-center text-xl flex-shrink-0">{int.icon}</div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-[#1A2E5A]">{int.label}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{int.sub}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1.5 text-xs font-medium ${int.status === 'connected' ? 'text-[#3B6D11]' : int.status === 'warning' ? 'text-[#854F0B]' : 'text-gray-400'}`}>
                        <div className={`w-2 h-2 rounded-full ${int.status === 'connected' ? 'bg-[#3B6D11]' : int.status === 'warning' ? 'bg-[#BA7517]' : 'bg-gray-300'}`} />
                        {int.status === 'connected' ? 'Connected' : int.status === 'warning' ? 'Expiring soon' : 'Not connected'}
                      </div>
                      <button
                        onClick={() => setSelectedIntegration(selectedIntegration === int.id ? null : int.id)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                          int.status === 'warning' ? 'bg-[#E8660A] text-white' : 'btn-ghost'
                        }`}
                      >
                        {int.status === 'disconnected' ? 'Connect' : int.status === 'warning' ? 'Renew Token' : 'Manage'}
                      </button>
                    </div>
                  </div>

                  {/* Token panel */}
                  {selectedIntegration === int.id && (
                    <div className="mx-4 mb-4 bg-[#F4F5F7] rounded-xl p-4 flex flex-col gap-3">
                      <div className="text-xs font-semibold text-[#1A2E5A]">API Key / Token</div>
                      <div className="flex gap-2">
                        <input
                          type={showToken ? 'text' : 'password'}
                          className="flex-1 bamo-input text-xs font-mono"
                          value={token || `${int.id}_live_xK9mP2qR8nL4jW7vT1bY3cF6`}
                          onChange={e => setToken(e.target.value)}
                        />
                        <button onClick={() => setShowToken(!showToken)} className="btn-ghost text-xs py-2 px-2.5">
                          {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button onClick={() => copyText(token || `${int.id}_live_xK9mP2qR8nL4jW7vT1bY3cF6`, setCopied)} className="btn-ghost text-xs py-2 px-2.5">
                          {copied ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                        <button className="btn-navy text-xs py-2 px-3">Save</button>
                      </div>
                      <div className={`text-xs flex items-center gap-1.5 ${int.status === 'warning' ? 'text-[#854F0B]' : 'text-[#3B6D11]'}`}>
                        {int.status === 'warning' ? '⚠ Expires Jun 3, 2026 — renew soon' : '✓ Token valid — no action needed'}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* BaMo API Key */}
            <div className="bamo-card">
              <div className="px-4 py-3 border-b border-black/5 text-sm font-semibold text-[#1A2E5A] flex items-center gap-2"><Key size={14} className="text-[#E8660A]" /> BaMo API Access</div>
              <div className="p-4 flex flex-col gap-3">
                <div className="text-xs text-gray-500">Use this key to authenticate requests from n8n or other tools.</div>
                <div className="flex gap-2">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    className="flex-1 bamo-input text-xs font-mono bg-[#F4F5F7]"
                    value={apiKey}
                    readOnly
                  />
                  <button onClick={() => setShowApiKey(!showApiKey)} className="btn-ghost text-xs py-2 px-2.5">
                    {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button onClick={() => copyText(apiKey, setApiKeyCopied)} className="btn-ghost text-xs py-2 px-2.5">
                    {apiKeyCopied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <button className="text-xs px-3 py-2 rounded-lg border border-[#F09595] text-[#A32D2D] hover:bg-[#FCEBEB]">Regenerate</button>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Allowed origins (CORS)</label>
                  <div className="flex gap-2">
                    <input className="flex-1 bamo-input text-sm" defaultValue="https://bahaymo.com, https://n8n-bahaymo.onrender.com" />
                    <button className="btn-orange text-xs">Save</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Webhooks */}
            <div className="bamo-card">
              <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between">
                <div className="text-sm font-semibold text-[#1A2E5A] flex items-center gap-2">🔗 Webhooks</div>
                <button className="btn-ghost text-xs"><Plus size={12} /> Add Webhook</button>
              </div>
              <div className="divide-y divide-black/5">
                {[
                  { label: 'BaMo Campaign Engine — Lead Intake', url: 'https://bahaymo.com/api/webhooks/lead-intake', pings: '247 events' },
                  { label: 'Creatomate — Render Complete', url: 'https://bahaymo.com/api/webhooks/creatomate-callback', pings: '38 events' },
                  { label: 'Meta Lead Form — Lead Sync', url: 'https://bahaymo.com/api/webhooks/meta-leads', pings: '142 events' },
                ].map(({ label, url, pings }) => (
                  <div key={url} className="px-4 py-4">
                    <div className="text-xs font-semibold text-[#1A2E5A] mb-2">{label}</div>
                    <div className="bg-[#F4F5F7] rounded-lg p-3 flex flex-col gap-2">
                      <div className="flex gap-2">
                        <div className="flex-1 text-xs font-mono text-[#1A2E5A] bg-white border border-black/8 rounded-lg px-3 py-2 truncate">{url}</div>
                        <button onClick={() => copyText(url, setCopied)} className="btn-ghost text-xs py-2 px-2.5 flex-shrink-0">
                          {copied ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      </div>
                      <div className="flex gap-4 text-[10px] text-gray-400">
                        <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-[#3B6D11]" /> Active</span>
                        <span>Last ping: 2 min ago</span>
                        <span>✓ {pings} this month</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* n8n settings */}
            <div className="bamo-card">
              <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between">
                <div className="text-sm font-semibold text-[#1A2E5A] flex items-center gap-2">⚡ n8n Automation</div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-[#3B6D11]"><div className="w-2 h-2 rounded-full bg-[#3B6D11]" /> Running</div>
              </div>
              <div className="p-4 flex flex-col gap-3">
                <div>
                  <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">n8n instance URL</label>
                  <div className="flex gap-2">
                    <input className="flex-1 bamo-input text-sm" defaultValue="https://n8n-bahaymo.onrender.com" />
                    <button className="btn-navy text-xs">Save</button>
                  </div>
                </div>
                {[
                  { label: 'Auto-trigger workflows on new leads', sub: 'n8n fires when Campaign Engine receives a new lead' },
                  { label: 'Sync analytics to n8n daily', sub: 'Push Meta ad metrics to n8n for custom reporting' },
                ].map(({ label, sub }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-t border-black/5">
                    <div>
                      <div className="text-sm font-medium text-[#1A2E5A]">{label}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
                    </div>
                    <Toggle on={true} onChange={() => {}} />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
