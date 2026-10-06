import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  ssr: false,
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },
  runtimeConfig: {
    public: { addDebugLogs: process.env.NUXT_ADD_DEBUG_LOGS === 'true' },
  },
  app: { head: { title: 'QR Code Builder', htmlAttrs: { lang: 'en' } } },
})
