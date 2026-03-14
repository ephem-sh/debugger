// https://nuxt.com/docs/api/configuration/nuxt-config
import { debuggerPlugin } from '@ephem-sh/debugger/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  vite: {
    plugins: [debuggerPlugin()],
  },
})
