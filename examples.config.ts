/**
 * Example app registry.
 *
 * Maps short names to their directory paths and scripts.
 * Used by `bun run dev:<name>` and `bun run install:<name>`.
 */
export const examples: Record<string, { path: string; dev: string; install: string }> = {
  // Node / JavaScript
  nextjs:        { path: 'examples/node/nextjs',        dev: 'next dev',       install: 'npm install' },
  'vite-react':  { path: 'examples/node/vite-react',    dev: 'vite',           install: 'npm install' },
  'vite-vue':    { path: 'examples/node/vite-vue',      dev: 'vite',           install: 'npm install' },
  'vite-svelte': { path: 'examples/node/vite-svelte',   dev: 'vite',           install: 'npm install' },
  remix:         { path: 'examples/node/remix',          dev: 'remix vite:dev', install: 'npm install' },
  astro:         { path: 'examples/node/astro',          dev: 'astro dev',      install: 'npm install' },
  nuxt:          { path: 'examples/node/nuxt',           dev: 'nuxt dev',       install: 'npm install' },
  solidjs:       { path: 'examples/node/solidjs',        dev: 'vite',           install: 'npm install' },
  sveltekit:     { path: 'examples/node/sveltekit',      dev: 'vite dev',       install: 'npm install' },
  gatsby:        { path: 'examples/node/gatsby',         dev: 'gatsby develop', install: 'npm install' },
  hono:          { path: 'examples/node/hono',           dev: 'hono dev',       install: 'npm install' },
  express:       { path: 'examples/node/express',        dev: 'node index.js',  install: 'npm install' },
  elysiajs:      { path: 'examples/node/elysiajs',       dev: 'bun run dev',    install: 'npm install' },
  waku:          { path: 'examples/node/waku',           dev: 'waku dev',       install: 'npm install' },
  vinext:        { path: 'examples/node/vinext',         dev: 'vinext dev',     install: 'npm install' },

  // Rust (future)
  // Go (future)
  // Python (future)
}
