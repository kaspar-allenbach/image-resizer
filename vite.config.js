import { defineConfig } from 'vite'

export default defineConfig({
  base: '/image-resizer/', // only affects build
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  optimizeDeps: {
    include: ['file-saver', 'utif'],
  },
})
