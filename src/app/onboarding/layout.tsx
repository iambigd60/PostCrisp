import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Welcome | PostCrisp',
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-primary">
      {children}
    </div>
  )
}
