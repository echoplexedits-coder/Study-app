import { describe, expect, it } from 'bun:test'

import { hasAuthCookie } from '../src/worker/auth'

const withCookie = (cookie: string) => new Request('https://myclassroom.example/', { headers: { cookie } })

describe('landing page cookie split', () => {
  it('serves the static landing page with no cookie', () => {
    expect(hasAuthCookie(new Request('https://myclassroom.example/'))).toBe(false)
  })

  it('ignores unrelated cookies', () => {
    expect(hasAuthCookie(withCookie('theme=dark; _ga=GA1.2.3'))).toBe(false)
  })

  it('recognises each real session cookie and its __Host- form', () => {
    for (const name of ['myclassroom_session', 'recall_user', 'freebuff_session']) {
      expect(hasAuthCookie(withCookie(`${name}=token`))).toBe(true)
      expect(hasAuthCookie(withCookie(`__Host-${name}=token`))).toBe(true)
    }
  })

  it('does not treat the short-lived OAuth transaction cookie as a session', () => {
    expect(hasAuthCookie(withCookie('recall_oauth=state'))).toBe(false)
  })

  it('does not match a cookie whose value merely contains a session name', () => {
    expect(hasAuthCookie(withCookie('other=myclassroom_session'))).toBe(false)
  })
})
