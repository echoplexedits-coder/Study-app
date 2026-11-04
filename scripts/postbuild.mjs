// Strips files the Sites uploader refuses (hidden files and source maps)
// from the build output, so `deploy.json` can point straight at dist/.
// Keeps wrangler.json so the dev server can still serve ASSETS from dist/client.
import { readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

function clean(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (name.startsWith('.') && name !== '.gitignore' && name !== '.freebuff-generated') {
      rmSync(path, { recursive: true, force: true })
      continue
    }
    if (name.endsWith('.map')) {
      rmSync(path, { recursive: true, force: true })
      continue
    }
    if (statSync(path).isDirectory()) clean(path)
  }
}

clean(new URL('../dist', import.meta.url).pathname)
