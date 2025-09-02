import { defineConfig } from 'vite'

export default defineConfig({
  base: '/image-resizer/', // GitHub Pages subpath
  root: '.', // Ensure Vite uses the current directory as root
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  optimizeDeps: {
    include: ['file-saver', 'utif'],
  },
})