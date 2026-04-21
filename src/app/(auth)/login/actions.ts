'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { readAccessControl } from '@/lib/platform-settings'

export async function login(formData: FormData) {
  const supabase = createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) {
    return { error: error.message }
  }

  // ─── Login gate — block non-admin logins when disabled ────────────────
  // Admins always bypass so they can't accidentally lock themselves out.
  const access = await readAccessControl()
  if (!access.login_enabled) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle()

    if (profile?.role !== 'admin') {
      await supabase.auth.signOut()
      return { error: 'PostCrisp is temporarily paused for maintenance. Check back soon.' }
    }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
