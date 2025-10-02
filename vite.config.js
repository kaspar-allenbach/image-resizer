import { defineConfig } from 'vite'

export default defineConfig({
  base: '/image-resizer/',
  
  // Add WASM file support
  assetsInclude: ['**/*.wasm'],
  
  // Server configuration for WASM files
  server: {
    fs: {
      allow: ['..']
    },
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    }
  },
  
  optimizeDeps: {
    include: ['file-saver', 'utif'],
    // Exclude jSquash packages so they can load WASM files properly
    exclude: ['@jsquash/png', '@jsquash/jpeg', '@jsquash/webp']
  },
  
  // Build configuration with WASM support
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        format: 'es'
      }
    }
  }
})