// ============================================================
// PREGAÇÃO EM ÁUDIO NO PODCAST — programa que roda num computador da equipe
// ------------------------------------------------------------
// O Agendador de Tarefas do Windows roda este arquivo de hora em hora
// (instalação: scripts/pregacao/instalar.ps1). A cada rodada:
//
//   1. Vê as últimas lives do canal (yt-dlp). Live nova, que terminou há mais de
//      1 hora e começou nos últimos DIAS_PARA_TRAS dias → pede ao site
//      (POST /api/rotina/pregacao, acao "analisar") para o Gemini achar a
//      pregação. O site grava em public.pregacoes:
//        confiança alta/média → "fila";  baixa ou sem pregação → "conferir"
//        (e-mail pedindo para conferir no painel, aba Vídeos).
//   2. Para cada pregação na "fila" (inclusive as que a equipe corrigiu no
//      painel): baixa o áudio da live, corta só a pregação (ffmpeg: mono,
//      volume igualado, MP3), pede um "vale de envio" ao banco, envia o MP3
//      para o Storage e publica o episódio no podcast do site
//      (pregacao_publicar). E-mail avisando; se o pregador não foi
//      identificado, o e-mail diz onde completar.
//   3. Uma vez por dia, limpeza: pregação com mais de 3 meses sai do podcast e o
//      MP3 é apagado do site (limpezaDiaria). Aqui no computador não fica áudio.
//   4. Anota como foi (pregacao_registrar): se falhar 2 vezes seguidas, o alerta
//      diário do site manda e-mail.
//
// Precisa: Node 18+, Python com yt-dlp (py -m pip install -U "yt-dlp[default]")
// e ffmpeg. Configuração (fora do GitHub):
//   %USERPROFILE%\.pregacao-podcast\config.json  { "chave": "preg_…", "site": "https://…" }
//   opcionais: "ffmpeg": "C:\\…\\ffmpeg.exe", "python": "py", "dias": 3
// Registro: %USERPROFILE%\.pregacao-podcast\registro.log
//
// Uso à mão:
//   node scripts/pregacao/rodar.mjs            → uma rodada normal
//   node scripts/pregacao/rodar.mjs --simular  → só mostra o que faria (não chama o Gemini nem publica)
// ============================================================
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { SUPABASE_URL, SUPABASE_KEY, rpc } from "../../api/_lib/fonte.mjs";

const PASTA = path.join(os.homedir(), ".pregacao-podcast");
const TMP = path.join(PASTA, "tmp");
const LOG = path.join(PASTA, "registro.log");
const TRAVA = path.join(PASTA, "rodando.lock");
const SIMULAR = process.argv.includes("--simular");
const ESPERA_DEPOIS_DA_LIVE_MS = 60 * 60e3; // 1 hora depois do fim da live
const ANALISES_POR_RODADA = 2; // poupa a cota grátis do Gemini
const LIMITE_MB = 45; // o Storage aceita até 50 MB por arquivo
// Pausas longas: silêncio abaixo de -40 dB por mais de 1,5 s fica com 1 s (acharPausas).
// (-40 dB: não pega fala baixa; desligar: "cortarPausas": false no config.json)
const PAUSA_DB = -40;
const PAUSA_MAX = 1.5;
const PAUSA_FICA = 1;

/* ---------- Registro ---------- */
fs.mkdirSync(TMP, { recursive: true });
function log(...partes) {
  const linha = `[${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}] ${partes.join(" ")}`;
  console.log(linha);
  try {
    if (fs.existsSync(LOG) && fs.statSync(LOG).size > 1e6) fs.writeFileSync(LOG, fs.readFileSync(LOG, "utf8").slice(-300000));
    fs.appendFileSync(LOG, linha + "\n");
  } catch {}
}

/* ---------- Configuração ---------- */
function lerConfig() {
  const arq = path.join(PASTA, "config.json");
  if (!fs.existsSync(arq)) throw new Error(`Falta ${arq}. Rode: node scripts/pregacao/nova-chave.mjs`);
  const c = JSON.parse(fs.readFileSync(arq, "utf8"));
  if (!/^preg_[0-9a-f]{48}$/.test(c.chave || "")) throw new Error("A chave em config.json é inválida.");
  return { site: "https://www.adbelemparquealvim.org.br", python: "py", dias: 3, ...c };
}

/* ---------- Programas externos ---------- */
function rodarProg(cmd, args, { timeoutMs = 30 * 60e3 } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { windowsHide: true });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err = (err + d).slice(-4000)));
    let estourou = false;
    const t = setTimeout(() => ((estourou = true), p.kill()), timeoutMs);
    p.on("error", (e) => (clearTimeout(t), reject(new Error(`${cmd}: ${e.message}`))));
    p.on("close", (code) => {
      clearTimeout(t);
      if (estourou) reject(Object.assign(new Error(`${path.basename(cmd)} demorou mais de ${Math.round(timeoutMs / 60e3)} min e foi interrompido.`), { estourou: true }));
      else if (code === 0) resolve(out);
      else reject(new Error(`${path.basename(cmd)} saiu com erro ${code}: ${err.trim().split("\n").slice(-3).join(" | ").slice(0, 400)}`));
    });
  });
}

function acharFfmpeg(cfg) {
  const candidatos = [cfg.ffmpeg, path.join(process.env.LOCALAPPDATA || "", "Microsoft", "WinGet", "Links", "ffmpeg.exe")];
  const raiz = path.join(os.homedir(), "ffmpeg");
  if (fs.existsSync(raiz)) for (const d of fs.readdirSync(raiz)) candidatos.push(path.join(raiz, d, "bin", "ffmpeg.exe"));
  return candidatos.find((c) => c && fs.existsSync(c)) || "ffmpeg"; // senão, o do PATH
}

const ytdlp = (cfg, args, opts) => rodarProg(cfg.python, ["-m", "yt_dlp", "--js-runtimes", `node:${process.execPath}`, "--no-progress", ...args], opts);

// yt-dlp precisa estar atualizado (o YouTube muda sempre): no máximo 1 vez por dia.
async function atualizarYtDlp(cfg) {
  const marca = path.join(PASTA, "yt-dlp-atualizado");
  if (fs.existsSync(marca) && Date.now() - fs.statSync(marca).mtimeMs < 20 * 3600e3) return;
  try {
    await rodarProg(cfg.python, ["-m", "pip", "install", "--user", "-U", "--quiet", "--disable-pip-version-check", "yt-dlp[default]"], { timeoutMs: 5 * 60e3 });
    fs.writeFileSync(marca, new Date().toISOString());
    log("yt-dlp conferido/atualizado.");
  } catch (e) {
    log("Aviso: não deu para atualizar o yt-dlp:", e.message);
  }
}

/* ---------- Site e banco ---------- */
async function site(cfg, corpo, timeoutMs = 320e3) {
  const res = await fetch(`${cfg.site}/api/rotina/pregacao`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.chave}`, "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `O site respondeu ${res.status}.`);
  return j;
}
const avisar = (cfg, video) => site(cfg, { acao: "avisar", video }, 30e3).catch((e) => log("Aviso por e-mail falhou:", e.message));

async function canalDoSite() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/settings?id=eq.main&select=canal:data->church->>liveChannelId`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    signal: AbortSignal.timeout(15000),
  });
  const canal = res.ok ? (await res.json())[0]?.canal : "";
  if (!/^UC[\w-]{22}$/.test(canal || "")) throw new Error("O ID do canal do YouTube não está configurado no painel (Igreja & redes).");
  return canal;
}

/* ---------- Passo 1: lives novas ---------- */
async function lerLives(cfg, canal) {
  const out = await ytdlp(cfg, ["-J", "--flat-playlist", "--playlist-end", "8", `https://www.youtube.com/channel/${canal}/streams`], { timeoutMs: 3 * 60e3 });
  return (JSON.parse(out).entries || []).filter((e) => e.live_status === "was_live" && /^[\w-]{11}$/.test(e.id || ""));
}

async function detalhes(cfg, id) {
  const out = await ytdlp(cfg, ["-J", "--skip-download", "--extractor-args", "youtube:lang=pt", `https://www.youtube.com/watch?v=${id}`], { timeoutMs: 3 * 60e3 });
  const j = JSON.parse(out);
  const inicioMs = (j.release_timestamp || j.timestamp || 0) * 1000;
  return { titulo: j.title || "", liveStatus: j.live_status, inicioMs, fimMs: inicioMs + (j.duration || 0) * 1000, duracao: j.duration || 0 };
}

/* ---------- Pausas longas ----------
   O silencedetect acha os trechos abaixo de PAUSA_DB por mais de PAUSA_MAX s; de
   cada um fica PAUSA_FICA/2 s antes e depois e o meio sai (aselect). Só corta
   dentro do silêncio: a fala nunca é cortada. Na pregação de 22/11/2026 (49 min):
   106 pausas, 2 min 25 s a menos, maior pausa de 6,8 s → ~2 s.
   (O filtro silenceremove do ffmpeg 8 foi testado e deixou pausas de 6 s.) */
async function acharPausas(ffmpeg, arquivo) {
  const saida = await new Promise((resolve, reject) => {
    const p = spawn(ffmpeg, ["-hide_banner", "-nostats", "-i", arquivo, "-af", `silencedetect=noise=${PAUSA_DB}dB:d=${PAUSA_MAX}`, "-f", "null", "-"], { windowsHide: true });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(err) : reject(new Error(`ffmpeg (pausas) saiu com erro ${code}`))));
  });
  const lado = PAUSA_FICA / 2;
  const cortes = [];
  let ini = null;
  for (const l of saida.split("\n")) {
    const a = l.match(/silence_start: ([\d.]+)/);
    const b = l.match(/silence_end: ([\d.]+)/);
    if (a) ini = Number(a[1]);
    if (b && ini !== null) {
      if (Number(b[1]) - ini - 2 * lado > 0.05) cortes.push([ini + lado, Number(b[1]) - lado]);
      ini = null;
    }
  }
  // as maiores primeiro, no máximo 600 (a linha de comando do Windows tem limite)
  const usados = cortes.sort((x, y) => y[1] - y[0] - (x[1] - x[0])).slice(0, 600).sort((x, y) => x[0] - y[0]);
  if (!usados.length) return { filtro: "", segundos: 0, pausas: 0 };
  // árvore balanceada de somas: uma lista longa "a+b+c+…" estoura o ffmpeg
  const arvore = (l) => (l.length === 1 ? l[0] : `(${arvore(l.slice(0, l.length >> 1))}+${arvore(l.slice(l.length >> 1))})`);
  const expr = arvore(usados.map(([a, b]) => `between(t,${a.toFixed(3)},${b.toFixed(3)})`));
  return { filtro: `aselect='not(${expr})',asetpts=N/SR/TB`, segundos: usados.reduce((t, [a, b]) => t + b - a, 0), pausas: usados.length };
}

/* ---------- Passo 2: gerar o áudio ---------- */
async function gerarAudio(cfg, ffmpeg, p) {
  const id = p.video_id;
  if (p.inicio == null) throw new Error("Sem o início da pregação.");
  // baixa só o áudio da live (rápido: ~1 minuto por hora de culto, ou menos)
  for (const f of fs.readdirSync(TMP)) if (f.startsWith(id)) fs.rmSync(path.join(TMP, f), { force: true });
  // O YouTube às vezes recusa um link de download (403) e aceita logo depois
  // (visto em 23/11/2026): até 3 tentativas, 30 s entre elas.
  // Live que o YouTube ainda não terminou de processar ("post_live", como a de 26/11/2026,
  // presa assim por mais de 14 h): não tem o 251 e baixa devagar, ~25 KB/s. Por isso o 139
  // (64k, metade do 140; o MP3 final tem 32–64k) vem antes do 140, e o prazo é de 100 min
  // (a trava da rodada vale 3 h). Se estourar o prazo, não tenta de novo nesta rodada.
  for (let tentativa = 1; ; tentativa++) {
    try {
      await ytdlp(cfg, ["-f", "251/139/140/bestaudio", "--no-part", "--no-playlist", "--retries", "5", "-o", path.join(TMP, `${id}.%(ext)s`), `https://www.youtube.com/watch?v=${id}`], { timeoutMs: 100 * 60e3 });
      break;
    } catch (e) {
      if (tentativa >= 3 || e.estourou) throw e;
      log(`  → o download falhou (${e.message.slice(-90)}); tentando de novo em 30 s…`);
      for (const f of fs.readdirSync(TMP)) if (f.startsWith(id)) fs.rmSync(path.join(TMP, f), { force: true });
      await new Promise((r) => setTimeout(r, 30e3));
    }
  }
  const baixado = fs.readdirSync(TMP).find((f) => f.startsWith(id + ".") && !f.endsWith(".mp3"));
  if (!baixado) throw new Error("O yt-dlp não baixou o áudio.");
  const entrada = path.join(TMP, baixado);
  const saida = path.join(TMP, `${id}.mp3`);
  // sem fim (a live caiu antes de terminar a pregação): vai até o fim do áudio
  const dur = p.fim != null ? p.fim - p.inicio : null;
  const kbps = dur ? Math.max(32, Math.min(64, Math.floor((LIMITE_MB * 8e3) / dur / 8) * 8)) : 48;
  // 1) corta a pregação, iguala o volume (o loudnorm trabalha em 192 kHz: volta
  //    para 44,1 kHz) e faz fade no início e no fim → FLAC temporário (sem perda)
  const filtros = ["loudnorm=I=-16:TP=-1.5:LRA=11", "aresample=44100", "afade=t=in:d=2"];
  if (dur) filtros.push(`afade=t=out:st=${Math.max(0, dur - 4)}:d=4`);
  const meio = path.join(TMP, `${id}-meio.flac`);
  await rodarProg(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", String(p.inicio), ...(p.fim != null ? ["-to", String(p.fim)] : []),
    "-i", entrada, "-vn", "-ac", "1", "-af", filtros.join(","), "-c:a", "flac", meio,
  ]);
  fs.rmSync(entrada, { force: true });
  // 2) pausas longas (cortarPausas no config.json; ligado se não disser nada)
  const { filtro: semPausas, segundos: tirado, pausas } = cfg.cortarPausas === false ? { filtro: "", segundos: 0, pausas: 0 } : await acharPausas(ffmpeg, meio);
  // 3) MP3 final
  const ano = p.culto_em ? new Date(p.culto_em).getFullYear() : new Date().getFullYear();
  await rodarProg(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-y", "-i", meio,
    ...(semPausas ? ["-af", semPausas] : []),
    "-c:a", "libmp3lame", "-b:a", `${kbps}k`,
    "-metadata", `title=${p.tema || p.titulo || "Pregação"}`, "-metadata", `artist=${p.pregador || "AD Belém – Parque Artur Alvim"}`,
    "-metadata", "album=Pregações – AD Belém Parque Artur Alvim", "-metadata", `date=${ano}`,
    saida,
  ]);
  fs.rmSync(meio, { force: true });
  if (pausas) log(`  → ${pausas} pausas longas encurtadas (${Math.round(tirado)} s a menos).`);
  const mb = fs.statSync(saida).size / 1e6;
  if (mb > 49.5) throw new Error(`O MP3 ficou grande demais (${mb.toFixed(1)} MB).`);
  return { arquivo: saida, mb };
}

async function enviarEPublicar(cfg, p, arquivo) {
  const nome = await rpc("pregacao_vale", { p_key: cfg.chave, p_video: p.video_id });
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/images/${nome}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "audio/mpeg", "cache-control": "31536000", "x-upsert": "false" },
    body: fs.readFileSync(arquivo),
    signal: AbortSignal.timeout(15 * 60e3),
  });
  if (!res.ok) throw new Error(`O Storage recusou o MP3 (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const url = `${SUPABASE_URL}/storage/v1/object/public/images/${nome}`;
  await rpc("pregacao_publicar", { p_key: cfg.chave, p_video: p.video_id, p_arquivo: nome, p_audio_url: url });
  return url;
}

/* ---------- Passo 3: limpeza (1 vez por dia) ----------
   Pregação de culto com mais de DIAS_NO_PODCAST dias sai do podcast e o MP3 é
   apagado do Storage (pregacao_arquivar_antigas; migração 20261124120000).
   Também apaga os MP3 trocados ("Gerar o áudio" de novo) e os de episódios
   excluídos à mão no painel. Neste computador não fica áudio nenhum: a pasta
   tmp é esvaziada a cada rodada. */
const DIAS_NO_PODCAST = 90; // decisão da equipe em 23/11/2026: 3 meses
async function limpezaDiaria(cfg) {
  const marca = path.join(PASTA, "limpeza-feita");
  if (fs.existsSync(marca) && Date.now() - fs.statSync(marca).mtimeMs < 20 * 3600e3) return "";
  const r = await rpc("pregacao_arquivar_antigas", { p_key: cfg.chave, p_dias: cfg.diasNoPodcast || DIAS_NO_PODCAST }).catch((e) => {
    if (e.missing) return null;
    throw e;
  });
  if (!r) return log("Limpeza: falta rodar supabase/migrations/20261124120000_pregacao_limpeza.sql no Supabase."), "";
  const lixo = (await rpc("pregacao_lixo", { p_key: cfg.chave })) || [];
  let apagados = [];
  if (lixo.length) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/images`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: lixo }),
      signal: AbortSignal.timeout(60e3),
    });
    if (!res.ok) throw new Error(`O Storage não apagou os MP3 antigos (${res.status}): ${(await res.text()).slice(0, 200)}`);
    const nomes = ((await res.json()) || []).map((o) => o.name);
    apagados = lixo.filter((n) => nomes.includes(n) || nomes.includes(n.split("/").pop()));
    // o que não voltou pode já ter sido apagado (pelo painel): confere se ainda existe
    for (const n of lixo.filter((x) => !apagados.includes(x))) {
      const h = await fetch(`${SUPABASE_URL}/storage/v1/object/public/images/${n}`, { method: "HEAD", signal: AbortSignal.timeout(15e3) }).catch(() => null);
      if (h && (h.status === 404 || h.status === 400)) apagados.push(n);
    }
    if (apagados.length) await rpc("pregacao_lixo_apagado", { p_key: cfg.chave, p_nomes: apagados });
  }
  fs.writeFileSync(marca, new Date().toISOString());
  const partes = [r.antigas && `${r.antigas} pregação(ões) com mais de ${cfg.diasNoPodcast || DIAS_NO_PODCAST} dias saíram do podcast`, r.soltas && `${r.soltas} MP3 de episódio excluído no painel`, apagados.length && `${apagados.length} MP3 apagado(s) do site`].filter(Boolean);
  if (lixo.length > apagados.length) partes.push(`${lixo.length - apagados.length} MP3 não deu para apagar (tenta amanhã)`);
  if (partes.length) log("Limpeza:", partes.join("; ") + ".");
  return partes.join("; ");
}

/* ---------- Rodada ---------- */
async function rodada() {
  const cfg = lerConfig();
  const ffmpeg = acharFfmpeg(cfg);
  if (!SIMULAR) await atualizarYtDlp(cfg);
  const estado = await rpc("pregacao_estado", { p_key: cfg.chave }).catch((e) => {
    throw new Error(e.missing ? "Falta rodar supabase/migrations/20261123120000_pregacao_audio.sql no Supabase." : e.message);
  });
  const conhecidos = new Set(estado.conhecidos || []);
  const canal = await canalDoSite();
  const lives = await lerLives(cfg, canal);
  const resumo = [];
  let analises = 0;

  for (const l of lives) {
    if (conhecidos.has(l.id)) continue;
    if (analises >= ANALISES_POR_RODADA) break;
    const d = await detalhes(cfg, l.id);
    if (d.liveStatus !== "was_live" || !d.inicioMs) continue;
    if (Date.now() - d.inicioMs > cfg.dias * 864e5) continue; // antiga: o programa só cuida das lives recentes
    if (Date.now() < d.fimMs + ESPERA_DEPOIS_DA_LIVE_MS) {
      log(`Esperando: "${d.titulo}" terminou há menos de 1 hora.`);
      continue;
    }
    analises++;
    if (SIMULAR) {
      log(`[simulação] Mandaria o Gemini achar a pregação de "${d.titulo}" (${l.id}).`);
      continue;
    }
    log(`Live nova: "${d.titulo}" (${l.id}). O Gemini está procurando a pregação…`);
    try {
      const r = await site(cfg, { acao: "analisar", video: l.id, titulo: d.titulo, culto_em: new Date(d.inicioMs).toISOString() });
      log(`  → ${r.status}: ${r.inicio ?? "?"}s até ${r.fim ?? "?"}s, confiança ${r.confianca}, pregador "${r.pregador || "?"}", tema "${r.tema || "?"}"`);
      resumo.push(`${l.id}: ${r.status}`);
      if (r.status === "conferir") await avisar(cfg, l.id);
    } catch (e) {
      log(`  → não deu para analisar: ${e.message}`);
      resumo.push(`${l.id}: Gemini falhou (${e.message.slice(0, 80)})`);
      if (/limite|429/i.test(e.message)) break; // cota do Gemini: tenta na próxima hora
    }
  }

  // fila: o que o Gemini acabou de achar + o que a equipe mandou gerar no painel
  const fila = SIMULAR ? estado.trabalho || [] : (await rpc("pregacao_estado", { p_key: cfg.chave })).trabalho || [];
  for (const p of fila) {
    if (SIMULAR) {
      log(`[simulação] Geraria o áudio de "${p.titulo}" (${p.video_id}), ${p.inicio}s até ${p.fim ?? "o fim"}.`);
      continue;
    }
    log(`Gerando o áudio: "${p.titulo}" (${p.video_id}), ${p.inicio}s até ${p.fim ?? "o fim"}…`);
    const t0 = Date.now();
    try {
      const { arquivo, mb } = await gerarAudio(cfg, ffmpeg, p);
      const url = await enviarEPublicar(cfg, p, arquivo);
      fs.rmSync(arquivo, { force: true });
      log(`  → publicado no podcast (${mb.toFixed(1)} MB, ${Math.round((Date.now() - t0) / 1000)} s): ${url}`);
      resumo.push(`${p.video_id}: publicado`);
      await avisar(cfg, p.video_id);
    } catch (e) {
      log(`  → falhou: ${e.message}`);
      const tentativas = await rpc("pregacao_falhou", { p_key: cfg.chave, p_video: p.video_id, p_detalhe: e.message }).catch(() => 0);
      resumo.push(`${p.video_id}: falhou (${e.message.slice(0, 80)})`);
      if (tentativas >= 3) await avisar(cfg, p.video_id);
    }
  }
  if (!SIMULAR) {
    const limpeza = await limpezaDiaria(cfg).catch((e) => (log("Limpeza falhou:", e.message), `limpeza falhou (${e.message.slice(0, 80)})`));
    if (limpeza) resumo.push(limpeza);
  }
  for (const f of fs.readdirSync(TMP)) fs.rmSync(path.join(TMP, f), { force: true }); // sobras de rodadas que caíram
  return { cfg, resumo };
}

/* ---------- Início ---------- */
if (fs.existsSync(TRAVA) && Date.now() - fs.statSync(TRAVA).mtimeMs < 3 * 3600e3) {
  log("Outra rodada ainda está em andamento; saindo.");
  process.exit(0);
}
fs.writeFileSync(TRAVA, String(process.pid));
let cfgParaRegistro = null;
try {
  const { cfg, resumo } = await rodada();
  cfgParaRegistro = cfg;
  log(`Rodada terminada${SIMULAR ? " (simulação)" : ""}.${resumo.length ? " " + resumo.join(" · ") : " Nada novo."}`);
  if (!SIMULAR) await rpc("pregacao_registrar", { p_key: cfg.chave, p_ok: !resumo.some((r) => /falhou/.test(r)), p_detalhe: resumo.join(" · ") || "Nada novo." }).catch(() => {});
} catch (e) {
  log("ERRO:", e.message);
  try {
    cfgParaRegistro ||= lerConfig();
    if (!SIMULAR) await rpc("pregacao_registrar", { p_key: cfgParaRegistro.chave, p_ok: false, p_detalhe: e.message }).catch(() => {});
  } catch {}
  process.exitCode = 1;
} finally {
  fs.rmSync(TRAVA, { force: true });
}
