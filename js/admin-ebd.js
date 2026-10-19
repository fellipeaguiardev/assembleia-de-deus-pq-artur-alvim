/* ============================================================
   PAINEL — EBD (Escola Bíblica Dominical)
   ------------------------------------------------------------
   1. Cadastre o trimestre uma vez: o painel cria as lições em
      sequência, uma por domingo, como rascunho.
   2. A cada semana, a equipe preenche/revisa a lição e publica
      (ou agenda a publicação).
   As permissões ficam no banco (RLS): só os e-mails de admin gravam.
   ============================================================ */
const ebdAdmin = {
  loaded: false,
  loading: false,
  missing: false,
  error: "",
  quarters: [],
  lessons: [],
  qid: null,
  editing: null, // cópia da lição sendo editada
  creating: null, // formulário de novo trimestre
  saving: false,
  syncing: false,
  syncMsg: "",
  autoTried: false,
};

const EBD_STATUS = {
  rascunho: { label: "Rascunho", cls: "st-draft" },
  revisao: { label: "Em revisão", cls: "st-review" },
  publicado: { label: "Publicada", cls: "st-live" },
};
const EBD_MAGAZINES = ["Adultos", "Jovens", "Adolescentes", "Juvenis", "Pré-adolescentes", "Juniores", "Primários", "Jardim de Infância", "Maternal", "Berçário", "Discipulando"];

function ebdStatusBadge(l) {
  const scheduled = l.status === "publicado" && l.publish_at && Date.parse(l.publish_at) > Date.now();
  const s = scheduled ? { label: `Agendada · ${fmtDate(l.publish_at.slice(0, 10))}`, cls: "st-scheduled" } : EBD_STATUS[l.status] || EBD_STATUS.rascunho;
  return `<span class="ebd-badge ${s.cls}">${esc(s.label)}</span>`;
}

const ebdSelectedQuarter = () => ebdAdmin.quarters.find((q) => q.id === ebdAdmin.qid) || null;

async function loadEbdAdmin(qid) {
  ebdAdmin.loading = true;
  const { data: quarters, error } = await db("ebd_quarters").select("*").order("year", { ascending: false }).order("quarter", { ascending: false }).order("magazine");
  if (error) {
    ebdAdmin.missing = ebdIsMissingTable(error);
    ebdAdmin.error = error.message;
    ebdAdmin.loaded = true;
    ebdAdmin.loading = false;
    if (adminTab === "ebd") renderAdmin();
    return;
  }
  ebdAdmin.missing = false;
  ebdAdmin.quarters = quarters || [];
  const today = spToday();
  const fallback = ebdAdmin.quarters.find((q) => ebdQuarterRunning(q, today)) || ebdAdmin.quarters[0];
  ebdAdmin.qid = (qid && ebdAdmin.quarters.some((q) => q.id === qid) && qid) || (ebdAdmin.quarters.some((q) => q.id === ebdAdmin.qid) && ebdAdmin.qid) || fallback?.id || null;
  ebdAdmin.lessons = [];
  if (ebdAdmin.qid) {
    const { data: lessons } = await db("ebd_lessons").select("*").eq("quarter_id", ebdAdmin.qid).order("number");
    ebdAdmin.lessons = lessons || [];
  }
  await bibleIndex().catch(() => {}); // para conferir as referências bíblicas
  ebdAdmin.loaded = true;
  ebdAdmin.loading = false;
  if (adminTab === "ebd") renderAdmin();
  ebdMaybeAutoSync();
}

function tabEbd() {
  const head = topbar("Escola Bíblica Dominical", ebdAdmin.loaded && !ebdAdmin.missing && !ebdAdmin.editing && !ebdAdmin.creating ? `<button class="btn btn-primary btn-sm" type="button" onclick="ebdStartNewQuarter()">+ Novo trimestre</button>` : "");
  if (!ebdAdmin.loaded) {
    if (!ebdAdmin.loading) loadEbdAdmin();
    return head + `<div class="admin-card"><div class="admin-empty">Carregando…</div></div>`;
  }
  if (ebdAdmin.missing) return head + ebdSetupHTML();
  if (ebdAdmin.error && !ebdAdmin.quarters.length) return head + `<div class="admin-card"><p class="admin-note admin-warn">${icon("x", 14)} Erro ao carregar: ${esc(ebdAdmin.error)}</p><button class="btn btn-ghost btn-sm" type="button" onclick="loadEbdAdmin()">Tentar de novo</button></div>`;
  if (ebdAdmin.creating) return head + ebdNewQuarterHTML();
  if (ebdAdmin.editing) return head + ebdLessonEditorHTML();
  return head + ebdOverviewHTML();
}

function ebdSetupHTML() {
  return `<div class="admin-card">
    <h3>Falta ativar a EBD no banco de dados</h3>
    <p class="admin-note">Isso é feito uma vez só e não apaga nada:</p>
    <ol class="install-steps">
      <li>Abra o Supabase do site → <strong>SQL Editor</strong> → <strong>New query</strong>.</li>
      <li>Cole o conteúdo do arquivo <code>supabase/migrations/20261010_ebd.sql</code> (está na pasta do projeto).</li>
      <li>Clique em <strong>Run</strong> e volte aqui.</li>
    </ol>
    <button class="btn btn-primary btn-sm" type="button" onclick="try { sessionStorage.removeItem('ebd-off') } catch {} ebdAdmin.loaded=false; renderAdmin()">Já rodei, verificar</button>
  </div>`;
}

const ebdCopyrightNote = `<p class="admin-note">${icon("book", 13)} Não copie o texto da revista. Use as referências bíblicas (o site mostra o texto da Bíblia Livre), escreva a ideia central, os pontos e as perguntas com as palavras da equipe e coloque o link da lição na fonte oficial.</p>`;

function ebdOverviewHTML() {
  const q = ebdSelectedQuarter();
  if (!ebdAdmin.quarters.length) {
    return `<div class="admin-card">
      <div class="admin-empty">Nenhum trimestre cadastrado ainda.</div>
      <p class="admin-note">Toque em “Sincronizar agora” abaixo para importar o trimestre atual do sumário, ou cadastre à mão em “+ Novo trimestre”.</p>
    </div>
    ${ebdSyncCardHTML()}`;
  }
  const today = spToday();
  const week = q ? ebdAdmin.lessons.find((l) => ebdStudyDate(l.lesson_date) >= today) : null;
  // Data da revista + aviso quando a lição vai para outro culto (ex.: Ceia no domingo).
  const dateLabel = (iso) => {
    const s = ebdStudyInfo(iso);
    return fmtDateFull(iso) + (s.moved ? ` → estudada ${onWeekday(s.day)}, ${fmtDate(s.date)}, no ${s.service} (${s.reason} ${onWeekday(s.fromDay)})` : "");
  };
  return `
    <div class="admin-card">
      <div class="field-row">
        ${field(
          "Trimestre",
          `<select onchange="ebdSelectQuarter(this.value)">${ebdAdmin.quarters
            .map((x) => `<option value="${esc(x.id)}" ${x.id === ebdAdmin.qid ? "selected" : ""}>${esc(ebdQuarterLabel(x))} · ${esc(x.magazine)}${x.theme ? " — " + esc(truncate(x.theme, 40)) : ""}${x.visible ? "" : " (oculto)"}</option>`)
            .join("")}</select>`,
          true,
        )}
      </div>
    </div>
    ${
      week
        ? `<div class="admin-card ebd-week">
      <h3>Esta semana</h3>
      <div class="ebd-week-row">
        <div><strong>Lição ${week.number} · ${esc(dateLabel(week.lesson_date))}</strong><span>${esc(week.title || "Sem título ainda")}</span></div>
        ${ebdStatusBadge(week)}
        <button class="btn btn-primary btn-sm" type="button" onclick="ebdEditLesson('${esc(week.id)}')">${week.status === "publicado" ? "Ver / editar" : "Revisar e publicar"}</button>
      </div>
    </div>`
        : ""
    }
    ${ebdSyncCardHTML()}
    ${q ? ebdQuarterFormHTML(q) : ""}
    <div class="admin-card">
      <h3>Lições</h3>
      ${ebdAdmin.lessons
        .map(
          (l) => `
        <div class="admin-list-item ebd-lesson-item${week && l.id === week.id ? " is-week" : ""}">
          <div class="meta"><strong>${l.number}. ${esc(l.title || "Sem título")}</strong><small>${esc(dateLabel(l.lesson_date))}</small></div>
          <div class="item-actions">
            ${ebdStatusBadge(l)}
            <button class="btn btn-ghost btn-sm" type="button" onclick="ebdEditLesson('${esc(l.id)}')">Editar</button>
          </div>
        </div>`,
        )
        .join("")}
      <div class="admin-card-foot">
        <button class="btn btn-ghost btn-sm" type="button" onclick="ebdAddLesson()">+ Adicionar lição</button>
      </div>
      ${ebdCopyrightNote}
    </div>`;
}

function ebdQuarterFormHTML(q) {
  return `<details class="admin-card ebd-qform">
    <summary><h3>Dados do trimestre</h3></summary>
    <div class="field-row">
      ${field("Tema do trimestre", `<input type="text" value="${esc(q.theme)}" data-k="theme">`, true)}
      ${field("Revista / faixa", `<input type="text" list="ebdMagazines" value="${esc(q.magazine)}" data-k="magazine">`)}
      ${field("Comentarista", `<input type="text" value="${esc(q.commentator)}" data-k="commentator">`)}
      ${field("Editora", `<input type="text" value="${esc(q.publisher)}" data-k="publisher">`)}
      ${field("Link oficial do trimestre (sumário ou loja)", `<input type="url" value="${esc(q.source_url)}" data-k="source_url" placeholder="https://">`, true)}
    </div>
    <label class="check"><input type="checkbox" data-k="visible" ${q.visible ? "checked" : ""}> Mostrar este trimestre no site</label>
    <datalist id="ebdMagazines">${EBD_MAGAZINES.map((m) => `<option value="${esc(m)}">`).join("")}</datalist>
    <div class="admin-card-foot sticky-actions">
      <button class="btn btn-danger btn-sm" type="button" onclick="ebdDeleteQuarter()">Apagar trimestre</button>
      <button class="btn btn-primary btn-sm" type="button" onclick="ebdSaveQuarter(this)">Salvar trimestre</button>
    </div>
  </details>`;
}

function ebdSelectQuarter(id) {
  ebdAdmin.loaded = false;
  ebdAdmin.loading = true;
  renderAdmin();
  loadEbdAdmin(id);
}

async function ebdSaveQuarter(btn) {
  const q = ebdSelectedQuarter();
  const box = btn.closest(".ebd-qform");
  const val = (k) => box.querySelector(`[data-k="${k}"]`);
  const magazine = val("magazine").value.trim() || "Adultos";
  const payload = {
    theme: val("theme").value.trim(),
    magazine,
    magazine_slug: slugify(magazine) || "adultos",
    commentator: val("commentator").value.trim(),
    publisher: val("publisher").value.trim(),
    source_url: val("source_url").value.trim(),
    visible: val("visible").checked,
  };
  if (payload.source_url && !safeUrl(payload.source_url)) return showToast("O link oficial precisa começar com https://", "error");
  const ok = await dbWrite(db("ebd_quarters").update(payload).eq("id", q.id), "Trimestre salvo", "Erro ao salvar o trimestre.");
  if (ok) loadEbdAdmin(q.id);
}

async function ebdDeleteQuarter() {
  const q = ebdSelectedQuarter();
  if (!q) return;
  const n = ebdAdmin.lessons.length;
  if (!confirm(`Apagar o ${ebdQuarterLabel(q)} (${q.magazine})?\n\nAs ${n} lições dele também serão apagadas. Isso não pode ser desfeito.`)) return;
  const ok = await dbWrite(db("ebd_quarters").delete().eq("id", q.id), "Trimestre apagado", "Erro ao apagar.");
  if (ok) {
    ebdAdmin.qid = null;
    loadEbdAdmin();
  }
}

/* ---------- Novo trimestre ---------- */
// Primeiro domingo do trimestre (jan, abr, jul ou out).
function ebdFirstSunday(year, quarter) {
  const d = new Date(Date.UTC(year, (quarter - 1) * 3, 1, 12));
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7));
  return d.toISOString().slice(0, 10);
}

function ebdStartNewQuarter() {
  const today = spToday();
  const year = Number(today.slice(0, 4));
  const quarter = Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1;
  ebdAdmin.creating = { year, quarter, magazine: "Adultos", theme: "", commentator: "", publisher: "CPAD", source_url: "", start_date: ebdFirstSunday(year, quarter), lesson_count: 13 };
  renderAdmin();
}

function ebdNewQuarterHTML() {
  const c = ebdAdmin.creating;
  const isSunday = new Date(c.start_date + "T12:00:00Z").getUTCDay() === 0;
  return `<div class="admin-card">
    <h3>Novo trimestre</h3>
    <p class="admin-note"><strong>Importar do sumário</strong> (revistas Adultos e Jovens): tema, títulos, datas e referências vêm prontos. <strong>Criar vazio</strong>: as lições são criadas em branco, uma por domingo, para preencher à mão.</p>
    <div class="field-row">
      ${field("Ano", `<input type="number" min="2020" max="2100" value="${c.year}" onchange="ebdNewSet('year', Number(this.value), true)">`)}
      ${field("Trimestre", `<select onchange="ebdNewSet('quarter', Number(this.value), true)">${[1, 2, 3, 4].map((n) => `<option value="${n}" ${n === c.quarter ? "selected" : ""}>${n}º trimestre</option>`).join("")}</select>`)}
      ${field("Revista / faixa", `<input type="text" list="ebdMagazinesNew" value="${esc(c.magazine)}" oninput="ebdNewSet('magazine', this.value)"><datalist id="ebdMagazinesNew">${EBD_MAGAZINES.map((m) => `<option value="${esc(m)}">`).join("")}</datalist>`)}
      ${field("Data da 1ª lição (domingo)", `<input type="date" value="${esc(c.start_date)}" onchange="ebdNewSet('start_date', this.value, true)">${isSunday ? "" : `<small class="ebd-warn">Essa data não é domingo.</small>`}`)}
      ${field("Quantidade de lições", `<input type="number" min="1" max="20" value="${c.lesson_count}" onchange="ebdNewSet('lesson_count', Number(this.value))">`)}
      ${field("Tema do trimestre", `<input type="text" value="${esc(c.theme)}" oninput="ebdNewSet('theme', this.value)" placeholder="Como está na capa da revista">`, true)}
      ${field("Comentarista", `<input type="text" value="${esc(c.commentator)}" oninput="ebdNewSet('commentator', this.value)">`)}
      ${field("Editora", `<input type="text" value="${esc(c.publisher)}" oninput="ebdNewSet('publisher', this.value)">`)}
      ${field("Link oficial do trimestre (opcional)", `<input type="url" value="${esc(c.source_url)}" oninput="ebdNewSet('source_url', this.value)" placeholder="https://">`, true)}
    </div>
    <div class="admin-card-foot">
      <button class="btn btn-ghost btn-sm" type="button" onclick="ebdAdmin.creating=null; renderAdmin()">Cancelar</button>
      <div class="inline-fields">
        <button class="btn btn-ghost btn-sm" type="button" onclick="ebdCreateQuarter(this)">Criar vazio</button>
        <button class="btn btn-primary btn-sm" type="button" onclick="ebdImportNewQuarter()">Importar do sumário</button>
      </div>
    </div>
  </div>`;
}

function ebdNewSet(k, v, rerender = false) {
  ebdAdmin.creating[k] = v;
  if (k === "year" || k === "quarter") ebdAdmin.creating.start_date = ebdFirstSunday(ebdAdmin.creating.year, ebdAdmin.creating.quarter);
  if (rerender) renderAdmin();
}

async function ebdCreateQuarter(btn) {
  const c = ebdAdmin.creating;
  if (!c.year || !c.quarter || !c.start_date) return showToast("Preencha ano, trimestre e data da 1ª lição.", "error");
  if (c.source_url && !safeUrl(c.source_url)) return showToast("O link oficial precisa começar com https://", "error");
  const count = Math.max(1, Math.min(20, c.lesson_count || 13));
  btn.disabled = true;
  const magazine = c.magazine.trim() || "Adultos";
  const { data: q, error } = await db("ebd_quarters")
    .insert({ year: c.year, quarter: c.quarter, magazine, magazine_slug: slugify(magazine) || "adultos", theme: c.theme.trim(), commentator: c.commentator.trim(), publisher: c.publisher.trim(), source_url: c.source_url.trim(), start_date: c.start_date, lesson_count: count })
    .select()
    .single();
  if (error) {
    btn.disabled = false;
    if (error.code !== "23505") console.error(error); // repetido é só aviso
    return showToast(error.code === "23505" ? "Esse trimestre já está cadastrado para essa revista." : "Erro ao criar o trimestre.", "error");
  }
  const rows = Array.from({ length: count }, (_, i) => ({ quarter_id: q.id, number: i + 1, lesson_date: isoAddDays(c.start_date, 7 * i) }));
  const ok = await dbWrite(db("ebd_lessons").insert(rows), `Trimestre criado com ${count} lições`, "O trimestre foi criado, mas houve erro ao criar as lições.");
  ebdAdmin.creating = null;
  if (ok) loadEbdAdmin(q.id);
  else loadEbdAdmin(q.id);
}

async function ebdAddLesson() {
  const q = ebdSelectedQuarter();
  if (!q) return;
  const last = ebdAdmin.lessons[ebdAdmin.lessons.length - 1];
  const number = (last?.number || 0) + 1;
  if (number > 20) return showToast("Limite de 20 lições por trimestre.", "error");
  const lesson_date = last ? isoAddDays(last.lesson_date, 7) : q.start_date;
  const ok = await dbWrite(db("ebd_lessons").insert({ quarter_id: q.id, number, lesson_date }), `Lição ${number} adicionada`);
  if (ok) {
    await dbWrite(db("ebd_quarters").update({ lesson_count: Math.max(q.lesson_count, number) }).eq("id", q.id));
    loadEbdAdmin(q.id);
  }
}

/* ---------- Editor da lição ---------- */
function ebdEditLesson(id) {
  const l = ebdAdmin.lessons.find((x) => x.id === id);
  if (!l) return;
  ebdAdmin.editing = {
    ...structuredClone(l),
    daily_refs: Array.from({ length: 6 }, (_, i) => (l.daily_refs || [])[i] || ""),
    questions: (Array.isArray(l.questions) ? l.questions : []).map((x) => ({ q: x.q || "", a: x.a || "" })),
    links: (Array.isArray(l.links) ? l.links : []).map((x) => ({ label: x.label || "", url: x.url || "" })),
    publish_local: l.publish_at ? ebdToLocalInput(l.publish_at) : "",
  };
  renderAdmin();
  document.getElementById("adminContent")?.scrollTo?.({ top: 0 });
}

const ebdToLocalInput = (iso) => {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

// Mostra, ao lado do campo, como o site entendeu a referência.
function ebdRefHintText(value) {
  if (!value || !value.trim()) return "";
  const refs = parseRefList(value);
  const parts = String(value).split(/\s*;\s*/).filter(Boolean).length;
  if (!refs.length) return `<span class="ref-bad">${icon("x", 12)} Não reconheci essa referência</span>`;
  return `<span class="${refs.length < parts ? "ref-bad" : "ref-ok"}">${icon(refs.length < parts ? "x" : "check", 12)} ${esc(refListLabel(refs))}${refs.length < parts ? " (parte não reconhecida)" : ""}</span>`;
}

function ebdRefInput(key, value, placeholder, onInput) {
  return `<input type="text" value="${esc(value)}" placeholder="${esc(placeholder)}" oninput="${onInput}; this.nextElementSibling.innerHTML = ebdRefHintText(this.value)"><small class="ref-hint">${ebdRefHintText(value)}</small>`;
}

function ebdDraftSet(k, v) {
  ebdAdmin.editing[k] = v;
}

function ebdLessonEditorHTML() {
  const l = ebdAdmin.editing;
  const q = ebdSelectedQuarter();
  return `
    <div class="admin-card">
      <button class="btn btn-ghost btn-sm" type="button" onclick="ebdCloseEditor()">${icon("arrowBack", 14)} Voltar para as lições</button>
      <h3 class="ebd-editor-title">Lição ${l.number} · ${esc(fmtDateFull(l.lesson_date))} ${ebdStatusBadge(l)}</h3>
      <div class="field-row">
        ${field("Título da lição", `<input type="text" value="${esc(l.title)}" oninput="ebdDraftSet('title', this.value)">`, true)}
        ${field("Data da revista (domingo)", `<input type="date" value="${esc(l.lesson_date)}" onchange="ebdDraftSet('lesson_date', this.value)">`)}
        ${field("Texto áureo (referência)", ebdRefInput("golden_ref", l.golden_ref, "Ex.: Jo 3.16", "ebdDraftSet('golden_ref', this.value)"))}
        ${field("Leitura bíblica em classe (referência)", ebdRefInput("reading_ref", l.reading_ref, "Ex.: Mt 5.1-12", "ebdDraftSet('reading_ref', this.value)"), true)}
      </div>
      <p class="admin-note">Digite só a referência; o site mostra o texto bíblico da Bíblia Livre automaticamente.</p>
      ${ebdStudyInfo(l.lesson_date).moved ? `<p class="admin-note">${esc(ebdMovedText(ebdStudyInfo(l.lesson_date)))} O site já mostra a lição nessa data (regra na aba Cultos); não precisa mudar a data acima.</p>` : ""}
    </div>
    <div class="admin-card">
      <h3>Leitura diária</h3>
      <div class="field-row compact">
        ${EBD_DAYS.map((d, i) => field(d, ebdRefInput("daily", l.daily_refs[i], "Ex.: Sl 23", `ebdAdmin.editing.daily_refs[${i}] = this.value`))).join("")}
      </div>
    </div>
    <div class="admin-card">
      <h3>Estudo (texto da equipe)</h3>
      <div class="field-row">
        ${field("Ideia central", `<textarea rows="2" oninput="ebdDraftSet('key_idea', this.value)" placeholder="Em uma ou duas frases, com as palavras da equipe">${esc(l.key_idea)}</textarea>`, true)}
        ${field("Pontos principais", `<textarea rows="7" oninput="ebdDraftSet('summary', this.value)" placeholder="Parágrafos separados por uma linha em branco. Para lista, comece a linha com “- ”.">${esc(l.summary)}</textarea>`, true)}
      </div>
    </div>
    <div class="admin-card">
      <h3>Perguntas para aprofundar</h3>
      ${l.questions
        .map(
          (x, i) => `<div class="admin-subcard">
        <div class="field-row">
          ${field(`Pergunta ${i + 1}`, `<textarea rows="2" oninput="ebdAdmin.editing.questions[${i}].q = this.value">${esc(x.q)}</textarea>`, true)}
          ${field("Resposta sugerida (opcional, fica escondida até a pessoa abrir)", `<textarea rows="2" oninput="ebdAdmin.editing.questions[${i}].a = this.value">${esc(x.a)}</textarea>`, true)}
        </div>
        <div class="admin-card-foot end"><button class="btn btn-danger btn-sm" type="button" onclick="ebdAdmin.editing.questions.splice(${i}, 1); renderAdmin()">Remover</button></div>
      </div>`,
        )
        .join("")}
      <button class="btn btn-ghost btn-sm" type="button" onclick="ebdAdmin.editing.questions.push({ q: '', a: '' }); renderAdmin()">+ Adicionar pergunta</button>
    </div>
    <div class="admin-card">
      <h3>Links</h3>
      <div class="field-row">
        ${field("Link desta lição na fonte oficial", `<input type="url" value="${esc(l.source_url)}" oninput="ebdDraftSet('source_url', this.value)" placeholder="${esc(q?.source_url || "https://")}">`, true)}
      </div>
      ${l.links
        .map(
          (x, i) => `<div class="admin-list-item">
        ${field("Material complementar", `<input type="text" value="${esc(x.label)}" oninput="ebdAdmin.editing.links[${i}].label = this.value" placeholder="Ex.: Vídeo da aula">`)}
        ${field("Endereço", `<input type="url" value="${esc(x.url)}" oninput="ebdAdmin.editing.links[${i}].url = this.value" placeholder="https://">`)}
        <div class="item-actions"><button class="icon-btn" type="button" onclick="ebdAdmin.editing.links.splice(${i}, 1); renderAdmin()" aria-label="Remover">${icon("x", 16)}</button></div>
      </div>`,
        )
        .join("")}
      <button class="btn btn-ghost btn-sm" type="button" onclick="ebdAdmin.editing.links.push({ label: '', url: '' }); renderAdmin()">+ Adicionar material</button>
      ${ebdCopyrightNote}
    </div>
    <div class="admin-card">
      <h3>Revisão e publicação</h3>
      <div class="field-row">
        ${field("Situação", `<select onchange="ebdDraftSet('status', this.value)">${Object.entries(EBD_STATUS)
          .map(([k, s]) => `<option value="${k}" ${l.status === k ? "selected" : ""}>${s.label}</option>`)
          .join("")}</select>`)}
        ${field("Publicar automaticamente em (opcional)", `<input type="datetime-local" value="${esc(l.publish_local)}" onchange="ebdDraftSet('publish_local', this.value)">`)}
        ${field("Revisado por", `<input type="text" value="${esc(l.reviewed_by)}" oninput="ebdDraftSet('reviewed_by', this.value)" placeholder="Nome de quem revisou">`)}
      </div>
      <p class="admin-note">Só aparece no site quando a situação é “Publicada”. Com data de publicação, ela entra sozinha no dia e hora marcados.</p>
      <div class="admin-card-foot sticky-actions">
        <a class="btn btn-ghost btn-sm" href="${q ? ebdLessonPath(q, l.number) : "/ebd"}" target="_blank" rel="noopener">${icon("external", 14)} Pré-visualizar</a>
        <div class="inline-fields">
          <button class="btn btn-ghost btn-sm" type="button" onclick="ebdSaveLesson()">Salvar</button>
          ${l.status === "publicado" ? "" : `<button class="btn btn-primary btn-sm" type="button" onclick="ebdSaveLesson('publicado')">Salvar e publicar</button>`}
        </div>
      </div>
    </div>`;
}

function ebdCloseEditor() {
  ebdAdmin.editing = null;
  renderAdmin();
}

async function ebdSaveLesson(status) {
  if (ebdAdmin.saving) return;
  const l = ebdAdmin.editing;
  const finalStatus = status || l.status;
  if (finalStatus === "publicado" && !l.title.trim()) return showToast("Dê um título à lição antes de publicar.", "error");
  const badLinks = l.links.filter((x) => x.url.trim() && !safeUrl(x.url.trim()));
  if (badLinks.length || (l.source_url.trim() && !safeUrl(l.source_url.trim()))) return showToast("Os links precisam começar com https://", "error");
  if (finalStatus === "publicado" && l.golden_ref.trim() && !parseRefList(l.golden_ref).length) {
    if (!confirm("Não reconheci a referência do texto áureo. Publicar assim mesmo?")) return;
  }
  const payload = {
    title: l.title.trim(),
    lesson_date: l.lesson_date,
    golden_ref: l.golden_ref.trim(),
    reading_ref: l.reading_ref.trim(),
    daily_refs: l.daily_refs.map((x) => x.trim()),
    key_idea: l.key_idea.trim(),
    summary: l.summary.trim(),
    questions: l.questions.filter((x) => x.q.trim()).map((x) => ({ q: x.q.trim(), a: x.a.trim() })),
    links: l.links.filter((x) => x.url.trim()).map((x) => ({ label: x.label.trim(), url: x.url.trim() })),
    source_url: l.source_url.trim(),
    status: finalStatus,
    publish_at: l.publish_local ? new Date(l.publish_local).toISOString() : null,
    reviewed_by: l.reviewed_by.trim(),
  };
  ebdAdmin.saving = true;
  const ok = await dbWrite(db("ebd_lessons").update(payload).eq("id", l.id), finalStatus === "publicado" && status ? "Lição publicada!" : "Lição salva", "Erro ao salvar a lição.");
  ebdAdmin.saving = false;
  if (!ok) return;
  // A página pública guarda uma cópia; limpa para mostrar a versão nova.
  try {
    localStorage.removeItem(EBD_CACHE_KEY);
  } catch {}
  Object.assign(l, payload);
  const i = ebdAdmin.lessons.findIndex((x) => x.id === l.id);
  if (i >= 0) ebdAdmin.lessons[i] = { ...ebdAdmin.lessons[i], ...payload };
  renderAdmin();
}

/* ============================================================
   IMPORTAÇÃO AUTOMÁTICA DO SUMÁRIO (estudantesdabiblia.com.br)
   ------------------------------------------------------------
   Todo dia às 06:00 uma função da Vercel confere o sumário sozinha.
   Aqui ficam as opções e o botão "Sincronizar agora". Só títulos,
   datas e referências bíblicas são importados — nunca o texto da
   revista — e nada que a equipe escreveu é sobrescrito.
   ============================================================ */
const EBD_SYNC_MAGAZINES = [
  ["adultos", "Adultos"],
  ["jovens", "Jovens"],
];
const EBD_SYNC_LAST_KEY = "ebd-sync-last";

// Trimestre atual e, até 21 dias antes da virada, também o próximo.
function ebdQuartersToSync(today = spToday()) {
  const year = Number(today.slice(0, 4));
  const quarter = Math.ceil(Number(today.slice(5, 7)) / 3);
  const list = [{ year, quarter }];
  const next = quarter === 4 ? { year: year + 1, quarter: 1 } : { year, quarter: quarter + 1 };
  if ((Date.parse(ebdFirstSunday(next.year, next.quarter)) - Date.parse(today)) / 864e5 <= 21) list.push(next);
  return list;
}

function ebdSyncLast() {
  try {
    return JSON.parse(localStorage.getItem(EBD_SYNC_LAST_KEY) || "null");
  } catch {
    return null;
  }
}

function ebdSyncCardHTML() {
  const cfg = data.ebdSync || defaultData.ebdSync;
  const last = ebdSyncLast();
  return `<div class="admin-card ebd-sync">
    <h3>Importação automática</h3>
    <label class="check"><input type="checkbox" ${cfg.enabled ? "checked" : ""} onchange="ebdSyncSet('enabled', this.checked)"> Importar as lições sozinho, todo dia às 06:00, do sumário em estudantesdabiblia.com.br</label>
    <div class="ebd-sync-mags">
      <span>Revistas:</span>
      ${EBD_SYNC_MAGAZINES.map(([slug, name]) => `<label class="check"><input type="checkbox" ${cfg.magazines.includes(slug) ? "checked" : ""} onchange="ebdSyncMagazine('${slug}', this.checked)"> ${name}</label>`).join("")}
    </div>
    <label class="check"><input type="checkbox" ${cfg.autoPublish ? "checked" : ""} onchange="ebdSyncSet('autoPublish', this.checked)"> Publicar sozinho: cada lição importada entra no ar na segunda-feira da semana dela (para segurar uma lição, marque “Em revisão”)</label>
    <p class="admin-note">Vêm do sumário só o tema, o comentarista, os títulos, as datas e as referências bíblicas (texto áureo, leitura em classe e leitura diária). O texto da revista não é copiado, e o que a equipe escrever nunca é substituído.</p>
    <div class="admin-card-foot">
      <span class="ebd-sync-status" id="ebdSyncStatus" role="status">${esc(ebdAdmin.syncMsg || (last ? `Última sincronização: ${new Date(last.at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} — ${last.summary}` : "Ainda não sincronizado neste aparelho."))}</span>
      <button class="btn btn-primary btn-sm" type="button" onclick="ebdSyncNow()" ${ebdAdmin.syncing ? "disabled" : ""}>${ebdAdmin.syncing ? "Sincronizando…" : "Sincronizar agora"}</button>
    </div>
  </div>`;
}

function ebdSyncSet(key, value) {
  data.ebdSync = { ...defaultData.ebdSync, ...(data.ebdSync || {}), [key]: value };
  persist();
}

function ebdSyncMagazine(slug, on) {
  const cur = new Set((data.ebdSync || defaultData.ebdSync).magazines);
  if (on) cur.add(slug);
  else cur.delete(slug);
  if (!cur.size) {
    showToast("Deixe pelo menos uma revista marcada (ou desligue a importação).", "error");
    renderAdmin();
    return;
  }
  ebdSyncSet("magazines", EBD_SYNC_MAGAZINES.map(([s]) => s).filter((s) => cur.has(s)));
}

function ebdSyncPaint(msg) {
  ebdAdmin.syncMsg = msg;
  const el = document.getElementById("ebdSyncStatus");
  if (el) el.textContent = msg;
}

async function ebdSyncCall(year, quarter, magazine) {
  const { data: s } = await supabaseClient.auth.getSession();
  const jwt = s?.session?.access_token;
  if (!jwt) throw new Error("Sessão expirada. Entre de novo no painel.");
  const res = await fetch("/api/ebd-sincronizar", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ year, quarter, magazine }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Erro ${res.status}`);
  return body;
}

// targets: [{ year, quarter, magazine }]; sem targets, usa o trimestre atual
// (e o próximo, perto da virada) das revistas marcadas.
async function ebdSyncNow({ targets, quiet = false } = {}) {
  if (ebdAdmin.syncing) return;
  const cfg = data.ebdSync || defaultData.ebdSync;
  const list = targets || cfg.magazines.flatMap((magazine) => ebdQuartersToSync().map((q) => ({ ...q, magazine })));
  ebdAdmin.syncing = true;
  if (!quiet && adminTab === "ebd") renderAdmin();
  ebdSyncPaint("Conferindo o sumário…");
  const total = { created: 0, filled: 0, published: 0 };
  const notes = [];
  let firstQuarterId = null;
  try {
    for (const t of list) {
      const label = `${t.quarter}º trimestre de ${t.year} (${t.magazine})`;
      let before = Infinity;
      for (let i = 0; i < 8; i++) {
        const r = await ebdSyncCall(t.year, t.quarter, t.magazine);
        if (r.skipped) {
          notes.push(`${label}: ${r.skipped}`);
          break;
        }
        firstQuarterId ||= r.quarter_id;
        total.created += r.created || 0;
        total.filled += r.filled || 0;
        total.published += r.published || 0;
        if (!r.remaining || r.remaining >= before) break;
        before = r.remaining;
        ebdSyncPaint(`Importando ${label}… faltam ${r.remaining} lições`);
      }
    }
    const parts = [];
    if (total.created) parts.push(`${total.created} lições criadas`);
    if (total.filled) parts.push(`${total.filled} completadas`);
    if (total.published) parts.push(`${total.published} publicadas`);
    const summary = parts.join(", ") || (notes.length ? notes.join(" · ") : "tudo em dia");
    try {
      localStorage.setItem(EBD_SYNC_LAST_KEY, JSON.stringify({ at: Date.now(), summary }));
    } catch {}
    ebdSyncPaint(`Sincronizado agora — ${summary}`);
    if (!quiet || parts.length) showToast(parts.length ? `EBD: ${summary}.` : "EBD: o sumário não trouxe novidades.", "success");
    if (parts.length) {
      try {
        localStorage.removeItem(EBD_CACHE_KEY); // páginas públicas buscam a versão nova
      } catch {}
    }
  } catch (e) {
    ebdSyncPaint(`Não foi possível sincronizar: ${e.message}`);
    if (!quiet) showToast(e.message, "error");
  } finally {
    ebdAdmin.syncing = false;
    // Recarrega a lista (sem atrapalhar quem estiver editando uma lição).
    if (adminTab === "ebd" && !ebdAdmin.editing && !ebdAdmin.creating) loadEbdAdmin(targets ? firstQuarterId : ebdAdmin.qid);
  }
}

// Ao abrir a aba, confere o sumário em segundo plano (no máximo a cada 6 h).
function ebdMaybeAutoSync() {
  const cfg = data.ebdSync || defaultData.ebdSync;
  const last = ebdSyncLast();
  if (!cfg.enabled || ebdAdmin.syncing || ebdAdmin.autoTried) return;
  if (last && Date.now() - last.at < 6 * 3600e3) return;
  ebdAdmin.autoTried = true;
  ebdSyncNow({ quiet: true });
}

// "Novo trimestre" → importar direto do sumário em vez de criar vazio.
async function ebdImportNewQuarter() {
  const c = ebdAdmin.creating;
  const slug = slugify(c.magazine);
  if (!EBD_SYNC_MAGAZINES.some(([s]) => s === slug)) return showToast("O sumário tem as revistas Adultos e Jovens. Para outras, use “Criar trimestre e lições”.", "error");
  ebdAdmin.creating = null;
  renderAdmin();
  await ebdSyncNow({ targets: [{ year: c.year, quarter: c.quarter, magazine: slug }] });
}
