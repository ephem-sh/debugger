import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { debuggerPlugin } from "@ephem-sh/debugger/vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths(), debuggerPlugin()],
});
