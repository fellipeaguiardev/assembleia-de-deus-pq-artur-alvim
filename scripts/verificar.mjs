#!/usr/bin/env node
// ============================================================
// Checagem automática do repositório (roda no GitHub Actions a cada push
// e também no computador:  node scripts/verificar.mjs ).
//
//  1. Sintaxe: node --check em js/*.js, sw.js e api/**/*.mjs.
//  2. Arquivos citados: tudo que index.html, sw.js (lista SHELL) e
//     manifest.webmanifest carregam precisa existir no repositório.
//     version.json fica de fora: é gerado na publicação.
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
const DOMINIOS = [/^https:\/\/assembleia-de-deus-pq-artur-alvim\.vercel\.app/];
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
console.log(`Arquivos citados: ${nHtml} no index.html, ${nSw} no sw.js, ${nManifest} no manifest.`);

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
