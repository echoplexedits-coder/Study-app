import type { Env } from './env'

/**
 * Password-reset mail is optional. Without an email provider configured, the
 * reset request is recorded instead and an admin hands out a one-time link from
 * the user-management page — the flow works either way, it just needs someone
 * to carry the link.
 */
export function mailConfigured(env: Env): boolean {
  return Boolean(env.RESEND_API_KEY && env.MAIL_FROM)
}

export async function sendResetEmail(env: Env, input: { to: string; name?: string | null; link: string; minutes: number }): Promise<boolean> {
  if (!mailConfigured(env)) return false
  const greeting = input.name ? `Hi ${input.name.split(' ')[0]},` : 'Hello,'
  const text = [
    greeting,
    '',
    'Someone asked to reset the password for your MyClassroom account.',
    `Open this link to choose a new password: ${input.link}`,
    `The link works once and expires in ${input.minutes} minutes.`,
    '',
    'If this was not you, you can ignore this message — your password has not changed.',
  ].join('\n')
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [input.to],
        subject: 'Reset your MyClassroom password',
        text,
      }),
    })
    if (!response.ok) console.error('reset email failed', response.status)
    return response.ok
  } catch (error) {
    console.error('reset email failed', error)
    return false
  }
}
