import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { CONTACT_EMAIL, CONTACT_TOPICS, DISCLAIMER, LEGAL_PAGES, POLICY_EFFECTIVE, POLICY_VERSION } from '../../shared/legal'
import { LegalFooter } from '../components/LegalFooter'
import { Logo } from '../components/Shell'
import { Input, Textarea } from '../components/ui'
import { sendContact } from '../lib/api'

type Section = { h: string; p?: string[]; list?: string[] }

function LegalShell({ title, intro, sections, children }: { title: string; intro?: string; sections?: Section[]; children?: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-5 sm:px-8">
          <Logo />
          <Link to="/" className="inline-flex h-9 items-center rounded-control px-3 text-[13.5px] font-medium text-muted hover:bg-surface-2 hover:text-fg">
            Back to the app
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[760px] flex-1 px-5 py-10 sm:px-8">
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-faint">
          <span className="font-medium uppercase tracking-[0.08em]">Policy</span>
          <span aria-hidden>·</span>
          <span>Version {POLICY_VERSION}</span>
          <span aria-hidden>·</span>
          <span>Effective {POLICY_EFFECTIVE}</span>
        </div>
        <h1 className="mt-2 text-[30px] font-bold leading-tight tracking-[-0.025em]">{title}</h1>
        {intro && <p className="mt-3 text-[15px] leading-relaxed text-muted">{intro}</p>}

        <nav aria-label="Policies" className="mt-6 flex flex-wrap gap-2 border-y border-line py-3">
          {LEGAL_PAGES.map((page) => (
            <Link key={page.to} to={page.to} className="rounded-[9px] bg-surface-2 px-2.5 py-1 text-[12.5px] font-medium text-muted hover:text-fg">
              {page.label}
            </Link>
          ))}
        </nav>

        {sections && <Doc sections={sections} />}
        {children}

        <p className="mt-10 rounded-card border border-line bg-surface-2 p-4 text-[12.5px] leading-relaxed text-muted">{DISCLAIMER}</p>
        <p className="mt-3 text-[12px] leading-relaxed text-faint">
          This page describes how the app actually works today. It is not legal advice, a certification, an audit or a claim of compliance with any law or standard.
          The operator is an individual developer and is not a school, company or government body.
        </p>
      </main>
      <LegalFooter />
    </div>
  )
}

function Doc({ sections }: { sections: Section[] }) {
  return (
    <div className="mt-8 flex flex-col gap-7">
      {sections.map((section) => (
        <section key={section.h}>
          <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{section.h}</h2>
          {section.p?.map((paragraph) => (
            <p key={paragraph} className="mt-2 text-[14px] leading-relaxed text-muted">
              {paragraph}
            </p>
          ))}
          {section.list && (
            <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-[14px] leading-relaxed text-muted marker:text-faint">
              {section.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}

const TERMS: Section[] = [
  {
    h: 'Agreement to these terms',
    p: [
      `These Terms of Use govern your use of myclassroom (the app). By signing in or using the app you agree to these terms, the Acceptable Use Policy and the Privacy Policy. If you do not agree, do not use the app.`,
      `The app is run by an individual developer. It is an independent study tool and is not affiliated with, endorsed by, sponsored by or operated by any school, college, university, coaching centre, board or government body.`,
    ],
  },
  {
    h: 'Accounts and eligibility',
    list: [
      `You can sign in with Freebuff, Google, or a username and password. Freebuff and Google provide a provider account id, name, email address and profile picture URL. A password account stores a PBKDF2 password hash, never the password itself.`,
      `Give accurate account information and keep access to your sign-in method secure. You are responsible for activity that happens under your account.`,
      `Use one account per person. Do not create accounts automatically or in bulk, and do not share an account with someone else.`,
      `If you are under 18, use the app only with the permission of a parent, guardian or teacher who agrees to these terms on your behalf.`,
      `Access is not guaranteed. The operator may refuse or end access as described below.`,
    ],
  },
  {
    h: 'Roles: admin and student',
    p: [
      `The site admin can add, change and remove decks, cards, attachments and classwork, and can see reports, audit records and backups. Students can read the class library and record their own study progress. An admin account is a technical role in this app, not a teacher qualification or an institutional appointment.`,
      `Only the site admin can upload or edit class material. Student accounts are read-only: they can search, preview and download the class library and record their own study progress. Class material is uploaded only where the admin has the right to share it. It is not checked, approved or endorsed by any school or board.`,
    ],
  },
  {
    h: 'Your content and the permission you give us',
    p: [
      `Only the site admin can create the class library: decks, cards, attachments and classwork. Students can read that material and record their own study progress; they do not upload or edit class material.`,
      `The site admin keeps ownership of the material they upload. To run the app, the admin grants the service a non-exclusive, worldwide, royalty-free permission to store, copy, display, back up and moderate that material, only for operating and protecting the app. That permission ends when the material is deleted, except for copies retained in a backup or a moderation record.`,
      `The site admin uploads only material they created, material they have permission or a licence to use, or material whose use is otherwise allowed by law. Do not upload other people's personal information, especially information about children, without permission.`,
    ],
  },
  {
    h: 'Rules for using the app',
    p: [
      `The Acceptable Use Policy is part of these terms. In short: no spam, harassment, hate, illegal content, impersonation, copyright infringement, malware, scraping, attempts to access other accounts, or attempts to break or overload the service.`,
    ],
  },
  {
    h: 'Account suspension and termination',
    p: [`Access may be suspended or ended, and content removed, if:`],
    list: [
      `you break these terms or the Acceptable Use Policy;`,
      `a copyright or other rights complaint is upheld against class material uploaded by the site admin;`,
      `your account appears to be compromised, shared, automated or used to attack the service or another account;`,
      `continuing to provide access would break the law or a lawful order; or`,
      `you abuse the report, contact or deletion-request systems, including by filing knowingly false reports.`,
    ],
  },
  {
    h: 'What happens on suspension',
    p: [
      `Where it is practicable and lawful, the operator will tell you why and give you a way to respond through the Contact page. Content may be removed immediately where it is illegal, harmful or infringes someone's rights. Data may be deleted after a suspension if the account is closed.`,
      `The app is free. No refund or compensation is owed for a suspension or for content removed under these terms.`,
    ],
  },
  {
    h: 'Availability and changes to the service',
    p: [
      `The app is provided as it is and as available. Features can change, be limited or be switched off. There is no uptime, availability or data-retention guarantee.`,
      `You can download a copy of your data from Settings at any time. Keep your own copy of material that matters to you: the operator is not a backup service and cannot promise that data will never be lost.`,
    ],
  },
  {
    h: 'Educational disclaimer',
    p: [
      `MyClassroom is a class-notes library with flashcards, multiple-choice practice and a matching game. It does not teach a curriculum, mark work for a qualification, or replace a teacher, textbook or school record. Class material is uploaded by the site admin and may contain mistakes.`,
      `Using the app does not guarantee any exam result, grade, admission or outcome, and nothing in it is academic, legal, medical or financial advice.`,
    ],
  },
  {
    h: 'Limitation of liability',
    p: [
      `To the extent permitted by law, the operator is not liable for indirect, incidental or consequential loss, loss of data, loss of marks or opportunities, or loss caused by content uploaded by another person.`,
      `Nothing in these terms limits a right that cannot be limited under applicable law, including rights under consumer-protection law where it applies.`,
    ],
  },
  {
    h: 'Your responsibility',
    p: [
      `The site admin is responsible for class material they upload and for claims that arise from it, including claims that it infringes copyright, defames someone or discloses personal information without permission. Students are responsible for their own account use, reports and messages.`,
    ],
  },
  {
    h: 'Governing law and disputes',
    p: [
      `These terms are governed by the laws of India, and disputes are subject to the courts of India. Before starting a formal dispute, write through the Contact page so the issue can be looked at directly.`,
      `These terms are written with Indian law in mind, including the Information Technology Act, 2000 and the Digital Personal Data Protection Act, 2023. Nothing here claims a certification, registration or approval under those laws.`,
    ],
  },
  {
    h: 'Changes to these terms',
    p: [
      `When the terms change, the version and effective date at the top of this page change too. A material change will ask you to accept the new version before you can keep making changes in the app. Continuing to use the app after a change means you accept the updated terms.`,
    ],
  },
  {
    h: 'Contact',
    p: [
      `Questions about these terms go through the Contact page, or by email to ${CONTACT_EMAIL}. Those are the operator's two contact channels; no postal address or phone line is operated for this app.`,
    ],
  },
]

const PRIVACY: Section[] = [
  {
    h: 'Who is responsible for your data',
    p: [
      `myclassroom is run by an individual developer. For the personal data described here, the operator of this app is the person who decides how it is used. No company, school or institution is involved in running it.`,
      `Privacy questions, access requests and complaints go through the Contact page with the privacy topic, or by email to ${CONTACT_EMAIL}. No Data Protection Officer has been appointed because this is a small, individually operated app; that is a limitation you should know about.`,
    ],
  },
  {
    h: 'What the app stores',
    list: [
      `Account details: for Freebuff or Google, a provider account id, name, email address and profile picture URL; for username/password accounts, a full name, email address and PBKDF2 password hash. The app never stores a plaintext password. It also stores the username and permanent student ID.`,
      `Class material: decks, card text, images or documents attached to cards, and classwork files uploaded by the site admin. Students do not upload class material.`,
      `Study activity: answers per card, mastery, streaks, due dates, and each session's mode, score and duration.`,
      `Consent records: the policy version you accepted, when you accepted it, and which screen recorded it.`,
      `Safety records: reports you file, deletion requests you send, and messages sent through the Contact page (name, email, topic, text).`,
      `Security logs: an audit trail of privileged actions such as role changes, uploads, deletes and restores, kept with the account id and, until you delete your account, the email address.`,
    ],
  },
  {
    h: 'The personal data kept, in plain language',
    p: [
      `For a signed-in account, the app keeps: your name and, for provider sign-in, profile picture URL; your email address; your username; a password hash if you use username/password sign-in (never the plaintext password); a permanent student ID; and study progress such as answers, mastery, streaks, due dates and session scores and durations.`,
      `It also keeps consent records, reports or requests you file, contact messages you send, and privileged-action audit records. It does not collect health, biometric, caste, religion, financial or precise location data.`,
    ],
  },
  {
    h: 'What the app does not do',
    list: [
      `No analytics, advertising, pixels or third-party tracking scripts are loaded. There is no advertising identifier and no profile-building for marketing.`,
      `Your data is not sold, rented or shared with data brokers.`,
      `There is no direct messaging between users and no public profile page.`,
      `No sensitive category data (health, biometric, caste, religion, financial account numbers) is requested by the app. Do not upload it to cards or classwork.`,
    ],
  },
  {
    h: 'Why the data is used',
    list: [
      `to sign you in and keep your library and progress in sync;`,
      `to show the class library and your own study statistics;`,
      `to store, serve and moderate uploaded files;`,
      `to record consent and handle access, correction and deletion requests;`,
      `to review reports and protect the service and its users; and`,
      `to meet legal obligations and respond to lawful requests.`,
    ],
  },
  {
    h: 'Consent, and withdrawing it',
    p: [
      `The app asks for your consent on a dedicated screen after you sign in. Each statement is unticked by default, and your acceptance of the current policy version, with its timestamp, is saved against your account. Content changes are blocked by the server until that acceptance exists.`,
      `You can withdraw consent at any time by deleting your account in Settings → Legal & safety. That removes your content, progress, sessions and consent records. You can also ask for deletion through the Contact page.`,
      `There is no optional marketing or analytics processing to opt out of, because none is used.`,
    ],
  },
  {
    h: 'Children, classrooms and guardian permission',
    p: [
      `MyClassroom is a classroom study tool, so some users may be under 18. The app asks you to confirm that you are 18 or older, or that a parent, guardian or teacher has agreed to your use. It does not verify age and does not run a separate verifiable parental-consent workflow.`,
      `For parents and guardians: the account keeps the child's name, email address, username, password hash (if password sign-in is used), student ID and study progress. It does not collect a phone number, postal address, date of birth or school records. If you did not agree to this use, or want a copy or deletion, use the Contact page with the privacy topic. India's Digital Personal Data Protection Act, 2023 treats children's data as requiring verifiable parental consent, with limited exemptions; how that applies to a tool used in a classroom needs professional legal review.`,
      `If you are a parent or guardian and a child's data was added without your permission, use the Contact page with the privacy topic and it will be removed.`
    ],
  },
  {
    h: 'Who can see your data',
    list: [
      `The site admin can see the whole class library, reports, audit records and backups.`,
      `Other signed-in users can see the class library (decks and cards marked shared) and attachments on those cards. They cannot see your progress, sessions or private decks.`,
      `Cloudflare provides the hosting, database and file storage used by the app, so it processes data on the operator's behalf. Like any host, it also processes request metadata such as IP address and user agent at the network edge for delivery and security.`,
      `Freebuff or Google handles sign-in and sees the authentication events for your account.`,
      `Authorities may receive data where the operator is legally required to provide it.`,
    ],
  },
  {
    h: 'Where the data is stored',
    p: [
      `Data is stored in Cloudflare's D1 database and R2 object storage. Cloudflare operates a global network, so data may be stored or processed outside India. The app does not transfer data to any other organisation.`,
      `Cross-border transfer rules under the Digital Personal Data Protection Act, 2023 and the rules made under it are still developing. This policy does not claim that any particular transfer mechanism has been approved.`,
    ],
  },
  {
    h: 'How long data is kept',
    list: [
      `Decks, cards and attachments: until you delete them or your account.`,
      `Progress and sessions: until you clear them in Settings or delete your account.`,
      `Consent records: while the account exists, plus any period needed to show that consent was obtained.`,
      `Reports and messages: while they are needed to handle the issue and for safety, then deleted or stripped of identifying details.`,
      `Audit records: kept as a security trail; when an account is deleted, the email address is removed and the account id remains.`,
      `Backups: the admin can download a JSON snapshot. A downloaded copy may exist outside the service and is not deleted automatically. Ask through the Contact page and the operator will remove it where it can be identified.`,
    ],
  },
  {
    h: 'Your rights',
    list: [
      `Access and portability: Settings → Legal & safety → Download my data gives you a JSON file with your account, content, progress, sessions, consent records and requests.`,
      `Correction: use Settings for account details that can be edited, or the Contact page for anything else; the site admin can correct class material.`,
      `Deletion: delete your account from Settings, or send a deletion request through the Contact page if you cannot sign in.`,
      `Withdraw consent: deleting the account withdraws it.`,
      `Grievance: use the Contact page and choose the privacy topic. Describe the issue and the account it concerns.`,
    ],
  },
  {
    h: 'How requests are handled',
    p: [
      `Requests are handled by the operator, not an outsourced support team. Identity may need to be checked before data is exported or deleted, normally by asking you to send the request from the signed-in account. The operator aims to respond within the time required by applicable law; no fixed response time is promised here.`,
      `If you are not satisfied with the response, you may have a right to complain to the Data Protection Board of India once it is operational under the DPDP Act. This policy does not claim that any particular complaint route is currently available.`,
    ],
  },
  {
    h: 'Cookies and local storage',
    list: [
      `The app uses a session cookie so you stay signed in. Freebuff sets its own auth cookie; Google sets a signed, HttpOnly, SameSite=Lax cookie on HTTPS; username/password sign-in sets an HttpOnly, SameSite=Lax cookie named myclassroom_session (with a __Host- prefix on HTTPS).`,
      `Google sign-in sets a short-lived state cookie (about ten minutes) to protect the OAuth flow against cross-site request forgery.`,
      `No analytics, advertising or preference cookies are set by the app, and the app itself does not write to localStorage or sessionStorage.`,
      `Cloudflare may set security cookies at its edge (for example for bot protection). Those are controlled by the hosting provider, not by the app's code.`,
      `You can clear cookies in your browser; doing so signs you out.`,
    ],
  },
  {
    h: 'Security',
    list: [
      `HTTPS with HSTS in production, a strict Content Security Policy, frame denial and no inline scripts.`,
      `Session cookies are HttpOnly and SameSite=Lax; password accounts store only a PBKDF2 hash, never the plaintext password.`,
      `Every API query is scoped to the signed-in account, and content changes are limited to admin accounts.`,
      `Uploads are checked against an allowlist and their byte signatures, and downloaded files are forced to download unless they are images.`,
      `Privileged actions are written to an audit log, and no API keys or database credentials are sent to the browser.`,
      `No system is perfectly secure. Report a suspected vulnerability through the Contact page and it will be looked at.`,
    ],
  },
  {
    h: 'Changes to this policy',
    p: [
      `The version and effective date are shown at the top of this page. A material change will ask you to accept the new version before you can keep making changes in the app. The previous acceptance stays in the database as a record.`,
    ],
  },
]

const COPYRIGHT: Section[] = [
  {
    h: 'What you own',
    p: [
      `The site admin keeps the copyright they already hold in the class material they create and upload. Using the app does not transfer copyright to the operator.`,
      `The app's own name, design, code and interface belong to the operator. Nothing here gives you a licence to reuse them outside the app.`,
      `Classwork files uploaded by the site admin remain the uploader's material or the rights holder's. The operator does not claim ownership and cannot grant permission to reuse them.`,
    ],
  },
  {
    h: 'The permission you give the app',
    p: [
      `The site admin grants the service a non-exclusive, worldwide, royalty-free permission to store, copy, display, back up and moderate class material so the app can work. This includes showing shared decks and card attachments to signed-in users and keeping a backup copy for disaster recovery.`,
      `The permission ends when the material is deleted, except for copies that remain in a backup or a moderation record for as long as those are kept.`,
    ],
  },
  {
    h: 'Who may upload, and on what basis',
    p: [
      `Only the site admin can upload class material to MyClassroom. Student accounts are read-only and cannot upload or edit decks, cards, attachments or classwork.`,
      `The site admin may upload only material they created, material they have permission or a licence to use, or material whose use is otherwise permitted by law. Textbook pages, question banks, past papers and other publishers' material must not be uploaded without permission or a legal basis.`,
      `Uploads must not contain another person's private information, especially information about children, without permission.`,
    ],
  },
  {
    h: 'Reporting copyright infringement',
    p: [
      `Anyone can report content they believe infringes copyright, whether or not they have an account. Use the copyright report in Settings (signed-in users) or the Contact page at /contact with the copyright topic (no account needed).`,
    ],
    list: [
      `your name and an email address the operator can reply to;`,
      `the work you say is infringed, and the rights you hold or the authority you act under;`,
      `where the infringing material is in the app: the deck title, card text or classwork file name, plus a link if you have one;`,
      `a statement that you have a good-faith belief the use is not authorised; and`,
      `a statement that the information is accurate and that you are the owner or authorised to act for the owner.`,
    ],
  },
  {
    h: 'What happens to a report',
    p: [
      `The operator reviews the report and may remove or disable the material while it is checked. Where possible, the person who uploaded it is told what was removed and why. Repeated infringement leads to suspension.`,
      `Knowingly false or abusive reports are themselves a breach of the Acceptable Use Policy.`,
    ],
  },
  {
    h: 'If material you are responsible for was reported',
    p: [
      `If material you are responsible for is reported, you can respond through the Contact page: explain why you have the right to use it, or send the permission or licence you rely on. Material may be restored if the complaint is withdrawn, shown to be mistaken, or does not hold up, subject to what the law requires.`,
    ],
  },
  {
    h: 'Legal framework and limits',
    p: [
      `This policy is written with the Copyright Act, 1957 and the Information Technology Rules, 2021 in mind. It is a practical notice-and-takedown process, not a claim of safe-harbour status, registration or any certification.`,
      `It is not legal advice. Whether a particular use is permitted, and what a rights holder or uploader must prove, are legal questions that need a lawyer's review.`,
    ],
  },
]

const ACCEPTABLE_USE: Section[] = [
  {
    h: 'What this policy covers',
    p: [
      `This policy applies to everything you do with MyClassroom and to any content you are allowed to add. Only the site admin can upload class material; everyone can send reports and contact messages. It applies to everyone, including the admin.`,
    ],
  },
  {
    h: 'Prohibited content',
    list: [
      `Harassment, bullying, threats, intimidation or targeted abuse.`,
      `Hate speech or discrimination based on religion, caste, ethnicity, nationality, sex, gender, sexual orientation, disability or similar characteristics.`,
      `Sexual content, and any sexual content involving minors. This is a zero-tolerance item: it will be removed and reported to the authorities.`,
      `Content that is illegal in India or that promotes illegal activity.`,
      `Graphic violence, gore or content that glorifies self-harm.`,
      `Another person's personal information, including phone numbers, addresses, identity numbers, private messages or images, without permission.`,
      `Impersonation of a person, school, board or organisation, or a fake account.`,
      `Malware, phishing pages, deceptive links or files designed to harm a device.`,
      `Copyrighted material uploaded without permission.`,
      `Spam, bulk advertising, scams or repeated off-topic content.`,
    ],
  },
  {
    h: 'Prohibited behaviour',
    list: [
      `Trying to access another account, another person's data, the admin area or the database without authorisation.`,
      `Scraping, crawling or bulk-downloading the service, or using automated tools to create accounts or content.`,
      `Overloading, probing or attacking the service, or trying to get around rate limits, size limits or file checks.`,
      `Uploading a file that claims one type but contains another, or trying to make the service serve executable content.`,
      `Sharing an account or your sign-in access with someone else.`,
      `Filing knowingly false reports or using the Contact form to harass or spam the operator.`,
      `Continuing to use the app after a suspension, including through another account.`,
    ],
  },
  {
    h: 'Files and uploads',
    p: [
      `Only the site admin can upload. Card attachments and classwork accept PNG, JPEG, WebP, GIF, PDF, Word, PowerPoint, Excel, plain text, CSV, Markdown, RTF and EPUB, up to 90 MB each. The server checks the file's actual bytes, not only the type the browser declares, and other file types are refused.`,
      `The site admin uploads only material they have the right to share. Class material can be seen by signed-in users when it is part of the shared class library. Rights holders can request removal through the Copyright page or the Contact page at /contact with the copyright topic.`,
    ],
  },
  {
    h: 'Reports and child safety',
    p: [
      `Report content from Settings → Legal & safety, or from the Contact page without an account. Reports are reviewed by the operator. False reports are a breach of this policy.`,
      `If someone is in immediate danger, contact local emergency services first (112 in India). For a child-safety concern in India, Childline is 1098. In-app reports are not monitored around the clock and are not an emergency service.`,
    ],
  },
  {
    h: 'Enforcement',
    list: [
      `Content may be removed or disabled, with a note to the uploader where practicable.`,
      `Accounts may be suspended or closed, and content deleted.`,
      `Serious cases, including child sexual abuse material and credible threats, may be reported to law enforcement.`,
      `The operator will respond to lawful requests and orders from competent authorities.`,
    ],
  },
  {
    h: 'Appeals',
    p: [
      `If you believe a decision was wrong, use the Contact page with the abuse or account topic. Include the account, the content and why you think it should be restored. Appeals are reviewed by the operator.`,
    ],
  },
]

export function TermsPage() {
  return (
    <LegalShell
      title="Terms of Use"
      intro="The agreement between you and the person who runs myclassroom: what you can expect, what is expected of you, and what happens when something goes wrong."
      sections={TERMS}
    />
  )
}

export function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      intro="What myclassroom stores, why, who can see it, how long it is kept and how to get a copy or have it deleted. Written to describe what the code actually does, not an aspiration."
      sections={PRIVACY}
    />
  )
}

export function CopyrightPage() {
  return (
    <LegalShell
      title="Copyright Policy"
      intro="Who owns what, who may upload and on what basis, and how a copyright complaint is made and handled."
      sections={COPYRIGHT}
    />
  )
}

export function AcceptableUsePage() {
  return (
    <LegalShell
      title="Acceptable Use Policy"
      intro="The short version of what is not allowed here, and what happens if it happens anyway."
      sections={ACCEPTABLE_USE}
    />
  )
}

export function ContactPage() {
  return (
    <LegalShell
      title="Contact"
      intro={`Write through the form below or email ${CONTACT_EMAIL}. Form messages are stored in the app's database and read by the operator in the admin inbox; email arrives in the same mailbox. No phone number or postal address is operated for this app.`}
    >
      <p className="mt-6 text-[14px] leading-relaxed text-muted">
        Prefer email? Write to{' '}
        <a className="font-medium text-accent hover:text-accent-deep" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>
        .
      </p>
      <ContactForm />
      <section className="mt-10">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em]">What to include</h2>
        <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-[14px] leading-relaxed text-muted marker:text-faint">
          <li>For a privacy request: the account email and what you want — a copy, a correction or deletion.</li>
          <li>For a copyright complaint: the work, where it appears, and your authority to act for the owner.</li>
          <li>For a safety issue: the deck or card, what is wrong, and whether anyone is in immediate danger.</li>
        </ul>
        <p className="mt-3 text-[13px] leading-relaxed text-faint">
          Never send a password or a one-time sign-in code. The operator will never ask for one. In an emergency, contact local emergency services (112 in India)
          rather than using this form.
        </p>
      </section>
    </LegalShell>
  )
}

function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', topic: 'privacy', message: '', consent: false, website: '' })
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await sendContact(form)
      setSent(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <section className="mt-8 rounded-card border border-line bg-surface p-6 shadow-card">
        <h2 className="text-[17px] font-semibold">Message received</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          Your message is in the operator's inbox. A reply goes to the email address you provided. Messages are read in the order they arrive.
        </p>
        <button type="button" onClick={() => setSent(false)} className="mt-4 text-[13.5px] font-medium text-accent hover:text-accent-deep">
          Send another message
        </button>
      </section>
    )
  }

  return (
    <section className="mt-8 rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
      <h2 className="text-[17px] font-semibold">Send a message</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">Your name</span>
          <Input value={form.name} autoComplete="name" onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">Email for the reply</span>
          <Input type="email" value={form.email} autoComplete="email" onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">Topic</span>
          <select
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
            className="h-9 w-full rounded-control border border-line-strong bg-surface px-3 text-[13.5px] text-fg focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
          >
            {CONTACT_TOPICS.map((topic) => (
              <option key={topic.value} value={topic.value}>
                {topic.label}
              </option>
            ))}
          </select>
        </label>
        <span className="hidden sm:block" aria-hidden />
      </div>
      <label className="mt-4 flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">Message</span>
        <Textarea
          value={form.message}
          rows={5}
          placeholder="Tell the operator what the issue is, and where it appears if it is about content."
          onChange={(e) => setForm({ ...form, message: e.target.value })}
        />
      </label>
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Leave this empty
          <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
        </label>
      </div>
      <label className="mt-4 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={form.consent}
          onChange={(e) => setForm({ ...form, consent: e.target.checked })}
          className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
        />
        <span className="text-[13px] leading-relaxed text-muted">
          I agree that this message, my name and my email address are stored in the app so the operator can respond, as described in the Privacy Policy.
        </span>
      </label>
      {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}
      <button
        type="button"
        disabled={busy || !form.consent || form.name.trim().length < 2 || form.email.includes('@') === false || form.message.trim().length < 20}
        onClick={submit}
        className="mt-5 inline-flex h-10 items-center justify-center rounded-control bg-accent px-4 text-[13.5px] font-medium text-white transition-colors hover:bg-accent-deep disabled:pointer-events-none disabled:opacity-50"
      >
        {busy ? 'Sending…' : 'Send message'}
      </button>
    </section>
  )
}
