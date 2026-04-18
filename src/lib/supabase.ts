import { createBrowserClient, createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export type SubscriptionTier = 'free' | 'pro' | 'business'

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          subscription_tier: SubscriptionTier
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          preferences: Record<string, unknown>
          daily_generations_used: number
          daily_generations_reset_at: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      generations: {
        Row: {
          id: string
          user_id: string
          feature: string
          platform: string | null
          input_data: Record<string, unknown> | null
          output_data: Record<string, unknown> | null
          tokens_used: number
          is_saved: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['generations']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['generations']['Insert']>
      }
      saved_content: {
        Row: {
          id: string
          user_id: string
          generation_id: string | null
          label: string | null
          folder: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['saved_content']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['saved_content']['Insert']>
      }
      usage_stats: {
        Row: {
          id: string
          user_id: string
          date: string
          feature: string
          count: number
        }
        Insert: Omit<Database['public']['Tables']['usage_stats']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['usage_stats']['Insert']>
      }
    }
  }
}

export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export function createServerSupabaseClient() {
  const cookieStore = cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try { cookieStore.set({ name, value, ...options }) } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }) } catch {}
        },
      },
    }
  )
}

export function createServiceSupabaseClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
