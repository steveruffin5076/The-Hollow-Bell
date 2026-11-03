import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative base so the build works from any folder or sub-path.
  base: "./",
  server: {
    port: 5173,
  },
  build: {
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
