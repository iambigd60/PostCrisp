/**
 * Google sign-in only works once the Google provider is enabled in Supabase
 * Auth (Authentication → Sign In / Providers). Until then the button leads to
 * Supabase's raw "provider is not enabled" error, so the login and signup
 * pages hide it unless NEXT_PUBLIC_GOOGLE_AUTH_ENABLED is "true". Inlined at
 * build time: changing it needs a redeploy.
 */
export const GOOGLE_AUTH_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true'
