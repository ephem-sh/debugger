// @ts-check
import { defineConfig } from 'astro/config';
import { debuggerPlugin } from '@ephem-sh/debugger/vite'

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [debuggerPlugin()],
  },
});
