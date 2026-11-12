/// <reference types="vitest/config" />

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/HK-ZH-Gas-discount-calc/",
  plugins: [react(), tailwindcss()],
  server: { port: 4173 },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
    exclude: ["e2e/**", "node_modules/**"],
  },
});
