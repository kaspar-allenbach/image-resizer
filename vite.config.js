import { defineConfig } from 'vite'

export default defineConfig({
  base: '/image-resizer/', // GitHub Pages repo name
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})
