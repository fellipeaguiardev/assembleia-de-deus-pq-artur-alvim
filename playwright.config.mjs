// ============================================================
// Smoke test (Playwright) — abre as páginas principais no celular e no
// computador e confere título, console e vinheta. Só leitura: nenhum
// formulário, nenhum "Quero este livro", nada do painel.
//   npm ci && npx playwright install chromium   (uma vez)
//   npx playwright test                         (sobe o npx serve sozinho)
// Também roda no GitHub Actions (.github/workflows/check.yml).
// ============================================================
import { defineConfig, devices } from "@playwright/test";

const PORTA = 5500;

export default defineConfig({
  testDir: "tests",
  timeout: 45_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0, // o banco é o de produção, pela internet: uma segunda chance no CI
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORTA}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // O mesmo servidor do "Rodar localmente" (-s: qualquer endereço abre o index.html).
  // Se já houver um rodando na porta, ele é reaproveitado (fora do CI).
  webServer: {
    command: `npx serve -s . -l ${PORTA}`,
    url: `http://localhost:${PORTA}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    { name: "celular", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 760 }, isMobile: true, hasTouch: true } },
    { name: "computador", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
});
