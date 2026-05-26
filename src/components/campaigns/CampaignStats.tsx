'use client'
import { Megaphone, TrendingUp, Coins, Users, Target } from 'lucide-react'

interface CampaignStatsProps {
  total: number
  active: number
  totalSpend: number
  totalLeads: number
  avgCPL: number
}

export default function CampaignStats({ total, active, totalSpend, totalLeads, avgCPL }: CampaignStatsProps) {
  const stats = [
    {
      label: 'Total campaigns',
      value: total,
      sub: `${active} active`,
      icon: Megaphone,
      iconBg: 'bg-[#E8EBF3]',
      iconColor: 'text-[#1A2E5A]',
    },
    {
      label: 'Active now',
      value: active,
      sub: 'running',
      icon: TrendingUp,
      iconBg: 'bg-[#EAF3DE]',
      iconColor: 'text-[#3B6D11]',
    },
    {
      label: 'Total ad spend',
      value: `₱${totalSpend.toLocaleString()}`,
      sub: 'all campaigns',
      icon: Coins,
      iconBg: 'bg-[#FAEEDA]',
      iconColor: 'text-[#854F0B]',
    },
    {
      label: 'Total leads',
      value: totalLeads,
      sub: 'generated',
      icon: Users,
      iconBg: 'bg-[#FDE8D8]',
      iconColor: 'text-[#E8660A]',
    },
    {
      label: 'Avg. cost per lead',
      value: avgCPL > 0 ? `₱${avgCPL.toLocaleString()}` : '—',
      sub: 'across all campaigns',
      icon: Target,
      iconBg: 'bg-[#E6F1FB]',
      iconColor: 'text-[#185FA5]',
    },
  ]

  return (
    <div className="grid grid-cols-5 gap-3">
      {stats.map(({ label, value, sub, icon: Icon, iconBg, iconColor }) => (
        <div key={label} className="bamo-card p-4">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${iconBg}`}>
            <Icon size={16} className={iconColor} />
          </div>
          <div className="text-xl font-semibold text-[#1A2E5A] leading-none">{value}</div>
          <div className="text-xs text-gray-500 mt-1">{label}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>
        </div>
      ))}
    </div>
  )
}
