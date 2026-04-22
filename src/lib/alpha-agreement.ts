// ─── Alpha Tester Agreement — canonical source of truth ────────────────────
// When you update the text, bump ALPHA_AGREEMENT_VERSION so users are
// prompted to re-accept the new version. Old acceptances are preserved in
// the audit log but no longer satisfy the gate.

export const ALPHA_AGREEMENT_VERSION = '1.0'

export const ALPHA_AGREEMENT_EFFECTIVE_DATE = '2026-04-22'

export const ALPHA_AGREEMENT_TITLE = 'Alpha Tester Agreement'

// ─── Structured content ──────────────────────────────────────────────────
// Rendered as numbered sections on the acceptance page. Keeping this in
// code (rather than loading from the markdown file) keeps the legal text
// version-locked with the application code and avoids any runtime fetch
// risk at the acceptance gate.

export interface AgreementSection {
  heading: string
  paragraphs: string[]
  bullets?: string[]
}

export const ALPHA_AGREEMENT_SECTIONS: AgreementSection[] = [
  {
    heading: '1. The Product',
    paragraphs: [
      'You are receiving early access to PostCrisp, an AI content platform still in pre-release alpha (the "Product"). The Product — including all features, UI/UX designs, business logic, pricing strategies, roadmap, bugs, technical implementation, and internal communications related to it ("Confidential Information") — is confidential property of Crusher Brands, LLC ("Company").',
    ],
  },
  {
    heading: '2. Your Obligations',
    paragraphs: ['You agree to:'],
    bullets: [
      'Keep all Confidential Information strictly private. Do not share screenshots, descriptions, features, or any details publicly (social media, blog posts, podcasts, videos, group chats, etc.) without prior WRITTEN consent from Crusher Brands, LLC.',
      'Not use Confidential Information to build, launch, or assist any competing product or service.',
      'Not reverse-engineer, copy, or attempt to derive source code or algorithms from the Product.',
      'Report bugs, feedback, and observations privately to Company through the in-app feedback channel — never through public support forums, social media, or third parties.',
      'Maintain confidentiality for two (2) years from the date a given feature becomes public, or indefinitely for features that remain non-public.',
    ],
  },
  {
    heading: '3. Exceptions',
    paragraphs: [
      'Nothing in this Agreement prohibits you from disclosing information that is (a) already publicly available through no fault of yours, (b) independently developed without reference to the Product, or (c) required to be disclosed by law, provided Company is given prompt written notice so it may seek a protective order.',
    ],
  },
  {
    heading: '4. Feedback Ownership',
    paragraphs: [
      'Any feedback, ideas, suggestions, or bug reports you provide may be used by Company without restriction, attribution, or compensation. You retain no ownership interest in such feedback and assign any rights in it to Company.',
    ],
  },
  {
    heading: '5. No Warranty',
    paragraphs: [
      'The Product is provided "as is" and "as available." Company makes no guarantees about stability, data retention, feature availability, or continued access during the alpha period.',
    ],
  },
  {
    heading: '6. No Employment / Equity / Compensation',
    paragraphs: [
      'This Agreement does not create any employment, partnership, agency, or equity relationship between you and Company. You are a volunteer alpha tester and will not receive monetary compensation for participation.',
    ],
  },
  {
    heading: '7. Term and Termination',
    paragraphs: [
      'Either party may end your alpha access at any time, for any reason, with or without notice. Confidentiality obligations under Section 2 survive any termination of this Agreement per the term specified in Section 2 above.',
    ],
  },
  {
    heading: '8. Governing Law',
    paragraphs: [
      'This Agreement is governed by the laws of the State of Nevada, without regard to its conflict-of-laws rules. Any disputes arising under this Agreement will be resolved exclusively in the state or federal courts located in Nevada.',
    ],
  },
  {
    heading: '9. Entire Agreement',
    paragraphs: [
      'This Agreement is the entire agreement between the parties regarding its subject matter and supersedes all prior discussions or understandings.',
    ],
  },
]

// ─── Acceptance record shape stored under profiles.preferences.alpha_nda ──

export interface AlphaNdaAcceptance {
  accepted_at: string       // ISO timestamp
  full_name: string         // what the tester typed as their signature
  version: string           // matches ALPHA_AGREEMENT_VERSION at time of signing
  user_agent?: string | null
  ip_hash?: string | null   // optional; we don't capture this today but leaving room
}

// Returns true if the given acceptance record satisfies the current
// agreement version. Any prior-version acceptance is treated as expired.
export function hasCurrentAcceptance(acceptance: AlphaNdaAcceptance | null | undefined): boolean {
  if (!acceptance) return false
  if (!acceptance.accepted_at) return false
  if (acceptance.version !== ALPHA_AGREEMENT_VERSION) return false
  return true
}
