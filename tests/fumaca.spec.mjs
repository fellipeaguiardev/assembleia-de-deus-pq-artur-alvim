// ============================================================
// Smoke test: as páginas principais abrem, com o h1 certo, sem erro no
// console, e a vinheta não atrapalha quem chega por um link direto.
// Só leitura: o site roda em localhost (modo só leitura do js/config.js)
// e, por garantia, todo pedido que gravaria algo é barrado aqui e faz o
// teste falhar. Nada de formulário, "Quero este livro" ou painel.
// ============================================================
import { test as base, expect } from "@playwright/test";

const ROTAS = [
  ["/", /\S/], // o título da página inicial vem do painel: basta não estar vazio
  ["/cultos", /Horários dos cultos/],
  ["/biblia/joao/3", /João 3/],
  ["/palavra", /Palavra Diária/],
  ["/ebd", /EBD|Escola Bíblica/],
  ["/harpa", /Harpa Cristã/],
  ["/biblioteca", /Biblioteca/],
  ["/videos", /vídeos/i],
  ["/podcast", /Podcast/],
  ["/privacidade", /Privacidade/i],
];

// Pedidos POST que só leem (RPC de consulta); qualquer outro não-GET é barrado.
const SO_LEITURA_POST = /\/rest\/v1\/rpc\/library_status\b/;
const DO_SITE = (url) => url.startsWith("http://localhost:") || /^https:\/\/[a-z0-9]+\.supabase\.co\//.test(url);

const test = base.extend({
  // Automático em todo teste: anota erros do console e barra gravações.
  vigia: [
    async ({ page, context }, use) => {
      const erros = [];
      const gravacoes = [];
      await context.route("**/*", (route) => {
        const r = route.request();
        if (["GET", "HEAD", "OPTIONS"].includes(r.method()) || SO_LEITURA_POST.test(r.url())) return route.continue();
        gravacoes.push(`${r.method()} ${r.url()}`);
        return route.abort();
      });
      page.on("pageerror", (e) => erros.push(`erro de JavaScript: ${e.message}`));
      page.on("console", (m) => {
        // em localhost o js/config.js já barra a gravação antes da rede e avisa assim
        if (m.type() === "warning" && m.text().includes("[só leitura]")) return gravacoes.push(m.text());
        if (m.type() !== "error") return;
        const onde = m.location()?.url || "";
        // Recurso de terceiros que falhou (ex.: miniatura de vídeo removido do YouTube) não é erro do site.
        if (/Failed to load resource/i.test(m.text()) && onde && !DO_SITE(onde)) return;
        erros.push(`${m.text()}${onde ? ` (${onde})` : ""}`);
      });
      await use({ erros });
      expect(gravacoes, "pedidos que gravariam algo (o smoke test é só leitura)").toEqual([]);
    },
    { auto: true },
  ],
});

async function assentar(page) {
  // espera a rede acalmar para pegar erros que aparecem depois do carregamento
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

test.describe("páginas", () => {
  for (const [rota, titulo] of ROTAS) {
    test(`${rota} abre com h1 e sem erro no console`, async ({ page, vigia }) => {
      // vinheta já vista (o teste dela é o de baixo)
      await page.addInitScript(() => {
        try {
          localStorage.setItem("intro-vista", "1");
        } catch {}
      });
      await page.goto(rota);
      const h1 = page.locator("#siteRoot h1").first();
      await expect(h1).toHaveText(titulo);
      await expect(page).not.toHaveTitle(/não encontrad/i);
      await assentar(page);
      expect(vigia.erros, vigia.erros.join("\n")).toEqual([]);
    });
  }
});

test.describe("vinheta", () => {
  test("link direto na primeira visita abre a página sem vinheta", async ({ page, vigia }) => {
    await page.goto("/cultos"); // contexto novo: nada no localStorage
    await expect(page.locator("html")).toHaveAttribute("data-intro", "none");
    const h1 = page.locator("#siteRoot h1").first();
    await expect(h1).toHaveText(/Horários dos cultos/, { timeout: 8_000 });
    // nada na frente da página: a abertura não intercepta o toque
    await h1.click({ trial: true, timeout: 5_000 });
    await expect(page.locator("#splash")).toHaveCount(0, { timeout: 5_000 });
    expect(vigia.erros, vigia.erros.join("\n")).toEqual([]);
  });

  test("início: vinheta completa só na primeira visita, depois a curta", async ({ page, vigia }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-intro", "full");
    const h1 = page.locator("#siteRoot h1").first();
    await expect(page.locator("#splash")).toHaveCount(0, { timeout: 20_000 });
    await h1.click({ trial: true, timeout: 5_000 });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-intro", "short");
    await expect(page.locator("#splash")).toHaveCount(0, { timeout: 10_000 });
    expect(vigia.erros, vigia.erros.join("\n")).toEqual([]);
  });
});
