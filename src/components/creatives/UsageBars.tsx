'use client'

interface UsageBarsProps {
  imagesUsed: number
  videosUsed: number
  imageLimit: number
  videoLimit: number
}

export default function UsageBars({ imagesUsed, videosUsed, imageLimit, videoLimit }: UsageBarsProps) {
  const imgPct = Math.min((imagesUsed / imageLimit) * 100, 100)
  const vidPct = Math.min((videosUsed / videoLimit) * 100, 100)

  const imgColor = imgPct >= 90 ? 'bg-[#A32D2D]' : imgPct >= 70 ? 'bg-[#BA7517]' : 'bg-[#E8660A]'
  const vidColor = vidPct >= 90 ? 'bg-[#A32D2D]' : vidPct >= 70 ? 'bg-[#BA7517]' : 'bg-[#1A2E5A]'

  const resetDate = new Date()
  resetDate.setMonth(resetDate.getMonth() + 1, 1)
  const resetStr = resetDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="bamo-card px-5 py-4 flex items-center gap-6">
      <div className="flex-1">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-gray-500">Images this month</span>
          <span className="font-semibold text-[#1A2E5A]">
            {imagesUsed} / {imageLimit === 999 ? 'Unlimited' : imageLimit}
          </span>
        </div>
        <div className="h-1.5 bg-[#F4F5F7] rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${imgColor}`} style={{ width: `${imgPct}%` }} />
        </div>
      </div>

      <div className="w-px h-8 bg-black/8 flex-shrink-0" />

      <div className="flex-1">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-gray-500">Videos this month</span>
          <span className="font-semibold text-[#1A2E5A]">
            {videosUsed} / {videoLimit}
          </span>
        </div>
        <div className="h-1.5 bg-[#F4F5F7] rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${vidColor}`} style={{ width: `${vidPct}%` }} />
        </div>
      </div>

      <div className="w-px h-8 bg-black/8 flex-shrink-0" />

      <div className="text-xs text-gray-500 flex-shrink-0">
        Resets <strong className="text-[#1A2E5A]">{resetStr}</strong>
      </div>
    </div>
  )
}
