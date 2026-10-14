/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

// Links antigos com "#" (ex.: /#eventos) viram endereços normais antes de tudo.
migrateLegacyHash();

// Se a sessão do admin expirar ou sair em outra aba, volta para a tela de login.
supabaseClient.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT" && (adminAuthed || adminGate)) {
    adminResetAccess();
    if (isAdminOpen()) renderAdmin();
  }
});

/* ---------- Tela de abertura (vinheta: js/intro.js) ---------- */
// Sem o js/intro.js, a abertura fica 0,7 s (evita "piscar").
const INTRO = window.INTRO || { ms: 700, done: new Promise((r) => setTimeout(r, 700)) };
const SPLASH_MAX_MS = INTRO.ms + 8000; // se o Supabase demorar, libera a tela mesmo assim
let siteReady = false;

function hideSplash() {
  const splash = document.getElementById("splash");
  if (!splash || splash.classList.contains("done")) return;
  // Libera as animações do site no mesmo instante em que a abertura começa a sumir.
  document.documentElement.classList.remove("booting", "intro-waiting");
  splash.classList.add("done");
  splash.addEventListener("transitionend", () => splash.remove(), { once: true });
  setTimeout(() => splash.remove(), 900);
}

setTimeout(hideSplash, SPLASH_MAX_MS);
// Vinheta acabou (ou foi pulada) e o site ainda carrega: mostra a barrinha.
INTRO.done.then(() => !siteReady && document.documentElement.classList.add("intro-waiting"));

(async function init() {
  try {
    await loadData();
    const route = currentRoute();
    if (route === "admin") openAdmin();
    else afterRoute(route);
    injectStructuredData();
  } catch (e) {
    console.error("Erro ao iniciar o site:", e);
  } finally {
    // Mesmo se algo falhar acima, a abertura some (ao fim da vinheta) e o
    // aviso de cookies aparece logo depois.
    siteReady = true;
    INTRO.done.then(() => {
      requestAnimationFrame(hideSplash);
      setTimeout(renderCookieBanner, 900);
    });
  }
})();

registerServiceWorker();
