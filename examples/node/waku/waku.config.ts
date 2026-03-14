import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'waku/config';
import { debuggerPlugin } from '@ephem-sh/debugger/vite'

export default defineConfig({
  vite: {
    plugins: [
      debuggerPlugin(),
      tailwindcss(),
      react({
        babel: {
          plugins: ['babel-plugin-react-compiler'],
        },
      }),
    ],
  },
});
