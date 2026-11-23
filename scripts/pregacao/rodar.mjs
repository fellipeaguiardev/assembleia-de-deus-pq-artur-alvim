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
//   3. Anota como foi (pregacao_registrar): se falhar 2 vezes seguidas, o alerta
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
    const t = setTimeout(() => p.kill(), timeoutMs);
    p.on("error", (e) => (clearTimeout(t), reject(new Error(`${cmd}: ${e.message}`))));
    p.on("close", (code) => {
      clearTimeout(t);
      if (code === 0) resolve(out);
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

/* ---------- Passo 2: gerar o áudio ---------- */
async function gerarAudio(cfg, ffmpeg, p) {
  const id = p.video_id;
  if (p.inicio == null) throw new Error("Sem o início da pregação.");
  // baixa só o áudio da live (rápido: ~1 minuto por hora de culto, ou menos)
  for (const f of fs.readdirSync(TMP)) if (f.startsWith(id)) fs.rmSync(path.join(TMP, f), { force: true });
  await ytdlp(cfg, ["-f", "251/140/bestaudio", "--no-part", "--no-playlist", "-o", path.join(TMP, `${id}.%(ext)s`), `https://www.youtube.com/watch?v=${id}`]);
  const baixado = fs.readdirSync(TMP).find((f) => f.startsWith(id + ".") && !f.endsWith(".mp3"));
  if (!baixado) throw new Error("O yt-dlp não baixou o áudio.");
  const entrada = path.join(TMP, baixado);
  const saida = path.join(TMP, `${id}.mp3`);
  // sem fim (a live caiu antes de terminar a pregação): vai até o fim do áudio
  const dur = p.fim != null ? p.fim - p.inicio : null;
  const kbps = dur ? Math.max(32, Math.min(64, Math.floor((LIMITE_MB * 8e3) / dur / 8) * 8)) : 48;
  const filtros = ["loudnorm=I=-16:TP=-1.5:LRA=11", "afade=t=in:d=2"];
  if (dur) filtros.push(`afade=t=out:st=${Math.max(0, dur - 4)}:d=4`);
  const ano = p.culto_em ? new Date(p.culto_em).getFullYear() : new Date().getFullYear();
  await rodarProg(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", String(p.inicio), ...(p.fim != null ? ["-to", String(p.fim)] : []),
    "-i", entrada, "-vn", "-ac", "1", "-ar", "44100", "-af", filtros.join(","),
    "-c:a", "libmp3lame", "-b:a", `${kbps}k`,
    "-metadata", `title=${p.tema || p.titulo || "Pregação"}`, "-metadata", `artist=${p.pregador || "AD Belém – Parque Artur Alvim"}`,
    "-metadata", "album=Pregações – AD Belém Parque Artur Alvim", "-metadata", `date=${ano}`,
    saida,
  ]);
  fs.rmSync(entrada, { force: true });
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
