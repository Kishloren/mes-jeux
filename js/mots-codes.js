// Jeu : Mots codés. Grille de mots croisés sans définitions : chaque lettre est
// remplacée par un nombre, toujours le même. Trouver une lettre la place partout.
(function () {
  "use strict";

  const cle = (g) => "mc-" + g.id;

  // Contrôles d'une grille (format interne) ; renvoie la liste des erreurs.
  function valider(g) {
    const err = [];
    try {
      const L = g.lignes;
      if (!Array.isArray(L) || L.length < 5 || L.length > 16) err.push("nombre de lignes");
      const C = L[0].length;
      if (C < 5 || C > 14 || L.some((l) => l.length !== C || !/^[A-Z#]+$/.test(l))) err.push("lignes");
      const presentes = [...new Set(L.join("").replace(/#/g, ""))];
      const nums = presentes.map((ch) => g.codes[ch]);
      const n = presentes.length;
      if (nums.some((x) => !Number.isInteger(x) || x < 1 || x > n) || new Set(nums).size !== n) err.push("codes");
      if (Object.keys(g.codes).length !== n) err.push("codes en trop");
      if (!Array.isArray(g.devoiles) || g.devoiles.some((ch) => !presentes.includes(ch))) err.push("lettres données");
      // Une lettre présente une seule fois (et non donnée) doit être à un croisement,
      // pour être devinable par deux mots.
      const blanc = (l, c) => l >= 0 && l < L.length && c >= 0 && c < C && L[l][c] !== "#";
      const vues = {};
      L.forEach((ligne, l) => [...ligne].forEach((ch, c) => {
        if (ch !== "#") (vues[ch] = vues[ch] || []).push([l, c]);
      }));
      for (const [ch, pos] of Object.entries(vues)) {
        if (pos.length !== 1 || g.devoiles.includes(ch)) continue;
        const [l, c] = pos[0];
        if (!((blanc(l, c - 1) || blanc(l, c + 1)) && (blanc(l - 1, c) || blanc(l + 1, c)))) err.push("lettre unique hors croisement : " + ch);
      }
    } catch (e) {
      err.push("grille illisible");
    }
    return err;
  }

  function analyser(g) {
    const R = g.lignes.length, C = g.lignes[0].length;
    const lettre = {}; // numéro -> lettre
    Object.entries(g.codes).forEach(([ch, n]) => { lettre[n] = ch; });
    const n = Object.keys(g.codes).length;
    const cases = []; // index -> numéro (0 = noire)
    g.lignes.forEach((l) => [...l].forEach((ch) => cases.push(ch === "#" ? 0 : g.codes[ch])));
    const donnes = new Set(g.devoiles.map((ch) => g.codes[ch]));
    return { R, C, n, lettre, cases, donnes };
  }

  function charger(g, A) {
    const s = UI.Store.get(cle(g), null);
    const choix = {}; // numéro -> lettre proposée
    const reveles = new Set(A.donnes);
    let fini = false;
    if (s && s.a) {
      Object.entries(s.a).forEach(([k, v]) => { if (+k >= 1 && +k <= A.n && /^[A-Z]$/.test(v)) choix[+k] = v; });
      (s.r || []).forEach((k) => reveles.add(k));
      fini = !!s.f;
    }
    reveles.forEach((k) => { choix[k] = A.lettre[k]; });
    return { choix, reveles, fini };
  }

  function progression(g) {
    const A = analyser(g);
    const st = charger(g, A);
    return { trouves: Object.keys(st.choix).length, total: A.n, fini: st.fini };
  }

  function reinitialiser(g) { UI.Store.del(cle(g)); }

  // base : adresse de la liste des grilles (le carnet).
  function ouvrir(racine, g, base = "#/mots-codes") {
    const A = analyser(g);
    const { R, C, n, lettre, cases } = A;
    const st = charger(g, A);
    const { choix, reveles } = st;
    const erreurs = new Set();
    let sel = cases.findIndex((x) => x && !choix[x]);
    if (sel < 0) sel = cases.findIndex((x) => x);
    let victoireAffichee = st.fini;

    racine.innerHTML = `
      <div class="mc">
        <header class="barre">
          <a class="btn btn-retour" href="${base}">← Retour</a>
          <h1>${UI.echap(g.nom)}</h1>
          <span class="espace"></span>
          <button class="btn" data-act="verifier">Vérifier</button>
          <button class="btn" data-act="aide">Aide</button>
        </header>
        <div class="mc-zone"><div class="mc-grille"></div></div>
        <div class="mc-table"></div>
        <div class="clavier"></div>
      </div>`;
    const elMC = racine.querySelector(".mc");
    const elZone = racine.querySelector(".mc-zone");
    const elGrille = racine.querySelector(".mc-grille");
    const elTable = racine.querySelector(".mc-table");
    const elClavier = racine.querySelector(".clavier");

    // Grille
    const elCases = cases.map((num, i) => {
      const c = document.createElement("div");
      c.className = num ? "case" : "case noire";
      if (num) {
        c.dataset.i = i;
        c.innerHTML = `<span class="num">${num}</span><span class="let"></span>`;
      }
      elGrille.appendChild(c);
      return c;
    });
    elGrille.style.gridTemplateColumns = `repeat(${C}, var(--mc))`;

    // Table de décodage
    const elNums = [];
    for (let k = 1; k <= n; k++) {
      const t = document.createElement("button");
      t.className = "mc-code";
      t.dataset.k = k;
      t.innerHTML = `<span class="mc-n">${k}</span><span class="mc-l"></span>`;
      elTable.appendChild(t);
      elNums[k] = t;
    }
    elTable.style.setProperty("--par-ligne", Math.ceil(n / 2));

    // Clavier
    const touches = {};
    UI.clavier().forEach((rangee, ri) => {
      const r = document.createElement("div");
      r.className = "rangee";
      for (const k of rangee) {
        const b = document.createElement("button");
        b.className = "touche";
        b.dataset.k = k;
        b.textContent = k;
        r.appendChild(b);
        touches[k] = b;
      }
      if (ri === 2) {
        r.insertAdjacentHTML("beforeend",
          `<button class="touche touche-fl" data-k="PREC" aria-label="Nombre précédent">◀</button>
           <button class="touche touche-fl" data-k="SUIV" aria-label="Nombre suivant">▶</button>
           <button class="touche touche-eff" data-k="EFFACER" aria-label="Effacer">⌫</button>`);
      }
      elClavier.appendChild(r);
    });

    // ---------- Affichage ----------
    function majTout() {
      const numSel = cases[sel];
      elCases.forEach((c, i) => {
        const num = cases[i];
        if (!num) return;
        c.querySelector(".let").textContent = choix[num] || "";
        c.classList.toggle("meme", num === numSel);
        c.classList.toggle("sel", i === sel);
        c.classList.toggle("revele", reveles.has(num));
        c.classList.toggle("err", erreurs.has(num));
      });
      for (let k = 1; k <= n; k++) {
        const t = elNums[k];
        t.querySelector(".mc-l").textContent = choix[k] || "";
        t.classList.toggle("sel", k === numSel);
        t.classList.toggle("revele", reveles.has(k));
        t.classList.toggle("err", erreurs.has(k));
      }
      const prises = new Set(Object.values(choix));
      for (const k in touches) touches[k].classList.toggle("prise", prises.has(k));
    }

    function miseEnPage() {
      elMC.style.setProperty("--mc", "10px");
      const W = elZone.clientWidth - 12, H = elZone.clientHeight - 12;
      const s = Math.max(24, Math.min(68, Math.floor(W / C), Math.floor(H / R)));
      elMC.style.setProperty("--mc", s + "px");
    }

    function sauver() {
      const a = {};
      Object.entries(choix).forEach(([k, v]) => { if (!reveles.has(+k)) a[k] = v; });
      UI.Store.set(cle(g), { a, r: [...reveles].filter((k) => !A.donnes.has(k)), f: st.fini });
    }

    // ---------- Sélection et saisie ----------
    function choisirNumero(k) {
      // On sélectionne la première case qui porte ce numéro.
      const i = cases.indexOf(k);
      if (i >= 0) sel = i;
      majTout();
    }

    // Case suivante sans lettre dans le mot de la case choisie (horizontal d'abord).
    function suivante() {
      const l = Math.floor(sel / C), c = sel % C;
      const blanc = (ll, cc) => ll >= 0 && ll < R && cc >= 0 && cc < C && cases[ll * C + cc];
      const sens = blanc(l, c - 1) || blanc(l, c + 1) ? [0, 1] : [1, 0];
      for (let ll = l + sens[0], cc = c + sens[1]; blanc(ll, cc); ll += sens[0], cc += sens[1]) {
        if (!choix[cases[ll * C + cc]]) { sel = ll * C + cc; return; }
      }
    }

    function ecrire(ch) {
      const k = cases[sel];
      if (!k || reveles.has(k)) return;
      // Une lettre ne correspond qu'à un seul nombre : on la retire ailleurs.
      for (const [autre, v] of Object.entries(choix)) {
        if (v === ch && +autre !== k && !reveles.has(+autre)) { delete choix[autre]; erreurs.delete(+autre); }
      }
      if (Object.values(choix).includes(ch) && choix[k] !== ch) {
        UI.toast(`La lettre ${ch} est déjà donnée pour un autre nombre.`);
        return;
      }
      choix[k] = ch;
      erreurs.delete(k);
      suivante();
      sauver();
      majTout();
      verifierFin();
    }

    function effacer() {
      const k = cases[sel];
      if (!k || reveles.has(k)) return;
      delete choix[k];
      erreurs.delete(k);
      sauver();
      majTout();
    }

    function voisinNumero(sens) {
      let k = cases[sel] || 1;
      for (let t = 0; t < n; t++) {
        k = ((k - 1 + sens + n) % n) + 1;
        if (!reveles.has(k)) break;
      }
      choisirNumero(k);
    }

    function toucheClavier(k) {
      if (k === "EFFACER") effacer();
      else if (k === "PREC") voisinNumero(-1);
      else if (k === "SUIV") voisinNumero(1);
      else if (/^[A-Z]$/.test(k)) ecrire(k);
    }

    // ---------- Vérification, aide, victoire ----------
    function verifier() {
      erreurs.clear();
      let remplis = 0;
      for (let k = 1; k <= n; k++) {
        if (!choix[k] || reveles.has(k)) continue;
        remplis++;
        if (choix[k] !== lettre[k]) erreurs.add(k);
      }
      majTout();
      if (!remplis) UI.toast("Aucune lettre à vérifier pour l'instant.");
      else if (!erreurs.size) UI.toast(`Aucune erreur parmi les ${remplis} lettres trouvées. Bravo !`);
      else UI.toast(erreurs.size === 1 ? "1 nombre à revoir (en rouge)." : `${erreurs.size} nombres à revoir (en rouge).`, 5000);
    }

    function verifierFin() {
      for (let k = 1; k <= n; k++) if (!choix[k]) return;
      for (let k = 1; k <= n; k++) {
        if (choix[k] !== lettre[k]) {
          UI.toast("Tous les nombres ont une lettre, mais il reste des erreurs. Touchez « Vérifier ».", 5000);
          return;
        }
      }
      st.fini = true;
      sauver();
      elMC.classList.add("termine");
      if (!victoireAffichee) {
        victoireAffichee = true;
        UI.modal({
          titre: "Bravo ! Grille terminée",
          html: "<p>Vous avez trouvé toutes les lettres.</p>",
          boutons: [
            { label: "Rester sur la grille" },
            { label: "↺ Recommencer la grille", action: demanderRecommencer },
            { label: "Retour aux grilles", classe: "btn-principal", action: () => { location.hash = base; } },
          ],
        });
      }
    }

    function demanderRecommencer() {
      UI.modal({
        titre: "Effacer toute la grille ?",
        html: "<p>Toutes les lettres trouvées seront effacées. Cette action ne peut pas être annulée.</p>",
        boutons: [
          { label: "Non, garder" },
          { label: "Oui, effacer", classe: "btn-danger", action: () => {
            for (const k of Object.keys(choix)) if (!A.donnes.has(+k)) delete choix[k];
            [...reveles].forEach((k) => { if (!A.donnes.has(k)) reveles.delete(k); });
            erreurs.clear();
            st.fini = false;
            victoireAffichee = false;
            elMC.classList.remove("termine");
            sauver();
            majTout();
          } },
        ],
      });
    }

    function aide() {
      const k = cases[sel];
      const boutons = [];
      if (k && !reveles.has(k)) {
        boutons.push({ label: `Montrer la lettre du nombre ${k}`, action: () => {
          // Si cette lettre était proposée ailleurs, on l'y retire.
          for (const [autre, v] of Object.entries(choix)) if (v === lettre[k] && +autre !== k) delete choix[autre];
          choix[k] = lettre[k];
          reveles.add(k);
          erreurs.delete(k);
          sauver();
          majTout();
          verifierFin();
        } });
      }
      boutons.push({ label: "Effacer toute la grille", classe: "btn-danger", action: demanderRecommencer });
      boutons.push({ label: "Fermer", classe: "btn-principal" });
      UI.modal({
        titre: "Aide",
        html: `<p>Chaque nombre remplace toujours la même lettre, et deux nombres différents ne cachent jamais la même lettre.</p>
          <p>Touchez une case puis une lettre du clavier : elle s'inscrit dans toutes les cases qui portent ce nombre. Les lettres en vert sont données.</p>`,
        boutons,
      });
    }

    // ---------- Événements ----------
    elGrille.addEventListener("click", (e) => {
      const c = e.target.closest(".case[data-i]");
      if (!c) return;
      sel = +c.dataset.i;
      majTout();
    });
    elTable.addEventListener("click", (e) => {
      const t = e.target.closest("[data-k]");
      if (t) choisirNumero(+t.dataset.k);
    });
    elClavier.addEventListener("click", (e) => {
      const b = e.target.closest("[data-k]");
      if (b) toucheClavier(b.dataset.k);
    });
    racine.querySelector(".barre").addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      if (b.dataset.act === "verifier") verifier();
      else if (b.dataset.act === "aide") aide();
    });
    function surTouche(e) {
      if (document.querySelector(".modal-fond") || e.ctrlKey || e.altKey || e.metaKey) return;
      const k = e.key;
      if (/^[a-zA-Z]$/.test(k)) { ecrire(k.toUpperCase()); e.preventDefault(); }
      else if (k === "Backspace" || k === "Delete") { effacer(); e.preventDefault(); }
      else if (k === "ArrowLeft") { voisinNumero(-1); e.preventDefault(); }
      else if (k === "ArrowRight") { voisinNumero(1); e.preventDefault(); }
    }
    document.addEventListener("keydown", surTouche);
    let rTimer = null;
    const surResize = () => { clearTimeout(rTimer); rTimer = setTimeout(miseEnPage, 120); };
    window.addEventListener("resize", surResize);

    miseEnPage();
    majTout();
    if (st.fini) elMC.classList.add("termine");

    return function nettoyer() {
      document.removeEventListener("keydown", surTouche);
      window.removeEventListener("resize", surResize);
    };
  }

  window.MotsCodes = { ouvrir, progression, reinitialiser, valider };
})();
