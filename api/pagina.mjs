// ============================================================
// Páginas do site com título e descrição certos no HTML
// ------------------------------------------------------------
// O WhatsApp, o Facebook e o Google leem só o HTML (não rodam o JS do
// site), então cada endereço precisa já vir com as tags da página. Esta
// função pega o index.html, troca só o <title>, a description, o og:* e o
// canonical (api/_lib/paginas.mjs) e devolve o resto igual.
//
//   GET /api/pagina?caminho=/biblia/joao/3/16
//
// Se algo falhar ou demorar mais de TEMPO_MAX_MS, devolve o index.html
// original (nunca uma página de erro). Rota que o site não conhece volta
// com status 404 e a mesma página "não encontrada" do site.
// Cache curto na Vercel (s-maxage) com stale-while-revalidate.
// ============================================================
import { metaDaRota, aplicarMeta, lerShell } from "./_lib/paginas.mjs";

const TEMPO_MAX_MS = 2500;
const CACHE = "public, max-age=0, s-maxage=300, stale-while-revalidate=86400";

const html = (body, status = 200, cache = CACHE) =>
  new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": cache } });

export async function GET(request) {
  const caminho = new URL(request.url).searchParams.get("caminho") || "/";
  let shell;
  try {
    shell = await lerShell();
  } catch (e) {
    console.error("pagina: sem index.html", e);
    // Último recurso: o arquivo estático (nunca uma página de erro).
    return fetch(new URL("/index.html", request.url));
  }
  try {
    const meta = await Promise.race([
      metaDaRota(caminho),
      new Promise((_, nao) => setTimeout(() => nao(new Error("demorou")), TEMPO_MAX_MS)),
    ]);
    return html(aplicarMeta(shell, meta), meta.status || 200);
  } catch (e) {
    console.error("pagina:", caminho, e?.message || e);
    return html(shell, 200, "public, max-age=0, s-maxage=30");
  }
}

export const HEAD = GET;
