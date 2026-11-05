// ============================================================
// Teste de carga (k6): várias pessoas usando o site ao mesmo tempo.
// ------------------------------------------------------------
// Cada "pessoa" (VU) faz o que um navegador faz ao abrir o site:
//   1. abre uma página (mais o início, os cultos e a Palavra Diária);
//   2. busca os dados públicos: /api/dados (um pacote só, guardado no cache
//      da Vercel), ou, com FONTE=supabase, as 9 consultas diretas ao
//      Supabase que o site fazia antes do cache;
//   3. confere se há transmissão ao vivo (/api/dados?o=ao-vivo);
//   4. "lê" de 8 a 20 segundos e abre outra página.
// Não grava nada, não manda formulário, não usa o painel.
//
// Perfis (PERFIL=…):
//   fumaca  20 pessoas por 30 s (roda depois de cada publicação)
//   rampa   sobe aos poucos até MAX pessoas (padrão 1000) e segura 2 min
// O teste PARA SOZINHO se passar de 5% de erros ou se 95% das respostas
// passarem de 5 s: não derruba quem está usando o site de verdade nem gasta
// cota à toa (Vercel e Supabase grátis têm limite mensal).
//
//   k6 run tests/carga/visitante.js                       (fumaça, produção)
//   k6 run -e PERFIL=rampa -e MAX=1000 tests/carga/visitante.js
//   k6 run -e BASE=https://outro-endereco tests/carga/visitante.js
// ============================================================
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

const BASE = (__ENV.BASE || "https://assembleia-de-deus-pq-artur-alvim.vercel.app").replace(/\/+$/, "");
const SUPABASE = "https://rtludbkopxbhiwlwycid.supabase.co/rest/v1";
const CHAVE = "sb_publishable_eRsl3xo3p7Qe_DanIB4Z7A_5V6Q0p9m"; // pública (a mesma do site)
const PERFIL = __ENV.PERFIL || "fumaca";
const MAX = Number(__ENV.MAX || 1000);
const FONTE = __ENV.FONTE || "api"; // "api" (cache da Vercel) ou "supabase" (como era antes)

const PERFIS = {
  fumaca: { executor: "constant-vus", vus: 20, duration: "30s" },
  rampa: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "30s", target: Math.min(50, MAX) },
      { duration: "1m", target: Math.min(200, MAX) },
      { duration: "1m", target: Math.min(500, MAX) },
      { duration: "1m", target: MAX },
      { duration: "2m", target: MAX },
      { duration: "30s", target: 0 },
    ],
    gracefulRampDown: "20s",
  },
};

// 95% das respostas abaixo disto (o teste curto tem mais peso das primeiras
// respostas, logo depois de publicar; por isso tolera um pouco mais)
const P95_MS = Number(__ENV.P95_MS || (PERFIL === "fumaca" ? 2000 : 1500));

export const options = {
  scenarios: { visitantes: PERFIS[PERFIL] },
  thresholds: {
    // aviso (o teste falha no fim, mas não para)
    http_req_failed: ["rate<0.01", { threshold: "rate<0.05", abortOnFail: true, delayAbortEval: "20s" }],
    "http_req_duration{tipo:pagina}": [`p(95)<${P95_MS}`],
    "http_req_duration{tipo:dados}": [`p(95)<${P95_MS}`],
    "http_req_duration{tipo:ao-vivo}": [`p(95)<${P95_MS}`],
    // freio de emergência: tudo muito lento por 30 s → para
    http_req_duration: [{ threshold: "p(95)<5000", abortOnFail: true, delayAbortEval: "30s" }],
    checks: ["rate>0.99"],
    bloqueado: ["count<1"], // a Vercel/Supabase passou a recusar (429/403): o teste fica vermelho
  },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "max"],
  userAgent: "k6-teste-de-carga (AD Belem Pq. Artur Alvim; tests/carga/visitante.js)",
};

const bloqueado = new Counter("bloqueado");
const PAGINAS = [
  ["/", 40],
  ["/cultos", 15],
  ["/palavra", 15],
  ["/biblia/joao/3", 10],
  ["/videos", 10],
  ["/eventos", 5],
  ["/podcast", 5],
];
const SORTEIO = PAGINAS.flatMap(([p, peso]) => Array(peso).fill(p));
const COMPRIME = { "Accept-Encoding": "gzip, br" };

function hojeSP(deslocDias = 0) {
  const d = new Date(Date.now() - 3 * 3600e3 + deslocDias * 864e5); // Brasília (UTC-3)
  return d.toISOString().slice(0, 10);
}

function consultasSupabase() {
  const h = { headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, ...COMPRIME }, tags: { tipo: "dados" } };
  return [
    `settings?select=data&id=eq.main`,
    `events?select=*&date=gte.${hojeSP(-1)}&order=date.asc`,
    `videos?select=id,title,youtube_url,youtube_id,category,date,description,source,created_at&hidden=eq.false&order=date.desc,created_at.desc&limit=12`,
    `services?select=*`,
    `announcements?select=*&or=(end_date.is.null,end_date.gte.${hojeSP()})`,
    `ministries?select=*`,
    `news?select=id,title,slug,summary,content,cover_image,published_at,author,featured,published,created_at,source_id,source_url,source_name,dismissed&published=eq.true&order=published_at.desc&limit=20`,
    `donation_types?select=*&order=sort_order.asc`,
    `podcasts?select=id,title,description,episode_number,cover_url,audio_url,spotify_url,youtube_url,published_at,status,created_at&status=eq.Publicado&order=published_at.desc&limit=8`,
  ].map((q) => ["GET", `${SUPABASE}/${q}`, null, h]);
}

// Aquecimento: uma visita antes de começar (função "fria" logo depois de
// publicar não conta como lentidão). Fica de fora dos limites por tipo.
export function setup() {
  const alvos = ["/", "/cultos", "/palavra", "/biblia/joao/3", "/videos", "/eventos", "/podcast", "/api/dados?o=ao-vivo", FONTE === "supabase" ? null : "/api/dados"].filter(Boolean);
  http.batch(alvos.map((p) => ["GET", BASE + p, null, { headers: COMPRIME, tags: { tipo: "aquecimento" } }]));
}

function anotar(res) {
  if (res.status === 429 || res.status === 403) bloqueado.add(1, { status: String(res.status) });
}

export default function () {
  const pagina = SORTEIO[Math.floor(Math.random() * SORTEIO.length)];

  // 1. a página
  const html = http.get(BASE + pagina, { headers: COMPRIME, tags: { tipo: "pagina" } });
  anotar(html);
  check(html, { "página abriu (200)": (r) => r.status === 200 && r.body.includes('id="siteRoot"') });

  // 2. os dados públicos
  if (FONTE === "supabase") {
    const rs = http.batch(consultasSupabase());
    rs.forEach(anotar);
    check(rs, { "9 consultas ao Supabase (200)": (lista) => lista.every((r) => r.status === 200) });
  } else {
    const d = http.get(`${BASE}/api/dados`, { headers: COMPRIME, tags: { tipo: "dados" } });
    anotar(d);
    check(d, { "dados (200, com cultos)": (r) => r.status === 200 && Array.isArray(r.json("services")) });
  }

  // 3. transmissão ao vivo
  const aoVivo = http.get(`${BASE}/api/dados?o=ao-vivo`, { headers: COMPRIME, tags: { tipo: "ao-vivo" } });
  anotar(aoVivo);
  check(aoVivo, { "ao vivo (200)": (r) => r.status === 200 && typeof r.json("aoVivo") === "boolean" });

  // 4. lendo a página
  sleep(8 + Math.random() * 12);
}

// Resumo em português (e o JSON completo em tests/carga/resultados/, fora do git)
export function handleSummary(d) {
  const m = d.metrics;
  const ms = (v) => (v == null ? "–" : `${Math.round(v)} ms`);
  const linha = (nome, chave) => {
    const t = m[chave]?.values;
    return t ? `  ${nome.padEnd(22)} mediana ${ms(t.med).padStart(8)}   95% até ${ms(t["p(95)"]).padStart(8)}   pior ${ms(t.max).padStart(8)}` : `  ${nome.padEnd(22)} –`;
  };
  const falhas = m.http_req_failed?.values?.rate ?? 0;
  const reqs = m.http_reqs?.values?.count ?? 0;
  const vusMax = m.vus_max?.values?.max ?? 0;
  const limites = Object.entries(m)
    .filter(([, v]) => v.thresholds)
    .flatMap(([k, v]) => Object.entries(v.thresholds).map(([t, r]) => `  ${r.ok ? "ok  " : "FALHOU"} ${k} ${t}`));
  const texto = [
    "",
    `Teste de carga — perfil ${PERFIL}${PERFIL === "rampa" ? ` (até ${MAX} pessoas)` : ""}, dados via ${FONTE}, ${BASE}`,
    `  pessoas ao mesmo tempo (máx.) ${vusMax}   requisições ${reqs}   erros ${(falhas * 100).toFixed(2)}%   bloqueios ${m.bloqueado?.values?.count ?? 0}`,
    linha("página", "http_req_duration{tipo:pagina}"),
    linha("dados públicos", "http_req_duration{tipo:dados}"),
    linha("ao vivo", "http_req_duration{tipo:ao-vivo}"),
    "",
    "Limites:",
    ...limites,
    "",
  ].join("\n");
  const nome = `tests/carga/resultados/${PERFIL}-${FONTE}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  return { stdout: texto, [nome]: JSON.stringify(d, null, 1) };
}
