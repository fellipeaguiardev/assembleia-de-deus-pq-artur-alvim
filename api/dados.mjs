// ============================================================
// GET /api/dados — os dados públicos que TODO visitante pede igual
// ------------------------------------------------------------
// Ao abrir o site, cada navegador fazia 9 consultas ao Supabase
// (configurações, eventos, vídeos, cultos, avisos, departamentos, notícias,
// tipos de oferta e podcasts), todas com o mesmo resultado para todo mundo.
// Esta função faz essas 9 consultas uma vez e o pacote fica 1 minuto no
// cache da Vercel (e até 10 min servindo a cópia anterior enquanto renova):
// mil pessoas abrindo o site viram ~1 consulta por minuto ao Supabase.
// O site (loadData em js/core.js) usa este pacote e, se ele falhar, faz as
// consultas diretas de sempre. O painel continua lendo tudo fresco.
// Mudança feita no painel aparece para os visitantes em até ~1 min.
// Mantenha as consultas iguais às de loadData/LIST_QUERIES em js/core.js.
// Só leitura, com a chave publicável: o RLS mostra só o que é público.
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY } from "./_lib/fonte.mjs";

const VIDEOS = "id,title,youtube_url,youtube_id,category,date,description,source,created_at";
const NEWS = "id,title,slug,summary,content,cover_image,published_at,author,featured,published,created_at,source_id,source_url,source_name,dismissed";
const PODCASTS = "id,title,description,episode_number,cover_url,audio_url,spotify_url,youtube_url,published_at,status,created_at";

const diaEmSP = (desloc = 0) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + desloc * 864e5));

function consultas() {
  const hoje = diaEmSP();
  const ontem = diaEmSP(-1);
  return {
    settings: ["settings?select=data&id=eq.main", true],
    events: [`events?select=*&date=gte.${ontem}&order=date.asc`],
    videos: [`videos?select=${VIDEOS}&hidden=eq.false&order=date.desc,created_at.desc&limit=12`],
    services: ["services?select=*"],
    announcements: [`announcements?select=*&or=(end_date.is.null,end_date.gte.${hoje})`],
    ministries: ["ministries?select=*"],
    news: [`news?select=${NEWS}&published=eq.true&order=published_at.desc&limit=20`],
    donationTypes: ["donation_types?select=*&order=sort_order.asc"],
    podcasts: [`podcasts?select=${PODCASTS}&status=eq.Publicado&order=published_at.desc&limit=8`],
  };
}

// { data, error } — o mesmo formato que o supabase-js devolve no navegador
async function ler(caminho, umaLinha) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { data: null, error: `HTTP ${res.status}` };
    const linhas = await res.json();
    return { data: umaLinha ? (linhas[0] ?? null) : linhas, error: null };
  } catch (e) {
    return { data: null, error: e.name === "TimeoutError" ? "demorou demais" : "sem resposta" };
  }
}

export async function GET() {
  const lista = Object.entries(consultas());
  const resultados = await Promise.all(lista.map(([, [caminho, umaLinha]]) => ler(caminho, umaLinha)));
  const pacote = Object.fromEntries(lista.map(([chave], i) => [chave, resultados[i]]));
  const falhas = resultados.filter((r) => r.error).length;
  if (falhas === resultados.length) return Response.json({ error: "Supabase sem resposta." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return Response.json(
    { ...pacote, geradoEm: new Date().toISOString() },
    {
      headers: {
        // Com alguma consulta falhando, guarda por pouco tempo (o site refaz só a que falhou).
        "Cache-Control": falhas ? "public, max-age=0, s-maxage=10" : "public, max-age=0, s-maxage=60, stale-while-revalidate=600",
      },
    },
  );
}
