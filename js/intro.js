/* ============================================================
   VINHETA DE ABERTURA
   ------------------------------------------------------------
   O tipo de abertura é escolhido no <head> (index.html), antes da
   primeira pintura, e fica em <html data-intro="...">:
     full     sempre que o site é aberto: vinheta completa de 6 s
     short    quando o site recarrega sozinho para atualizar: ~1,2 s
     reduced  aparelho com "reduzir movimento": tela final parada
   Quem quiser entrar direto toca em "Pular abertura".
   Este arquivo prepara a frase (letra por letra), desenha as
   partículas e cuida do "Pular". O js/main.js espera INTRO.done
   para tirar a abertura da tela.
   ============================================================ */
(function () {
  var root = document.documentElement;
  var splash = document.getElementById("splash");
  var DURATION = { full: 6000, short: 1200, reduced: 600 };
  var mode = root.getAttribute("data-intro") || "reduced";
  var ms = DURATION[mode] || 600;

  var resolveDone;
  var done = new Promise(function (r) {
    resolveDone = r;
  });
  var ended = false;
  var stopParticles = function () {};

  function end() {
    if (ended) return;
    ended = true;
    root.classList.add("intro-ended");
    stopParticles();
    resolveDone();
  }

  window.INTRO = { mode: mode, ms: ms, done: done, skip: skip };
  if (!splash) {
    end();
    return;
  }

  var lockup = splash.querySelector(".intro-lockup");
  var text = splash.querySelector(".intro-text");
  var tagline = splash.querySelector(".intro-tagline");

  // Frase da abertura: a última salva no painel (Aparência), se houver.
  try {
    var cached = JSON.parse(localStorage.getItem("site-theme") || "null");
    if (cached && cached.tagline) tagline.textContent = cached.tagline;
  } catch (e) {}

  // Quebra a frase em letras (cada palavra fica inteira na mesma linha).
  var words = tagline.textContent.trim().split(/\s+/);
  var n = 0;
  tagline.textContent = "";
  words.forEach(function (w, wi) {
    var ws = document.createElement("span");
    ws.className = "word";
    Array.from(w).forEach(function (c) {
      var s = document.createElement("span");
      s.className = "ch";
      s.style.setProperty("--i", n++);
      s.textContent = c;
      ws.appendChild(s);
    });
    tagline.appendChild(ws);
    if (wi < words.length - 1) {
      tagline.appendChild(document.createTextNode(" "));
      n++;
    }
  });
  // Frase longa: letras mais rápidas, para terminar dentro dos 6 s.
  tagline.style.setProperty("--step", Math.min(38, Math.round(900 / Math.max(1, n - 1))) + "ms");

  // Quanto o brasão sobe para o conjunto (brasão + textos) ficar centralizado.
  function measure() {
    var shift = (text.offsetTop + text.offsetHeight - lockup.offsetHeight) / 2;
    lockup.style.setProperty("--shift", Math.max(0, Math.round(shift)) + "px");
  }
  measure();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  addEventListener("resize", measure);
  splash.classList.add("ready");

  // Relógio da vinheta = relógio das animações CSS (que começam antes deste arquivo rodar).
  var elapsed = 0;
  try {
    var core = splash.querySelector(".intro-core");
    var anim = mode === "full" && core.getAnimations && core.getAnimations()[0];
    if (anim && anim.currentTime) elapsed = Math.min(anim.currentTime, 1500);
  } catch (e) {}
  var t0 = performance.now() - elapsed;
  setTimeout(end, Math.max(0, ms - elapsed));

  if (mode === "full") {
    stopParticles = particles(t0);
    var skipBtn = splash.querySelector(".intro-skip");
    skipBtn.addEventListener("click", skip);
    splash.addEventListener("pointerdown", function (e) {
      if (e.target !== skipBtn && !skipBtn.contains(e.target)) skip();
    });
    addEventListener("keydown", onKey);
  }

  function onKey(e) {
    if (ended) return removeEventListener("keydown", onKey);
    if (e.key === "Escape" || e.key === "Enter" || e.key === " ") skip();
  }

  // Pula para a tela final: termina todas as animações de uma vez.
  function skip() {
    if (ended) return;
    try {
      splash.getAnimations({ subtree: true }).forEach(function (a) {
        try {
          a.finish();
        } catch (e) {} // animações infinitas (brilho de fundo) continuam
      });
    } catch (e) {}
    end();
  }

  /* ---------- Partículas ----------
     Convergem para o centro (0,05–1,2 s) e explodem para fora no clarão
     (3,42 s). Cada partícula é um risco curto na direção do movimento,
     o que dá o efeito de motion blur. */
  function particles(start) {
    var canvas = splash.querySelector(".intro-particles");
    var ctx = canvas.getContext && canvas.getContext("2d");
    if (!ctx) return function () {};
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W, H, cx, cy, reach;
    var COLORS = ["255,255,255", "190,222,255", "134,171,202", "255,196,90", "255,140,40"];
    var rnd = Math.random;

    function size() {
      W = innerWidth;
      H = innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var r = lockup.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      reach = Math.hypot(W, H) / 2;
    }
    size();
    addEventListener("resize", size);

    var small = W < 700;
    var inward = [];
    for (var i = 0; i < (small ? 70 : 120); i++) {
      inward.push({
        a: rnd() * Math.PI * 2,
        d: (0.55 + rnd() * 0.65) * reach,
        delay: 0.05 + rnd() * 0.3, // todas chegam até ~1,2 s, quando a luz "explode"
        dur: 0.55 + rnd() * 0.3,
        spin: (rnd() - 0.5) * 1.4,
        w: 0.8 + rnd() * 1.8,
        c: COLORS[(rnd() * COLORS.length) | 0],
      });
    }
    var outward = [];
    for (var j = 0; j < (small ? 40 : 70); j++) {
      outward.push({
        a: rnd() * Math.PI * 2,
        d: (0.18 + rnd() * 0.5) * Math.min(W, H),
        delay: 3.42 + rnd() * 0.06,
        dur: 0.7 + rnd() * 0.6,
        w: 0.8 + rnd() * 1.6,
        c: COLORS[(rnd() * COLORS.length) | 0],
      });
    }

    var raf = 0;
    var stopped = false;

    function streak(x1, y1, x2, y2, w, color, alpha) {
      ctx.strokeStyle = "rgba(" + color + "," + alpha + ")";
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    function frame(now) {
      if (stopped) return;
      var t = (now - start) / 1000;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";

      inward.forEach(function (p) {
        var k = (t - p.delay) / p.dur;
        if (k <= 0 || k >= 1) return;
        var at = function (q) {
          var e = q * q * q; // acelera ao chegar no centro
          var r = p.d * (1 - e);
          var th = p.a + p.spin * e;
          return [cx + Math.cos(th) * r, cy + Math.sin(th) * r];
        };
        var head = at(k);
        var tail = at(Math.max(0, k - 0.09));
        streak(tail[0], tail[1], head[0], head[1], p.w, p.c, 0.25 + 0.75 * k);
      });

      outward.forEach(function (p) {
        var k = (t - p.delay) / p.dur;
        if (k <= 0 || k >= 1) return;
        var at = function (q) {
          var e = 1 - Math.pow(1 - q, 3); // sai rápido e desacelera
          var r = 12 + p.d * e;
          return [cx + Math.cos(p.a) * r, cy + Math.sin(p.a) * r];
        };
        var head = at(k);
        var tail = at(Math.max(0, k - 0.12));
        streak(tail[0], tail[1], head[0], head[1], p.w, p.c, 1 - k);
      });

      if (t < 4.6) raf = requestAnimationFrame(frame);
      else stop();
    }
    raf = requestAnimationFrame(frame);

    function stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      removeEventListener("resize", size);
      ctx.clearRect(0, 0, W, H);
    }
    return stop;
  }
})();
