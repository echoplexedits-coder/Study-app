import { describe, expect, it } from 'bun:test'

import { isLastAdminChange } from '../src/worker/db'

describe('last-admin guard', () => {
  it('blocks removing the only admin by demotion, suspension or deletion', () => {
    expect(isLastAdminChange('admin', 1)).toBe(true)
  })

  it('allows removing an admin when another admin remains', () => {
    expect(isLastAdminChange('admin', 2)).toBe(false)
  })

  it('never blocks a student or a missing role row', () => {
    expect(isLastAdminChange('student', 1)).toBe(false)
    expect(isLastAdminChange(null, 1)).toBe(false)
    expect(isLastAdminChange(undefined, 1)).toBe(false)
  })

  it('treats a zero-admin table as already unsafe rather than removable', () => {
    expect(isLastAdminChange('admin', 0)).toBe(true)
  })
})
