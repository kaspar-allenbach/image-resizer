import { defineConfig } from 'vite'

export default defineConfig({
  base: '/image-resizer/', // GitHub Pages repo name
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      // ensure file-saver is bundled
      external: [],
    },
  },
  optimizeDeps: {
    include: ['file-saver', 'utif'] // force Vite to pre-bundle these
  }
})
