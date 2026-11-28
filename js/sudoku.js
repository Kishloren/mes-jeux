// Sudoku : générateur de grilles (solution unique) classées en 5 niveaux, et écran de jeu.
// Le niveau dépend des chiffres donnés ET des raisonnements nécessaires pour résoudre :
//   1 Débutant  : beaucoup de chiffres, « singletons » seulement (une case n'a plus qu'un
//                 chiffre possible, ou un chiffre n'a plus qu'une place dans un groupe) ;
//   2 Facile    : moins de chiffres, toujours les singletons ;
//   3 Moyen     : encore moins de chiffres, singletons ;
//   4 Difficile : il faut aussi les paires et les interactions bloc/ligne ;
//   5 Expert    : ces raisonnements ne suffisent plus (grille minimale).
(function () {
  "use strict";

  const NIVEAUX = [
    { n: 1, nom: "Débutant", donnes: 44, logique: 1, desc: "Beaucoup de chiffres donnés, pour se lancer." },
    { n: 2, nom: "Facile", donnes: 37, logique: 1, desc: "Un peu moins d'aide." },
    { n: 3, nom: "Moyen", donnes: 31, logique: 1, desc: "Il faut chercher un peu plus." },
    { n: 4, nom: "Difficile", donnes: 27, logique: 2, desc: "Demande de noter les possibilités." },
    { n: 5, nom: "Expert", donnes: 22, logique: 3, desc: "Pour les spécialistes." },
  ];

  // ---------- Outils ----------
  const LIGNE = (k) => Math.floor(k / 9), COL = (k) => k % 9, BLOC = (k) => Math.floor(k / 27) * 3 + Math.floor((k % 9) / 3);
  const GROUPES = [];
  for (let i = 0; i < 9; i++) {
    GROUPES.push(Array.from({ length: 9 }, (_, j) => i * 9 + j)); // lignes
    GROUPES.push(Array.from({ length: 9 }, (_, j) => j * 9 + i)); // colonnes
    GROUPES.push(Array.from({ length: 9 }, (_, j) => (Math.floor(i / 3) * 3 + Math.floor(j / 3)) * 9 + (i % 3) * 3 + (j % 3))); // blocs
  }
  const VOISINS = Array.from({ length: 81 }, (_, k) => {
    const s = new Set();
    for (let j = 0; j < 81; j++) if (j !== k && (LIGNE(j) === LIGNE(k) || COL(j) === COL(k) || BLOC(j) === BLOC(k))) s.add(j);
    return [...s];
  });
  const TOUS = 0x3fe; // bits 1..9
  const bits = (m) => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
  const chiffres = (m) => { const r = []; for (let d = 1; d <= 9; d++) if (m & (1 << d)) r.push(d); return r; };

  function hasard(graine) {
    let s = graine >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const melanger = (t, rnd) => { for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; } return t; };

  function candidats(g, k) {
    let m = TOUS;
    for (const v of VOISINS[k]) if (g[v]) m &= ~(1 << g[v]);
    return m;
  }

  // Compte les solutions (jusqu'à `limite`), par retour arrière sur la case la plus contrainte.
  function compter(g0, limite = 2) {
    const g = g0.slice();
    let n = 0;
    (function rec() {
      let meilleur = -1, mm = 0, mb = 10;
      for (let k = 0; k < 81; k++) {
        if (g[k]) continue;
        const m = candidats(g, k), b = bits(m);
        if (!b) return;
        if (b < mb) { mb = b; meilleur = k; mm = m; if (b === 1) break; }
      }
      if (meilleur < 0) { n++; return; }
      for (const d of chiffres(mm)) {
        g[meilleur] = d;
        rec();
        if (n >= limite) break;
      }
      g[meilleur] = 0;
    })();
    return n;
  }

  // Grille complète au hasard.
  function remplir(rnd) {
    const g = new Array(81).fill(0);
    (function rec() {
      let meilleur = -1, mm = 0, mb = 10;
      for (let k = 0; k < 81; k++) {
        if (g[k]) continue;
        const m = candidats(g, k), b = bits(m);
        if (!b) return false;
        if (b < mb) { mb = b; meilleur = k; mm = m; }
      }
      if (meilleur < 0) return true;
      for (const d of melanger(chiffres(mm), rnd)) {
        g[meilleur] = d;
        if (rec()) return true;
      }
      g[meilleur] = 0;
      return false;
    })();
    return g;
  }

  // Résolution « humaine ». Renvoie le niveau de raisonnement nécessaire :
  // 1 = singletons, 2 = paires et interactions bloc/ligne, 3 = au-delà (non résolue).
  function evaluer(g0) {
    const g = g0.slice();
    const cand = g.map((v, k) => (v ? 0 : candidats(g, k)));
    let niveau = 1;
    const poser = (k, d) => {
      g[k] = d; cand[k] = 0;
      for (const v of VOISINS[k]) cand[v] &= ~(1 << d);
    };
    for (let tour = 0; tour < 400; tour++) {
      if (g.every(Boolean)) return niveau;
      let progres = false;
      // Singletons nus
      for (let k = 0; k < 81; k++) if (!g[k] && bits(cand[k]) === 1) { poser(k, chiffres(cand[k])[0]); progres = true; }
      if (progres) continue;
      // Singletons cachés
      for (const G of GROUPES) {
        for (let d = 1; d <= 9; d++) {
          const ou = G.filter((k) => !g[k] && cand[k] & (1 << d));
          if (ou.length === 1) { poser(ou[0], d); progres = true; }
        }
      }
      if (progres) continue;
      if (cand.some((m, k) => !g[k] && !m)) return 3; // contradiction (ne devrait pas arriver)
      // Niveau 2 : paires nues, paires cachées, interactions bloc/ligne.
      let elimine = false;
      for (const G of GROUPES) {
        const vides = G.filter((k) => !g[k]);
        // Paires nues
        for (let i = 0; i < vides.length; i++) for (let j = i + 1; j < vides.length; j++) {
          const a = vides[i], b = vides[j];
          if (cand[a] === cand[b] && bits(cand[a]) === 2) {
            for (const k of vides) if (k !== a && k !== b && cand[k] & cand[a]) { cand[k] &= ~cand[a]; elimine = true; }
          }
        }
        // Paires cachées
        const places = {};
        for (let d = 1; d <= 9; d++) places[d] = vides.filter((k) => cand[k] & (1 << d));
        for (let d = 1; d <= 9; d++) for (let e = d + 1; e <= 9; e++) {
          if (places[d].length === 2 && places[e].length === 2 && places[d][0] === places[e][0] && places[d][1] === places[e][1]) {
            const garde = (1 << d) | (1 << e);
            for (const k of places[d]) if (cand[k] & ~garde) { cand[k] &= garde; elimine = true; }
          }
        }
      }
      // Interactions : un chiffre confiné à une ligne/colonne dans un bloc (et inversement).
      for (let d = 1; d <= 9; d++) {
        const bitd = 1 << d;
        for (let i = 0; i < 9; i++) {
          const bloc = GROUPES[i * 3 + 2].filter((k) => !g[k] && cand[k] & bitd);
          if (bloc.length > 1) {
            const lignes = new Set(bloc.map(LIGNE)), cols = new Set(bloc.map(COL));
            if (lignes.size === 1) { const l = LIGNE(bloc[0]); for (let c = 0; c < 9; c++) { const k = l * 9 + c; if (!g[k] && BLOC(k) !== BLOC(bloc[0]) && cand[k] & bitd) { cand[k] &= ~bitd; elimine = true; } } }
            if (cols.size === 1) { const c = COL(bloc[0]); for (let l = 0; l < 9; l++) { const k = l * 9 + c; if (!g[k] && BLOC(k) !== BLOC(bloc[0]) && cand[k] & bitd) { cand[k] &= ~bitd; elimine = true; } } }
          }
          for (const G of [GROUPES[i * 3], GROUPES[i * 3 + 1]]) {
            const ou = G.filter((k) => !g[k] && cand[k] & bitd);
            if (ou.length > 1 && new Set(ou.map(BLOC)).size === 1) {
              for (const k of GROUPES[BLOC(ou[0]) * 3 + 2]) if (!g[k] && !G.includes(k) && cand[k] & bitd) { cand[k] &= ~bitd; elimine = true; }
            }
          }
        }
      }
      if (!elimine) return 3;
      niveau = 2;
    }
    return 3;
  }

  // Fabrique une grille du niveau demandé. Renvoie { donnees, solution, niveau, graine }.
  function generer(n, graine = (Date.now() ^ (Math.random() * 1e9)) >>> 0) {
    const N = NIVEAUX[n - 1];
    const rnd = hasard(graine);
    let meilleure = null;
    for (let essai = 0; essai < 40; essai++) {
      const solution = remplir(rnd);
      const g = solution.slice();
      // Cases retirées par paires symétriques (centre de la grille), dans un ordre au hasard.
      const ordre = melanger(Array.from({ length: 41 }, (_, i) => i), rnd);
      let donnes = 81;
      for (const k of ordre) {
        if (donnes <= N.donnes) break;
        const k2 = 80 - k;
        const a = g[k], b = g[k2];
        g[k] = 0; g[k2] = 0;
        const retire = k === k2 ? 1 : 2;
        let ok = compter(g) === 1;
        if (ok && N.logique < 3) ok = evaluer(g) <= N.logique;
        if (ok) donnes -= retire; else { g[k] = a; g[k2] = b; }
      }
      const e = evaluer(g);
      const conforme = N.logique === 3 ? e === 3 : N.logique === 2 ? e === 2 : e === 1;
      const ecart = Math.abs(donnes - N.donnes) + (conforme ? 0 : 20);
      if (!meilleure || ecart < meilleure.ecart) meilleure = { donnees: g.slice(), solution, ecart };
      if (conforme && donnes <= N.donnes + 2) break;
    }
    return { donnees: meilleure.donnees, solution: meilleure.solution, niveau: n, graine };
  }

  // ---------- Parties enregistrées (une par niveau) ----------
  const cle = (n) => "sdk-" + n;
  function charger(n) {
    const s = UI.Store.get(cle(n), null);
    if (!s || !Array.isArray(s.d) || s.d.length !== 81 || !Array.isArray(s.s) || s.s.length !== 81) return null;
    return {
      donnees: s.d, solution: s.s,
      valeurs: Array.isArray(s.v) && s.v.length === 81 ? s.v : s.d.slice(),
      notes: Array.isArray(s.n) && s.n.length === 81 ? s.n : new Array(81).fill(0),
      reveles: Array.isArray(s.r) ? s.r : [],
      fini: !!s.f,
    };
  }
  function sauver(n, p) {
    UI.Store.set(cle(n), { d: p.donnees, s: p.solution, v: p.valeurs, n: p.notes, r: p.reveles, f: p.fini });
  }
  function nouvelle(n) {
    const G = generer(n);
    const p = { donnees: G.donnees, solution: G.solution, valeurs: G.donnees.slice(), notes: new Array(81).fill(0), reveles: [], fini: false };
    sauver(n, p);
    return p;
  }
  function etat(n) {
    const p = charger(n);
    const stats = UI.Store.get("sdk-stats", {});
    const reussies = stats[n] || 0;
    if (!p) return { existe: false, reussies };
    const vides = p.donnees.filter((v) => !v).length;
    const remplies = p.valeurs.filter((v, k) => v && !p.donnees[k]).length;
    return { existe: true, fini: p.fini, remplies, vides, reussies };
  }

  // ---------- Écran de jeu ----------
  function ouvrir(racine, n, base = "#/sudoku") {
    const N = NIVEAUX[n - 1];
    const p = charger(n) || nouvelle(n);
    const { donnees, solution, valeurs, notes } = p;
    const reveles = new Set(p.reveles);
    let sel = donnees.findIndex((v) => !v);
    let modeNotes = false;
    const erreurs = new Set();
    let victoireAffichee = p.fini;

    racine.innerHTML = `
      <div class="sdk">
        <header class="barre">
          <a class="btn btn-retour" href="${base}">← Retour</a>
          <h1>Sudoku — ${N.nom}</h1>
          <span class="espace"></span>
          <button class="btn" data-act="verifier">Vérifier</button>
          <button class="btn" data-act="aide">Aide</button>
        </header>
        <div class="sdk-zone"><div class="sdk-grille"></div></div>
        <div class="sdk-pave">
          <div class="sdk-chiffres">${Array.from({ length: 9 }, (_, i) => `<button class="sdk-ch" data-d="${i + 1}"><b>${i + 1}</b><small></small></button>`).join("")}</div>
          <div class="sdk-outils">
            <button class="btn sdk-notes" data-act="notes">✎ Notes : non</button>
            <button class="btn" data-act="effacer">⌫ Effacer</button>
          </div>
        </div>
      </div>`;
    const elS = racine.querySelector(".sdk");
    const elZone = racine.querySelector(".sdk-zone");
    const elGrille = racine.querySelector(".sdk-grille");
    const elCh = [...racine.querySelectorAll(".sdk-ch")];
    const elNotes = racine.querySelector(".sdk-notes");

    const elCases = Array.from({ length: 81 }, (_, k) => {
      const c = document.createElement("div");
      c.className = "sdk-case";
      if (COL(k) % 3 === 2 && COL(k) < 8) c.classList.add("bd");
      if (LIGNE(k) % 3 === 2 && LIGNE(k) < 8) c.classList.add("bb");
      c.dataset.k = k;
      elGrille.appendChild(c);
      return c;
    });

    const enregistrer = () => { p.reveles = [...reveles]; sauver(n, p); };

    function majTout() {
      const v = valeurs[sel];
      // Doublons visibles tout de suite (règle du jeu, pas la solution).
      const doublons = new Set();
      for (let k = 0; k < 81; k++) if (valeurs[k]) for (const w of VOISINS[k]) if (valeurs[w] === valeurs[k]) doublons.add(k);
      elCases.forEach((c, k) => {
        const val = valeurs[k];
        c.classList.toggle("donne", !!donnees[k]);
        c.classList.toggle("revele", reveles.has(k));
        c.classList.toggle("sel", k === sel);
        c.classList.toggle("zone", sel >= 0 && k !== sel && (LIGNE(k) === LIGNE(sel) || COL(k) === COL(sel) || BLOC(k) === BLOC(sel)));
        c.classList.toggle("meme", !!v && val === v && k !== sel);
        c.classList.toggle("doublon", doublons.has(k) && !donnees[k]);
        c.classList.toggle("err", erreurs.has(k));
        if (val) c.textContent = val;
        else if (notes[k]) c.innerHTML = `<span class="sdk-n">${Array.from({ length: 9 }, (_, i) => `<i>${notes[k] & (1 << (i + 1)) ? i + 1 : ""}</i>`).join("")}</span>`;
        else c.textContent = "";
      });
      // Pavé : chiffres restants à placer.
      elCh.forEach((b, i) => {
        const d = i + 1;
        const restant = 9 - valeurs.filter((x) => x === d).length;
        b.querySelector("small").textContent = restant > 0 ? restant : "";
        b.classList.toggle("complet", restant <= 0);
        b.classList.toggle("note-on", modeNotes && sel >= 0 && !!(notes[sel] & (1 << d)));
      });
      elNotes.textContent = `✎ Notes : ${modeNotes ? "oui" : "non"}`;
      elNotes.classList.toggle("actif", modeNotes);
      elS.classList.toggle("termine", p.fini);
    }

    function jouer(d) {
      if (sel < 0 || donnees[sel] || reveles.has(sel) || p.fini) return;
      if (modeNotes) {
        if (valeurs[sel]) return;
        notes[sel] ^= 1 << d;
      } else {
        valeurs[sel] = valeurs[sel] === d ? 0 : d;
        erreurs.delete(sel);
        // Le chiffre posé disparaît des notes des cases voisines.
        if (valeurs[sel]) { notes[sel] = 0; for (const w of VOISINS[sel]) notes[w] &= ~(1 << d); }
      }
      enregistrer();
      majTout();
      verifierFin();
    }
    function effacer() {
      if (sel < 0 || donnees[sel] || reveles.has(sel)) return;
      if (valeurs[sel]) valeurs[sel] = 0; else notes[sel] = 0;
      erreurs.delete(sel);
      enregistrer();
      majTout();
    }

    function verifierFin() {
      if (!valeurs.every((v, k) => v === solution[k])) return;
      p.fini = true;
      enregistrer();
      majTout();
      if (victoireAffichee) return;
      victoireAffichee = true;
      const stats = UI.Store.get("sdk-stats", {});
      stats[n] = (stats[n] || 0) + 1;
      UI.Store.set("sdk-stats", stats);
      setTimeout(() => UI.modal({
        titre: "Bravo ! Sudoku terminé",
        html: `<p>Grille de niveau <b>${N.nom}</b> réussie.</p>`,
        boutons: [
          { label: "Nouvelle grille", classe: "btn-principal", action: () => nouvellePartie() },
          { label: "Retour aux niveaux", action: () => { location.hash = base; } },
        ],
      }), 400);
    }

    function nouvellePartie() {
      elGrille.classList.add("prepa");
      setTimeout(() => {
        const q = nouvelle(n);
        Object.assign(p, q);
        p.donnees.forEach((v, k) => { donnees[k] = q.donnees[k]; solution[k] = q.solution[k]; valeurs[k] = q.valeurs[k]; notes[k] = 0; });
        reveles.clear(); erreurs.clear(); victoireAffichee = false; p.fini = false;
        p.donnees = donnees; p.solution = solution; p.valeurs = valeurs; p.notes = notes;
        sel = donnees.findIndex((v) => !v);
        enregistrer();
        elGrille.classList.remove("prepa");
        majTout();
      }, 30);
    }

    function verifier() {
      erreurs.clear();
      valeurs.forEach((v, k) => { if (v && !donnees[k] && v !== solution[k]) erreurs.add(k); });
      majTout();
      UI.toast(erreurs.size ? `${erreurs.size} chiffre${erreurs.size > 1 ? "s" : ""} à revoir (en rouge).` : "Aucune erreur pour l'instant.");
    }

    function aide() {
      const boutons = [];
      if (sel >= 0 && !donnees[sel] && valeurs[sel] !== solution[sel]) {
        boutons.push({ label: "Révéler cette case", classe: "btn-principal", action: () => {
          valeurs[sel] = solution[sel]; notes[sel] = 0; reveles.add(sel); erreurs.delete(sel);
          for (const w of VOISINS[sel]) notes[w] &= ~(1 << solution[sel]);
          enregistrer(); majTout(); verifierFin();
        } });
      }
      boutons.push({ label: "Noter toutes les possibilités", action: () => {
        for (let k = 0; k < 81; k++) if (!valeurs[k]) notes[k] = candidats(valeurs, k);
        enregistrer(); majTout();
      } });
      boutons.push({ label: "Nouvelle grille", classe: "btn-danger", action: () => {
        UI.modal({
          titre: "Commencer une nouvelle grille ?",
          html: "<p>La grille en cours sera abandonnée.</p>",
          boutons: [{ label: "Non, continuer" }, { label: "Oui, nouvelle grille", classe: "btn-danger", action: nouvellePartie }],
        });
      } });
      boutons.push({ label: "Fermer" });
      UI.modal({
        titre: "Aide",
        html: `<p>Chaque ligne, chaque colonne et chaque carré de 3 × 3 doit contenir tous les chiffres de 1 à 9, une seule fois.</p>
          <p>Touchez une case, puis un chiffre. Avec « Notes », les chiffres s'inscrivent en petit, comme au crayon. Un chiffre en double est signalé en rouge.</p>`,
        boutons,
      });
    }

    // ---------- Événements ----------
    elGrille.addEventListener("click", (e) => {
      const c = e.target.closest(".sdk-case");
      if (!c) return;
      sel = +c.dataset.k;
      majTout();
    });
    racine.querySelector(".sdk-pave").addEventListener("click", (e) => {
      const b = e.target.closest("[data-d], [data-act]");
      if (!b) return;
      if (b.dataset.d) jouer(+b.dataset.d);
      else if (b.dataset.act === "notes") { modeNotes = !modeNotes; majTout(); }
      else if (b.dataset.act === "effacer") effacer();
    });
    racine.querySelector(".sdk .barre").addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      if (b.dataset.act === "verifier") verifier();
      else if (b.dataset.act === "aide") aide();
    });
    function surTouche(e) {
      if (document.querySelector(".modal-fond")) return;
      if (/^[1-9]$/.test(e.key)) { jouer(+e.key); e.preventDefault(); }
      else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") { effacer(); e.preventDefault(); }
    }
    document.addEventListener("keydown", surTouche);

    function dimensionner() {
      const r = elZone.getBoundingClientRect();
      const s = Math.max(24, Math.floor(Math.min(92, (r.width - 16) / 9, (r.height - 16) / 9)));
      elS.style.setProperty("--sdk", s + "px");
    }
    const ro = new ResizeObserver(dimensionner);
    ro.observe(elZone);

    majTout();
    dimensionner();
    return () => { ro.disconnect(); document.removeEventListener("keydown", surTouche); };
  }

  window.Sudoku = { NIVEAUX, generer, evaluer, compter, etat, nouvelle, ouvrir };
})();
