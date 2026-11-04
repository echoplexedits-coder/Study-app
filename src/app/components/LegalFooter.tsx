import { Link } from 'react-router'

import { DISCLAIMER, LEGAL_PAGES, POLICY_VERSION } from '../../shared/legal'

/** Shared legal footer: the disclaimer plus every policy, on every surface. */
export function LegalFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer className="border-t border-line pb-24 sm:pb-0">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-4 px-5 py-8 sm:px-8">
        <nav aria-label="Legal and safety" className="flex flex-wrap gap-x-4 gap-y-1.5">
          {LEGAL_PAGES.map((page) => (
            <Link key={page.to} to={page.to} className="text-[12.5px] font-medium text-muted hover:text-fg">
              {page.label}
            </Link>
          ))}
          <span className="text-[12.5px] text-faint">Policies v{POLICY_VERSION}</span>
        </nav>
        {!compact && <p className="max-w-[760px] text-[12px] leading-relaxed text-faint">{DISCLAIMER}</p>}
      </div>
    </footer>
  )
}
