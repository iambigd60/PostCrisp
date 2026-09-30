import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { AdminMfa } from './AdminMfa'

export const metadata = { title: 'Admin verification | PostCrisp' }

export default async function MfaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.role !== 'admin') redirect('/dashboard')

  return <AdminMfa />
}
