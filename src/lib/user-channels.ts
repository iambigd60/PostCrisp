import type { createClient } from '@/utils/supabase/server'

type ServerClient = Awaited<ReturnType<typeof createClient>>

export interface UserChannels {
  instagram?: string
  tiktok?: string
  youtube?: string
  x?: string
  facebook?: string
  threads?: string
  linkedin?: string
  website?: string
}

/**
 * Load the user's saved channel URLs from profile.preferences.channels.
 * Returns an object with only the fields the user has actually filled in
 * (empty strings filtered out).
 */
export async function getUserChannels(supabase: ServerClient, userId: string): Promise<UserChannels> {
  const { data } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('id', userId)
    .maybeSingle()

  const raw = (data?.preferences as Record<string, unknown> | null | undefined)?.channels as Record<string, string> | undefined
  if (!raw) return {}

  const out: UserChannels = {}
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string' && value.trim() !== '') {
      out[key as keyof UserChannels] = value.trim()
    }
  }
  return out
}

/**
 * Format channels as a prompt-friendly block to inject into API prompts.
 * Returns empty string if the user has no channels saved.
 */
export function formatChannelsForPrompt(channels: UserChannels): string {
  const labels: Record<keyof UserChannels, string> = {
    instagram: 'Instagram',
    tiktok:    'TikTok',
    youtube:   'YouTube',
    x:         'X',
    facebook:  'Facebook',
    threads:   'Threads',
    linkedin:  'LinkedIn',
    website:   'Website',
  }
  const entries = Object.entries(channels).filter(([, v]) => !!v)
  if (entries.length === 0) return ''
  const lines = entries.map(([k, v]) => `- ${labels[k as keyof UserChannels]}: ${v}`)
  return `\nUser's actual channel URLs (use these verbatim — never use placeholder text like [Your Instagram Link]):\n${lines.join('\n')}\n`
}
