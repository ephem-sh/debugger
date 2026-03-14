import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { debuggerPlugin } from '@ephem-sh/debugger/vite';

export default defineConfig({ plugins: [tailwindcss(), sveltekit(), debuggerPlugin()] });
