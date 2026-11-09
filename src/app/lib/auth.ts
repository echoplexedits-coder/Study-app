import type { Me } from '../../shared/types'

/**
 * Ends the current auth session with a same-origin POST, then replaces the
 * current history entry with the public welcome screen. Using fetch instead of
 * a native form keeps the sign-out navigation to one deliberate replace, so a
 * redirect cannot bounce through the protected app or re-submit the form.
 */
export async function signOut(auth: Me['capabilities']['auth']): Promise<void> {
  if (auth === 'development') {
    // The development identity has no provider session to revoke. Reloading
    // would just sign the same local user back in.
    window.location.replace('/welcome')
    return
  }

  if (auth === 'password') {
    const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
    if (!response.ok) throw new Error('Could not sign out. Try again.')
    window.location.replace('/')
    return
  }

  const endpoint = auth === 'google' ? '/auth/google/signout' : '/auth/freebuff/signout'
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ returnTo: '/welcome' }),
  })

  if (!response.ok) {
    throw new Error('Could not sign out. Try again.')
  }

  window.location.replace('/welcome')
}
