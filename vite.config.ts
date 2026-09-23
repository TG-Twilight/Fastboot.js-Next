/// <reference types="node" />
/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  // GitHub Pages serves the site under /<repo>/; override with VITE_BASE_PATH elsewhere.
  base: process.env.VITE_BASE_PATH ?? (process.env.GITHUB_ACTIONS ? "/Fastboot.js-Next/" : "/"),
  plugins: [vue()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) }
  },
  build: {
    target: "es2022"
  },
  test: {
    environment: "node"
  }
});
