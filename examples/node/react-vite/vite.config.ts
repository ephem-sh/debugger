import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { debuggerPlugin } from '@ephem-sh/debugger/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), debuggerPlugin()],
})
