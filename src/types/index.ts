export type UserRole = 'baymo_admin' | 'client_admin'

export type AdPlan = 'starter' | 'growth' | 'pro'

export type Platform = 'facebook' | 'instagram' | 'linkedin'

export type CreativeType = 'image' | 'video' | 'carousel'

export type CreativeSource = 'canva' | 'fal_ai' | 'creatomate' | 'upload'

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'failed'

export type PostStatus = 'scheduled' | 'published' | 'failed'

export type ContentStatus = 'draft' | 'approved' | 'archived'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  client_id: string | null
  created_at: string
}

export interface Client {
  id: string
  name: string
  email: string
  ads_enabled: boolean
  ads_plan: AdPlan
  ads_plan_started_at: string | null
  created_at: string
}

export interface AdSocialAccount {
  id: string
  client_id: string
  platform: Platform
  account_id: string
  account_name: string
  is_active: boolean
  token_expires_at: string | null
  created_at: string
}

export interface AdContent {
  id: string
  client_id: string
  title: string
  platform: Platform
  tone: string
  target_audience: string
  caption: string
  hook: string
  hashtags: string[]
  cta: string
  ai_generated: boolean
  listing_id: string | null
  status: ContentStatus
  created_by: string
  created_at: string
  updated_at: string
}

export interface AdCreative {
  id: string
  client_id: string
  content_id: string | null
  type: CreativeType
  source: CreativeSource
  asset_url: string
  thumbnail_url: string | null
  width: number | null
  height: number | null
  duration_seconds: number | null
  render_job_id: string | null
  status: 'pending' | 'ready' | 'failed'
  created_at: string
}

export interface AdCampaign {
  id: string
  client_id: string
  social_account_id: string | null
  content_id: string | null
  creative_id: string | null
  listing_id: string | null
  name: string
  objective: string
  budget_daily: number | null
  budget_total: number | null
  audience_config: Record<string, unknown>
  placement: string[]
  meta_campaign_id: string | null
  status: CampaignStatus
  starts_at: string | null
  ends_at: string | null
  launched_at: string | null
  created_at: string
  updated_at: string
}

export interface AdAnalytics {
  id: string
  campaign_id: string
  client_id: string
  date: string
  impressions: number
  reach: number
  clicks: number
  cpc: number | null
  cpm: number | null
  spend: number | null
  leads: number
  link_clicks: number
}

export interface AdListing {
  id: string
  client_id: string
  marketplace_listing_id: string
  property_name: string | null
  property_type: string | null
  description: string | null
  price: number | null
  location: string | null
  city: string | null
  bedrooms: number | null
  bathrooms: number | null
  floor_area: number | null
  lot_area: number | null
  primary_photo_url: string | null
  photo_urls: string[]
  listing_url: string | null
  agent_name: string | null
  agent_prc_number: string | null
  agent_email: string | null
  agent_phone: string | null
  snapshotted_at: string
}

export interface AdNotification {
  id: string
  client_id: string
  type: 'campaign_live' | 'lead_received' | 'post_published' | 'budget_low'
  title: string
  message: string | null
  is_read: boolean
  entity_type: string | null
  entity_id: string | null
  created_at: string
}
