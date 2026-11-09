// ============================================================
// Sonda (k6): uma visita de teste ao site no ar, para o alerta de lentidão.
// ------------------------------------------------------------
// Roda a cada 30 min no GitHub Actions (.github/workflows/monitor.yml).
// Abre o início, a Palavra Diária, os dados públicos e o "ao vivo", 3 vezes.
// Falha (e o GitHub abre um aviso por e-mail) se algo der erro ou se o mais
// lento passar de LIMITE_MS (padrão 2500 ms).
//   k6 run tests/carga/sonda.js
// ============================================================
import http from "k6/http";
import { check } from "k6";

const BASE = (__ENV.BASE || "https://www.adbelemparquealvim.org.br").replace(/\/+$/, "");
const LIMITE_MS = Number(__ENV.LIMITE_MS || 2500);
const ALVOS = [
  ["/", "pagina"],
  ["/palavra", "pagina"],
  ["/api/dados", "dados"],
  ["/api/dados?o=ao-vivo", "ao-vivo"],
];

export const options = {
  vus: 1,
  iterations: 3,
  thresholds: {
    http_req_failed: ["rate==0"],
    // o pior de cada tipo: lento demais é alerta
    "http_req_duration{tipo:pagina}": [`max<${LIMITE_MS}`],
    "http_req_duration{tipo:dados}": [`max<${LIMITE_MS}`],
    "http_req_duration{tipo:ao-vivo}": [`max<${LIMITE_MS}`],
    checks: ["rate==1"],
  },
  userAgent: "k6-sonda (AD Belem Pq. Artur Alvim; tests/carga/sonda.js)",
};

export default function () {
  for (const [caminho, tipo] of ALVOS) {
    const r = http.get(BASE + caminho, { headers: { "Accept-Encoding": "gzip, br" }, tags: { tipo } });
    check(r, { [`${caminho} respondeu 200`]: (x) => x.status === 200 });
  }
}

export function handleSummary(d) {
  const m = d.metrics;
  const ms = (v) => (v == null ? "–" : `${Math.round(v)} ms`);
  const linhas = ["pagina", "dados", "ao-vivo"].map((t) => {
    const v = m[`http_req_duration{tipo:${t}}`]?.values || {};
    return `| ${t} | ${ms(v.med)} | ${ms(v.max)} |`;
  });
  const erros = Math.round((m.http_req_failed?.values?.rate ?? 0) * 100);
  const ok = Object.values(m).every((x) => !x.thresholds || Object.values(x.thresholds).every((t) => t.ok));
  const md = [
    `**${ok ? "Tudo normal" : "Lento ou com erro"}** — ${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC, ${BASE}`,
    "",
    `Limite: ${LIMITE_MS} ms. Erros: ${erros}%.`,
    "",
    "| O quê | Mediana | Mais lento |",
    "| --- | --- | --- |",
    ...linhas,
  ].join("\n");
  return { stdout: md + "\n", "sonda-resumo.md": md };
}
