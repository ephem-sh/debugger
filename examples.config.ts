/**
 * Example app registry.
 *
 * Maps short names to their directory paths and scripts.
 * Used by `bun run dev:<name>` and `bun run install:<name>`.
 */
export const examples: Record<string, { path: string; dev: string; install: string }> = {
  // Node / JavaScript — active examples
  nextjs:          { path: 'examples/node/nextjs',          dev: 'next dev',          install: 'npm install' },
  'react-vite':    { path: 'examples/node/react-vite',      dev: 'vite',              install: 'npm install' },
  vue:             { path: 'examples/node/vue',              dev: 'vite',              install: 'npm install' },
  svelte:          { path: 'examples/node/svelte',           dev: 'vite dev',          install: 'npm install' },
  'react-router':  { path: 'examples/node/react-router',    dev: 'react-router dev',  install: 'npm install' },
  qwik:            { path: 'examples/node/qwik',             dev: 'vite --mode ssr',   install: 'npm install' },
  'tanstack-start':{ path: 'examples/node/tanstack-start',   dev: 'vite dev',          install: 'npm install' },
  nuxt:            { path: 'examples/node/nuxt',              dev: 'nuxt dev',          install: 'npm install' },
  waku:            { path: 'examples/node/waku',              dev: 'waku dev',          install: 'npm install' },
  astro:           { path: 'examples/node/astro',             dev: 'astro dev',         install: 'npm install' },
  angular:         { path: 'examples/node/angular',           dev: 'ng serve',          install: 'npm install' },
  gatsby:          { path: 'examples/node/gatsby',            dev: 'gatsby develop',    install: 'npm install' },

  // Rust (future)
  // Go (future)
  // Python (future)
}
