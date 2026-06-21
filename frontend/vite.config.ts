import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icono.png', 'logo.png'],
      manifest: {
        name: 'odontiacloud',
        short_name: 'odontiacloud',
        description: 'Sistema de gestión para clínicas dentales',
        theme_color: '#0f2f4f',
        background_color: '#eaf6fb',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'es',
        categories: ['medical', 'productivity', 'business'],
        icons: [
          { src: '/icono.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icono.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icono.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Las llamadas a la API NUNCA se cachean — los datos clínicos deben ser frescos.
        // Cachear solo los assets estáticos del build.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/accounts\.google\.com\/gsi\//,
            handler: 'NetworkOnly',
          },
          {
            // Logos e iconos: cache primero (rara vez cambian)
            urlPattern: /\.(png|jpg|jpeg|svg|webp|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 30, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // en dev no instalamos SW para evitar caché molesta
      },
    }),
  ],
  server: {
    port: Number(process.env.PORT) || 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
