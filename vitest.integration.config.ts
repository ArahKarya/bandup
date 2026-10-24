import path from "node:path";
import { defineConfig } from "vitest/config";

try {
  process.loadEnvFile(".env");
} catch {
  // CI provides DATABASE_URL directly
}

/** Database-backed tests: `pnpm test:integration` (needs Postgres + synced content). */
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: { include: ["tests/integration/**/*.test.ts"], environment: "node", testTimeout: 30_000 },
});
