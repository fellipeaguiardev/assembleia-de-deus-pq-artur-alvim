#!/usr/bin/env node
// ============================================================
// Checagem automática do repositório (roda no GitHub Actions a cada push
// e também no computador:  node scripts/verificar.mjs ).
//
//  1. Sintaxe: node --check em js/*.js, sw.js e api/**/*.mjs.
//  2. Arquivos citados: tudo que index.html, sw.js (lista SHELL) e
//     manifest.webmanifest carregam precisa existir no repositório, e
//     também os /js/… e /css/… citados no próprio JS (ex.: o painel,
//     carregado sob demanda por js/core.js). version.json fica de fora:
//     é gerado na publicação.
//  2b. Rotas: as páginas de ROUTE_BASES (js/compartilhado.js) e os "case"
//     do roteador (pageHTML em js/site.js) são as mesmas.
//  2d. Funções: no máximo 12 em api/ (limite do plano grátis da Vercel por
//     publicação; acima disso a Vercel recusa a publicação inteira).
//  2c. Migrations: supabase/migrations/ só com nomes que o CLI do Supabase
//     aceita (14 dígitos + _nome.sql, versões sem repetir) e o baseline primeiro.
//  3. Segredos: chave secreta do Supabase (sb_secret_…), JWT com papel
//     service_role, "service_role" com valor, blocos -----BEGIN … e
//     arquivos .env no git.
//
// Sem dependências: só Node e git. Termina com código 1 se algo falhar.
// ============================================================
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ESTE = relative(RAIZ, fileURLToPath(import.meta.url)).split(sep).join("/");
const falhas = [];
const falhar = (grupo, msg) => falhas.push(`[${grupo}] ${msg}`);
const ler = (arq) => readFileSync(join(RAIZ, arq), "utf8");

// ---------- 1) Sintaxe ----------
function listar(pasta, filtro) {
  const out = [];
  for (const nome of readdirSync(join(RAIZ, pasta))) {
    const rel = `${pasta}/${nome}`;
    if (statSync(join(RAIZ, rel)).isDirectory()) out.push(...listar(rel, filtro));
    else if (filtro(nome)) out.push(rel);
  }
  return out;
}
const paraChecar = [
  ...readdirSync(join(RAIZ, "js")).filter((n) => n.endsWith(".js")).map((n) => `js/${n}`),
  "sw.js",
  ...listar("api", (n) => n.endsWith(".mjs")),
];
for (const arq of paraChecar) {
  const r = spawnSync(process.execPath, ["--check", join(RAIZ, arq)], { encoding: "utf8" });
  if (r.status !== 0) falhar("sintaxe", `${arq}\n${(r.stderr || "").trim().split("\n").slice(0, 6).join("\n")}`);
}
console.log(`Sintaxe: ${paraChecar.length} arquivos conferidos.`);

// ---------- 2) Arquivos citados ----------
// Endereços do próprio site (absolutos) também contam, ex.: og:image.
const DOMINIOS = [/^https:\/\/(www\.)?adbelemparquealvim\.org\.br/, /^https:\/\/assembleia-de-deus-pq-artur-alvim\.vercel\.app/];
const GERADOS = new Set(["/version.json"]);
function caminhoLocal(valor) {
  let v = String(valor).trim();
  for (const d of DOMINIOS) v = v.replace(d, "");
  if (!v.startsWith("/") || v.startsWith("//")) return null; // externo ou relativo a outra coisa
  v = v.split(/[?#]/)[0];
  if (v === "/") return "/index.html";
  // Rotas do site (/cultos, /palavra…) não são arquivos: só confere o que tem extensão.
  return /\.[a-z0-9]+$/i.test(v.split("/").pop()) ? v : null;
}
function conferir(origem, valores) {
  let n = 0;
  for (const valor of valores) {
    const p = caminhoLocal(valor);
    if (!p || GERADOS.has(p)) continue;
    n++;
    if (!existsSync(join(RAIZ, decodeURIComponent(p)))) falhar("arquivos", `${origem} cita ${p}, que não existe`);
  }
  return n;
}
// index.html: src, href, content (og:image), srcset
const html = ler("index.html");
const doHtml = [];
for (const m of html.matchAll(/\s(?:src|href|content)\s*=\s*"([^"]*)"/g)) doHtml.push(m[1]);
for (const m of html.matchAll(/\ssrcset\s*=\s*"([^"]*)"/g)) doHtml.push(...m[1].split(",").map((s) => s.trim().split(/\s+/)[0]));
const nHtml = conferir("index.html", doHtml);
// sw.js: só a lista SHELL (o resto são prefixos de caminho, não arquivos)
const sw = ler("sw.js");
const shell = sw.match(/const SHELL\s*=\s*\[([\s\S]*?)\];/);
if (!shell) falhar("arquivos", "sw.js: não achei a lista SHELL");
const nSw = shell ? conferir("sw.js", [...shell[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1])) : 0;
// manifest.webmanifest: todo "src" e "url", em qualquer nível
let nManifest = 0;
try {
  const valores = [];
  (function andar(o) {
    if (Array.isArray(o)) return o.forEach(andar);
    if (o && typeof o === "object")
      for (const [k, v] of Object.entries(o)) {
        if ((k === "src" || k === "url") && typeof v === "string") valores.push(v);
        else andar(v);
      }
  })(JSON.parse(ler("manifest.webmanifest")));
  nManifest = conferir("manifest.webmanifest", valores);
} catch (e) {
  falhar("arquivos", `manifest.webmanifest não é um JSON válido: ${e.message}`);
}
// JS do site: caminhos "/js/…" e "/css/…" escritos no código (carregamento sob demanda)
let nJs = 0;
for (const arq of readdirSync(join(RAIZ, "js")).filter((n) => n.endsWith(".js"))) {
  const valores = [...ler(`js/${arq}`).matchAll(/["'`](\/(?:js|css)\/[\w./-]+\.(?:js|css))["'`]/g)].map((m) => m[1]);
  nJs += conferir(`js/${arq}`, valores);
}
console.log(`Arquivos citados: ${nHtml} no index.html, ${nSw} no sw.js, ${nManifest} no manifest, ${nJs} no JS.`);

// ---------- 2b) Rotas: a lista única (js/compartilhado.js) bate com o roteador ----------
await import(new URL("../js/compartilhado.js", import.meta.url));
const bases = globalThis.SITE_SHARED?.ROUTE_BASES || [];
const roteador = ler("js/site.js");
const corpo = roteador.slice(roteador.indexOf("function pageHTML("), roteador.indexOf("function notFoundPageHTML("));
const casos = new Set([...corpo.matchAll(/case\s+"([^"]+)"/g)].map((m) => m[1]));
for (const b of bases) if (!casos.has(b)) falhar("rotas", `"${b}" está em ROUTE_BASES (js/compartilhado.js) mas não tem case em pageHTML (js/site.js)`);
for (const c of casos) if (!bases.includes(c)) falhar("rotas", `pageHTML (js/site.js) tem case "${c}", que falta em ROUTE_BASES (js/compartilhado.js)`);
console.log(`Rotas: ${bases.length} páginas na lista única, todas no roteador.`);

// ---------- 2c) Migrations no formato do CLI do Supabase ----------
const MIG = "supabase/migrations";
const migs = readdirSync(join(RAIZ, MIG)).filter((f) => !f.startsWith(".")).sort();
const versoes = new Set();
for (const f of migs) {
  const m = f.match(/^(\d{14})_[a-z0-9_]+\.sql$/);
  if (!m) falhar("migrations", `${MIG}/${f}: nome fora do padrão do CLI (use: npx supabase@3 migration new <nome>)`);
  else if (versoes.has(m[1])) falhar("migrations", `${MIG}/${f}: versão ${m[1]} repetida`);
  else versoes.add(m[1]);
}
if (migs[0] !== "00000000000000_baseline.sql") falhar("migrations", `${MIG}: o primeiro arquivo precisa ser o 00000000000000_baseline.sql`);
console.log(`Migrations: ${migs.length} arquivos no formato do CLI.`);

// ---------- 2d) Funções da Vercel: no máximo 12 (plano grátis) ----------
const MAX_FUNCOES = 12;
function funcoes(pasta) {
  return readdirSync(join(RAIZ, pasta), { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith("_") || e.name.startsWith(".")) return []; // _lib, _fontes: não são funções
    const rel = `${pasta}/${e.name}`;
    if (e.isDirectory()) return funcoes(rel);
    return /\.(mjs|js|ts)$/.test(e.name) ? [rel] : [];
  });
}
const listaFuncoes = funcoes("api");
if (listaFuncoes.length > MAX_FUNCOES) falhar("funções", `${listaFuncoes.length} funções em api/ (o plano grátis da Vercel aceita ${MAX_FUNCOES}): junte alguma em outra`);
console.log(`Funções: ${listaFuncoes.length} de ${MAX_FUNCOES} (plano grátis da Vercel).`);

// ---------- 3) Segredos ----------
// Os padrões são montados em partes para este arquivo não acusar a si mesmo.
const PAD = {
  supabaseSecret: new RegExp("sb_" + "secret_[A-Za-z0-9_-]{8,}"),
  bloco: new RegExp("-----" + "BEGIN [A-Z0-9 ]+-----"),
  serviceRoleValor: new RegExp("service_" + "role[\\w\"' ]{0,20}[:=]\\s*[\"'`][^\"'`\\s]{20,}", "i"),
  jwt: /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
};
const BINARIO = /\.(png|jpe?g|gif|webp|ico|svg|woff2?|ttf|otf|pdf|mp3|mp4|zip)$/i;
const rastreados = execFileSync("git", ["ls-files", "-z"], { cwd: RAIZ, encoding: "utf8" }).split("\0").filter(Boolean);
let nLidos = 0;
for (const arq of rastreados) {
  const nome = arq.split("/").pop();
  if (/^\.env(\..+)?$/.test(nome) && !/\.example$/.test(nome)) falhar("segredos", `${arq}: arquivo .env no git`);
  if (arq === ESTE || BINARIO.test(arq) || !existsSync(join(RAIZ, arq))) continue;
  let txt;
  try {
    txt = ler(arq);
  } catch {
    continue;
  }
  nLidos++;
  const linhaDe = (i) => txt.slice(0, i).split("\n").length;
  for (const [tipo, re] of Object.entries({ supabaseSecret: PAD.supabaseSecret, bloco: PAD.bloco, serviceRoleValor: PAD.serviceRoleValor })) {
    const m = re.exec(txt);
    if (m) falhar("segredos", `${arq}:${linhaDe(m.index)}: ${tipo === "bloco" ? "bloco -----BEGIN" : tipo === "supabaseSecret" ? "chave secreta do Supabase" : "service_role com valor"}`);
  }
  // JWT: só acusa os de papel service_role (a chave anon é pública por natureza)
  for (const m of txt.matchAll(PAD.jwt)) {
    try {
      const corpo = JSON.parse(Buffer.from(m[0].split(".")[1], "base64url").toString("utf8"));
      if (corpo.role === "service_role") falhar("segredos", `${arq}:${linhaDe(m.index)}: JWT com papel service_role`);
    } catch {}
  }
}
console.log(`Segredos: ${nLidos} arquivos do git conferidos.`);

// ---------- Resultado ----------
if (falhas.length) {
  console.error(`\n${falhas.length} problema(s):\n` + falhas.map((f) => "  - " + f).join("\n"));
  process.exit(1);
}
console.log("\nTudo certo.");
