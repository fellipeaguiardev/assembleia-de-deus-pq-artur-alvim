// ============================================================
// sync-youtube — importa os vídeos/lives novos do canal do YouTube
// para a tabela "videos". Roda a cada 10 min (pg_cron) e também
// pelo botão "Sincronizar agora" no painel.
//
// - Usa o feed RSS público do canal (sem chave de API).
// - Só INSERE vídeos novos: nunca altera ou recria o que já existe,
//   então edições e vídeos ocultados pelo admin são respeitados.
// - O ID do canal vem das configurações do site (church.liveChannelId).
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const FALLBACK_CHANNEL_ID = "UCUzpqNZG604k3E_GDDdGgXQ";

const MONTHS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const decode = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();

const pick = (xml: string, tag: string) => {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? decode(m[1]) : "";
};

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// "Culto Público - 01 de outubro de 2026" → "2026-10-01"
function dateFromTitle(title: string): string | null {
  const m = normalize(title).match(/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/);
  if (!m || !MONTHS[m[2]]) return null;
  return `${m[3]}-${String(MONTHS[m[2]]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

// Data de publicação no fuso de São Paulo
function localDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

// Remove da descrição as linhas de redes sociais e links (já ficam no rodapé
// do site) e a linha que só repete o título.
const SOCIAL_LINE = /^(instagram|facebook|tiktok|whatsapp|twitter|x|youtube|spotify|site)\s*:/i;

function cleanDescription(desc: string, title: string): string {
  const flat = (s: string) => normalize(s).replace(/\s+/g, " ").trim();
  const t = flat(title);
  return desc
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !SOCIAL_LINE.test(l) && !/https?:\/\//i.test(l) && !t.startsWith(flat(l)))
    .join("\n")
    .slice(0, 600);
}

function guessCategory(title: string): string {
  const t = normalize(title);
  if (/ebd|escola biblica|estudo/.test(t)) return "Estudos";
  if (/jovens|juventude|mocidade|umadeb|adolescentes/.test(t)) return "Jovens";
  if (/congresso|conferencia|confraternizacao|aniversario|batismo|santa ceia/.test(t)) return "Eventos";
  return "Cultos";
}

// Quem pode disparar a sincronização:
//  - o agendamento (pg_cron), que manda o header x-cron-secret igual ao
//    segredo CRON_SECRET (supabase secrets set CRON_SECRET=...);
//  - um admin com a entrada liberada no painel ("Sincronizar agora"): quem
//    responde é o banco, pela função public.is_admin() chamada com o login da
//    própria pessoa — está em public.admins E a sessão foi liberada por e-mail
//    (vale 12 h). A lista de admins fica só na tabela, não no código.
// Qualquer outra chamada é recusada, inclusive enquanto CRON_SECRET não existir.
function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function isAuthorized(req: Request): Promise<boolean> {
  if (sameSecret(req.headers.get("x-cron-secret") ?? "", Deno.env.get("CRON_SECRET") ?? "")) return true;
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  // Cliente com a chave pública + o token de quem chamou: a RPC roda com as
  // permissões dessa pessoa (com a chave pública sozinha, is_admin() dá false).
  const asCaller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await asCaller.rpc("is_admin");
  if (error) {
    console.error("is_admin:", error.message);
    return false;
  }
  return data === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  if (!(await isAuthorized(req))) {
    return Response.json({ ok: false, error: "Não autorizado" }, { status: 401, headers: cors });
  }
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { data: settings } = await supabase.from("settings").select("data").eq("id", "main").maybeSingle();
    const configured = String(settings?.data?.church?.liveChannelId ?? "").trim();
    const channelId = /^UC[\w-]{20,}$/.test(configured) ? configured : FALLBACK_CHANNEL_ID;

    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
    if (!res.ok) throw new Error(`Feed do YouTube respondeu ${res.status}`);
    const xml = await res.text();

    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => {
      const id = pick(e, "yt:videoId");
      const title = pick(e, "title");
      const published = pick(e, "published");
      return {
        youtube_id: id,
        youtube_url: `https://www.youtube.com/watch?v=${id}`,
        title,
        description: cleanDescription(pick(e, "media:description"), title),
        date: dateFromTitle(title) ?? (published ? localDate(published) : null),
        category: guessCategory(title),
        source: "auto",
      };
    }).filter((v) => v.youtube_id);

    if (!entries.length) {
      return Response.json({ ok: true, channelId, checked: 0, inserted: 0 }, { headers: cors });
    }

    // Insere só o que ainda não existe (ignora duplicados pelo youtube_id).
    const { data: inserted, error } = await supabase
      .from("videos")
      .upsert(entries, { onConflict: "youtube_id", ignoreDuplicates: true })
      .select("id,title");
    if (error) throw error;

    return Response.json(
      { ok: true, channelId, checked: entries.length, inserted: inserted?.length ?? 0, titles: inserted?.map((v) => v.title) },
      { headers: cors },
    );
  } catch (e) {
    console.error(e); // detalhe fica só no log do Supabase
    return Response.json({ ok: false, error: "Falha ao sincronizar" }, { status: 500, headers: cors });
  }
});
