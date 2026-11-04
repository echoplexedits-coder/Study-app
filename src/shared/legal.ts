// One source of truth for policy identity and the options the UI offers.
// Bump POLICY_VERSION and POLICY_EFFECTIVE whenever the text changes in a way
// that needs fresh consent; old acceptances stay in the database as history.

export const POLICY_VERSION = '1.0'
export const POLICY_EFFECTIVE = '4 November 2026'

export const LEGAL_PAGES = [
  { to: '/terms', label: 'Terms of Use' },
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/acceptable-use', label: 'Acceptable Use' },
  { to: '/copyright', label: 'Copyright' },
  { to: '/contact', label: 'Contact' },
] as const

/** Shown on every policy page, the consent screen and the sign-in page. */
export const DISCLAIMER =
  'myclassroom is an independent study tool, built and operated by an individual developer. It is not affiliated with, endorsed by, sponsored by or operated by any school, college, university, coaching centre, education board or government body. Decks and classwork are uploaded by the person who runs this site or by its signed-in users and do not represent any institution.'

export const REPORT_REASONS = [
  { value: 'harassment', label: 'Harassment, threats or bullying' },
  { value: 'hate', label: 'Hate speech or discrimination' },
  { value: 'sexual', label: 'Sexual or adult content' },
  { value: 'child_safety', label: 'Child safety concern' },
  { value: 'illegal', label: 'Illegal content or activity' },
  { value: 'copyright', label: 'Copyright or other intellectual property' },
  { value: 'privacy', label: 'Personal information or privacy' },
  { value: 'impersonation', label: 'Impersonation or a fake account' },
  { value: 'spam', label: 'Spam or misleading content' },
  { value: 'other', label: 'Something else' },
] as const

export const CONTACT_TOPICS = [
  { value: 'privacy', label: 'Privacy or my data' },
  { value: 'copyright', label: 'Copyright or takedown' },
  { value: 'abuse', label: 'Abuse or safety' },
  { value: 'account', label: 'Account or deletion' },
  { value: 'support', label: 'Using the app' },
  { value: 'other', label: 'Something else' },
] as const

export const TARGET_TYPES = [
  { value: 'deck', label: 'A deck in the library' },
  { value: 'card', label: 'A single card' },
  { value: 'classwork', label: 'An uploaded classwork file' },
  { value: 'other', label: 'Something else (describe it below)' },
] as const

export type ReportReason = (typeof REPORT_REASONS)[number]['value']
export type ContactTopic = (typeof CONTACT_TOPICS)[number]['value']
export type ReportTarget = (typeof TARGET_TYPES)[number]['value']
