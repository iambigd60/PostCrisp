import type { Metadata } from 'next'
import { requireAlphaAcceptance } from '@/lib/alpha-agreement-server'

export const metadata: Metadata = {
  title: 'Welcome | PostCrisp',
}

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  // New signups must accept the agreement before the onboarding wizard
  // even renders. After acceptance they come right back here via ?next=.
  await requireAlphaAcceptance('/onboarding')
  return (
    <div className="min-h-screen bg-surface-primary">
      {children}
    </div>
  )
}
