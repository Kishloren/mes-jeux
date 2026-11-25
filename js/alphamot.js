// Alphamot : mots fléchés dont chaque définition est l'anagramme alphabétique de la réponse
// (AEISTT pour ATTISE ; « ** » pour un mot de deux lettres).
// Grille (format interne) : { id, nom, niveau, solution: ["#E#R…"], definitions:
//   [{ x, y, fleche: "droite"|"bas"|"droite-bas"|"bas-droite", mot, indice }] }
(function () {
  "use strict";

  const CLAVIER = ["AZERTYUIOP", "QSDFGHJKLM", "WXCVBN"];
  // Départ et sens de lecture de chaque flèche, depuis la case définition.
  const FLECHES = {
    droite: { ox: 1, oy: 0, dx: 1, dy: 0 },
    bas: { ox: 0, oy: 1, dx: 0, dy: 1 },
    "droite-bas": { ox: 1, oy: 0, dx: 0, dy: 1 },
    "bas-droite": { ox: 0, oy: 1, dx: 1, dy: 0 },
  };
  const HAUT = { droite: 0, "droite-bas": 0, bas: 1, "bas-droite": 1 }; // place dans la case définition
  const SVG_FLECHE = {
    droite: '<path d="M2 2 L8 5 L2 8 Z"/>',
    bas: '<path d="M2 2 L8 2 L5 8 Z"/>',
    "droite-bas": '<path d="M1 2.5 H6 V6" fill="none" stroke-width="1.6"/><path d="M3.8 5.5 H8.2 L6 9 Z"/>',
    "bas-droite": '<path d="M2.5 1 V6 H6" fill="none" stroke-width="1.6"/><path d="M5.5 3.8 V8.2 L9 6 Z"/>',
  };
  const fleche = (f) => `<svg class="am-fl" viewBox="0 0 10 10" aria-hidden="true">${SVG_FLECHE[f]}</svg>`;

  function analyser(g) {
    const S = g.solution, R = S.length, C = S[0].length;
    const mots = g.definitions.map((d) => {
      const F = FLECHES[d.fleche];
      const cases = [];
      let x = d.x + F.ox, y = d.y + F.oy;
      while (x < C && y < R && S[y][x] !== "#") { cases.push(y * C + x); x += F.dx; y += F.dy; }
      return { d, cases, sens: F.dx ? "h" : "v", def: d.y * C + d.x };
    });
    const motsDe = {}; // case -> { h, v } (indices de mots)
    mots.forEach((m, i) => m.cases.forEach((k) => { (motsDe[k] = motsDe[k] || {})[m.sens] = i; }));
    const defsCase = {}; // case définition -> indices de mots, celui du haut d'abord
    mots.forEach((m, i) => (defsCase[m.def] = defsCase[m.def] || []).push(i));
    Object.values(defsCase).forEach((l) => l.sort((a, b) => HAUT[mots[a].d.fleche] - HAUT[mots[b].d.fleche]));
    return { R, C, mots, motsDe, defsCase };
  }

  function valider(g) {
    const err = [];
    try {
      const S = g.solution;
      if (!Array.isArray(S) || S.length < 6 || S.length > 22) err.push("nombre de lignes");
      const C = S[0].length;
      if (C < 6 || C > 18 || S.some((l) => l.length !== C || !/^[A-Z#]+$/.test(l))) err.push("lignes");
      const A = analyser(g);
      A.mots.forEach((m) => {
        const lu = m.cases.map((k) => S[Math.floor(k / C)][k % C]).join("");
        if (!FLECHES[m.d.fleche] || S[m.d.y][m.d.x] !== "#" || lu !== m.d.mot) err.push("mot " + m.d.mot);
      });
      S.forEach((l, y) => [...l].forEach((ch, x) => { if (ch !== "#" && !A.motsDe[y * C + x]) err.push("case sans définition"); }));
    } catch (e) {
      err.push("grille illisible");
    }
    return err;
  }

  const cle = (g) => "am-" + g.id;
  function charger(g) {
    const R = g.solution.length, C = g.solution[0].length;
    const s = UI.Store.get(cle(g), null);
    const lettres = new Array(R * C).fill("");
    if (s && typeof s.l === "string" && s.l.length === R * C) [...s.l].forEach((ch, k) => { if (/[A-Z]/.test(ch)) lettres[k] = ch; });
    return { lettres, reveles: new Set(s && Array.isArray(s.r) ? s.r : []), fini: !!(s && s.f) };
  }
  function progression(g) {
    const st = charger(g);
    const total = g.solution.join("").replace(/#/g, "").length;
    const remplies = st.lettres.filter(Boolean).length;
    return { remplies, total, fini: st.fini };
  }
  function reinitialiser(g) { UI.Store.del(cle(g)); }

  // base : adresse du carnet (retour).
  function ouvrir(racine, g, base = "#/alphamot") {
    const A = analyser(g);
    const { R, C, mots, motsDe, defsCase } = A;
    const sol = [...g.solution.join("")];
    const st = charger(g);
    const { lettres, reveles } = st;
    const erreurs = new Set();
    let sel = sol.findIndex((ch, k) => ch !== "#" && !lettres[k]);
    if (sel < 0) sel = sol.findIndex((ch) => ch !== "#");
    let sens = motsDe[sel].h !== undefined ? "h" : "v";
    let victoireAffichee = st.fini;

    racine.innerHTML = `
      <div class="am">
        <header class="barre">
          <a class="btn btn-retour" href="${base}">← Retour</a>
          <h1>${UI.echap(g.nom)}</h1>
          <span class="espace"></span>
          <button class="btn" data-act="verifier">Vérifier</button>
          <button class="btn" data-act="aide">Aide</button>
        </header>
        <div class="am-zone"><div class="am-grille"></div></div>
        <div class="am-def"></div>
        <div class="clavier"></div>
      </div>`;
    const elAM = racine.querySelector(".am");
    const elZone = racine.querySelector(".am-zone");
    const elGrille = racine.querySelector(".am-grille");
    const elDef = racine.querySelector(".am-def");
    const elClavier = racine.querySelector(".clavier");

    // ---------- Grille ----------
    elGrille.style.gridTemplateColumns = `repeat(${C}, var(--am))`;
    const elCases = sol.map((ch, k) => {
      const c = document.createElement("div");
      c.dataset.k = k;
      if (ch === "#") {
        c.className = "am-case am-dc";
        const liste = defsCase[k] || [];
        c.innerHTML = liste.map((i) => {
          const d = mots[i].d;
          // Indice long : sur deux lignes, pour écrire plus gros dans la petite case.
          const t = d.indice;
          const lignes = t.length > 5 ? [t.slice(0, Math.ceil(t.length / 2)), t.slice(Math.ceil(t.length / 2))] : [t];
          const larg = Math.max(...lignes.map((l) => l.length));
          const k2 = Math.min((1 / liste.length - 0.05) / (lignes.length * 1.06), 0.9 / (larg * 0.68 + 0.95), 0.32);
          return `<span class="am-indice" data-m="${i}" style="font-size:calc(var(--am) * ${k2.toFixed(3)})"><span class="am-txt">${lignes.map(UI.echap).join("<br>")}</span>${fleche(d.fleche)}</span>`;
        }).join("");
        if (!liste.length) c.classList.add("am-vide");
      } else {
        c.className = "am-case";
      }
      elGrille.appendChild(c);
      return c;
    });

    // ---------- Clavier ----------
    CLAVIER.forEach((rangee, ri) => {
      const r = document.createElement("div");
      r.className = "rangee";
      r.innerHTML = [...rangee].map((k) => `<button class="touche" data-k="${k}">${k}</button>`).join("")
        + (ri === 2 ? `<button class="touche touche-fl" data-k="PREC" aria-label="Mot précédent">◀</button>
           <button class="touche touche-fl" data-k="SUIV" aria-label="Mot suivant">▶</button>
           <button class="touche touche-eff" data-k="EFFACER" aria-label="Effacer">⌫</button>` : "");
      elClavier.appendChild(r);
    });

    // ---------- État ----------
    const sauver = () => UI.Store.set(cle(g), {
      l: lettres.map((x) => x || " ").join(""), r: [...reveles],
      f: sol.every((ch, k) => ch === "#" || lettres[k] === ch),
    });
    const motActif = () => {
      const m = motsDe[sel] || {};
      return m[sens] !== undefined ? m[sens] : m[sens === "h" ? "v" : "h"];
    };
    const plein = (i) => mots[i].cases.every((k) => lettres[k]);

    function libelle(i, grand) {
      const d = mots[i].d;
      const n = mots[i].cases.length;
      const texte = d.indice === "**" ? "Mot de 2 lettres" : d.indice;
      return `<span class="am-def-fl">${fleche(d.fleche)}</span><span class="${grand ? "am-def-texte" : "am-def-autre"}">${UI.echap(texte)}</span>`
        + `<span class="am-def-n">${n} lettres</span>`;
    }

    function majTout() {
      const i = motActif();
      if (i !== undefined) sens = mots[i].sens;
      const actives = new Set(i !== undefined ? mots[i].cases : []);
      elCases.forEach((c, k) => {
        if (sol[k] === "#") return;
        c.textContent = lettres[k];
        c.classList.toggle("mot", actives.has(k));
        c.classList.toggle("sel", k === sel);
        c.classList.toggle("revele", reveles.has(k));
        c.classList.toggle("err", erreurs.has(k));
      });
      elGrille.querySelectorAll(".am-indice").forEach((s) => {
        const m = +s.dataset.m;
        s.classList.toggle("actif", m === i);
        s.classList.toggle("fait", plein(m));
      });
      const autre = (motsDe[sel] || {})[sens === "h" ? "v" : "h"];
      // Les deux définitions sur une seule ligne, de hauteur fixe : rien ne bouge en dessous.
      elDef.innerHTML = i === undefined ? "" : `<div class="am-def-ligne">${libelle(i, true)}</div>`
        + `<div class="am-def-ligne am-def-croise">${autre !== undefined ? libelle(autre, false) : ""}</div>`;
    }

    function selectionner(k, nouveauSens) {
      sel = k;
      if (nouveauSens) sens = nouveauSens;
      majTout();
    }

    function suivanteDansMot(pas) {
      const i = motActif();
      if (i === undefined) return;
      const cs = mots[i].cases;
      const p = cs.indexOf(sel) + pas;
      if (p >= 0 && p < cs.length) sel = cs[p];
    }

    function ecrire(L) {
      if (!reveles.has(sel)) { lettres[sel] = L; erreurs.delete(sel); }
      suivanteDansMot(1);
      sauver();
      majTout();
      verifierFin();
    }
    function effacer() {
      if (lettres[sel] && !reveles.has(sel)) lettres[sel] = "";
      else {
        suivanteDansMot(-1);
        if (!reveles.has(sel)) lettres[sel] = "";
      }
      erreurs.delete(sel);
      sauver();
      majTout();
    }
    // Mot précédent ou suivant, dans l'ordre des définitions ; curseur sur la première case vide.
    function voisinMot(pas) {
      const i = motActif();
      const j = ((i === undefined ? 0 : i) + pas + mots.length) % mots.length;
      const m = mots[j];
      sens = m.sens;
      sel = m.cases.find((k) => !lettres[k]) ?? m.cases[0];
      majTout();
    }

    function verifierFin() {
      if (!sol.every((ch, k) => ch === "#" || lettres[k] === ch)) return;
      st.fini = true;
      sauver();
      elAM.classList.add("termine");
      if (victoireAffichee) return;
      victoireAffichee = true;
      setTimeout(() => UI.modal({
        titre: "Bravo ! Grille terminée",
        html: "<p>Tous les mots sont trouvés.</p>",
        boutons: [
          { label: "Retour aux grilles", classe: "btn-principal", action: () => { location.hash = base; } },
          { label: "Rester sur la grille" },
        ],
      }), 400);
    }

    function verifier() {
      erreurs.clear();
      sol.forEach((ch, k) => { if (ch !== "#" && lettres[k] && lettres[k] !== ch) erreurs.add(k); });
      majTout();
      UI.toast(erreurs.size ? `${erreurs.size} lettre${erreurs.size > 1 ? "s" : ""} à revoir (en rouge).` : "Aucune erreur pour l'instant.");
    }

    function reveler(cases) {
      cases.forEach((k) => { lettres[k] = sol[k]; reveles.add(k); erreurs.delete(k); });
      sauver();
      majTout();
      verifierFin();
    }

    function aide() {
      const i = motActif();
      const boutons = [];
      if (sol[sel] !== "#" && lettres[sel] !== sol[sel]) boutons.push({ label: "Révéler cette lettre", classe: "btn-principal", action: () => reveler([sel]) });
      if (i !== undefined && mots[i].cases.some((k) => lettres[k] !== sol[k])) boutons.push({ label: "Révéler ce mot", action: () => reveler(mots[i].cases) });
      boutons.push({ label: "Effacer toute la grille", classe: "btn-danger", action: () => {
        UI.modal({
          titre: "Effacer toute la grille ?",
          html: "<p>Toutes les lettres seront effacées.</p>",
          boutons: [
            { label: "Non, garder" },
            { label: "Oui, effacer", classe: "btn-danger", action: () => {
              lettres.fill(""); reveles.clear(); erreurs.clear(); st.fini = false; victoireAffichee = false;
              elAM.classList.remove("termine"); sauver(); majTout();
            } },
          ],
        });
      } });
      boutons.push({ label: "Fermer" });
      UI.modal({
        titre: "Aide",
        html: `<p>Chaque définition donne les lettres du mot rangées par ordre alphabétique : AEISTT pour ATTISE. « ** » désigne un mot de deux lettres.</p>
          <p>Touchez une case ou une définition, puis tapez les lettres. Touchez à nouveau une case pour changer de sens.</p>`,
        boutons,
      });
    }

    // ---------- Événements ----------
    elGrille.addEventListener("click", (e) => {
      const c = e.target.closest(".am-case");
      if (!c) return;
      const k = +c.dataset.k;
      if (sol[k] === "#") {
        // Case définition : premier mot, puis le second au toucher suivant.
        const liste = defsCase[k] || [];
        if (!liste.length) return;
        const i = motActif();
        const p = liste.indexOf(i);
        const j = liste[p >= 0 ? (p + 1) % liste.length : 0];
        sens = mots[j].sens;
        sel = mots[j].cases.find((x) => !lettres[x]) ?? mots[j].cases[0];
        majTout();
        return;
      }
      const m = motsDe[k] || {};
      if (k === sel && m.h !== undefined && m.v !== undefined) selectionner(k, sens === "h" ? "v" : "h");
      else selectionner(k, m[sens] !== undefined ? sens : (m.h !== undefined ? "h" : "v"));
    });
    elClavier.addEventListener("click", (e) => {
      const b = e.target.closest("[data-k]");
      if (!b) return;
      const k = b.dataset.k;
      if (k === "EFFACER") effacer();
      else if (k === "PREC") voisinMot(-1);
      else if (k === "SUIV") voisinMot(1);
      else ecrire(k);
    });
    racine.querySelector(".am .barre").addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      if (b.dataset.act === "verifier") verifier();
      else if (b.dataset.act === "aide") aide();
    });
    function surTouche(e) {
      if (document.querySelector(".modal-fond") || e.ctrlKey || e.altKey || e.metaKey) return;
      if (/^[a-zA-Z]$/.test(e.key)) { ecrire(e.key.toUpperCase()); e.preventDefault(); }
      else if (e.key === "Backspace" || e.key === "Delete") { effacer(); e.preventDefault(); }
    }
    document.addEventListener("keydown", surTouche);

    function dimensionner() {
      elAM.style.setProperty("--am", "10px");
      const r = elZone.getBoundingClientRect();
      // Les filets de 1 px entre les cases et la bordure comptent aussi.
      const s = Math.max(16, Math.floor(Math.min(64, (r.width - 12 - (C - 1)) / C, (r.height - 12 - (R - 1)) / R)));
      elAM.style.setProperty("--am", s + "px");
    }
    const ro = new ResizeObserver(() => dimensionner());
    ro.observe(elZone);

    majTout();
    dimensionner();
    if (st.fini) elAM.classList.add("termine");

    return () => { ro.disconnect(); document.removeEventListener("keydown", surTouche); };
  }

  window.Alphamot = { valider, progression, reinitialiser, ouvrir };
})();
