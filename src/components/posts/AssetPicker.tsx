'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Image as ImageIcon, Film } from 'lucide-react'

export interface PickerItem {
  id: string
  url: string
  thumb: string | null
  type: 'image' | 'video'
  label: string
  source: 'upload' | 'creative'
}

interface AssetPickerProps {
  open: boolean
  items: PickerItem[]
  initialSelected: string[]
  onClose: () => void
  onConfirm: (selected: PickerItem[]) => void
}

const MAX_IMAGES = 10

export default function AssetPicker({ open, items, initialSelected, onClose, onConfirm }: AssetPickerProps) {
  const [mounted, setMounted] = useState(false)
  const [tab, setTab] = useState<'image' | 'video'>('image')
  const [selected, setSelected] = useState<string[]>(initialSelected)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    if (open) setSelected(initialSelected)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted || !open) return null

  const visible = items.filter(i => i.type === tab)
  const selectedItems = items.filter(i => selected.includes(i.url))
  const imageCount = selectedItems.filter(i => i.type === 'image').length
  const hasVideo = selectedItems.some(i => i.type === 'video')

  function toggle(item: PickerItem) {
    setSelected(prev => {
      if (prev.includes(item.url)) return prev.filter(u => u !== item.url)
      // A video is always alone on a post
      if (item.type === 'video') return [item.url]
      // Adding an image drops any selected video
      const imagesOnly = prev.filter(u => items.find(i => i.url === u)?.type === 'image')
      if (imagesOnly.length >= MAX_IMAGES) return imagesOnly
      return [...imagesOnly, item.url]
    })
  }

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-black/8 flex items-center justify-between flex-shrink-0">
          <div className="text-sm font-semibold text-[#1A2E5A]">Choose media — Asset Library</div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 flex items-center gap-1 flex-shrink-0">
          {(['image', 'video'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors ${
                tab === t ? 'bg-[#E8EBF3] text-[#1A2E5A]' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {t === 'image' ? <ImageIcon size={11} /> : <Film size={11} />}
              {t === 'image' ? 'Images' : 'Videos'}
            </button>
          ))}
          <div className="ml-auto text-[10px] text-gray-400">
            {hasVideo ? '1 video selected' : `${imageCount}/${MAX_IMAGES} images`}
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {visible.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-10">
              {tab === 'image'
                ? 'No images for this client yet — upload in Asset Library or generate in Creatives.'
                : 'No videos for this client yet — generate one in Creatives.'}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2.5">
              {visible.map(item => {
                const isSelected = selected.includes(item.url)
                const order = item.type === 'image' ? selected.indexOf(item.url) + 1 : null
                return (
                  <button
                    key={item.id}
                    onClick={() => toggle(item)}
                    className={`relative rounded-lg overflow-hidden border-2 transition-colors text-left ${
                      isSelected ? 'border-[#E8660A]' : 'border-transparent hover:border-black/15'
                    }`}
                  >
                    {item.thumb ? (
                      <img src={item.thumb} alt={item.label} className="w-full h-24 object-cover" />
                    ) : (
                      <div className="w-full h-24 bg-[#1A2E5A] flex items-center justify-center text-white">
                        <Film size={20} />
                      </div>
                    )}
                    <div className="absolute top-1 left-1 bg-black/55 text-white text-[8px] font-semibold px-1.5 py-0.5 rounded-full">
                      {item.source === 'upload' ? 'Upload' : 'Creative'}
                    </div>
                    {isSelected && (
                      <div className="absolute top-1 right-1 bg-[#E8660A] text-white text-[9px] font-bold w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center">
                        {order ?? '✓'}
                      </div>
                    )}
                    <div className="px-1.5 py-1 text-[9px] text-gray-500 truncate bg-white">{item.label}</div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-black/8 flex items-center justify-between flex-shrink-0">
          <div className="text-[10px] text-gray-400">Up to {MAX_IMAGES} photos for a carousel, or 1 video.</div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-ghost text-xs">Cancel</button>
            <button
              onClick={() => onConfirm(selectedItems)}
              disabled={selectedItems.length === 0}
              className="btn-orange text-xs disabled:opacity-40"
            >
              Use {selectedItems.length > 0 ? selectedItems.length : ''} selected
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
