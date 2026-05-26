'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FileText, Image, Megaphone,
  MapPin, Send, BarChart2, Bell, Settings, Users, LogOut
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { UserRole } from '@/types'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/content', label: 'Content Studio', icon: FileText },
  { href: '/creatives', label: 'Creatives', icon: Image },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/listings', label: 'Listings', icon: MapPin },
  { href: '/posts', label: 'Posts', icon: Send },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings', label: 'Settings', icon: Settings },
]

const adminOnlyItems = [
  { href: '/clients', label: 'Clients', icon: Users },
]

interface SidebarProps {
  role: UserRole
  clientName?: string
}

export default function Sidebar({ role, clientName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const allItems = role === 'baymo_admin'
    ? [...adminOnlyItems, ...navItems]
    : navItems

  return (
    <aside className="w-60 min-h-screen bg-[#1A2E5A] flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <p className="text-white font-bold text-xl">BaMo</p>
        <p className="text-[#E8660A] text-sm font-semibold">Ads Manager</p>
        {clientName && (
          <p className="text-white/50 text-xs mt-1 truncate">{clientName}</p>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {allItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                active
                  ? 'bg-[#E8660A] text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 w-full transition"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
