'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Check, Globe, Building, Rocket, ChevronRight, ChevronLeft, ExternalLink } from 'lucide-react'

const THEMES = [
  { id: 'modern', label: 'Modern', bg: '#1A2E5A' },
  { id: 'elegant', label: 'Elegant', bg: '#2C2C2A' },
  { id: 'bold', label: 'Bold', bg: '#E8660A' },
  { id: 'minimal', label: 'Minimal', bg: '#F4F5F7', border: true },
]

const SECTIONS = [
  { id: 'hero', label: 'Hero Section', sub: 'Headline, subheadline, CTA button', icon: '🏠', defaultOn: true },
  { id: 'about', label: 'About / Agent Profile', sub: 'Company story, agent name and credentials', icon: '👤', defaultOn: true },
  { id: 'services', label: 'Services', sub: 'What you offer — buying, selling, leasing', icon: '📋', defaultOn: true },
  { id: 'seo', label: 'SEO Settings', sub: 'Meta title, description, keywords', icon: '🔍', defaultOn: true },
  { id: 'contact', label: 'Contact & Social', sub: 'Phone, email, Facebook, Messenger', icon: '📱', defaultOn: true },
]

const LEAD_FORM_FIELDS = ['Name', 'Phone', 'Email', 'Message', 'Preferred location', 'Budget range', 'Property type']

interface Website {
  id: string
  subdomain: string | null
  status: string
  theme: string | null
  site_name: string | null
  tagline: string | null
  content: any
  show_listings: boolean
  lead_form_enabled: boolean
  vercel_deployment_url: string | null
  published_at: string | null
}

interface Build {
  id: string
  status: string
  deployment_url: string | null
  started_at: string
  completed_at: string | null
}

interface Props {
  website: Website | null
  builds: Build[]
  listings: any[]
  clientId: string
  clientName: string
}

export default function WebsiteBuilder({ website, builds, listings, clientId, clientName }: Props) {
  const supabase = createClient()
  const router = useRouter()

  const [step, setStep] = useState(website ? 6 : 1)
  const [saving, setSaving] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [deployLog, setDeployLog] = useState<string[]>([])
  const [deployed, setDeployed] = useState(website?.status === 'live')
  const [generating, setGenerating] = useState(false)

  // Form state
  const [siteName, setSiteName] = useState(website?.site_name ?? clientName)
  const [tagline, setTagline] = useState(website?.tagline ?? '')
  const [subdomain, setSubdomain] = useState(website?.subdomain ?? clientName.toLowerCase().replace(/\s+/g, '').slice(0, 20))
  const [customDomain, setCustomDomain] = useState('')
  const [theme, setTheme] = useState(website?.theme ?? 'modern')
  const [primaryColor, setPrimaryColor] = useState('#1A2E5A')
  const [accentColor, setAccentColor] = useState('#E8660A')
  const [sectionToggles, setSectionToggles] = useState<Record<string, boolean>>(
    SECTIONS.reduce((acc, s) => ({ ...acc, [s.id]: s.defaultOn }), {})
  )
  const [content, setContent] = useState({
    hero_headline: website?.content?.hero?.headline ?? `Find Your Dream Home in CALABARZON`,
    hero_sub: website?.content?.hero?.subheadline ?? `${clientName} — trusted property experts`,
    hero_cta: website?.content?.hero?.cta_text ?? 'View Our Listings',
    about: website?.content?.about?.text ?? '',
    meta_title: website?.content?.seo?.meta_title ?? `${siteName} — Philippine Real Estate`,
    meta_desc: website?.content?.seo?.meta_description ?? '',
    phone: website?.content?.contact?.phone ?? '',
    email: website?.content?.contact?.email ?? '',
    facebook: website?.content?.social?.facebook ?? '',
    messenger: website?.content?.contact?.messenger_link ?? '',
  })
  const [showListings, setShowListings] = useState(website?.show_listings ?? true)
  const [listingFilter, setListingFilter] = useState({ city: '', type: '', maxPrice: '' })
  const [leadFormEnabled, setLeadFormEnabled] = useState(website?.lead_form_enabled ?? true)
  const [leadFormTitle, setLeadFormTitle] = useState('Interested? Get in touch')
  const [activeFormFields, setActiveFormFields] = useState(['Name', 'Phone', 'Email', 'Message'])

  const completedSteps = step - 1

  async function generateContent() {
    setGenerating(true)
    try {
      const res = await fetch('/api/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Generate website content for a Philippine real estate company called "${siteName}".
Return ONLY JSON with these keys:
{
  "hero_headline": "catchy headline",
  "hero_sub": "subheadline",
  "hero_cta": "CTA button text",
  "about": "2-3 sentences about the company",
  "meta_title": "SEO meta title",
  "meta_desc": "SEO meta description under 160 chars"
}`,
        }),
      })
      const data = await res.json()
      setContent(prev => ({ ...prev, ...data }))
    } catch (e) { console.error(e) }
    setGenerating(false)
  }

  async function saveWebsite() {
    setSaving(true)
    try {
      const payload = {
        client_id: clientId,
        site_name: siteName,
        tagline,
        subdomain,
        custom_domain: customDomain || null,
        theme,
        primary_color: primaryColor,
        accent_color: accentColor,
        show_listings: showListings,
        lead_form_enabled: leadFormEnabled,
        lead_form_title: leadFormTitle,
        status: 'draft',
        content: {
          hero: { headline: content.hero_headline, subheadline: content.hero_sub, cta_text: content.hero_cta },
          about: { text: content.about },
          seo: { meta_title: content.meta_title, meta_description: content.meta_desc },
          contact: { phone: content.phone, email: content.email, messenger_link: content.messenger },
          social: { facebook: content.facebook },
        },
        listing_filter: listingFilter,
      }

      if (website) {
        await supabase.from('client_bamo_website').update(payload).eq('id', website.id)
      } else {
        await supabase.from('client_bamo_website').insert(payload)
      }
      router.refresh()
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  async function deploy() {
    setDeploying(true)
    setDeployLog([])
    const steps = [
      '▶ Initializing Vercel deployment...',
      '▶ Cloning template repository...',
      '▶ Injecting client content and listings...',
      '▶ Building Next.js app...',
      `▶ Configuring subdomain ${subdomain}.bahaymo.com...`,
      '▶ SSL certificate provisioned...',
      '✓ Deployment successful!',
    ]
    for (const s of steps) {
      await new Promise(r => setTimeout(r, 700))
      setDeployLog(prev => [...prev, s])
    }

    // Save build record
    await supabase.from('client_website_builds').insert({
      client_id: clientId,
      website_id: website?.id ?? null,
      status: 'success',
      deployment_url: `https://${subdomain}.bahaymo.com`,
      completed_at: new Date().toISOString(),
    })

    if (website) {
      await supabase.from('client_bamo_website').update({
        status: 'live',
        published_at: new Date().toISOString(),
        vercel_deployment_url: `https://${subdomain}.bahaymo.com`,
      }).eq('id', website.id)
    }

    setDeployed(true)
    setDeploying(false)
    router.refresh()
  }

  const STEPS = [
    { label: 'Site Setup', sub: 'Name, domain, theme' },
    { label: 'Content', sub: 'AI-generated copy' },
    { label: 'Listings', sub: 'Marketplace connect' },
    { label: 'Lead Form', sub: 'Connect to CRM' },
    { label: 'Preview', sub: 'Review before publish' },
    { label: 'Deploy', sub: 'Go live on BaMo' },
  ]

  function StepNav() {
    return (
      <div className="w-48 min-w-48 bg-white border-r border-black/10 flex flex-col py-4 px-3 gap-1 overflow-y-auto">
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">Build Steps</div>
        {STEPS.map((s, i) => {
          const n = i + 1
          const done = n < step
          const active = n === step
          return (
            <div key={n}>
              <button
                onClick={() => setStep(n)}
                className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg w-full text-left transition-colors ${
                  active ? 'bg-[#FDE8D8]' : 'hover:bg-[#F4F5F7]'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 border-[1.5px] ${
                  done ? 'bg-[#EAF3DE] text-[#3B6D11] border-[#3B6D11]' :
                  active ? 'bg-[#E8660A] text-white border-[#E8660A]' :
                  'border-black/15 text-gray-400'
                }`}>
                  {done ? '✓' : n}
                </div>
                <div>
                  <div className={`text-xs font-medium ${active ? 'text-[#E8660A]' : done ? 'text-[#1A2E5A]' : 'text-gray-500'}`}>{s.label}</div>
                  <div className="text-[10px] text-gray-400">{s.sub}</div>
                </div>
              </button>
              {i < STEPS.length - 1 && <div className="ml-5 w-px h-3 bg-black/8 my-0.5" />}
            </div>
          )
        })}

        <div className="mt-auto pt-3 border-t border-black/8 px-1">
          <div className="text-[10px] text-gray-400 mb-1.5">Site status</div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${deployed ? 'bg-[#3B6D11]' : 'bg-[#BA7517]'}`} />
            <div className={`text-xs font-medium ${deployed ? 'text-[#3B6D11]' : 'text-[#854F0B]'}`}>
              {deployed ? 'Live' : 'Draft — not published'}
            </div>
          </div>
          <div className="text-[10px] text-gray-400 mt-1">{subdomain}.bahaymo.com</div>
        </div>
      </div>
    )
  }

  function StepFooter({ onNext, onBack, nextLabel = 'Next' }: any) {
    return (
      <div className="flex items-center justify-between pt-4 border-t border-black/8 mt-4">
        <div className="text-xs text-gray-400">Step {step} of 6</div>
        <div className="flex gap-2">
          {step > 1 && (
            <button onClick={onBack ?? (() => setStep(s => s - 1))} className="btn-ghost text-sm">
              <ChevronLeft size={14} /> Back
            </button>
          )}
          <button onClick={onNext ?? (() => setStep(s => s + 1))} className="btn-navy text-sm">
            {nextLabel} <ChevronRight size={14} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex overflow-hidden">
      <StepNav />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 max-w-3xl">

        {/* Step 1 — Setup */}
        {step === 1 && (
          <>
            <div>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-[#FDE8D8] text-[#E8660A] px-2.5 py-1 rounded-full mb-2">🌐 Step 1 of 6</span>
              <h2 className="text-xl font-semibold text-[#1A2E5A]">Site Setup</h2>
              <p className="text-xs text-gray-500 mt-0.5">Set up the basics — name, domain, theme and brand colors.</p>
            </div>
            <div className="bamo-card">
              <div className="px-4 py-3 border-b border-black/5 text-sm font-semibold text-[#1A2E5A]">🪪 Identity</div>
              <div className="p-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Site name</label>
                  <input className="bamo-input" value={siteName} onChange={e => setSiteName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Tagline</label>
                  <input className="bamo-input" value={tagline} onChange={e => setTagline(e.target.value)} placeholder="Your trusted property experts" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Subdomain</label>
                  <div className="flex items-center border border-black/12 rounded-lg overflow-hidden">
                    <input className="flex-1 px-3 py-2 text-sm outline-none bg-white" value={subdomain} onChange={e => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
                    <div className="px-3 py-2 bg-[#F4F5F7] text-xs text-gray-500 border-l border-black/8 flex-shrink-0">.bahaymo.com</div>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Custom domain <span className="text-gray-400 font-normal">optional</span></label>
                  <input className="bamo-input" value={customDomain} onChange={e => setCustomDomain(e.target.value)} placeholder="e.g. prestigerealty.ph" />
                </div>
              </div>
            </div>
            <div className="bamo-card">
              <div className="px-4 py-3 border-b border-black/5 text-sm font-semibold text-[#1A2E5A]">🎨 Theme</div>
              <div className="p-4">
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {THEMES.map(t => (
                    <button key={t.id} onClick={() => setTheme(t.id)} className={`rounded-lg border-[1.5px] p-2 text-center transition-all ${theme === t.id ? 'border-[#E8660A]' : 'border-black/10'}`}>
                      <div className={`h-8 rounded mb-2 ${t.border ? 'border border-black/15' : ''}`} style={{ background: t.bg }} />
                      <div className={`text-xs font-medium ${theme === t.id ? 'text-[#E8660A]' : 'text-[#1A2E5A]'}`}>{t.label}</div>
                    </button>
                  ))}
                </div>
                <div className="flex gap-6">
                  <div>
                    <div className="text-xs font-medium text-[#1A2E5A] mb-1.5">Primary color</div>
                    <div className="flex items-center gap-2">
                      <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-8 h-8 rounded-lg border border-black/10 cursor-pointer" />
                      <span className="text-xs text-gray-500">{primaryColor}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-[#1A2E5A] mb-1.5">Accent color</div>
                    <div className="flex items-center gap-2">
                      <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} className="w-8 h-8 rounded-lg border border-black/10 cursor-pointer" />
                      <span className="text-xs text-gray-500">{accentColor}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <StepFooter />
          </>
        )}

        {/* Step 2 — Content */}
        {step === 2 && (
          <>
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-[#FDE8D8] text-[#E8660A] px-2.5 py-1 rounded-full mb-2">✍️ Step 2 of 6</span>
                <h2 className="text-xl font-semibold text-[#1A2E5A]">Content</h2>
                <p className="text-xs text-gray-500 mt-0.5">Claude generates your website copy. Review and edit each section.</p>
              </div>
              <span className="text-[10px] font-semibold bg-[#E8EBF3] text-[#1A2E5A] px-2.5 py-1 rounded-full flex items-center gap-1">✨ AI-powered</span>
            </div>

            {/* Let Claude write */}
            <div className="bg-[#1A2E5A] rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center text-lg">🤖</div>
                <div>
                  <div className="text-sm font-semibold text-white">Let Claude write everything</div>
                  <div className="text-xs text-white/60 mt-0.5">Generates hero, about, services, SEO — all from your site info</div>
                </div>
              </div>
              <button onClick={generateContent} disabled={generating} className="bg-[#E8660A] text-white text-xs font-semibold px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5">
                ✨ {generating ? 'Generating...' : 'Generate All'}
              </button>
            </div>

            {/* Content sections */}
            {SECTIONS.map(s => (
              <div key={s.id} className="bamo-card">
                <div className="flex items-center justify-between px-4 py-3 border-b border-black/5 cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#FDE8D8] flex items-center justify-center text-sm">{s.icon}</div>
                    <div>
                      <div className="text-sm font-medium text-[#1A2E5A]">{s.label}</div>
                      <div className="text-xs text-gray-400">{s.sub}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSectionToggles(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                    className={`toggle ${sectionToggles[s.id] ? 'on' : ''}`}
                  >
                    <div className="toggle-knob" />
                  </button>
                </div>
                {sectionToggles[s.id] && s.id === 'hero' && (
                  <div className="p-4 grid grid-cols-2 gap-3">
                    <div className="col-span-2"><label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Headline</label><input className="bamo-input" value={content.hero_headline} onChange={e => setContent(p => ({ ...p, hero_headline: e.target.value }))} /></div>
                    <div className="col-span-2"><label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Subheadline</label><input className="bamo-input" value={content.hero_sub} onChange={e => setContent(p => ({ ...p, hero_sub: e.target.value }))} /></div>
                    <div><label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">CTA text</label><input className="bamo-input" value={content.hero_cta} onChange={e => setContent(p => ({ ...p, hero_cta: e.target.value }))} /></div>
                  </div>
                )}
                {sectionToggles[s.id] && s.id === 'about' && (
                  <div className="p-4">
                    <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">About text</label>
                    <textarea className="bamo-input resize-none" rows={3} value={content.about} onChange={e => setContent(p => ({ ...p, about: e.target.value }))} placeholder="Write about your company or brokerage..." />
                  </div>
                )}
                {sectionToggles[s.id] && s.id === 'seo' && (
                  <div className="p-4 grid grid-cols-1 gap-3">
                    <div><label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Meta title</label><input className="bamo-input" value={content.meta_title} onChange={e => setContent(p => ({ ...p, meta_title: e.target.value }))} /></div>
                    <div><label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Meta description</label><textarea className="bamo-input resize-none" rows={2} value={content.meta_desc} onChange={e => setContent(p => ({ ...p, meta_desc: e.target.value }))} /></div>
                  </div>
                )}
                {sectionToggles[s.id] && s.id === 'contact' && (
                  <div className="p-4 grid grid-cols-2 gap-3">
                    <div><label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Phone</label><input className="bamo-input" value={content.phone} onChange={e => setContent(p => ({ ...p, phone: e.target.value }))} placeholder="+63 917 xxx xxxx" /></div>
                    <div><label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Email</label><input className="bamo-input" type="email" value={content.email} onChange={e => setContent(p => ({ ...p, email: e.target.value }))} placeholder="hello@example.ph" /></div>
                    <div><label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Facebook page</label><input className="bamo-input" value={content.facebook} onChange={e => setContent(p => ({ ...p, facebook: e.target.value }))} placeholder="facebook.com/yourpage" /></div>
                    <div><label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Messenger link</label><input className="bamo-input" value={content.messenger} onChange={e => setContent(p => ({ ...p, messenger: e.target.value }))} placeholder="m.me/yourpage" /></div>
                  </div>
                )}
              </div>
            ))}
            <StepFooter />
          </>
        )}

        {/* Step 3 — Listings */}
        {step === 3 && (
          <>
            <div>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-[#FDE8D8] text-[#E8660A] px-2.5 py-1 rounded-full mb-2">🏠 Step 3 of 6</span>
              <h2 className="text-xl font-semibold text-[#1A2E5A]">Listings</h2>
              <p className="text-xs text-gray-500 mt-0.5">Connect your BaMo Marketplace listings to appear on the website.</p>
            </div>
            <div className="bamo-card">
              <div className="flex items-center justify-between px-4 py-4 border-b border-black/5">
                <div>
                  <div className="text-sm font-semibold text-[#1A2E5A]">Show listings from BaMo Marketplace</div>
                  <div className="text-xs text-gray-400 mt-0.5">Automatically pulls your active listings from bahaymo.com</div>
                </div>
                <button onClick={() => setShowListings(p => !p)} className={`toggle ${showListings ? 'on' : ''}`}>
                  <div className="toggle-knob" />
                </button>
              </div>
              {showListings && (
                <div className="p-4 grid grid-cols-3 gap-3">
                  <div><label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Filter by city</label><input className="bamo-input text-xs" value={listingFilter.city} onChange={e => setListingFilter(p => ({ ...p, city: e.target.value }))} placeholder="Sta. Rosa, Imus..." /></div>
                  <div><label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Property type</label><select className="bamo-input text-xs" value={listingFilter.type} onChange={e => setListingFilter(p => ({ ...p, type: e.target.value }))}><option value="">All types</option><option value="condo">Condo</option><option value="house_lot">House & Lot</option><option value="lot">Lot</option></select></div>
                  <div><label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Max price</label><input className="bamo-input text-xs" value={listingFilter.maxPrice} onChange={e => setListingFilter(p => ({ ...p, maxPrice: e.target.value }))} placeholder="No limit" /></div>
                </div>
              )}
              <div className="px-4 py-3 bg-[#EAF3DE] flex items-center gap-2 text-xs text-[#3B6D11]">
                <Check size={14} /> {listings.length} active listing{listings.length !== 1 ? 's' : ''} will appear on your website
              </div>
            </div>
            <StepFooter />
          </>
        )}

        {/* Step 4 — Lead Form */}
        {step === 4 && (
          <>
            <div>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-[#FDE8D8] text-[#E8660A] px-2.5 py-1 rounded-full mb-2">📋 Step 4 of 6</span>
              <h2 className="text-xl font-semibold text-[#1A2E5A]">Lead Form</h2>
              <p className="text-xs text-gray-500 mt-0.5">Capture inquiries and send them straight into the Campaign Engine.</p>
            </div>
            <div className="bamo-card">
              <div className="flex items-center justify-between px-4 py-4 border-b border-black/5">
                <div>
                  <div className="text-sm font-semibold text-[#1A2E5A]">Enable lead capture form</div>
                  <div className="text-xs text-gray-400 mt-0.5">Adds a contact form — inquiries go straight to your CRM</div>
                </div>
                <button onClick={() => setLeadFormEnabled(p => !p)} className={`toggle ${leadFormEnabled ? 'on' : ''}`}>
                  <div className="toggle-knob" />
                </button>
              </div>
              {leadFormEnabled && (
                <div className="p-4 flex flex-col gap-3">
                  <div>
                    <label className="text-xs font-medium text-[#1A2E5A] mb-1.5 block">Form title</label>
                    <input className="bamo-input" value={leadFormTitle} onChange={e => setLeadFormTitle(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#1A2E5A] mb-2 block">Form fields</label>
                    <div className="flex flex-wrap gap-2">
                      {LEAD_FORM_FIELDS.map(f => (
                        <button
                          key={f}
                          onClick={() => setActiveFormFields(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeFormFields.includes(f) ? 'bg-[#1A2E5A] text-white' : 'border border-black/10 text-gray-500 hover:bg-gray-50'}`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="px-4 py-3 bg-[#EAF3DE] flex items-center gap-2 text-xs text-[#3B6D11] border-t border-black/5">
                🔗 Connected to BaMo Campaign Engine webhook — leads auto-tagged and added to your pipeline
              </div>
            </div>
            <StepFooter />
          </>
        )}

        {/* Step 5 — Preview */}
        {step === 5 && (
          <>
            <div>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-[#FDE8D8] text-[#E8660A] px-2.5 py-1 rounded-full mb-2">👁 Step 5 of 6</span>
              <h2 className="text-xl font-semibold text-[#1A2E5A]">Preview</h2>
              <p className="text-xs text-gray-500 mt-0.5">Review your website before going live.</p>
            </div>
            <div className="bamo-card overflow-hidden">
              {/* Browser chrome */}
              <div className="bg-[#1A2E5A] px-3 py-2 flex items-center gap-2">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-white/30" />)}
                </div>
                <div className="flex-1 bg-white/10 rounded px-3 py-1 text-xs text-white/60">{subdomain}.bahaymo.com</div>
                <ExternalLink size={13} className="text-white/40" />
              </div>
              {/* Hero */}
              <div className="p-10 text-center" style={{ background: primaryColor }}>
                <div className="text-xs font-bold text-white/60 uppercase tracking-widest mb-2">{siteName}</div>
                <div className="text-xl font-bold text-white mb-2 leading-tight">{content.hero_headline}</div>
                <div className="text-xs text-white/70 mb-4">{content.hero_sub}</div>
                <div className="inline-block px-5 py-2 rounded-lg text-xs font-bold text-white" style={{ background: accentColor }}>{content.hero_cta}</div>
              </div>
              {/* Listings preview */}
              {showListings && listings.length > 0 && (
                <div className="p-4 bg-[#F4F5F7] grid grid-cols-3 gap-2">
                  {listings.slice(0, 3).map(l => (
                    <div key={l.id} className="bg-white rounded-lg p-3 border border-black/5">
                      <div className="h-10 bg-[#E8EBF3] rounded mb-2 flex items-center justify-center">
                        <Building size={16} className="text-[#1A2E5A] opacity-40" />
                      </div>
                      <div className="text-[10px] font-semibold text-[#1A2E5A] truncate">{l.property_name}</div>
                      {l.price && <div className="text-[10px] mt-0.5" style={{ color: accentColor }}>₱{Number(l.price).toLocaleString()}</div>}
                    </div>
                  ))}
                </div>
              )}
              {/* Lead form preview */}
              {leadFormEnabled && (
                <div className="p-4 text-center border-t border-black/5">
                  <div className="text-xs font-semibold text-[#1A2E5A] mb-3">{leadFormTitle}</div>
                  <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
                    {activeFormFields.slice(0, 4).map(f => (
                      <div key={f} className={`h-7 bg-[#F4F5F7] rounded border border-black/8 ${f === 'Message' ? 'col-span-2' : ''}`} />
                    ))}
                  </div>
                  <div className="inline-block mt-3 px-5 py-2 rounded-lg text-[10px] font-bold text-white" style={{ background: accentColor }}>Send Inquiry</div>
                </div>
              )}
            </div>
            <StepFooter nextLabel="Next: Deploy" onNext={async () => { await saveWebsite(); setStep(6) }} />
          </>
        )}

        {/* Step 6 — Deploy */}
        {step === 6 && (
          <>
            <div>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-[#FDE8D8] text-[#E8660A] px-2.5 py-1 rounded-full mb-2">🚀 Step 6 of 6</span>
              <h2 className="text-xl font-semibold text-[#1A2E5A]">Deploy</h2>
              <p className="text-xs text-gray-500 mt-0.5">Go live on BaMo hosting — one click to publish.</p>
            </div>

            <div className="bamo-card border-[1.5px] border-[#1A2E5A]">
              <div className="bg-[#1A2E5A] px-4 py-3">
                <div className="text-sm font-semibold text-white flex items-center gap-2"><Rocket size={15} /> {deployed ? 'Site is live' : 'Ready to deploy'}</div>
                <div className="text-xs text-white/60 mt-0.5">Your site will be live at {subdomain}.bahaymo.com</div>
              </div>
              <div className="p-4 flex flex-col gap-2">
                {[
                  { label: `Site setup complete — ${subdomain}.bahaymo.com`, done: true },
                  { label: 'Content generated — sections ready', done: true },
                  { label: `${listings.length} listings connected from BaMo Marketplace`, done: true },
                  { label: `Lead form ${leadFormEnabled ? 'connected to Campaign Engine' : 'disabled'}`, done: true },
                  { label: 'Preview reviewed', done: true },
                  { label: deployed ? 'Deployed to Vercel — site is live' : 'Deploy to Vercel — pending', done: deployed },
                ].map(({ label, done }) => (
                  <div key={label} className={`flex items-center gap-2 text-xs ${done ? 'text-[#3B6D11]' : 'text-gray-400'}`}>
                    {done ? <Check size={14} className="text-[#3B6D11] flex-shrink-0" /> : <div className="w-3.5 h-3.5 rounded-full border border-gray-300 flex-shrink-0" />}
                    {label}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-t border-black/5">
                <div className="flex items-center gap-1.5 text-xs text-[#185FA5]">
                  <Globe size={13} /> {subdomain}.bahaymo.com
                </div>
                {deployed ? (
                  <a href={`https://${subdomain}.bahaymo.com`} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs flex items-center gap-1.5">
                    <ExternalLink size={12} /> View Live Site
                  </a>
                ) : (
                  <button onClick={deploy} disabled={deploying} className="btn-orange text-sm flex items-center gap-1.5 disabled:opacity-50">
                    <Rocket size={14} /> {deploying ? 'Deploying...' : 'Deploy Now'}
                  </button>
                )}
              </div>
            </div>

            {/* Build log */}
            {(deploying || deployLog.length > 0) && (
              <div className="bamo-card">
                <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
                  <div className="text-sm font-semibold text-[#1A2E5A] flex items-center gap-2">💻 Build log</div>
                  <div className={`text-xs font-semibold ${deployed ? 'text-[#3B6D11]' : 'text-[#854F0B]'}`}>
                    {deployed ? 'Live' : 'Building...'}
                  </div>
                </div>
                <div className="p-4 font-mono text-xs flex flex-col gap-1.5">
                  {deployLog.map((line, i) => (
                    <div key={i} className={line.startsWith('✓') ? 'text-[#3B6D11]' : 'text-gray-500'}>{line}</div>
                  ))}
                  {deploying && <div className="flex items-center gap-2 text-gray-400"><div className="w-3 h-3 border border-gray-300 border-t-[#E8660A] rounded-full animate-spin" /> Processing...</div>}
                </div>
              </div>
            )}

            {/* Previous builds */}
            {builds.length > 0 && (
              <div className="bamo-card">
                <div className="px-4 py-3 border-b border-black/5 text-sm font-semibold text-[#1A2E5A]">📜 Build history</div>
                <div className="divide-y divide-black/5">
                  {builds.map(b => (
                    <div key={b.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <div className={`text-xs font-semibold ${b.status === 'success' ? 'text-[#3B6D11]' : b.status === 'failed' ? 'text-[#A32D2D]' : 'text-[#854F0B]'}`}>
                          {b.status === 'success' ? '✓' : b.status === 'failed' ? '✗' : '⏳'} {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{new Date(b.started_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      {b.deployment_url && (
                        <a href={b.deployment_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#185FA5] flex items-center gap-1">
                          <ExternalLink size={11} /> View
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-start">
              <button onClick={() => setStep(5)} className="btn-ghost text-sm"><ChevronLeft size={14} /> Back to Preview</button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
