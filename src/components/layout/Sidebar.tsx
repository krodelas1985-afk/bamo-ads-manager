'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, FileText, Image, Megaphone, Building,
  Files, Send, BarChart2, Globe, Bell, Settings, LogOut
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

const mainNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/content', label: 'Content Studio', icon: FileText },
  { href: '/creatives', label: 'Creatives', icon: Image },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
]

const manageNav = [
  { href: '/listings', label: 'Listings', icon: Building },
  { href: '/assets', label: 'Asset Library', icon: Files },
  { href: '/posts', label: 'Posts', icon: Send },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/website', label: 'Website', icon: Globe },
]

const accountNav = [
  { href: '/notifications', label: 'Notifications', icon: Bell, badge: true },
  { href: '/settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  role: 'baymo_admin' | 'client_admin'
  clientName?: string
  unreadCount?: number
}

export default function Sidebar({ role, clientName, unreadCount = 0 }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  function NavItem({ href, label, icon: Icon, badge }: {
    href: string, label: string, icon: any, badge?: boolean
  }) {
    const active = isActive(href)
    return (
      <Link
        href={href}
        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
          active
            ? 'bg-[#E8660A] text-white'
            : 'text-white/60 hover:text-white hover:bg-white/10'
        }`}
      >
        <Icon size={16} className="flex-shrink-0" />
        <span className="flex-1">{label}</span>
        {badge && unreadCount > 0 && (
          <span className="bg-[#E8660A] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
            {unreadCount}
          </span>
        )}
      </Link>
    )
  }

  function SectionLabel({ label }: { label: string }) {
    return (
      <div className="text-[10px] font-semibold text-white/30 uppercase tracking-widest px-2.5 pt-2 pb-1">
        {label}
      </div>
    )
  }

  return (
    <aside className="w-[220px] min-w-[220px] h-screen bg-[#1A2E5A] flex flex-col sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="text-white font-semibold text-xl leading-none">BaMo</div>
        <div className="text-[#E8660A] text-[11px] font-medium uppercase tracking-widest mt-1">Ads Manager</div>
      </div>

      {/* Client context */}
      <div className="px-5 py-3 border-b border-white/10">
        <div className="text-[10px] text-white/40 uppercase tracking-wider">
          {role === 'baymo_admin' ? 'Admin View' : 'Client'}
        </div>
        <div className="text-white/85 text-sm font-medium mt-0.5 truncate">
          {clientName || (role === 'baymo_admin' ? 'All Clients' : 'My Workspace')}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-3 flex flex-col gap-0.5 overflow-y-auto">
        <SectionLabel label="Main" />
        {mainNav.map(item => <NavItem key={item.href} {...item} />)}

        <SectionLabel label="Manage" />
        {manageNav.map(item => <NavItem key={item.href} {...item} />)}

        <SectionLabel label="Account" />
        {accountNav.map(item => (
          <NavItem key={item.href} {...item} />
        ))}
      </nav>

      {/* Logout */}
      <div className="px-2.5 py-3 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 w-full transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
