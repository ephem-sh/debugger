## @ephem-sh/debugger

**Install:**

```bash
npm install -D @ephem-sh/debugger
```

**Setup** — add the plugin to `vite.config.ts`:

```ts
import { debuggerPlugin } from '@ephem-sh/debugger/vite'

export default defineConfig({
  plugins: [sveltekit(), debuggerPlugin()],
})
```

**Health check:**

```bash
npm run dev
npx dbg status
```

[Full documentation](https://github.com/ephem-sh/debugger/tree/main/docs) | Happy debugging!

---

# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
npx sv@0.12.7 create --template minimal --types ts --add tailwindcss="plugins:none" --install npm svelte
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
