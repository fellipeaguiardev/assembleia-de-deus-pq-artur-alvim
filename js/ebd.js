/* ============================================================
   EBD — ESCOLA BÍBLICA DOMINICAL (páginas públicas)
   ------------------------------------------------------------
   Endereços:
     /ebd                          lição da semana + trimestres
     /ebd/atual                    vai direto para a lição da semana
     /ebd/2026/4/adultos           lições do trimestre (revista Adultos)
     /ebd/2026/4/adultos/3         lição 3
   Dados: tabelas ebd_quarters e ebd_lessons (supabase/migrations/
   20261010_ebd.sql). O visitante só recebe lições publicadas — a
   regra está no banco (RLS), não aqui.
   Conteúdo: referências bíblicas (texto da Bíblia Livre), textos da
   equipe da igreja e link para a fonte oficial da revista. O texto
   da revista não é copiado para o site.
   ============================================================ */
const EBD = { unavailable: false };
const EBD_CACHE_KEY = "ebd-cache-v1";
const EBD_DAILY_KEY = "ebd-daily";
const EBD_DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const EBD_LIGHT = "id,quarter_id,number,lesson_date,title,golden_ref,status,publish_at";

const ebdQuarterLabel = (q) => `${q.quarter}º Trimestre de ${q.year}`;
const ebdQuarterPath = (q) => `/ebd/${Number(q.year)}/${Number(q.quarter)}/${encodeURIComponent(q.magazine_slug)}`;
const ebdLessonPath = (q, n) => `${ebdQuarterPath(q)}/${n}`;
const ebdLessonDate = (q, n) => isoAddDays(q.start_date, 7 * (n - 1));

// Publicada e já no ar? (Trimestre: visível.) Admin logado recebe também os
// rascunhos do banco — eles só aparecem como pré-visualização, nunca nas listas.
function ebdLive(r) {
  if (!r || typeof r !== "object") return false;
  if ("status" in r) return r.status === "publicado" && (!r.publish_at || Date.parse(r.publish_at) <= Date.now());
  return r.visible !== false;
}

function ebdIsMissingTable(err) {
  return !!err && (err.code === "42P01" || err.code === "PGRST205" || /does not exist|could not find the table/i.test(err.message || ""));
}

/* ---------- Cópia local (para abrir sem internet) ----------
   Guarda só o que o visitante já recebeu: lições publicadas. */
function ebdCacheAll() {
  try {
    return JSON.parse(localStorage.getItem(EBD_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function ebdCacheSet(key, value) {
  const all = ebdCacheAll();
  all[key] = { at: Date.now(), v: value };
  const keep = Object.entries(all)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, 30);
  try {
    localStorage.setItem(EBD_CACHE_KEY, JSON.stringify(Object.fromEntries(keep)));
  } catch {}
}

async function ebdFetch(key, run) {
  // Banco da EBD ainda não ativado: não pergunta de novo nesta visita.
  try {
    if (sessionStorage.getItem("ebd-off")) {
      EBD.unavailable = true;
      return null;
    }
  } catch {}
  const cached = ebdCacheAll()[key];
  if (navigator.onLine === false) {
    if (cached) return cached.v;
    throw new Error("offline");
  }
  const { data: rows, error } = await run();
  if (error) {
    if (ebdIsMissingTable(error)) {
      EBD.unavailable = true;
      try {
        sessionStorage.setItem("ebd-off", "1");
      } catch {}
      return null;
    }
    if (cached) return cached.v;
    throw error;
  }
  // Na cópia local entra só o que é público.
  // (Em ebd_quarters, "quarter" é o número do trimestre; nas lições é o trimestre embutido.)
  const embedOk = (r) => typeof r.quarter !== "object" || ebdLive(r.quarter);
  ebdCacheSet(key, Array.isArray(rows) ? rows.filter((r) => ebdLive(r) && embedOk(r)) : ebdLive(rows) ? rows : null);
  return rows;
}

const ebdLoadQuarters = () =>
  ebdFetch("quarters", () =>
    db("ebd_quarters")
      .select("id,year,quarter,magazine,magazine_slug,theme,commentator,publisher,source_url,start_date,lesson_count,visible")
      .order("year", { ascending: false })
      .order("quarter", { ascending: false }),
  ).then((r) => (r || []).filter(ebdLive));

const ebdLoadQuarterLessons = (qid) =>
  ebdFetch("q:" + qid, () => db("ebd_lessons").select(EBD_LIGHT).eq("quarter_id", qid).order("number")).then((r) => (r || []).filter(ebdLive));

const ebdLoadLesson = (qid, n) =>
  ebdFetch(`l:${qid}:${n}`, () => db("ebd_lessons").select("*").eq("quarter_id", qid).eq("number", n).maybeSingle());

// Quando a lição é estudada. Normalmente no domingo da revista; se esse domingo
// for o da troca mensal (ex.: 3º domingo = Ceia do Senhor), a lição vai para o
// horário indicado na programação (Culto de Ensino da terça seguinte).
// A data da revista no banco não muda — só o que o site mostra.
function ebdStudyInfo(iso) {
  const date = parseISODate(iso);
  if (date) {
    for (const d of data.services || []) {
      for (const it of d.items || []) {
        if (!isEbdService(it.name)) continue;
        const m = monthlyRule(it);
        const to = monthlyMoveTarget(m);
        if (!to || date.getDay() !== weekdayIndex(d.day) || weekOfMonth(date) !== m.week) continue;
        return { date: isoAddDays(iso, moveOffset(d.day, to.day)), moved: true, from: iso, fromDay: d.day, day: to.day, time: to.time, service: to.name, reason: m.name };
      }
    }
  }
  return { date: iso, moved: false };
}
const ebdStudyDate = (iso) => ebdStudyInfo(iso).date;

// "No domingo (18/10) é Ceia do Senhor: a lição será estudada na terça (20/10), no Culto de Ensino, às 19:30."
const ebdDayMonth = (iso) => parseISODate(iso)?.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) || "";
const ebdMovedText = (s) =>
  `${capitalize(onWeekday(s.fromDay))} (${ebdDayMonth(s.from)}) é ${s.reason}: a lição será estudada ${onWeekday(s.day)} (${ebdDayMonth(s.date)}), no ${s.service}, às ${s.time}.`;

// Lições perto de hoje (3 semanas para trás, 2 para frente), com o trimestre junto.
async function ebdLoadCurrent() {
  const today = spToday();
  const rows =
    (await ebdFetch("current", () =>
      db("ebd_lessons")
        .select(`${EBD_LIGHT},reading_ref,quarter:ebd_quarters!inner(id,year,quarter,magazine,magazine_slug,theme,start_date,lesson_count,visible)`)
        .gte("lesson_date", isoAddDays(today, -21))
        .lte("lesson_date", isoAddDays(today, 13))
        .order("lesson_date"),
    )) || [];
  const live = rows.filter((l) => ebdLive(l) && ebdLive(l.quarter));
  // A lição da semana é a do próximo domingo (ou de hoje). Se ela ainda não foi
  // publicada, mostra a última publicada. Uma por revista (Adultos, Jovens…).
  const byMag = new Map();
  live.forEach((l) => {
    const k = l.quarter.magazine_slug;
    if (!byMag.has(k)) byMag.set(k, []);
    byMag.get(k).push(l);
  });
  return [...byMag.values()]
    .map((list) => {
      const next = list.find((l) => ebdStudyDate(l.lesson_date) >= today);
      const prev = [...list].reverse().find((l) => ebdStudyDate(l.lesson_date) < today);
      if (next) return { lesson: next, kind: ebdStudyDate(next.lesson_date) === today ? "hoje" : "semana" };
      return prev ? { lesson: prev, kind: "anterior" } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (a.lesson.quarter.magazine_slug === "adultos" ? -1 : b.lesson.quarter.magazine_slug === "adultos" ? 1 : 0));
}

// Trimestre em andamento hoje (pela data da 1ª lição e a quantidade de lições).
function ebdQuarterRunning(q, today = spToday()) {
  const end = isoAddDays(q.start_date, 7 * (q.lesson_count - 1) + 6);
  return q.start_date <= isoAddDays(today, 6) && today <= end;
}

// Número da lição desta semana dentro do trimestre (pelas datas previstas).
function ebdWeekNumber(q, lessons = [], today = spToday()) {
  for (let n = 1; n <= q.lesson_count; n++) {
    const date = lessons.find((l) => l.number === n)?.lesson_date || ebdLessonDate(q, n);
    if (ebdStudyDate(date) >= today) return n;
  }
  return 0;
}

// Horário da EBD tirado da programação de cultos (nada é inventado aqui).
function ebdScheduleText() {
  const out = [];
  (data.services || []).forEach((d) =>
    (d.items || []).forEach((i) => {
      if (!isEbdService(i.name)) return;
      const m = monthlyRule(i);
      const to = monthlyMoveTarget(m);
      const moved = to ? `; a lição é dada ${onWeekday(to.day)} seguinte, no ${to.name}` : "";
      out.push(`${d.day} · ${i.time}${m ? ` (no ${nthWeekdayLabel(m.week, d.day)} do mês: ${m.name}${moved})` : ""}`);
    }),
  );
  return out.join(" · ");
}

/* ============================================================
   PÁGINAS
   ============================================================ */
function ebdPageHTML() {
  return `<section class="ebd-page" id="ebdRoot" aria-live="polite">
    <div class="container bible-loading">
      <div class="bible-skel bible-skel-title"></div>
      <div class="bible-skel"></div><div class="bible-skel"></div><div class="bible-skel short"></div>
    </div>
  </section>`;
}

let ebdViewToken = 0;

async function initEbdView(param) {
  const token = ++ebdViewToken;
  const root = document.getElementById("ebdRoot");
  if (!root) return;
  const [year, quarter, slug, num] = String(param || "").split("/");
  const alive = () => token === ebdViewToken && document.body.contains(root);
  try {
    if (!year) return await renderEbdHub(root, alive);
    if (year === "atual") {
      const [cur] = await ebdLoadCurrent();
      if (!alive()) return;
      return navigateTo(cur ? ebdLessonPath(cur.lesson.quarter, cur.lesson.number) : "/ebd", { replace: true });
    }
    const quarters = await ebdLoadQuarters();
    if (!alive()) return;
    if (EBD.unavailable) return renderEbdSoon(root);
    const q = quarters.find((x) => String(x.year) === year && String(x.quarter) === quarter && x.magazine_slug === (slug || "adultos"));
    if (!q) return renderEbdNotFound(root, "Trimestre não encontrado", "Confira os trimestres disponíveis na página da EBD.");
    if (!num) return await renderEbdQuarter(root, q, alive);
    await renderEbdLesson(root, q, Number(num), alive);
  } catch (e) {
    console.error("EBD:", e);
    if (!alive()) return;
    root.innerHTML = `<div class="container">${emptyState(
      "book",
      "Não foi possível abrir a EBD agora",
      navigator.onLine ? "Tente novamente em instantes." : "Você está sem internet. As lições que você já abriu continuam disponíveis.",
      `<button class="btn btn-primary btn-sm" type="button" onclick="initEbdView(routeParam(currentRoute()))">Tentar de novo</button>`,
    )}</div>`;
  }
}

function ebdHeroHTML(eyebrow, title, lead, extra = "") {
  const schedule = ebdScheduleText();
  return `
    <div class="ebd-hero">
      <div class="container">
        <span class="eyebrow">${icon("school", 15)} ${esc(eyebrow)}</span>
        <h1>${esc(title)}</h1>
        ${lead ? `<p class="lead">${esc(lead)}</p>` : ""}
        ${schedule ? `<p class="ebd-schedule">${icon("clock", 15)} ${esc(schedule)}</p>` : ""}
        ${extra}
      </div>
    </div>`;
}

function renderEbdSoon(root) {
  setMeta(ROUTE_META.ebd[0], ROUTE_META.ebd[1], "/ebd");
  root.innerHTML =
    ebdHeroHTML("Escola Bíblica Dominical", "EBD", "A lição da semana, as referências bíblicas e perguntas para aprofundar o estudo.") +
    `<div class="container ebd-body">${emptyState("school", "Em breve", "Os estudos da EBD vão aparecer aqui assim que a equipe publicar a primeira lição.", `<a class="btn btn-primary btn-sm" href="/cultos">Ver os horários</a>`)}</div>`;
}

function renderEbdNotFound(root, title, text, back = "/ebd") {
  setMeta(title, ROUTE_META.ebd[1], location.pathname, { noindex: true });
  root.innerHTML = `<div class="container ebd-body">${emptyState("school", title, text, `<a class="btn btn-primary btn-sm" href="${back}">Voltar para a EBD</a>`)}</div>`;
}

function ebdLessonCardHTML(c) {
  const l = c.lesson;
  const q = l.quarter;
  const refs = parseRefList(l.golden_ref);
  const badge = { hoje: "Hoje", semana: "Lição desta semana", anterior: "Última lição publicada" }[c.kind];
  const s = ebdStudyInfo(l.lesson_date);
  return `
    <a class="ebd-current" href="${ebdLessonPath(q, l.number)}">
      <span class="ebd-chip">${badge}</span>
      <span class="ebd-current-meta">${esc(q.magazine)} · Lição ${l.number} · ${esc(fmtDateFull(s.date))}</span>
      ${s.moved && c.kind !== "anterior" ? `<span class="ebd-current-moved">${icon("calendar", 15)} ${esc(ebdMovedText(s))}</span>` : ""}
      <strong class="ebd-current-title">${esc(l.title || `Lição ${l.number}`)}</strong>
      ${refs.length ? `<span class="ebd-current-ref">${icon("book", 15)} Texto áureo: ${esc(refListLabel(refs))}</span>` : ""}
      <span class="ebd-current-cta">Estudar a lição ${icon("arrow", 15)}</span>
    </a>`;
}

function ebdLessonListHTML(q, lessons) {
  const week = ebdQuarterRunning(q) ? ebdWeekNumber(q, lessons) : 0;
  return `<ol class="ebd-list">${Array.from({ length: q.lesson_count }, (_, k) => {
    const n = k + 1;
    const l = lessons.find((x) => x.number === n);
    const s = ebdStudyInfo(l?.lesson_date || ebdLessonDate(q, n));
    const inner = `
      <span class="ebd-num">${n}</span>
      <span class="ebd-row-main"><strong>${l ? esc(l.title || `Lição ${n}`) : "Em breve"}</strong><small>${esc(fmtDate(s.date))}${s.moved ? ` · ${esc(onWeekday(s.day))}, no ${esc(s.service)} (${esc(s.reason)} ${esc(onWeekday(s.fromDay))})` : ""}</small></span>
      ${n === week ? `<span class="ebd-chip">Esta semana</span>` : ""}
      ${l ? icon("right", 16) : ""}`;
    return l
      ? `<li><a class="ebd-row${n === week ? " is-current" : ""}" href="${ebdLessonPath(q, n)}">${inner}</a></li>`
      : `<li><div class="ebd-row is-soon${n === week ? " is-current" : ""}">${inner}</div></li>`;
  }).join("")}</ol>`;
}

async function renderEbdHub(root, alive) {
  await bibleIndex().catch(() => {});
  const [current, quarters] = await Promise.all([ebdLoadCurrent(), ebdLoadQuarters()]);
  if (!alive()) return;
  if (EBD.unavailable || !quarters.length) return renderEbdSoon(root);
  setMeta(ROUTE_META.ebd[0], ROUTE_META.ebd[1], "/ebd");

  // Trimestres em andamento (um por revista); se nenhum, o mais recente.
  let running = quarters.filter((q) => ebdQuarterRunning(q));
  if (!running.length) running = [quarters.find((q) => q.start_date <= spToday()) || quarters[quarters.length - 1]];
  const lessonsOf = await Promise.all(running.map((q) => ebdLoadQuarterLessons(q.id)));
  if (!alive()) return;
  const others = quarters.filter((q) => !running.includes(q));
  const years = [...new Set(others.map((q) => q.year))];

  root.innerHTML =
    ebdHeroHTML("Escola Bíblica Dominical", "EBD", "A lição da semana, as referências bíblicas e perguntas para aprofundar o estudo.") +
    `<div class="container ebd-body">
      ${current.length ? `<div class="ebd-current-grid" data-stagger>${current.map(ebdLessonCardHTML).join("")}</div>` : ""}
      ${running
        .map(
          (q, i) => `
        <section class="ebd-quarter-block" data-reveal>
          <div class="ebd-quarter-head">
            <div>
              <span class="eyebrow">${esc(ebdQuarterLabel(q))} · ${esc(q.magazine)}</span>
              <h2>${esc(q.theme || "Lições do trimestre")}</h2>
              ${q.commentator ? `<p>Comentarista: ${esc(q.commentator)}</p>` : ""}
            </div>
            <a class="btn btn-ghost btn-sm" href="${ebdQuarterPath(q)}">Ver o trimestre ${icon("arrow", 14)}</a>
          </div>
          ${ebdLessonListHTML(q, lessonsOf[i])}
        </section>`,
        )
        .join("")}
      ${
        others.length
          ? `<section class="ebd-archive" data-reveal>
        <h2>Trimestres anteriores</h2>
        ${years
          .map(
            (y) => `<h3>${y}</h3><div class="ebd-archive-grid">${others
              .filter((q) => q.year === y)
              .map((q) => `<a class="ebd-archive-card" href="${ebdQuarterPath(q)}"><small>${esc(ebdQuarterLabel(q))} · ${esc(q.magazine)}</small><strong>${esc(q.theme || "Lições do trimestre")}</strong></a>`)
              .join("")}</div>`,
          )
          .join("")}
      </section>`
          : ""
      }
      ${ebdNoteHTML(running[0])}
    </div>`;
  initReveal(root);
  settleTop();
}

async function renderEbdQuarter(root, q, alive) {
  const lessons = await ebdLoadQuarterLessons(q.id);
  if (!alive()) return;
  setMeta(`EBD — ${ebdQuarterLabel(q)}`, q.theme ? `${q.theme} — lições da Escola Bíblica Dominical (${q.magazine}).` : ROUTE_META.ebd[1], ebdQuarterPath(q));
  root.innerHTML =
    ebdHeroHTML(
      `${ebdQuarterLabel(q)} · ${q.magazine}`,
      q.theme || "Lições do trimestre",
      q.commentator ? `Comentarista: ${q.commentator}` : "",
      `<div class="ebd-hero-actions">
        <a class="btn btn-ghost btn-sm" href="/ebd">${icon("arrowBack", 14)} Página da EBD</a>
        ${safeUrl(q.source_url) ? `<a class="btn btn-ghost btn-sm" href="${esc(safeUrl(q.source_url))}" target="_blank" rel="noopener">Revista na fonte oficial ${icon("external", 14)}</a>` : ""}
      </div>`,
    ) +
    `<div class="container ebd-body narrow">
      <section class="ebd-quarter-block" data-reveal>${ebdLessonListHTML(q, lessons)}</section>
      ${ebdNoteHTML(q)}
    </div>`;
  initReveal(root);
  settleTop();
}

// Texto com parágrafos e listas ("- item"), sempre escapado.
function ebdRichText(text) {
  const blocks = String(text || "").trim().split(/\n\s*\n/).filter(Boolean);
  return blocks
    .map((b) => {
      const lines = b.split("\n").map((s) => s.trim()).filter(Boolean);
      if (lines.every((s) => /^[-•*]\s+/.test(s))) return `<ul>${lines.map((s) => `<li data-listen>${esc(s.replace(/^[-•*]\s+/, ""))}</li>`).join("")}</ul>`;
      return `<p data-listen>${lines.map(esc).join("<br>")}</p>`;
    })
    .join("");
}

// Busca o texto bíblico; sem internet e sem cópia guardada, mostra só a referência.
async function ebdVersesFor(refs) {
  return Promise.all(
    refs.map(async (ref) => {
      try {
        return { ref, verses: await refVerses(ref) };
      } catch {
        return { ref, verses: [] };
      }
    }),
  );
}

async function renderEbdLesson(root, q, n, alive) {
  const [lesson, list] = await Promise.all([ebdLoadLesson(q.id, n), ebdLoadQuarterLessons(q.id)]);
  if (!alive()) return;
  if (!lesson) {
    return renderEbdNotFound(
      root,
      `Lição ${n} ainda não publicada`,
      n >= 1 && n <= q.lesson_count ? `Prevista para ${fmtDateFull(ebdStudyDate(ebdLessonDate(q, n)))}. A equipe publica cada lição depois de revisar.` : "Confira as lições do trimestre.",
      ebdQuarterPath(q),
    );
  }
  await bibleIndex().catch(() => {});
  const golden = parseRefList(lesson.golden_ref);
  const reading = parseRefList(lesson.reading_ref);
  const [goldenV, readingV] = await Promise.all([ebdVersesFor(golden), ebdVersesFor(reading)]);
  if (!alive()) return;

  const title = lesson.title || `Lição ${n}`;
  const path = ebdLessonPath(q, n);
  setMeta(`${title} — EBD`, `Lição ${n} (${ebdQuarterLabel(q)}, ${q.magazine}): ${golden.length ? "texto áureo " + refListLabel(golden) + ". " : ""}Referências e perguntas para estudo.`, path);

  const published = list.filter((l) => l.number !== n).sort((a, b) => a.number - b.number);
  const prev = [...published].reverse().find((l) => l.number < n);
  const next = published.find((l) => l.number > n);
  const source = safeUrl(lesson.source_url) || safeUrl(q.source_url);
  const preview = !ebdLive(lesson); // só um admin logado recebe lição não publicada
  const questions = (Array.isArray(lesson.questions) ? lesson.questions : []).filter((x) => x && x.q);
  const links = (Array.isArray(lesson.links) ? lesson.links : []).filter((x) => x && safeUrl(x.url));
  const daily = (lesson.daily_refs || []).slice(0, 6);
  const done = ebdDailyDone(lesson.id);
  const goldenText = goldenV.flatMap((g) => g.verses.map((v) => v.text)).join(" ").replace(/[[\]]/g, "");
  const study = ebdStudyInfo(lesson.lesson_date);

  root.innerHTML = `
    <article class="ebd-lesson" data-listen-root data-listen-title="Lição ${n}: ${esc(title)}">
      <header class="ebd-lesson-head">
        <div class="container">
          ${preview ? `<p class="ebd-preview">${icon("user", 15)} Pré-visualização: esta lição está como “${esc({ rascunho: "rascunho", revisao: "em revisão", publicado: "agendada" }[lesson.status] || lesson.status)}” e só administradores conseguem vê-la.</p>` : ""}
          <a class="back-link" href="${ebdQuarterPath(q)}">${icon("arrowBack", 16)} ${esc(ebdQuarterLabel(q))} · ${esc(q.magazine)}</a>
          <span class="eyebrow">Lição ${n} · ${esc(fmtDateFull(study.date))}</span>
          <h1 data-listen data-listen-text="${esc(`Lição ${n}. ${title}.`)}">${esc(title)}</h1>
          ${q.theme ? `<p class="ebd-theme">Trimestre: ${esc(q.theme)}</p>` : ""}
          ${study.moved ? `<p class="ebd-moved">${icon("calendar", 16)} <span>${esc(ebdMovedText(study))}</span></p>` : ""}
          <div class="ebd-actions">
            ${listenButtonHTML()}
            <button class="btn btn-ghost btn-sm" type="button" onclick="ebdShare()">${icon("share", 15)} Compartilhar</button>
            ${source ? `<a class="btn btn-ghost btn-sm" href="${esc(source)}" target="_blank" rel="noopener" title="Abre ${esc(ebdHost(source))}">Ler a lição completa ${icon("external", 14)}</a>` : ""}
          </div>
        </div>
      </header>
      <div class="container ebd-lesson-grid">
        <div class="ebd-lesson-main">
          ${
            golden.length
              ? `<section class="ebd-card ebd-golden" data-listen data-listen-text="${esc(`Texto áureo. ${golden.map(refSpoken).join("; ")}. ${goldenText}`)}">
            <span class="ebd-label">Texto áureo</span>
            ${goldenText ? `<blockquote>${esc(goldenText)}</blockquote>` : ""}
            <p class="ebd-ref">${golden.map((r) => `<a href="${refPath(r)}">${esc(refLabel(r))} ${icon("arrow", 13)}</a>`).join(" ")}</p>
          </section>`
              : ""
          }
          ${
            reading.length
              ? `<section class="ebd-card ebd-reading">
            <div class="ebd-card-head">
              <h2 class="ebd-label" data-listen data-listen-text="${esc(`Leitura bíblica em classe. ${reading.map(refSpoken).join("; ")}.`)}">Leitura bíblica em classe</h2>
              <span>${reading.map((r) => `<a href="${refPath(r)}">${esc(refLabel(r))}</a>`).join("; ")}</span>
            </div>
            ${readingV
              .map(
                (g) => `
              ${readingV.length > 1 ? `<h3 class="ebd-sub">${esc(refLabel(g.ref))}</h3>` : ""}
              ${
                g.verses.length
                  ? `<div class="ebd-verses">${g.verses
                      .slice(0, 80)
                      .map((v) => `<p data-listen><sup>${v.n}</sup>${esc(v.text)}</p>`)
                      .join("")}</div>${g.verses.length > 80 ? `<a class="link-btn" href="${refPath(g.ref)}">Continuar a leitura na Bíblia ${icon("arrow", 13)}</a>` : ""}`
                  : `<p class="ebd-muted">Sem internet: <a href="${refPath(g.ref)}">abra a passagem na Bíblia</a> quando estiver conectado.</p>`
              }`,
              )
              .join("")}
          </section>`
              : ""
          }
          ${
            lesson.key_idea
              ? `<section class="ebd-card ebd-idea"><h2 class="ebd-label">Ideia central</h2><p data-listen data-listen-text="${esc(`Ideia central. ${lesson.key_idea}`)}">${esc(lesson.key_idea)}</p></section>`
              : ""
          }
          ${
            lesson.summary
              ? `<section class="ebd-card ebd-summary"><h2 class="ebd-label" data-listen>Pontos principais</h2><div class="ebd-rich">${ebdRichText(lesson.summary)}</div></section>`
              : ""
          }
          ${
            questions.length
              ? `<section class="ebd-card ebd-questions">
            <div class="ebd-card-head">
              <h2 class="ebd-label" data-listen>Perguntas para aprofundar</h2>
              <button class="link-btn" type="button" onclick="ebdCopyQuestions()">${icon("copy", 13)} Copiar perguntas</button>
            </div>
            <ol>
              ${questions
                .map(
                  (x, i) => `<li data-listen data-listen-text="${esc(`Pergunta ${i + 1}. ${x.q}`)}"><p class="ebd-q">${esc(x.q)}</p>${
                    x.a ? `<details><summary>Ver resposta sugerida</summary><div class="pre-line">${esc(x.a)}</div></details>` : ""
                  }</li>`,
                )
                .join("")}
            </ol>
          </section>`
              : ""
          }
        </div>
        <aside class="ebd-lesson-side">
          ${
            daily.some((d) => d && d.trim())
              ? `<section class="ebd-card ebd-daily">
            <h2 class="ebd-label">Leitura diária</h2>
            <ul>
              ${daily
                .map((raw, i) => {
                  if (!raw || !raw.trim()) return "";
                  const refs = parseRefList(raw);
                  const label = refs.length ? refListLabel(refs) : raw;
                  return `<li>
                  <label class="ebd-check"><input type="checkbox" ${done[i] ? "checked" : ""} onchange="ebdDailyToggle('${esc(lesson.id)}', ${i}, this.checked)"><span>${EBD_DAYS[i]}</span></label>
                  ${refs.length ? `<a href="${refPath(refs[0])}">${esc(label)}</a>` : `<span>${esc(label)}</span>`}
                </li>`;
                })
                .join("")}
            </ul>
            <p class="ebd-daily-progress" id="ebdDailyProgress">${ebdDailyProgressText(lesson.id, daily)}</p>
          </section>`
              : ""
          }
          ${
            links.length
              ? `<section class="ebd-card ebd-links"><h2 class="ebd-label">Materiais complementares</h2><ul>${links
                  .map((x) => `<li><a href="${esc(safeUrl(x.url))}" target="_blank" rel="noopener">${esc(x.label || x.url)} ${icon("external", 13)}</a></li>`)
                  .join("")}</ul></section>`
              : ""
          }
          ${ebdNoteHTML(q)}
        </aside>
      </div>
      <nav class="container ebd-lesson-nav" aria-label="Outras lições">
        ${prev ? `<a class="bible-nav-link prev" href="${ebdLessonPath(q, prev.number)}">${icon("left", 18)}<span><small>Lição ${prev.number}</small>${esc(prev.title || "Anterior")}</span></a>` : "<span></span>"}
        ${next ? `<a class="bible-nav-link next" href="${ebdLessonPath(q, next.number)}"><span><small>Lição ${next.number}</small>${esc(next.title || "Próxima")}</span>${icon("right", 18)}</a>` : "<span></span>"}
      </nav>
    </article>`;
  root.dataset.title = title;
  root.dataset.questions = questions.map((x, i) => `${i + 1}. ${x.q}`).join("\n");
  settleTop();
  listenContentReady();
}

const ebdHost = (url) => {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
};

function ebdNoteHTML(q) {
  const publisher = q?.publisher || "a editora";
  const src = /estudantesdabiblia\.com\.br/.test(q?.source_url || "") ? " Títulos e referências conforme o sumário publicado em estudantesdabiblia.com.br." : "";
  return `<p class="ebd-note">Estudo preparado pela equipe da EBD da igreja, como apoio à revista. A lição completa está na revista publicada por ${esc(publisher)}.${src} Textos bíblicos: Bíblia Livre (CC BY 4.0).</p>`;
}

/* ---------- Leitura diária (marcada só neste aparelho) ---------- */
function ebdDailyDone(id) {
  try {
    return JSON.parse(localStorage.getItem(EBD_DAILY_KEY) || "{}")[id] || [];
  } catch {
    return [];
  }
}

function ebdDailyToggle(id, i, on) {
  let all = {};
  try {
    all = JSON.parse(localStorage.getItem(EBD_DAILY_KEY) || "{}");
  } catch {}
  const list = all[id] || [];
  list[i] = on;
  all[id] = list;
  // Guarda só as 20 lições mais recentes.
  const keys = Object.keys(all);
  if (keys.length > 20) keys.slice(0, keys.length - 20).forEach((k) => delete all[k]);
  try {
    localStorage.setItem(EBD_DAILY_KEY, JSON.stringify(all));
  } catch {}
  const el = document.getElementById("ebdDailyProgress");
  if (el) el.textContent = ebdDailyProgressText(id);
}

function ebdDailyProgressText(id, daily) {
  const total = daily ? daily.filter((d) => d && d.trim()).length : document.querySelectorAll(".ebd-daily li label").length;
  const count = ebdDailyDone(id).filter(Boolean).length;
  return count >= total && total ? "Leituras da semana concluídas! 🎉" : `${count} de ${total} leituras feitas`;
}

async function ebdShare() {
  const title = document.getElementById("ebdRoot")?.dataset.title || "EBD";
  const url = location.origin + location.pathname;
  try {
    if (navigator.share) await navigator.share({ title: `${title} — EBD`, text: `Estude a lição da EBD: ${title}`, url });
    else window.open(`https://wa.me/?text=${encodeURIComponent(`Estude a lição da EBD: ${title}\n${url}`)}`, "_blank", "noopener");
  } catch (e) {
    if (e?.name !== "AbortError") showToast("Não foi possível compartilhar.", "error");
  }
}

async function ebdCopyQuestions() {
  const root = document.getElementById("ebdRoot");
  try {
    await copyText(`${root.dataset.title}\n\n${root.dataset.questions}\n\n${location.origin + location.pathname}`);
    showToast("Perguntas copiadas!", "success");
  } catch {
    showToast("Não foi possível copiar.", "error");
  }
}

/* ---------- Seção da página inicial ---------- */
// Só aparece quando há lição publicada perto de hoje.
function ebdHomeHTML() {
  return `<section class="block tight ebd-home" id="ebdHome" hidden>
    <div class="container" data-reveal>
      <div class="ebd-home-head">
        <div><span class="eyebrow">${icon("school", 15)} Escola Bíblica Dominical</span><h2>Lição da semana</h2></div>
        <a class="btn btn-ghost btn-sm" href="/ebd">Todas as lições ${icon("arrow", 14)}</a>
      </div>
      <div class="ebd-current-grid" id="ebdHomeCards"></div>
    </div>
  </section>`;
}

async function initEbdHome() {
  const sec = document.getElementById("ebdHome");
  if (!sec) return;
  try {
    await bibleIndex().catch(() => {});
    const current = await ebdLoadCurrent();
    if (!current.length || !document.body.contains(sec)) return;
    document.getElementById("ebdHomeCards").innerHTML = current.map(ebdLessonCardHTML).join("");
    sec.hidden = false;
  } catch {}
}
