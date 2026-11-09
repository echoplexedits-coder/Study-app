import { type ReactNode } from 'react'

export function cn(...inputs: ReactNode[]) {
  return inputs.filter(Boolean).join(' ')
}
