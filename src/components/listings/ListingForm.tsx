'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Save } from 'lucide-react'

const PROPERTY_TYPES = [
  { id: 'condo', label: 'Condominium' },
  { id: 'house_lot', label: 'House & Lot' },
  { id: 'lot', label: 'Lot only' },
  { id: 'commercial', label: 'Commercial' },
]

export default function ListingForm({ clientId }: { clientId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    marketplace_listing_id: '',
    property_name: '',
    property_type: 'condo',
    description: '',
    price: '',
    location: '',
    city: '',
    bedrooms: '',
    bathrooms: '',
    floor_area: '',
    lot_area: '',
    listing_url: '',
    agent_name: '',
    agent_prc_number: '',
    agent_email: '',
    agent_phone: '',
  })

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!form.property_name.trim()) { alert('Property name is required'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('ad_listings').insert({
        client_id: clientId,
        marketplace_listing_id: form.marketplace_listing_id || `manual-${Date.now()}`,
        property_name: form.property_name,
        property_type: form.property_type,
        description: form.description || null,
        price: form.price ? Number(form.price) : null,
        location: form.location || null,
        city: form.city || null,
        bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
        floor_area: form.floor_area ? Number(form.floor_area) : null,
        lot_area: form.lot_area ? Number(form.lot_area) : null,
        listing_url: form.listing_url || null,
        agent_name: form.agent_name || null,
        agent_prc_number: form.agent_prc_number || null,
        agent_email: form.agent_email || null,
        agent_phone: form.agent_phone || null,
      })
      if (error) throw error
      router.push('/listings')
      router.refresh()
    } catch (err) {
      console.error(err)
      alert('Failed to save listing. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function Field({ label, field, type = 'text', placeholder = '', optional = false, full = false }: {
    label: string, field: string, type?: string, placeholder?: string, optional?: boolean, full?: boolean
  }) {
    return (
      <div className={full ? 'col-span-2' : ''}>
        <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">
          {label} {optional && <span className="text-gray-400 font-normal">optional</span>}
        </label>
        <input
          className="bamo-input"
          type={type}
          placeholder={placeholder}
          value={(form as any)[field]}
          onChange={e => update(field, e.target.value)}
        />
      </div>
    )
  }

  return (
    <div className="max-w-2xl flex flex-col gap-4">

      <div className="bamo-card">
        <div className="px-4 py-3 border-b border-black/5 text-sm font-semibold text-[#1A2E5A]">🏠 Property Details</div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <Field label="Property name" field="property_name" placeholder="e.g. Laguna Condo 2BR" />
          <div>
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Property type</label>
            <select className="bamo-input" value={form.property_type} onChange={e => update('property_type', e.target.value)}>
              {PROPERTY_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <Field label="Price (₱)" field="price" type="number" placeholder="e.g. 4200000" />
          <Field label="City" field="city" placeholder="e.g. Sta. Rosa" />
          <Field label="Full location" field="location" placeholder="e.g. Sta. Rosa, Laguna" optional full />
          <Field label="Floor area (sqm)" field="floor_area" type="number" placeholder="e.g. 42" optional />
          <Field label="Lot area (sqm)" field="lot_area" type="number" placeholder="e.g. 80" optional />
          <Field label="Bedrooms" field="bedrooms" type="number" placeholder="e.g. 2" optional />
          <Field label="Bathrooms" field="bathrooms" type="number" placeholder="e.g. 1" optional />
          <div className="col-span-2">
            <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Description <span className="text-gray-400 font-normal">optional</span></label>
            <textarea
              className="bamo-input resize-none"
              rows={3}
              placeholder="Describe the property..."
              value={form.description}
              onChange={e => update('description', e.target.value)}
            />
          </div>
          <Field label="Listing URL" field="listing_url" placeholder="https://bahaymo.com/listing/..." optional full />
          <Field label="BaMo Marketplace ID" field="marketplace_listing_id" placeholder="Leave blank if manual entry" optional full />
        </div>
      </div>

      <div className="bamo-card">
        <div className="px-4 py-3 border-b border-black/5 text-sm font-semibold text-[#1A2E5A]">👤 Agent Info</div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <Field label="Agent name" field="agent_name" placeholder="e.g. Maria Santos" optional />
          <Field label="PRC license number" field="agent_prc_number" placeholder="e.g. PRC-REB-2021-04821" optional />
          <Field label="Agent email" field="agent_email" type="email" placeholder="e.g. maria@prestige.ph" optional />
          <Field label="Agent phone" field="agent_phone" placeholder="+63 917 xxx xxxx" optional />
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn-orange">
          <Save size={14} /> {saving ? 'Saving...' : 'Save Listing'}
        </button>
      </div>

    </div>
  )
}
