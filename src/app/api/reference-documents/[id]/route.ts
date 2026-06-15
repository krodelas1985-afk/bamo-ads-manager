import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, client_id')
    .eq('id', user.id)
    .single()
  if (!profile || (profile.role !== 'baymo_admin' && profile.role !== 'client_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: doc, error: fetchErr } = await supabase
    .from('client_reference_documents')
    .select('id, client_id, storage_path')
    .eq('id', params.id)
    .single()
  if (fetchErr || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }
  // RLS already filters by ownership for client_admin; double-check defensively.
  if (profile.role === 'client_admin' && doc.client_id !== profile.client_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { error: storageErr } = await admin.storage
    .from('client-assets')
    .remove([doc.storage_path])
  if (storageErr) {
    return NextResponse.json({ error: `Storage delete failed: ${storageErr.message}` }, { status: 500 })
  }

  const { error: dbErr } = await admin
    .from('client_reference_documents')
    .delete()
    .eq('id', doc.id)
  if (dbErr) {
    return NextResponse.json({ error: `DB delete failed: ${dbErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
