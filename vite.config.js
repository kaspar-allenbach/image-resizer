import { defineConfig } from 'vite'

export default defineConfig({
  base: '/image-resizer/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  optimizeDeps: {
    include: ['file-saver', 'utif'],
  },
})
