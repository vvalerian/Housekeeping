import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // En développement, l'API du lot 1 tourne à côté (`npm run dev` à la racine).
    proxy: { '/api': 'http://localhost:3000' },
  },
})
