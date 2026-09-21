import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // PWA installable (lot 4, avancé le 2026-09-21) : l'intervenante ajoute
    // l'application à l'écran d'accueil de son téléphone. Le service worker
    // précache la coquille (démarrage rapide, SPEC §8) ; l'API reste en
    // réseau direct — la file d'écritures hors ligne viendra compléter.
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Housekeeping',
        short_name: 'Housekeeping',
        description: 'Plano de limpeza da casa / Plan de ménage du foyer',
        start_url: '/',
        display: 'standalone',
        background_color: '#f1f5f9',
        theme_color: '#f1f5f9',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/admin/],
      },
    }),
  ],
  server: {
    // En développement, l'API du lot 1 tourne à côté (`npm run dev` à la racine).
    proxy: { '/api': 'http://localhost:3000' },
  },
})
