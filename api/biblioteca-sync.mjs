// ============================================================
// Biblioteca — traz os livros novos da planilha para o site
// ------------------------------------------------------------
// Quem aciona:
//   GET  com "Authorization: Bearer CRON_SECRET"  → Vercel Cron, todo dia
//   GET  ?chave=LIB_TRIGGER_KEY                   → link "Atualizar agora" da
//        equipe da biblioteca (mostra uma página com o resultado)
//   POST com o login de um admin liberado         → botão do painel
//
// O que faz: lê a planilha (api/_lib/planilha.mjs), cadastra os exemplares
// novos (função library_sync_apply, com a chave LIB_SYNC_TOKEN, que nunca
// sai daqui) e guarda a capa de quem ainda não tem: a imagem colada na
// coluna "Capa" da planilha ou, para livro novo sem imagem, uma capa achada
// na internet quando título e autor batem (Open Library; Google Books se
// houver GOOGLE_BOOKS_KEY). Nunca apaga nem muda o que a equipe editou.
//
// Variáveis na Vercel: LIB_SHEET_ID (id da planilha — não fica no código,
// ela tem nomes), LIB_SYNC_TOKEN, LIB_TRIGGER_KEY, CRON_SECRET e, opcional,
// GOOGLE_BOOKS_KEY. No banco: supabase/migrations/20261015_biblioteca_planilha.sql.
// ============================================================
import { timingSafeEqual } from "node:crypto";
import { rpc } from "./_lib/fonte.mjs";
import { readSheet, downloadCover, findCoverOnline } from "./_lib/planilha.mjs";
import { esc, page } from "./_lib/acesso.mjs";

const TIME_BUDGET_MS = 48000; // a função pode rodar até 60 s (vercel.json)
const MAX_ONLINE = 12; // buscas na internet por vez
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

const sameSecret = (a, b) => {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
};

export async function runLibrarySync() {
  const t0 = Date.now();
  const sheetId = process.env.LIB_SHEET_ID;
  const key = process.env.LIB_SYNC_TOKEN;
  if (!sheetId || !key) return { ok: false, status: 500, error: "Faltam LIB_SHEET_ID e LIB_SYNC_TOKEN na Vercel." };

  let sheet;
  try {
    sheet = await readSheet(sheetId);
  } catch (e) {
    console.error("biblioteca-sync: planilha", e.message, e.url || "");
    const why = e.status ? ` (o Google respondeu ${e.status})` : /aba/.test(e.message) ? `: ${e.message}` : "";
    return { ok: false, status: 502, error: `Não consegui ler a planilha agora${why}. Tente de novo em alguns minutos.` };
  }

  let res;
  try {
    res = await rpc("library_sync_apply", {
      p_key: key,
      p_rows: sheet.rows.map(({ title, author, category, synopsis, owner }) => ({ title, author, category, synopsis, owner })),
    });
  } catch (e) {
    console.error("biblioteca-sync: banco", e.message);
    if (e.missing) return { ok: false, status: 503, error: "Falta rodar supabase/migrations/20261015_biblioteca_planilha.sql no Supabase." };
    return { ok: false, status: 502, error: "O banco recusou a sincronização." };
  }
  if (!res?.ok) return { ok: false, status: 429, error: "A planilha acabou de ser conferida. Tente de novo daqui a 30 segundos." };

  const added = new Set(res.added.map((a) => a.id));
  const out = { ok: true, novos: res.added.map((a) => a.title), capasPlanilha: 0, capasInternet: 0, semCapa: [], pendentes: 0, livrosNaPlanilha: sheet.rows.length, abas: sheet.tabs.length, avisos: sheet.warnings };
  let online = 0;
  for (const b of res.needCover) {
    if (Date.now() - t0 > TIME_BUDGET_MS) {
      out.pendentes++;
      continue;
    }
    const row = Number.isInteger(b.row) ? sheet.rows[b.row] : null;
    if (row?.img) {
      try {
        const img = await downloadCover(row.img);
        await rpc("library_set_cover", { p_key: key, p_book: b.id, p_mime: img.mime, p_data: img.base64 });
        out.capasPlanilha++;
        continue;
      } catch (e) {
        console.warn("biblioteca-sync: capa da planilha", b.title, e.message);
      }
    }
    // Na internet, só para livro que acabou de entrar (os antigos sem capa já foram vistos pela equipe).
    if (added.has(b.id) && online < MAX_ONLINE) {
      online++;
      const url = await findCoverOnline(b.title, b.author, process.env.GOOGLE_BOOKS_KEY || "");
      if (url) {
        try {
          await rpc("library_set_cover", { p_key: key, p_book: b.id, p_url: url });
          out.capasInternet++;
          continue;
        } catch (e) {
          console.warn("biblioteca-sync: capa da internet", b.title, e.message);
        }
      }
    }
    if (added.has(b.id)) out.semCapa.push(b.title);
  }
  console.log("biblioteca-sync:", JSON.stringify({ novos: out.novos.length, capasPlanilha: out.capasPlanilha, capasInternet: out.capasInternet, semCapa: out.semCapa.length, pendentes: out.pendentes, ms: Date.now() - t0 }));
  return out;
}

const resultHTML = (r) =>
  r.ok
    ? `<h1>✅ Acervo atualizado</h1>
       <p>${r.novos.length ? `<strong>${r.novos.length} ${r.novos.length === 1 ? "livro novo entrou" : "livros novos entraram"}</strong> no site:` : "Nenhum livro novo na planilha desde a última conferência."}</p>
       ${r.novos.length ? `<ul>${r.novos.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
       ${r.capasPlanilha + r.capasInternet ? `<p>${r.capasPlanilha + r.capasInternet} capa(s) adicionada(s)${r.capasInternet ? ` (${r.capasInternet} achada(s) na internet — confira se é a edição certa)` : ""}.</p>` : ""}
       ${r.semCapa.length ? `<p>Sem capa ainda: ${r.semCapa.map(esc).join(", ")}. Cole a imagem na coluna “Capa” da planilha e atualize de novo.</p>` : ""}
       ${r.pendentes ? `<p>Ainda faltam ${r.pendentes} capa(s): toque em atualizar de novo.</p>` : ""}
       <a class="link" href="/biblioteca">Ver a biblioteca</a>`
    : `<h1>Não deu para atualizar agora</h1><p>${esc(r.error)}</p><a class="link" href="/biblioteca">Ver a biblioteca</a>`;

export async function GET(request) {
  const url = new URL(request.url);
  const cron = process.env.CRON_SECRET;
  if (cron && sameSecret(request.headers.get("authorization"), `Bearer ${cron}`)) {
    const r = await runLibrarySync();
    return json(r.ok ? 200 : r.status || 500, r);
  }
  const chave = url.searchParams.get("chave");
  if (chave && sameSecret(chave, process.env.LIB_TRIGGER_KEY)) {
    const r = await runLibrarySync();
    return page("Biblioteca", resultHTML(r), r.ok ? 200 : r.status || 500);
  }
  return page("Link inválido", `<h1>Link inválido</h1><p>Peça o link de atualização a quem cuida do site.</p>`, 401);
}

export async function POST(request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return json(403, { error: "Origem não permitida." });
  const jwt = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt || jwt.length > 4096) return json(401, { error: "Faça login no painel." });
  const isAdmin = await rpc("is_site_admin", {}, jwt).catch((e) => (e.status === 401 ? "expirou" : null));
  if (isAdmin === "expirou") return json(401, { error: "Sessão expirada. Entre de novo no painel." });
  if (isAdmin !== true) return json(403, { error: "Sem permissão. Confirme o acesso ao painel pelo e-mail." });
  const r = await runLibrarySync();
  const trigger = process.env.LIB_TRIGGER_KEY;
  // O painel mostra o link da equipe (a chave fica só no servidor).
  return json(r.ok ? 200 : r.status || 500, { ...r, linkEquipe: trigger ? `${url0(request)}/api/biblioteca-sync?chave=${encodeURIComponent(trigger)}` : "" });
}

const url0 = (request) => new URL(request.url).origin;
