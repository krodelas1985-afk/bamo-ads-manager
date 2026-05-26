'use client'

interface TopbarProps {
  title: string
  role: 'baymo_admin' | 'client_admin'
  plan?: string
  userInitials?: string
  actions?: React.ReactNode
}

export default function Topbar({ title, role, plan, userInitials = 'KR', actions }: TopbarProps) {
  return (
    <div className="bg-white border-b border-black/10 px-6 h-[52px] flex items-center justify-between flex-shrink-0">
      <div className="text-[15px] font-semibold text-[#1A2E5A]">{title}</div>
      <div className="flex items-center gap-3">
        {actions}
        {plan && (
          <div className="bg-[#FDE8D8] text-[#E8660A] text-xs font-semibold px-2.5 py-1 rounded-full">
            {plan}
          </div>
        )}
        {role === 'baymo_admin' && (
          <div className="bg-[#E8EBF3] text-[#1A2E5A] text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
            <span>baymo_admin</span>
          </div>
        )}
        <div className="w-8 h-8 rounded-full bg-[#1A2E5A] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
          {userInitials}
        </div>
      </div>
    </div>
  )
}
