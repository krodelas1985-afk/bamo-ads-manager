'use client'
import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  Upload, Image as ImageIcon, Video, FileText,
  FolderPlus, X, Download, Trash2, Copy, Check,
  Megaphone, Globe, Send, LayoutGrid, List
} from 'lucide-react'
import Link from 'next/link'
import ReferenceDocumentsPanel, { type ReferenceDocument } from './ReferenceDocumentsPanel'

const FOLDERS = [
  { id: 'general', label: 'All Assets', icon: '📦' },
  { id: 'documents', label: 'Documents', icon: '📄' },
  { id: 'listings', label: 'Listings', icon: '🏠' },
  { id: 'team', label: 'Team / Agents', icon: '👥' },
  { id: 'branding', label: 'Branding', icon: '👑' },
  { id: 'hero', label: 'Hero Images', icon: '🖼️' },
  { id: 'video', label: 'Videos', icon: '🎬' },
  { id: 'generated', label: 'Generated', icon: '✨' },
]

const TYPE_ICONS: Record<string, any> = {
  image: ImageIcon,
  video: Video,
  document: FileText,
}

const TYPE_COLORS: Record<string, string> = {
  image: 'bg-[#E8EBF3] text-[#1A2E5A]',
  video: 'bg-[#FDE8D8] text-[#E8660A]',
  document: 'bg-[#E6F1FB] text-[#185FA5]',
}

interface Asset {
  id: string
  file_name: string
  file_type: string
  mime_type: string | null
  file_size_bytes: number | null
  public_url: string
  storage_path: string
  width: number | null
  height: number | null
  duration_seconds: number | null
  thumbnail_url: string | null
  folder: string
  tags: string[]
  used_in_creatives: boolean
  used_in_website: boolean
  used_in_posts: boolean
  usage_count: number
  created_at: string
  source?: 'upload' | 'creative'
}

interface Props {
  assets: Asset[]
  clientId: string | null
  storageUsedGB: number
  storageMaxGB: number
  referenceDocuments: ReferenceDocument[]
}

export default function AssetLibraryClient({ assets: initialAssets, clientId, storageUsedGB, storageMaxGB, referenceDocuments }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [assets, setAssets] = useState<Asset[]>(initialAssets)
  const [folder, setFolder] = useState('general')
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Asset | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadFileName, setUploadFileName] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [copied, setCopied] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const storagePct = Math.min((storageUsedGB / storageMaxGB) * 100, 100)

  const folderCounts = FOLDERS.reduce((acc, f) => {
    if (f.id === 'general') acc[f.id] = assets.length
    else if (f.id === 'documents') acc[f.id] = referenceDocuments.length
    else acc[f.id] = assets.filter(a => a.folder === f.id).length
    return acc
  }, {} as Record<string, number>)

  const filtered = assets.filter(a => {
    const matchFolder = folder === 'general' ? true : a.folder === folder
    const matchType = typeFilter === 'all' ? true : a.file_type === typeFilter
    const matchSearch = search ? a.file_name.toLowerCase().includes(search.toLowerCase()) : true
    return matchFolder && matchType && matchSearch
  })

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    if (!clientId) {
      alert('Select a client first (Viewing dropdown above) to upload assets.')
      return
    }
    const file = files[0]
    setUploading(true)
    setUploadFileName(file.name)
    setUploadProgress(0)

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 85) { clearInterval(progressInterval); return prev }
          return prev + Math.random() * 15 + 5
        })
      }, 200)

      const fileExt = file.name.split('.').pop()
      const storagePath = `${clientId}/${Date.now()}.${fileExt}`

      const { data, error } = await supabase.storage
        .from('client-assets')
        .upload(storagePath, file, { cacheControl: '3600', upsert: false })

      clearInterval(progressInterval)

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage
        .from('client-assets')
        .getPublicUrl(storagePath)

      const fileType = file.type.startsWith('image/') ? 'image'
        : file.type.startsWith('video/') ? 'video' : 'document'

      const { data: inserted, error: dbErr } = await supabase
        .from('client_assets')
        .insert({
          client_id: clientId,
          file_name: file.name,
          file_type: fileType,
          mime_type: file.type,
          file_size_bytes: file.size,
          storage_path: storagePath,
          public_url: publicUrl,
          folder: folder === 'general' ? 'general' : folder,
        })
        .select()
        .single()

      if (dbErr) throw dbErr

      setUploadProgress(100)
      setAssets(prev => [{ ...inserted, source: 'upload' }, ...prev])

      setTimeout(() => {
        setUploading(false)
        setUploadProgress(0)
        setUploadFileName('')
      }, 600)

    } catch (err) {
      console.error('Upload failed:', err)
      setUploading(false)
      setUploadProgress(0)
    }
  }

  async function handleDelete(asset: Asset) {
    if (asset.source === 'creative') {
      alert('Generated creatives are managed in the Creatives tab.')
      return
    }
    if (!confirm(`Delete "${asset.file_name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await supabase.storage.from('client-assets').remove([asset.storage_path])
      await supabase.from('client_assets').delete().eq('id', asset.id)
      setAssets(prev => prev.filter(a => a.id !== asset.id))
      setSelected(null)
    } catch (err) {
      console.error(err)
    } finally {
      setDeleting(false)
    }
  }

  async function handleBulkDelete() {
    const toDelete = assets.filter(a => selectedIds.has(a.id) && a.source !== 'creative')
    const skipped = selectedIds.size - toDelete.length
    if (toDelete.length === 0) {
      alert('Generated creatives are managed in the Creatives tab and were not deleted.')
      return
    }
    if (!confirm(`Delete ${toDelete.length} asset(s)?${skipped > 0 ? ` (${skipped} generated creative(s) will be skipped.)` : ''} This cannot be undone.`)) return
    const paths = toDelete.map(a => a.storage_path).filter(Boolean)
    if (paths.length > 0) await supabase.storage.from('client-assets').remove(paths)
    await supabase.from('client_assets').delete().in('id', toDelete.map(a => a.id))
    const deletedIds = new Set(toDelete.map(a => a.id))
    setAssets(prev => prev.filter(a => !deletedIds.has(a.id)))
    setSelectedIds(new Set())
    setSelectMode(false)
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  }

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback(() => setIsDragging(false), [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }, [folder])

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* Folders sidebar */}
      <div className="w-44 min-w-44 bg-white border-r border-black/10 flex flex-col py-3 px-2.5 gap-0.5">
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 py-1.5">Folders</div>

        {FOLDERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFolder(f.id)}
            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium w-full text-left transition-colors ${
              folder === f.id ? 'bg-[#FDE8D8] text-[#E8660A]' : 'text-gray-500 hover:bg-[#F4F5F7] hover:text-[#1A2E5A]'
            }`}
          >
            <span className="text-base leading-none">{f.icon}</span>
            <span className="flex-1 truncate text-xs">{f.label}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
              folder === f.id ? 'bg-[#E8660A] text-white' : 'bg-[#F4F5F7] text-gray-400'
            }`}>
              {folderCounts[f.id] ?? 0}
            </span>
          </button>
        ))}

        <button className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-gray-400 hover:bg-[#F4F5F7] mt-2">
          <FolderPlus size={14} /> New Folder
        </button>

        {/* Storage */}
        <div className="mt-auto pt-3 border-t border-black/8 px-1">
          <div className="flex justify-between text-[10px] text-gray-400 mb-1.5">
            <span>Storage</span>
            <span className="font-semibold text-[#1A2E5A]">{storageUsedGB} / {storageMaxGB} GB</span>
          </div>
          <div className="h-1.5 bg-[#F4F5F7] rounded-full overflow-hidden">
            <div className="h-full bg-[#E8660A] rounded-full" style={{ width: `${storagePct}%` }} />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden p-5 gap-3">

        {folder === 'documents' ? (
          <>
            <div>
              <div className="text-xl font-semibold text-[#1A2E5A]">Reference Documents</div>
              <div className="text-xs text-gray-500 mt-0.5">Source-of-truth files the AI can ground its writing on</div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ReferenceDocumentsPanel clientId={clientId} initialDocuments={referenceDocuments} />
            </div>
          </>
        ) : (
        <>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-semibold text-[#1A2E5A]">Asset Library</div>
            <div className="text-xs text-gray-500 mt-0.5">Shared across Creatives, Website Builder, and Posts</div>
          </div>
          <div className="flex gap-2">
            {selectMode ? (
              <button
                onClick={() => { setSelectMode(false); setSelectedIds(new Set()) }}
                className="btn-ghost text-sm"
              >
                Done
              </button>
            ) : (
              <button onClick={() => setSelectMode(true)} className="btn-ghost text-sm">
                ☑ Select
              </button>
            )}
            <button onClick={() => fileInputRef.current?.click()} className="btn-orange text-sm">
              <Upload size={14} /> Upload Assets
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,.pdf"
              className="hidden"
              onChange={e => handleFiles(e.target.files)}
            />
          </div>
        </div>

        {/* Upload zone */}
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`border-2 rounded-xl p-5 text-center cursor-pointer transition-all ${
            isDragging ? 'border-[#E8660A] bg-[#FDE8D8]' : 'border-dashed border-black/15 bg-white hover:border-[#E8660A] hover:bg-[#FDE8D8]/30'
          }`}
        >
          {uploading ? (
            <div className="flex items-center gap-3 max-w-sm mx-auto">
              <div className="w-8 h-8 border-2 border-[#FDE8D8] border-t-[#E8660A] rounded-full animate-spin flex-shrink-0" />
              <div className="flex-1 text-left">
                <div className="text-xs font-medium text-[#1A2E5A] truncate">{uploadFileName}</div>
                <div className="h-1.5 bg-[#F4F5F7] rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full bg-[#E8660A] rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
              <div className="text-xs text-gray-500">{Math.round(uploadProgress)}%</div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <Upload size={24} className="text-[#E8660A]" />
              <div className="text-sm font-medium text-[#1A2E5A]">
                {clientId ? 'Drag & drop files here' : 'Select a client above to upload'}
              </div>
              <div className="text-xs text-gray-400">JPG, PNG, MP4, MOV, PDF · Max 50MB per file</div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="bamo-card border-[1.5px] border-[#E8660A]">
            <div className="bg-[#FDE8D8] px-4 py-2.5 flex items-center justify-between">
              <div className="text-sm font-semibold text-[#E8660A] truncate flex items-center gap-1.5">
                <ImageIcon size={13} /> {selected.file_name}
              </div>
              <button onClick={() => setSelected(null)} className="text-[#E8660A] ml-2 flex-shrink-0">
                <X size={15} />
              </button>
            </div>
            <div className="px-4 py-3 grid grid-cols-3 gap-3">
              {selected.file_type === 'video' && selected.public_url && (
                <div className="col-span-3">
                  <video
                    key={selected.id}
                    src={selected.public_url}
                    poster={selected.thumbnail_url ?? undefined}
                    controls
                    preload="metadata"
                    className="w-full max-h-72 rounded-lg bg-black"
                  />
                </div>
              )}
              {[
                { label: 'Type', value: `${selected.file_type} · ${selected.mime_type?.split('/')[1]?.toUpperCase() ?? '—'}` },
                { label: 'Size', value: selected.file_size_bytes ? formatBytes(selected.file_size_bytes) : '—' },
                { label: 'Dimensions', value: selected.width && selected.height ? `${selected.width} × ${selected.height}` : '—' },
                { label: 'Folder', value: FOLDERS.find(f => f.id === selected.folder)?.label ?? selected.folder },
                { label: 'Uploaded', value: new Date(selected.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) },
                {
                  label: 'Used in', value: [
                    selected.used_in_creatives && 'Creatives',
                    selected.used_in_website && 'Website',
                    selected.used_in_posts && 'Posts',
                  ].filter(Boolean).join(', ') || 'Not used yet'
                },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</div>
                  <div className="text-xs font-medium text-[#1A2E5A] mt-0.5">{value}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-1.5 px-4 py-2.5 border-t border-black/5 flex-wrap">
              <Link href={`/creatives/new?asset_id=${selected.id}`} className="btn-ghost text-xs py-1.5">
                <ImageIcon size={11} /> Use in Creative
              </Link>
              <Link href={`/website?asset_id=${selected.id}`} className="btn-ghost text-xs py-1.5">
                <Globe size={11} /> Use in Website
              </Link>
              <Link href={`/posts/new?asset_id=${selected.id}`} className="btn-ghost text-xs py-1.5">
                <Send size={11} /> Use in Post
              </Link>
              <button
                onClick={() => copyUrl(selected.public_url)}
                className="btn-ghost text-xs py-1.5"
              >
                {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy URL</>}
              </button>
              <a href={selected.public_url} download={selected.file_name} className="btn-ghost text-xs py-1.5">
                <Download size={11} /> Download
              </a>
              {selected.source !== 'creative' && (
                <button
                  onClick={() => handleDelete(selected)}
                  disabled={deleting}
                  className="text-xs py-1.5 px-2.5 rounded-lg border border-[#F09595] text-[#A32D2D] hover:bg-[#FCEBEB] transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  <Trash2 size={11} /> Delete
                </button>
              )}
            </div>
          </div>
        )}

        {/* Bulk bar */}
        {selectMode && selectedIds.size > 0 && (
          <div className="bg-[#1A2E5A] rounded-xl px-4 py-3 flex items-center justify-between">
            <div className="text-sm font-medium text-white flex items-center gap-2">
              ☑ {selectedIds.size} selected
            </div>
            <div className="flex gap-2">
              <button className="text-xs px-3 py-1.5 rounded-lg bg-white/15 text-white hover:bg-white/25 transition-colors">
                <ImageIcon size={11} className="inline mr-1" /> Use in Creative
              </button>
              <button className="text-xs px-3 py-1.5 rounded-lg bg-white/15 text-white hover:bg-white/25 transition-colors">
                <Globe size={11} className="inline mr-1" /> Use in Website
              </button>
              <button
                onClick={handleBulkDelete}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#FCEBEB]/20 text-[#F09595] hover:bg-[#FCEBEB]/40 transition-colors"
              >
                <Trash2 size={11} className="inline mr-1" /> Delete
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-white rounded-lg border border-black/10 px-3 py-1.5">
            <span className="text-gray-400">🔍</span>
            <input
              type="text"
              placeholder="Search assets..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-sm outline-none flex-1"
            />
          </div>
          {['all', 'image', 'video', 'document'].map(f => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                typeFilter === f ? 'bg-[#1A2E5A] text-white' : 'border border-black/10 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
              <div className="text-3xl">📂</div>
              <div className="text-sm">No assets here yet</div>
              <button onClick={() => fileInputRef.current?.click()} className="btn-orange text-sm">
                <Upload size={13} /> Upload your first asset
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3 pb-4">
              {filtered.map(asset => {
                const Icon = TYPE_ICONS[asset.file_type] ?? FileText
                const isSelected = selectMode && selectedIds.has(asset.id)
                const isDetailSelected = selected?.id === asset.id

                return (
                  <div
                    key={asset.id}
                    onClick={() => selectMode ? toggleSelect(asset.id) : setSelected(isDetailSelected ? null : asset)}
                    className={`bamo-card cursor-pointer transition-all hover:border-[#1A2E5A] ${
                      isDetailSelected ? 'border-[1.5px] border-[#E8660A]' : ''
                    } ${isSelected ? 'border-[1.5px] border-[#E8660A] bg-[#FDE8D8]/20' : ''}`}
                  >
                    {/* Thumb */}
                    <div className={`aspect-square flex items-center justify-center relative overflow-hidden ${TYPE_COLORS[asset.file_type] ?? 'bg-[#E8EBF3]'}`}>
                      {asset.file_type === 'image' && asset.public_url ? (
                        <img
                          src={asset.public_url}
                          alt={asset.file_name}
                          className="w-full h-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : asset.file_type === 'video' && asset.thumbnail_url ? (
                        <img
                          src={asset.thumbnail_url}
                          alt={asset.file_name}
                          className="w-full h-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : (
                        <Icon size={28} className="opacity-40" />
                      )}

                      {/* Type badge */}
                      <span className="absolute top-1.5 left-1.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-[#1A2E5A]/80 text-white">
                        {asset.mime_type?.split('/')[1]?.toUpperCase().slice(0, 4) ?? asset.file_type.toUpperCase().slice(0, 3)}
                      </span>

                      {/* Status dot */}
                      {(asset.used_in_creatives || asset.used_in_website || asset.used_in_posts) && (
                        <div className="absolute bottom-1.5 right-1.5 flex gap-1">
                          {asset.used_in_creatives && <div className="w-2 h-2 rounded-full bg-[#1A2E5A]" title="Used in Creative" />}
                          {asset.used_in_website && <div className="w-2 h-2 rounded-full bg-[#3B6D11]" title="Used in Website" />}
                          {asset.used_in_posts && <div className="w-2 h-2 rounded-full bg-[#E8660A]" title="Used in Post" />}
                        </div>
                      )}

                      {/* Video duration */}
                      {asset.file_type === 'video' && asset.duration_seconds && (
                        <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold bg-black/50 text-white px-1.5 py-0.5 rounded">
                          {Math.floor(asset.duration_seconds / 60)}:{String(asset.duration_seconds % 60).padStart(2, '0')}
                        </span>
                      )}

                      {/* Select check */}
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#E8660A] flex items-center justify-center">
                          <Check size={11} className="text-white" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-2.5">
                      <div className="text-xs font-medium text-[#1A2E5A] truncate">{asset.file_name}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {asset.file_size_bytes ? formatBytes(asset.file_size_bytes) : ''}
                        {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ''}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  )
}
