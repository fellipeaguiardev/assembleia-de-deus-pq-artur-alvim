// ============================================================
// GET /api/capa-livro/<id do livro>-<versão>.jpg
// ------------------------------------------------------------
// Capa de livro que veio da planilha (guardada no banco pela
// sincronização, api/biblioteca-sync.mjs). Só de livro visível.
// A versão no nome muda quando a capa muda, então pode ficar em cache.
// O site mostra pelo redutor de imagens da Vercel (vercel.json → images).
// ============================================================
import { rpc } from "../_lib/fonte.mjs";

const notFound = () => new Response("Capa não encontrada", { status: 404, headers: { "Cache-Control": "public, max-age=300" } });

export async function GET(request) {
  const m = /\/api\/capa-livro\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:-\d{1,20})?\.jpg$/i.exec(new URL(request.url).pathname);
  if (!m) return notFound();
  let rows;
  try {
    rows = await rpc("library_cover", { p_book: m[1].toLowerCase() });
  } catch (e) {
    console.error("capa-livro:", e.message);
    return new Response("Indisponível", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const c = Array.isArray(rows) ? rows[0] : null;
  if (!c?.data) return notFound();
  return new Response(Buffer.from(c.data, "base64"), {
    headers: { "Content-Type": c.mime, "Cache-Control": "public, max-age=604800, s-maxage=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
