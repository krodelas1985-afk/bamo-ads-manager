import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getMarketplaceClient() {
  const url = process.env.MARKETPLACE_SUPABASE_URL
  const key = process.env.MARKETPLACE_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Marketplace Supabase env vars not configured')
  }

  return createClient(url, key)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') ?? ''
    const limit = parseInt(searchParams.get('limit') ?? '30')

    const supabase = getMarketplaceClient()

    let query = supabase
      .from('listings')
      .select(`
        id,
        title,
        price,
        property_type,
        city,
        location,
        bedrooms,
        bathrooms,
        floor_area,
        lot_area,
        description,
        images,
        status,
        agent_name,
        agent_prc,
        agent_email,
        agent_phone
      `)
      .eq('status', 'active')
      .limit(limit)

    if (search) {
      query = query.or(`title.ilike.%${search}%,city.ilike.%${search}%,location.ilike.%${search}%`)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error

    const normalized = (data ?? []).map((l: any) => ({
      marketplace_id: l.id,
      property_name: l.title ?? null,
      price: l.price ?? null,
      property_type: l.property_type ?? null,
      city: l.city ?? null,
      location: l.location ?? null,
      bedrooms: l.bedrooms ?? null,
      bathrooms: l.bathrooms ?? null,
      floor_area: l.floor_area ?? null,
      lot_area: l.lot_area ?? null,
      description: l.description ?? null,
      primary_photo_url: Array.isArray(l.images) ? l.images[0] ?? null : null,
      agent_name: l.agent_name ?? null,
      agent_prc_number: l.agent_prc ?? null,
      agent_email: l.agent_email ?? null,
      agent_phone: l.agent_phone ?? null,
      listing_url: `https://bahaymo.com/listing/${l.id}`,
    }))

    return NextResponse.json({ listings: normalized })
  } catch (error: any) {
    console.error('Marketplace fetch error:', error)
    return NextResponse.json(
      { error: error.message ?? 'Failed to fetch marketplace listings' },
      { status: 500 }
    )
  }
}
