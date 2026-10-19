// ============================================================
// Notícias da AD Belém – Sede (ad.org.br): leitura e filtro
// ------------------------------------------------------------
// A sede publica as notícias num WordPress com API pública (a mesma que
// alimenta o RSS do site). Daqui só sai o que um leitor de notícias mostra:
// TÍTULO, DATA, um RESUMO curto e o LINK para ler lá. O texto inteiro e as
// fotos não são copiados (direito autoral da sede, Lei 9.610/98).
//
// Filtro "notícia que importa": fica de fora o que é pessoal ou rotina
// (aniversário e homenagem a pessoas, transição de pastor em outro setor,
// boletins diários repetidos de um mesmo evento); entra o que tem assunto da
// igreja (batismo, Ceia, EBD/EBO, missões, Círculo de Oração, congressos,
// campanhas…). Mesmo assim tudo chega como SUGESTÃO: a equipe publica.
//
// Datas: vale a data em que a sede publicou (o WordPress dá no horário de
// São Paulo); só entram notícias dos últimos DIAS_RECENTES dias.
// ============================================================
import { SITE_URL } from "./site.mjs";

export const SEDE_HOST = "https://ad.org.br";
export const SEDE_NOME = "AD Belém – Sede";
export const DIAS_RECENTES = 30;
const UA = `AD-Belem-Pq-Artur-Alvim-Noticias/1.0 (+${SITE_URL})`;

const semAcento = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", ndash: "–", mdash: "—", laquo: "«", raquo: "»", ordm: "º", ordf: "ª" };
export function textoLimpo(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

// Resumo curto (até ~280 caracteres, cortado em palavra inteira).
export function resumoCurto(html, max = 280) {
  const bruto = textoLimpo(html);
  const cortado = /(\[…\]|\[\.\.\.\]|…|Leia mais.*|Continue lendo.*)\s*$/i.test(bruto); // a sede já cortou o texto
  const t = bruto.replace(/\s*(\[…\]|\[\.\.\.\]|…|Leia mais.*|Continue lendo.*)\s*$/i, "").trim();
  if (t.length <= max) return cortado && t ? t.replace(/[,;:.\s]+$/, "") + "…" : t;
  return t.slice(0, max).replace(/\s+\S*$/, "").replace(/[,;:.\s]+$/, "") + "…";
}

// ---------- Filtro ----------
// Sempre entra (institucional), mesmo que o título fale em "homenagem".
const SEMPRE = [/anos de fundacao/, /anos de evangelizacao/, /aniversario da (igreja|assembleia|ad\b)/, /\bsenado\b/, /camara (municipal|dos deputados)/, /sessao solene/];
// Fica de fora (pessoal ou rotina).
const FORA = [
  [/\bcompleta \d+ anos\b/, "aniversário"],
  [/aniversari/, "aniversário"],
  [/\banos de vida\b/, "aniversário"],
  [/\b\d+ anos do (pastor|pr\b|presidente|bispo|missionario)/, "aniversário"],
  [/homenag/, "homenagem a pessoa"],
  [/transic(ao|oes) pastora/, "transição pastoral"],
  [/\bsubstitui\b|\bposse do pastor\b|\bassume o setor\b/, "transição pastoral"],
  [/autografo/, "evento pessoal"],
  [/falec|\bluto\b|velorio|sepultamento/, "falecimento"],
  [/\brelembrando\b|\bfaltam \d+ dias\b/, "repetida"],
  [/\b(chega ao (?!fim)|chega a mais|entra na|entra em|continua\b|prossegue|avanca|tem continuidade|segue com)/, "boletim diário"],
  [/\bresumo\b|\b\d+[oº]? dia\b|\b(segundo|terceiro|quarto|quinto|decimo|ultimo) dia\b|final de semana/, "boletim diário"],
];
// Assunto da igreja (pelo menos um, no título).
const DENTRO = [
  /batismo/, /ceia do senhor|santa ceia/, /escola biblica/, /\bebo\b/, /\bebd\b/, /miss(ao|oes)/, /circulo de oracao/, /oracao|vigilia|jejum/,
  /crianc|jovens|juventude|mocidade|adolescentes|familia/, /\bculto\b/, /congresso|conferencia|encontro|convencao|assembleia geral|seminario/,
  /cgadb|confradesp/, /revista|trimestre|\blic(ao|oes)\b/, /campanha|arrecada|doac|acao social|\bsocial\b/, /consagra/, /inaugura|templo/, /evangeliz/,
];

export function classificar(titulo) {
  const t = semAcento(titulo);
  if (SEMPRE.some((r) => r.test(t))) return { entra: true, motivo: "institucional" };
  const fora = FORA.find(([r]) => r.test(t));
  if (fora) return { entra: false, motivo: fora[1] };
  if (DENTRO.some((r) => r.test(t))) return { entra: true, motivo: "assunto da igreja" };
  return { entra: false, motivo: "sem assunto da igreja" };
}

// "Ceia do Senhor leva milhares…" → "ceia-do-senhor-leva-milhares"
export function slugDe(titulo, id) {
  const base = semAcento(titulo)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
  return `sede-${id}-${base || "noticia"}`;
}

// Lê as notícias recentes da sede. Devolve só o que pode ir para o site.
export async function lerNoticiasSede({ agora = new Date(), fetchImpl = fetch } = {}) {
  const desde = new Date(agora.getTime() - DIAS_RECENTES * 86400000).toISOString().slice(0, 19);
  const url = `${SEDE_HOST}/wp-json/wp/v2/posts?per_page=40&orderby=date&order=desc&after=${desde}&_fields=id,date,title,link,excerpt`;
  const res = await fetchImpl(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw Object.assign(new Error(`O site da sede respondeu ${res.status}`), { status: 502 });
  const lista = await res.json();
  if (!Array.isArray(lista)) throw Object.assign(new Error("Resposta inesperada do site da sede"), { status: 502 });
  const hoje = agora.toISOString().slice(0, 10);
  return lista.map((p) => {
    const titulo = textoLimpo(p?.title?.rendered).slice(0, 300);
    const data = String(p?.date || "").slice(0, 10); // dia em que a sede publicou (horário de São Paulo)
    const link = String(p?.link || "");
    const valido = /^\d+$/.test(String(p?.id)) && titulo && /^\d{4}-\d{2}-\d{2}$/.test(data) && data <= hoje && link.startsWith(SEDE_HOST + "/");
    const c = valido ? classificar(titulo) : { entra: false, motivo: "dados incompletos" };
    return {
      source_id: `adbelem:${p?.id}`,
      title: titulo,
      summary: resumoCurto(p?.excerpt?.rendered),
      url: link,
      date: data,
      slug: slugDe(titulo, p?.id),
      entra: c.entra,
      motivo: c.motivo,
    };
  });
}
