// Writes dist/client/landing.html: the served HTML for signed-out visitors.
// It reuses the client build's head (title, meta tags, stylesheet) so those
// stay in one place, drops the app bundle, and inserts the server-rendered
// landing markup. The page needs no JavaScript to display or navigate.
import { readFile, writeFile } from 'node:fs/promises'

import { render } from '../dist-ssr/entry-server.js'

const client = new URL('../dist/client/', import.meta.url)
const shell = await readFile(new URL('index.html', client), 'utf8')
const markup = render()

let page = shell
  .replace(/\s*<script[^>]*type="module"[^>]*><\/script>/g, '')
  .replace(/\s*<link[^>]*rel="modulepreload"[^>]*>/g, '')

if (!/<div id="root">\s*<\/div>/.test(page)) {
  throw new Error('prerender: could not find an empty #root in dist/client/index.html')
}

page = page.replace(/<div id="root">\s*<\/div>/, `<div id="root">${markup}</div>`)

await writeFile(new URL('landing.html', client), page)
console.log(`prerender: wrote landing.html (${markup.length} characters of markup)`)
