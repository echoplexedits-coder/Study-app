import { renderToString } from 'react-dom/server'

import { Welcome } from './app/pages/Welcome'

/** Rendered at build time into dist/client/landing.html. */
export function render(): string {
  return renderToString(<Welcome />)
}
