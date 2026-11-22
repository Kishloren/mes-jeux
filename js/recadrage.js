// Outil de recadrage : un cadre aux proportions figées, 8 poignées (4 coins, 4 côtés),
// déplaçable en le faisant glisser. Travaille en pixels de l'image d'origine.
(function () {
  "use strict";

  // ouvrir(racine, source, { ratio, titre, surValider(rect), surAnnuler() })
  // source : ImageBitmap ou image décodée ; ratio = largeur / hauteur du cadre.
  // rect renvoyé : { x, y, w, h } en pixels de la source.
  function ouvrir(racine, source, opts) {
    const W = source.width, H = source.height, r = opts.ratio;
    const MIN = Math.max(60, Math.round(Math.min(W, H * r) * 0.12)); // largeur minimale du cadre
    // Cadre de départ : le plus grand possible, centré.
    let w = Math.min(W, H * r), h = w / r;
    let cadre = { x: (W - w) / 2, y: (H - h) / 2, w, h };

    racine.innerHTML = `
      <div class="rc">
        <header class="barre">
          <button class="btn" data-act="annuler">Annuler</button>
          <h1>${UI.echap(opts.titre || "Recadrer")}</h1>
          <span class="espace"></span>
          <button class="btn btn-principal rc-ok" data-act="valider">Valider ✓</button>
        </header>
        <p class="rc-aide">Faites glisser le cadre ou ses poignées</p>
        <div class="rc-zone">
          <div class="rc-scene">
            <canvas class="rc-image"></canvas>
            <div class="rc-cadre">
              <span class="rc-tiers"></span>
              ${["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((p) => `<span class="rc-poignee rc-${p}" data-p="${p}"><i></i></span>`).join("")}
            </div>
          </div>
        </div>
      </div>`;
    const zone = racine.querySelector(".rc-zone");
    const scene = racine.querySelector(".rc-scene");
    const toile = racine.querySelector(".rc-image");
    const elCadre = racine.querySelector(".rc-cadre");
    let echelle = 1; // px écran par px image

    function disposer() {
      const R = zone.getBoundingClientRect();
      const marge = 28; // place pour les poignées autour de l'image
      echelle = Math.min((R.width - 2 * marge) / W, (R.height - 2 * marge) / H);
      const lw = Math.round(W * echelle), lh = Math.round(H * echelle);
      scene.style.width = lw + "px";
      scene.style.height = lh + "px";
      const dpr = window.devicePixelRatio || 1;
      toile.width = Math.round(lw * dpr);
      toile.height = Math.round(lh * dpr);
      const ctx = toile.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(source, 0, 0, toile.width, toile.height);
      dessiner();
    }

    function dessiner() {
      elCadre.style.left = cadre.x * echelle + "px";
      elCadre.style.top = cadre.y * echelle + "px";
      elCadre.style.width = cadre.w * echelle + "px";
      elCadre.style.height = cadre.h * echelle + "px";
    }

    // ---------- Gestes ----------
    let geste = null;
    function versImage(e) {
      const R = scene.getBoundingClientRect();
      return { x: (e.clientX - R.left) / echelle, y: (e.clientY - R.top) / echelle };
    }

    elCadre.addEventListener("pointerdown", (e) => {
      if (geste) return;
      e.preventDefault();
      const p = e.target.closest("[data-p]");
      geste = { id: e.pointerId, poignee: p ? p.dataset.p : null, depart: versImage(e), cadre: { ...cadre } };
      elCadre.setPointerCapture(e.pointerId);
      elCadre.classList.add("actif");
    });
    elCadre.addEventListener("pointermove", (e) => {
      if (!geste || e.pointerId !== geste.id) return;
      const m = versImage(e);
      cadre = geste.poignee ? redimensionner(geste.cadre, geste.poignee, m) : deplacer(geste.cadre, m.x - geste.depart.x, m.y - geste.depart.y);
      dessiner();
    });
    const fin = (e) => {
      if (!geste || e.pointerId !== geste.id) return;
      geste = null;
      elCadre.classList.remove("actif");
    };
    elCadre.addEventListener("pointerup", fin);
    elCadre.addEventListener("pointercancel", fin);

    function deplacer(c, dx, dy) {
      return {
        x: Math.min(Math.max(0, c.x + dx), W - c.w),
        y: Math.min(Math.max(0, c.y + dy), H - c.h),
        w: c.w, h: c.h,
      };
    }

    // Redimensionne en gardant les proportions. Un coin garde le coin opposé fixe ;
    // un côté garde le côté opposé fixe et reste centré dans l'autre direction.
    function redimensionner(c, p, m) {
      const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
      const gauche = p.includes("w"), droite = p.includes("e"), haut = p.includes("n"), bas = p.includes("s");
      let w, max;
      if ((gauche || droite) && (haut || bas)) {
        const ax = gauche ? c.x + c.w : c.x, ay = haut ? c.y + c.h : c.y;
        const dx = gauche ? ax - m.x : m.x - ax, dy = haut ? ay - m.y : m.y - ay;
        w = Math.max(dx, dy * r);
        max = Math.min(gauche ? ax : W - ax, (haut ? ay : H - ay) * r);
        w = Math.min(Math.max(w, MIN), max);
        const h = w / r;
        return { x: gauche ? ax - w : ax, y: haut ? ay - h : ay, w, h };
      }
      if (gauche || droite) {
        const ax = gauche ? c.x + c.w : c.x;
        w = gauche ? ax - m.x : m.x - ax;
        max = Math.min(gauche ? ax : W - ax, H * r);
        w = Math.min(Math.max(w, MIN), max);
        const h = w / r;
        // Centré verticalement, mais glissé si besoin pour rester dans l'image.
        return { x: gauche ? ax - w : ax, y: Math.min(Math.max(0, cy - h / 2), H - h), w, h };
      }
      const ay = haut ? c.y + c.h : c.y;
      let h = haut ? ay - m.y : m.y - ay;
      max = Math.min(haut ? ay : H - ay, W / r);
      h = Math.min(Math.max(h, MIN / r), max);
      w = h * r;
      return { x: Math.min(Math.max(0, cx - w / 2), W - w), y: haut ? ay - h : ay, w, h };
    }

    racine.querySelector(".rc .barre").addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      if (b.dataset.act === "annuler") opts.surAnnuler();
      else {
        b.disabled = true;
        const { x, y, w, h } = cadre;
        opts.surValider({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
      }
    });

    const ro = new ResizeObserver(() => disposer());
    ro.observe(zone);
    return () => ro.disconnect();
  }

  window.Recadrage = { ouvrir };
})();
