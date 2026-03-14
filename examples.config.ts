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

  // Rust (future)
  // Go (future)
  // Python (future)
}
