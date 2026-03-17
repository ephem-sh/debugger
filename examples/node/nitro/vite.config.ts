import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import { debuggerPlugin } from "@ephem-sh/debugger/vite";

export default defineConfig({
  plugins: [
    nitro(),
    debuggerPlugin(),
  ],
  resolve: {
    tsconfigPaths: true
  }
});
