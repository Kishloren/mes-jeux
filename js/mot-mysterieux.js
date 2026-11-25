// Mot mystérieux : retrouver dans la grille les mots de la liste, dans les 8 directions.
// Les lettres qui restent, lues ligne par ligne, forment le mot mystérieux.
// Grille (format interne) : { id, nom, theme, niveau, lignes: ["ABC…"], mots: ["…"],
//   placements: [{ mot, x, y, dx, dy }], mystere }
(function () {
  "use strict";

  const COULEURS = ["#ffd43b", "#8ce99a", "#74c0fc", "#ffa8a8", "#b197fc", "#ffc078", "#63e6be", "#faa2c1", "#a9e34b", "#66d9e8"];

  function valider(g) {
    const err = [];
    try {
      const L = g.lignes;
      if (!Array.isArray(L) || L.length < 8 || L.length > 20) err.push("nombre de lignes");
      const C = L[0].length;
      if (C < 8 || C > 20 || L.some((l) => l.length !== C || !/^[A-Z]+$/.test(l))) err.push("lignes");
      if (!Array.isArray(g.placements) || !g.placements.length) err.push("placements");
      const couvertes = new Set();
      for (const p of g.placements) {
        if (!/^[A-Z]{2,}$/.test(p.mot) || Math.abs(p.dx) > 1 || Math.abs(p.dy) > 1 || (!p.dx && !p.dy)) { err.push("placement " + p.mot); continue; }
        for (let i = 0; i < p.mot.length; i++) {
          const x = p.x + i * p.dx, y = p.y + i * p.dy;
          if (y < 0 || y >= L.length || x < 0 || x >= C || L[y][x] !== p.mot[i]) { err.push("placement " + p.mot); break; }
          couvertes.add(y * C + x);
        }
      }
      let reste = "";
      L.forEach((l, y) => [...l].forEach((ch, x) => { if (!couvertes.has(y * C + x)) reste += ch; }));
      if (!g.mystere || reste !== g.mystere) err.push("mot mystérieux");
    } catch (e) {
      err.push("grille illisible");
    }
    return err;
  }

  const cle = (g) => "mm-" + g.id;
  function charger(g) {
    const s = UI.Store.get(cle(g), null);
    const t = new Set((s && Array.isArray(s.t) ? s.t : []).filter((i) => Number.isInteger(i) && i >= 0 && i < g.placements.length));
    return { trouves: t, fini: !!(s && s.f) && t.size === g.placements.length };
  }
  function progression(g) {
    const st = charger(g);
    return { trouves: st.trouves.size, total: g.placements.length, fini: st.fini };
  }
  function reinitialiser(g) { UI.Store.del(cle(g)); }

  // base : adresse du carnet (retour).
  function ouvrir(racine, g, base = "#/mot-mysterieux") {
    const R = g.lignes.length, C = g.lignes[0].length;
    const st = charger(g);
    const trouves = st.trouves;
    const sauver = () => UI.Store.set(cle(g), { t: [...trouves], f: trouves.size === g.placements.length });
    // Ordre d'affichage de la liste : alphabétique (indices des placements).
    const ordre = g.placements.map((p, i) => i).sort((a, b) => g.placements[a].mot.localeCompare(g.placements[b].mot, "fr"));
    const couleur = (i) => COULEURS[i % COULEURS.length];

    racine.innerHTML = `
      <div class="mm">
        <header class="barre">
          <a class="btn btn-retour" href="${base}">← Retour</a>
          <h1>${UI.echap(g.nom)}</h1>
          <span class="espace"></span>
          <button class="btn" data-act="aide">Aide</button>
        </header>
        <div class="mm-zone">
          <div class="mm-plateau">
            <svg class="mm-traits" aria-hidden="true" preserveAspectRatio="none"></svg>
            <div class="mm-grille"></div>
          </div>
        </div>
        <div class="mm-mystere"></div>
        <ul class="mm-mots"></ul>
      </div>`;
    const elMM = racine.querySelector(".mm");
    const elZone = racine.querySelector(".mm-zone");
    const elPlateau = racine.querySelector(".mm-plateau");
    const elGrille = racine.querySelector(".mm-grille");
    const elTraits = racine.querySelector(".mm-traits");
    const elMots = racine.querySelector(".mm-mots");
    const elMystere = racine.querySelector(".mm-mystere");

    elGrille.style.gridTemplateColumns = `repeat(${C}, var(--mm))`;
    const elCases = [];
    g.lignes.forEach((l, y) => [...l].forEach((ch, x) => {
      const c = document.createElement("div");
      c.className = "mm-case";
      c.textContent = ch;
      c.dataset.x = x; c.dataset.y = y;
      elGrille.appendChild(c);
      elCases.push(c);
    }));
    elTraits.setAttribute("viewBox", `0 0 ${C} ${R}`);

    elMots.innerHTML = ordre.map((i) => `<li data-i="${i}">${g.placements[i].mot}</li>`).join("");
    const elMot = new Map([...elMots.children].map((li) => [+li.dataset.i, li]));

    // ---------- Dessin ----------
    const SVG = "http://www.w3.org/2000/svg";
    function trait(x0, y0, x1, y1, classe, coul) {
      const l = document.createElementNS(SVG, "line");
      l.setAttribute("x1", x0 + 0.5); l.setAttribute("y1", y0 + 0.5);
      l.setAttribute("x2", x1 + 0.5); l.setAttribute("y2", y1 + 0.5);
      l.setAttribute("class", classe);
      if (coul) l.style.stroke = coul;
      elTraits.appendChild(l);
      return l;
    }
    const fin = (p) => [p.x + (p.mot.length - 1) * p.dx, p.y + (p.mot.length - 1) * p.dy];

    function dessiner() {
      elTraits.querySelectorAll(".mm-trouve").forEach((l) => l.remove());
      trouves.forEach((i) => { const p = g.placements[i]; const [x1, y1] = fin(p); trait(p.x, p.y, x1, y1, "mm-trouve", couleur(i)); });
      elMot.forEach((li, i) => {
        li.classList.toggle("trouve", trouves.has(i));
        li.style.setProperty("--c", couleur(i));
      });
      const total = g.placements.length;
      const fini = trouves.size === total;
      elMM.classList.toggle("termine", fini);
      // Mot mystérieux : cases vides tant que tous les mots ne sont pas trouvés.
      if (fini) {
        const couvertes = new Set();
        g.placements.forEach((p) => { for (let k = 0; k < p.mot.length; k++) couvertes.add((p.y + k * p.dy) * C + p.x + k * p.dx); });
        elCases.forEach((c, k) => c.classList.toggle("reste", !couvertes.has(k)));
      }
      elMystere.innerHTML = `<span class="mm-mystere-titre">Mot mystérieux</span><span class="mm-lettres">${[...g.mystere]
        .map((ch) => `<span>${fini ? ch : ""}</span>`).join("")}</span>
        <span class="mm-compte">${trouves.size} mot${trouves.size > 1 ? "s" : ""} sur ${total}</span>`;
    }

    // ---------- Taille ----------
    function dimensionner() {
      elMM.style.setProperty("--mm", "10px");
      const r = elZone.getBoundingClientRect();
      const s = Math.max(16, Math.floor(Math.min(64, (r.width - 12) / C, (r.height - 12) / R)));
      elMM.style.setProperty("--mm", s + "px");
    }

    // ---------- Sélection : glisser du premier au dernier mot, ou toucher les deux bouts ----------
    let geste = null;  // { x0, y0, x1, y1, id, bouge }
    let depart = null; // premier bout choisi au toucher
    let elSel = null;

    function caseSous(e) {
      const r = elGrille.getBoundingClientRect();
      const x = Math.floor(((e.clientX - r.left) / r.width) * C);
      const y = Math.floor(((e.clientY - r.top) / r.height) * R);
      return [Math.min(C - 1, Math.max(0, x)), Math.min(R - 1, Math.max(0, y))];
    }
    // Ramène le second bout sur l'une des 8 directions.
    function aligner(x0, y0, x, y) {
      let dx = x - x0, dy = y - y0;
      if (!dx && !dy) return [x0, y0];
      const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
      const ux = Math.round(Math.cos(a)), uy = Math.round(Math.sin(a));
      let n = Math.max(Math.abs(dx), Math.abs(dy));
      while (n > 0 && (x0 + n * ux < 0 || x0 + n * ux >= C || y0 + n * uy < 0 || y0 + n * uy >= R)) n--;
      return [x0 + n * ux, y0 + n * uy];
    }
    function montrerSel(x0, y0, x1, y1) {
      if (!elSel) elSel = trait(x0, y0, x1, y1, "mm-sel");
      elSel.setAttribute("x1", x0 + 0.5); elSel.setAttribute("y1", y0 + 0.5);
      elSel.setAttribute("x2", x1 + 0.5); elSel.setAttribute("y2", y1 + 0.5);
    }
    function effacerSel() { if (elSel) { elSel.remove(); elSel = null; } }
    function marquerDepart(on) {
      elCases.forEach((c) => c.classList.remove("depart"));
      if (on && depart) elCases[depart[1] * C + depart[0]].classList.add("depart");
    }

    function essayer(x0, y0, x1, y1) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      const ux = Math.sign(x1 - x0), uy = Math.sign(y1 - y0);
      let lu = "";
      for (let k = 0; k <= n; k++) lu += g.lignes[y0 + k * uy][x0 + k * ux];
      const envers = [...lu].reverse().join("");
      const memeBouts = (p) => {
        const [fx, fy] = fin(p);
        return (p.x === x0 && p.y === y0 && fx === x1 && fy === y1) || (p.x === x1 && p.y === y1 && fx === x0 && fy === y0);
      };
      const libres = g.placements.map((p, i) => i).filter((i) => !trouves.has(i));
      let i = libres.find((k) => memeBouts(g.placements[k]));
      if (i === undefined) i = libres.find((k) => g.placements[k].mot === lu || g.placements[k].mot === envers);
      if (i === undefined) {
        if (n > 0 && elSel) { elSel.classList.add("rate"); const l = elSel; elSel = null; setTimeout(() => l.remove(), 450); }
        else effacerSel();
        return;
      }
      effacerSel();
      trouves.add(i);
      sauver();
      dessiner();
      const li = elMot.get(i);
      if (li) { li.classList.add("vient"); li.scrollIntoView({ block: "nearest" }); setTimeout(() => li.classList.remove("vient"), 900); }
      if (trouves.size === g.placements.length) victoire();
    }

    elPlateau.addEventListener("pointerdown", (e) => {
      if (geste || elMM.classList.contains("termine")) return;
      e.preventDefault();
      const [x, y] = caseSous(e);
      geste = { x0: x, y0: y, x1: x, y1: y, id: e.pointerId, bouge: false };
      elPlateau.setPointerCapture(e.pointerId);
      if (!depart) montrerSel(x, y, x, y);
    });
    elPlateau.addEventListener("pointermove", (e) => {
      if (!geste || e.pointerId !== geste.id) return;
      const [x, y] = caseSous(e);
      if (x === geste.x0 && y === geste.y0 && !geste.bouge) return;
      geste.bouge = true;
      if (depart) { depart = null; marquerDepart(false); }
      [geste.x1, geste.y1] = aligner(geste.x0, geste.y0, x, y);
      montrerSel(geste.x0, geste.y0, geste.x1, geste.y1);
    });
    const finGeste = (e) => {
      if (!geste || e.pointerId !== geste.id) return;
      const gst = geste;
      geste = null;
      if (gst.bouge && (gst.x1 !== gst.x0 || gst.y1 !== gst.y0)) { essayer(gst.x0, gst.y0, gst.x1, gst.y1); return; }
      // Toucher simple : premier bout, puis second bout.
      if (!depart) { depart = [gst.x0, gst.y0]; marquerDepart(true); return; }
      const [dx0, dy0] = depart;
      depart = null;
      marquerDepart(false);
      if (dx0 === gst.x0 && dy0 === gst.y0) { effacerSel(); return; }
      const [x1, y1] = aligner(dx0, dy0, gst.x0, gst.y0);
      montrerSel(dx0, dy0, x1, y1);
      essayer(dx0, dy0, x1, y1);
    };
    elPlateau.addEventListener("pointerup", finGeste);
    elPlateau.addEventListener("pointercancel", (e) => { if (geste && e.pointerId === geste.id) { geste = null; effacerSel(); } });

    // ---------- Aide : montre un mot pendant quelques secondes ----------
    let minuteurAide = null;
    function aide() {
      const libres = ordre.filter((i) => !trouves.has(i));
      if (!libres.length) return;
      const i = libres[Math.floor(Math.random() * libres.length)];
      const p = g.placements[i];
      const [x1, y1] = fin(p);
      elTraits.querySelectorAll(".mm-aide").forEach((l) => l.remove());
      trait(p.x, p.y, x1, y1, "mm-aide");
      const li = elMot.get(i);
      if (li) { li.classList.add("aide"); li.scrollIntoView({ block: "nearest" }); }
      clearTimeout(minuteurAide);
      minuteurAide = setTimeout(() => {
        elTraits.querySelectorAll(".mm-aide").forEach((l) => l.remove());
        if (li) li.classList.remove("aide");
      }, 3000);
    }

    function victoire() {
      setTimeout(() => {
        UI.modal({
          titre: "Bravo ! Grille terminée",
          html: `<p>Tous les mots sont trouvés.</p><p>Le mot mystérieux est :</p><p class="mm-reponse">${UI.echap(g.mystere)}</p>`,
          boutons: [
            { label: "Retour aux grilles", classe: "btn-principal", action: () => { location.hash = base; } },
            { label: "Rester sur la grille" },
          ],
        });
      }, 600);
    }

    racine.querySelector(".mm .barre").addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (b && b.dataset.act === "aide") aide();
    });

    dessiner();
    dimensionner();
    const ro = new ResizeObserver(() => dimensionner());
    ro.observe(elZone);
    return () => { ro.disconnect(); clearTimeout(minuteurAide); };
  }

  window.MotMysterieux = { valider, progression, reinitialiser, ouvrir };
})();
