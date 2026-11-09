// ============================================================
// GET /api/dados — os dados públicos que TODO visitante pede igual
// ------------------------------------------------------------
// Ao abrir o site, cada navegador fazia 9 consultas ao Supabase
// (configurações, eventos, vídeos, cultos, avisos, departamentos, notícias,
// tipos de oferta e podcasts), mais a Lição da semana da página inicial,
// todas com o mesmo resultado para todo mundo.
// Esta função faz essas 9 consultas uma vez e o pacote fica 1 minuto no
// cache da Vercel (e até 2 min servindo a cópia anterior enquanto renova):
// mil pessoas abrindo o site viram ~1 consulta por minuto ao Supabase.
// O site (loadData em js/core.js) usa este pacote e, se ele falhar, faz as
// consultas diretas de sempre. O painel continua lendo tudo fresco.
// Mudança feita no painel aparece para os visitantes em até ~1 min (com o
// site parado, o primeiro visitante depois de 1 a 3 min ainda pega a cópia
// anterior, e a Vercel já renova para o próximo).
// Mantenha as consultas iguais às de loadData/LIST_QUERIES em js/core.js.
// Só leitura, com a chave publicável: o RLS mostra só o que é público.
//
// GET /api/dados?o=ao-vivo — a igreja está transmitindo agora? (o botão "Ao
// vivo" vermelho, conferirAoVivo em js/site.js; leitura em _lib/aovivo.mjs).
// Fica aqui dentro, e não numa função própria, porque o plano grátis da
// Vercel aceita no máximo 12 funções por publicação (scripts/verificar.mjs
// confere). Resposta: { aoVivo: true, videoId, titulo } ou { aoVivo: false };
// 1 min no cache: o YouTube é consultado no máximo 1 vez por minuto.
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY } from "./_lib/fonte.mjs";
import { statusDoCanal } from "./_lib/aovivo.mjs";

const VIDEOS = "id,title,youtube_url,youtube_id,category,date,description,source,created_at";
const NEWS = "id,title,slug,summary,content,cover_image,published_at,author,featured,published,created_at,source_id,source_url,source_name,dismissed";
const PODCASTS = "id,title,description,episode_number,cover_url,audio_url,spotify_url,youtube_url,published_at,status,created_at";
// Lição da semana da página inicial (ebdLoadCurrent em js/ebd.js)
const EBD = "id,quarter_id,number,lesson_date,title,golden_ref,reading_ref,source_url,key_idea,summary,daily_refs,questions,status,publish_at,quarter:ebd_quarters!inner(id,year,quarter,magazine,magazine_slug,theme,start_date,lesson_count,visible)";

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
    ebdAtual: [`ebd_lessons?select=${EBD}&lesson_date=gte.${diaEmSP(-21)}&lesson_date=lte.${diaEmSP(13)}&order=lesson_date.asc`],
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

const umMinuto = (corpo, segundos = 60) =>
  Response.json(corpo, { headers: { "Cache-Control": `public, max-age=0, s-maxage=${segundos}, stale-while-revalidate=${segundos}` } });

async function aoVivo() {
  try {
    const { data, error } = await ler("settings?id=eq.main&select=canal:data->church->>liveChannelId", true);
    if (error) throw new Error(`settings: ${error}`); // não confundir com "sem canal cadastrado"
    const status = await statusDoCanal(String(data?.canal || "").trim());
    return umMinuto({ ...status, conferidoEm: new Date().toISOString() });
  } catch (e) {
    console.error("ao-vivo:", e.message);
    return umMinuto({ aoVivo: false, erro: true }, 30); // na dúvida, não acende
  }
}

export async function GET(request) {
  if (new URL(request.url).searchParams.get("o") === "ao-vivo") return aoVivo();
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
        "Cache-Control": falhas ? "public, max-age=0, s-maxage=10" : "public, max-age=0, s-maxage=60, stale-while-revalidate=120",
      },
    },
  );
}
