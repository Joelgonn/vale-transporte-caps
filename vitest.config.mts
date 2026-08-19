import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL(".", import.meta.url)),
      },
    },
    test: {
      environment: "node",
      globals: true,
      include: ["tests/**/*.test.{ts,tsx}"],
      setupFiles: ["./tests/setup.ts"],
      // Sprint 37 — Fase A: uma sessão real por perfil por execução (leitura de
      // arquivo de sessão pelos workers) para não estourar o rate limit do
      // Supabase Auth com signIns repetidos.
      globalSetup: ["./tests/global-setup.ts"],
      env: env,
      coverage: {
        reporter: ["text", "html"],
      },
    },
  };
});
