'use client'

interface UsageBarsProps {
  imagesUsed: number
  videosUsed: number
  carouselUsed?: number
  imageLimit: number
  videoLimit: number
  carouselLimit?: number
}

export default function UsageBars({
  imagesUsed, videosUsed, carouselUsed = 0,
  imageLimit, videoLimit, carouselLimit = 20,
}: UsageBarsProps) {
  const imgPct = Math.min((imagesUsed / imageLimit) * 100, 100)
  const vidPct = Math.min((videosUsed / videoLimit) * 100, 100)
  const carPct = Math.min((carouselUsed / carouselLimit) * 100, 100)

  const barColor = (pct: number, base: string) =>
    pct >= 90 ? 'bg-[#A32D2D]' : pct >= 70 ? 'bg-[#BA7517]' : base

  const resetDate = new Date()
  resetDate.setMonth(resetDate.getMonth() + 1, 1)
  const resetStr = resetDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })

  const bars = [
    { label: 'Images', used: imagesUsed, limit: imageLimit, pct: imgPct, base: 'bg-[#E8660A]' },
    { label: 'Videos', used: videosUsed, limit: videoLimit, pct: vidPct, base: 'bg-[#1A2E5A]' },
    { label: 'Carousels', used: carouselUsed, limit: carouselLimit, pct: carPct, base: 'bg-[#5B77B0]' },
  ]

  return (
    <div className="bamo-card px-5 py-4 flex items-center gap-6">
      {bars.map((b, i) => (
        <div key={b.label} className="flex items-center gap-6 flex-1">
          {i > 0 && <div className="w-px h-8 bg-black/8 flex-shrink-0" />}
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-500">{b.label} this month</span>
              <span className="font-semibold text-[#1A2E5A]">
                {b.used} / {b.limit === 999 ? 'Unlimited' : b.limit}
              </span>
            </div>
            <div className="h-1.5 bg-[#F4F5F7] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor(b.pct, b.base)}`}
                style={{ width: `${b.pct}%` }}
              />
            </div>
          </div>
        </div>
      ))}
      <div className="w-px h-8 bg-black/8 flex-shrink-0" />
      <div className="text-xs text-gray-500 flex-shrink-0">
        Resets <strong className="text-[#1A2E5A]">{resetStr}</strong>
      </div>
    </div>
  )
}
