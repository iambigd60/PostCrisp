import type { SupabaseClient } from '@supabase/supabase-js'

// Supported platforms — aligns with existing platform identifiers used
// across the app. Extend here when adding a new social platform.
export const CHANNEL_PLATFORMS = [
  'instagram',
  'tiktok',
  'youtube',
  'x',
  'linkedin',
  'threads',
  'facebook',
  'newsletter',
  'blog',
  'other',
] as const

export type ChannelPlatform = (typeof CHANNEL_PLATFORMS)[number]

export interface Channel {
  id: string
  user_id: string
  platform: ChannelPlatform
  handle: string
  label: string | null
  url: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

// Platform display metadata — icons + labels + brand colors for chips/cards.
// Not a lookup against external data — purely visual.
export const PLATFORM_META: Record<
  ChannelPlatform,
  { label: string; icon: string; chip: string }
> = {
  instagram:  { label: 'Instagram', icon: '📸', chip: 'bg-pink-500/10 text-pink-300 border-pink-500/20' },
  tiktok:     { label: 'TikTok',    icon: '🎵', chip: 'bg-zinc-700/40 text-zinc-200 border-zinc-500/20' },
  youtube:    { label: 'YouTube',   icon: '▶️', chip: 'bg-red-500/10 text-red-300 border-red-500/20' },
  x:          { label: 'X',         icon: '✖️', chip: 'bg-zinc-800/60 text-zinc-200 border-zinc-500/20' },
  linkedin:   { label: 'LinkedIn',  icon: '💼', chip: 'bg-sky-500/10 text-sky-300 border-sky-500/20' },
  threads:    { label: 'Threads',   icon: '🧵', chip: 'bg-zinc-800/60 text-zinc-200 border-zinc-500/20' },
  facebook:   { label: 'Facebook',  icon: '📘', chip: 'bg-blue-500/10 text-blue-300 border-blue-500/20' },
  newsletter: { label: 'Newsletter',icon: '📧', chip: 'bg-amber-500/10 text-amber-300 border-amber-500/20' },
  blog:       { label: 'Blog',      icon: '✍️', chip: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' },
  other:      { label: 'Other',     icon: '🔗', chip: 'bg-brand-500/10 text-brand-300 border-brand-500/20' },
}

export function isValidPlatform(p: string | null | undefined): p is ChannelPlatform {
  return typeof p === 'string' && (CHANNEL_PLATFORMS as readonly string[]).includes(p)
}

export async function loadChannels(
  supabase: SupabaseClient,
  userId: string
): Promise<Channel[]> {
  const { data, error } = await supabase
    .from('channels')
    .select('id, user_id, platform, handle, label, url, sort_order, created_at, updated_at')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error || !data) return []
  return data as Channel[]
}

// Convenience: given a platform, return the user's first (default) channel
// for that platform, or null if they have none. Useful when a tool wants
// to auto-pick a channel based on the platform dropdown they already have.
export async function defaultChannelForPlatform(
  supabase: SupabaseClient,
  userId: string,
  platform: string
): Promise<Channel | null> {
  if (!isValidPlatform(platform)) return null
  const channels = await loadChannels(supabase, userId)
  return channels.find((c) => c.platform === platform) ?? null
}
