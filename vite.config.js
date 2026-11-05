import { defineConfig } from "vite";
import { readFileSync, existsSync } from "node:fs";

// v86 asks for v86.wasm and, if the main binary fails to instantiate,
// v86-fallback.wasm (same folder). Serve and emit both straight from
// node_modules so we don't depend on the package's "exports" map.
const FILES = {
  "v86.wasm": "node_modules/v86/build/v86.wasm",
  "v86-fallback.wasm": "node_modules/v86/build/v86-fallback.wasm",
};

const v86Wasm = () => ({
  name: "v86-wasm",
  buildStart() {
    if (!existsSync(FILES["v86.wasm"])) this.error(`${FILES["v86.wasm"]} not found. Run "npm install" first.`);
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const name = (req.url || "").split("?")[0].replace(/^\/+/, "");
      const path = FILES[name];
      if (!path || !existsSync(path)) return next();
      res.setHeader("Content-Type", "application/wasm");
      res.end(readFileSync(path));
    });
  },
  generateBundle() {
    for (const [fileName, path] of Object.entries(FILES))
      if (existsSync(path)) this.emitFile({ type: "asset", fileName, source: readFileSync(path) });
  },
});

export default defineConfig({
  base: "./",
  plugins: [v86Wasm()],
  optimizeDeps: { exclude: ["v86"] },
  build: { target: "esnext" },
});
