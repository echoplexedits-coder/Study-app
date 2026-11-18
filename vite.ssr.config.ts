import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Builds only the landing page's server entry. The Worker and client builds
// stay untouched in vite.config.ts; scripts/prerender.mjs consumes this output.
export default defineConfig({
  plugins: [react()],
  build: {
    ssr: 'src/entry-server.tsx',
    outDir: 'dist-ssr',
    emptyOutDir: true,
    sourcemap: false,
  },
})
