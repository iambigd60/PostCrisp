import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Alpha Tester Agreement | PostCrisp',
}

export default function AcceptTermsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-primary">
      {children}
    </div>
  )
}
