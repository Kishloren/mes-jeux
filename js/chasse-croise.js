// Jeu : Chassé-croisé.
(function () {
  "use strict";

  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()
    .replace(/Œ/g, "OE").replace(/Æ/g, "AE");
  const JOINTS = "'’-‑";

  // Découpe la citation en mots ; chaque case = { pos (1..N), joint (apostrophe/trait d'union avant) }.
  function analyser(g) {
    const mots = [];
    const lettres = [];
    let mot = [];
    let joint = false;
    for (const ch of g.citation) {
      const n = norm(ch);
      if (/^[A-Z]+$/.test(n)) {
        for (const l of n) {
          lettres.push(l);
          mot.push({ pos: lettres.length, joint });
          joint = false;
        }
      } else if (JOINTS.includes(ch) && mot.length) {
        joint = true;
      } else {
        if (mot.length) mots.push(mot);
        mot = [];
        joint = false;
      }
    }
    if (mot.length) mots.push(mot);
    const proprio = []; // proprio[pos] = { d, i }
    g.defs.forEach((d, di) => d[3].forEach((pos, i) => { proprio[pos] = { d: di, i }; }));
    return { mots, lettres, N: lettres.length, proprio };
  }

  function cleStock(g) { return "cc-" + g.id; }

  function charger(g, N) {
    const s = UI.Store.get(cleStock(g), null);
    const saisie = new Array(N + 1).fill("");
    const reveles = new Set();
    let fini = false;
    if (s && typeof s.s === "string" && s.s.length === N) {
      for (let i = 0; i < N; i++) saisie[i + 1] = s.s[i] === "." ? "" : s.s[i];
      (s.r || []).forEach((p) => reveles.add(p));
      fini = !!s.f;
    }
    return { saisie, reveles, fini };
  }

  // Contrôles bloquants d'une grille (spécification § 5.4) ; renvoie la liste des erreurs.
  function valider(g) {
    const err = [];
    try {
      const { lettres, N } = analyser(g);
      if (N < 100 || N > 300) err.push("longueur de citation");
      if (!Array.isArray(g.defs) || g.defs.length < 8 || g.defs.length > 26) err.push("nombre de définitions");
      if (!Number.isInteger(g.acrostiche) || g.acrostiche < 0) err.push("acrostiche");
      const vus = new Set();
      for (const [lettre, texte, rep, cases] of g.defs) {
        if (!lettre || !texte) err.push("définition vide");
        if (!/^[A-Z]{2,14}$/.test(rep) || !Array.isArray(cases) || cases.length !== rep.length) { err.push("réponse " + rep); continue; }
        if (rep.length <= g.acrostiche) err.push("acrostiche hors de " + rep);
        cases.forEach((c, i) => {
          if (!Number.isInteger(c) || c < 1 || c > N || vus.has(c) || lettres[c - 1] !== rep[i]) err.push(`case ${c} de ${rep}`);
          vus.add(c);
        });
      }
      if (vus.size !== N) err.push("cases non couvertes");
    } catch (e) {
      err.push("grille illisible");
    }
    return err;
  }

  function reinitialiser(g) { UI.Store.del(cleStock(g)); }

  function progression(g) {
    const a = analyser(g);
    const st = charger(g, a.N);
    return { remplies: st.saisie.filter(Boolean).length, total: a.N, fini: st.fini };
  }

  // Disposition de la grille comme dans le magazine : une case noire entre deux mots,
  // retour à la ligne toutes les `cols` cases (les mots peuvent être coupés),
  // dernière ligne complétée par des cases noires.
  function disposer(mots, cols) {
    const flux = [];
    mots.forEach((m, i) => {
      if (i) flux.push(null);
      flux.push(...m);
    });
    while (flux.length % cols) flux.push(null);
    const lignes = [];
    for (let i = 0; i < flux.length; i += cols) lignes.push(flux.slice(i, i + cols));
    return lignes;
  }

  const CLAVIER = ["AZERTYUIOP", "QSDFGHJKLM", "WXCVBN"];

  // base : adresse de la liste des grilles (le carnet).
  function ouvrir(racine, g, base = "#/chasse-croise") {
    const A = analyser(g);
    const { N, lettres, proprio, mots } = A;
    const st = charger(g, N);
    const { saisie, reveles } = st;
    const erreurs = new Set();
    let sel = { pos: 0, ctx: "def" };
    let zoom = UI.Store.get("cc-zoom", 1);
    let numeros = UI.Store.get("cc-numeros", true); // numéros des cases visibles ?
    let victoireAffichee = st.fini;

    const motDePos = []; // index du mot de la citation pour chaque position
    mots.forEach((m, mi) => m.forEach((c) => { motDePos[c.pos] = mi; }));

    // ---------- Construction du DOM ----------
    racine.innerHTML = `
      <div class="cc">
        <header class="barre">
          <a class="btn btn-retour" href="${base}">← Retour</a>
          <h1>${UI.echap(g.nom)}</h1>
          <span class="espace"></span>
          <button class="btn" data-act="verifier">Vérifier</button>
          <button class="btn" data-act="aide">Aide</button>
          <button class="btn btn-num" data-act="numeros">N°</button>
          <button class="btn btn-zoom" data-act="zoom" aria-label="Taille du texte">A<small>A</small></button>
        </header>
        <div class="cc-corps">
          <div class="cc-acro">
            <div class="acro-titre">Auteur<br>et titre</div>
            <div class="acro-cases"></div>
          </div>
          <div class="cc-defs"></div>
          <div class="clavier"></div>
          <div class="cc-droite">
            <div class="cc-grille"><div class="grille"></div></div>
          </div>
        </div>
      </div>`;
    const elCC = racine.querySelector(".cc");
    const elDefs = racine.querySelector(".cc-defs");
    const elZoneGrille = racine.querySelector(".cc-grille");
    const elGrille = racine.querySelector(".grille");
    const elClavier = racine.querySelector(".clavier");
    const elAcro = racine.querySelector(".acro-cases");
    const elEntete = racine.querySelector(".barre");

    const caseDef = [];   // caseDef[pos] = élément
    const caseGrille = []; // caseGrille[pos] = élément
    const caseAcro = [];  // caseAcro[pos] = élément (colonne auteur/titre)
    const ligneDef = [];  // ligneDef[di] = élément
    const posAcro = g.defs.map((d) => d[3][g.acrostiche]);

    // Bande « auteur et titre » : la colonne encadrée de bleu, toujours visible
    posAcro.forEach((pos, di) => {
      const c = document.createElement("div");
      c.className = "case acro";
      c.dataset.pos = pos;
      c.dataset.ctx = "acro";
      c.innerHTML = `<span class="num">${g.defs[di][0]}</span><span class="let"></span>`;
      caseAcro[pos] = c;
      elAcro.appendChild(c);
    });

    // Définitions : toutes les lignes ont autant de cases que la plus longue réponse.
    const LMAX = Math.max(...g.defs.map((d) => d[3].length));
    const fragDefs = document.createDocumentFragment();
    g.defs.forEach(([lettre, texte, rep, nums], di) => {
      const row = document.createElement("div");
      row.className = "def";
      row.innerHTML = `<span class="def-lettre">${lettre}</span><span class="def-texte">${UI.echap(texte)}</span>`;
      const cases = document.createElement("span");
      cases.className = "def-cases";
      for (let i = 0; i < LMAX; i++) {
        const c = document.createElement("span");
        if (i < nums.length) {
          const pos = nums[i];
          c.className = "case" + (i === g.acrostiche ? " acro" : "");
          c.dataset.pos = pos;
          c.dataset.ctx = "def";
          c.innerHTML = `<span class="num">${pos}</span><span class="let"></span>`;
          caseDef[pos] = c;
        } else {
          c.className = "case noire";
        }
        cases.appendChild(c);
      }
      row.appendChild(cases);
      ligneDef[di] = row;
      fragDefs.appendChild(row);
    });
    elDefs.appendChild(fragDefs);

    // Cases de la grille (créées une fois, replacées à chaque redimensionnement)
    for (let pos = 1; pos <= N; pos++) {
      const p = proprio[pos];
      const c = document.createElement("div");
      c.className = "case";
      c.dataset.pos = pos;
      c.dataset.ctx = "grille";
      c.innerHTML = `<span class="num">${g.defs[p.d][0]}${pos}</span><span class="let"></span>`;
      caseGrille[pos] = c;
    }
    const jointDePos = [];
    mots.forEach((m) => m.forEach((c) => { jointDePos[c.pos] = c.joint; }));

    // Clavier
    CLAVIER.forEach((rangee, ri) => {
      const r = document.createElement("div");
      r.className = "rangee";
      for (const k of rangee) {
        const b = document.createElement("button");
        b.className = "touche";
        b.dataset.k = k;
        b.textContent = k;
        r.appendChild(b);
      }
      if (ri === 2) {
        const gauche = document.createElement("button");
        gauche.className = "touche touche-fl";
        gauche.dataset.k = "GAUCHE";
        gauche.setAttribute("aria-label", "Case précédente");
        gauche.textContent = "◀";
        const droite = document.createElement("button");
        droite.className = "touche touche-fl";
        droite.dataset.k = "DROITE";
        droite.setAttribute("aria-label", "Case suivante");
        droite.textContent = "▶";
        const eff = document.createElement("button");
        eff.className = "touche touche-eff";
        eff.dataset.k = "EFFACER";
        eff.setAttribute("aria-label", "Effacer");
        eff.textContent = "⌫";
        r.append(gauche, droite, eff);
      }
      elClavier.appendChild(r);
    });

    // ---------- Mise en page adaptative ----------
    function placerAcro() {
      const W = elCC.clientWidth - 120; // place pour le libellé « Auteur et titre »
      const n = posAcro.length;
      let cols = n;
      let s = Math.floor(W / n);
      if (s < 30) { cols = Math.ceil(n / 2); s = Math.floor(W / cols); }
      s = Math.max(26, Math.min(48, s));
      elAcro.style.setProperty("--ac", s + "px");
      elAcro.style.gridTemplateColumns = `repeat(${cols}, ${s}px)`;
    }

    const COLS = g.colonnes || 20;
    const LIGNES = disposer(mots, COLS);

    // Hauteur disponible pour la grille.
    function hauteurGrille() {
      const portrait = elCC.classList.contains("portrait");
      if (portrait) {
        // Ce qui reste une fois l'en-tête, la bande auteur/titre, le clavier
        // et au moins trois définitions placés.
        const dc = parseFloat(getComputedStyle(elCC).getPropertyValue("--dc"));
        return Math.max(160, window.innerHeight - elEntete.offsetHeight - elClavier.offsetHeight
          - elAcro.parentElement.offsetHeight - 3 * (dc + 14) - 16);
      }
      return window.innerHeight - elEntete.offsetHeight - elAcro.parentElement.offsetHeight - 12;
    }

    // En paysage, la grille prend toute la largeur qu'elle peut remplir en hauteur ;
    // les définitions gardent au moins la place de leurs 8 cases.
    function partagerLargeur() {
      const corps = elCC.querySelector(".cc-corps");
      if (elCC.classList.contains("portrait")) { corps.style.gridTemplateColumns = ""; return; }
      const total = corps.clientWidth;
      const sH = Math.min(64, Math.floor(hauteurGrille() / LIGNES.length));
      const minDefs = Math.round(44 + 100 * zoom + 8 * 32 + 34);
      const defs = Math.max(minDefs, total - (COLS * sH + 16));
      corps.style.gridTemplateColumns = `${Math.min(defs, total - 200)}px minmax(0, 1fr)`;
    }

    function placerGrille() {
      const W = elZoneGrille.clientWidth - 8;
      const H = hauteurGrille();
      const s = Math.max(16, Math.min(64, Math.floor(W / COLS), Math.floor(H / LIGNES.length)));
      const choix = { s, cols: COLS, lignes: LIGNES };
      elGrille.style.setProperty("--gc", choix.s + "px");
      elGrille.style.gridTemplateColumns = `repeat(${choix.cols}, ${choix.s}px)`;
      const frag = document.createDocumentFragment();
      for (const ligne of choix.lignes) {
        ligne.forEach((c, x) => {
          if (!c) {
            const n = document.createElement("div");
            n.className = "case noire";
            frag.appendChild(n);
          } else {
            const el = caseGrille[c.pos];
            el.classList.toggle("joint", !!jointDePos[c.pos] && x > 0);
            frag.appendChild(el);
          }
        });
      }
      elGrille.innerHTML = "";
      elGrille.appendChild(frag);
    }

    function placerDefs() {
      elCC.style.setProperty("--zoom", zoom);
      // Largeur utile d'une ligne : marges (12), pastille (40 + 8), espace (8), bordure des cases (4).
      const W = elDefs.clientWidth - 16;
      const texteMin = 110 * zoom;
      let dc = (W - 72 - texteMin) / LMAX;
      // Trop étroit : les cases passent sous l'intitulé, sur toute la largeur.
      const empile = dc < 38;
      if (empile) dc = (W - 12 - 48 - 4) / LMAX;
      elCC.classList.toggle("defs-empilees", empile);
      elCC.style.setProperty("--dc", Math.floor(Math.max(20, Math.min(56 * zoom, dc))) + "px");
    }

    function miseEnPage() {
      elCC.classList.toggle("portrait", window.innerHeight > window.innerWidth);
      // On vide la grille pour mesurer la place disponible sans elle.
      elGrille.innerHTML = "";
      placerAcro();
      partagerLargeur();
      placerDefs();
      placerGrille();
    }

    // ---------- Affichage ----------
    function majCase(pos) {
      const v = saisie[pos];
      for (const el of [caseDef[pos], caseGrille[pos], caseAcro[pos]]) {
        if (!el) continue;
        el.lastChild.textContent = v;
        el.classList.toggle("revele", reveles.has(pos));
        el.classList.toggle("err", erreurs.has(pos));
      }
    }

    let surlignes = [];
    function surligner() {
      surlignes.forEach((el) => el.classList.remove("sel", "lie", "actif"));
      surlignes = [];
      const ajoute = (el, cl) => { if (el) { el.classList.add(cl); surlignes.push(el); } };
      const pos = sel.pos;
      const p = proprio[pos];
      // Définition concernée
      ajoute(ligneDef[p.d], "actif");
      if (sel.ctx === "def") {
        g.defs[p.d][3].forEach((q) => ajoute(caseGrille[q], "lie"));
      } else {
        mots[motDePos[pos]].forEach((c) => ajoute(caseGrille[c.pos], "lie"));
      }
      if (sel.ctx === "acro") posAcro.forEach((q) => ajoute(caseAcro[q], "lie"));
      ajoute(caseDef[pos], "sel");
      ajoute(caseGrille[pos], "sel");
      ajoute(caseAcro[pos], "sel");
    }

    // Seule la liste des définitions défile : on y amène la définition concernée.
    function selectionner(pos, ctx, defiler) {
      sel = { pos, ctx };
      surligner();
      if (defiler !== false) {
        const row = ligneDef[proprio[pos].d];
        const haut = row.offsetTop; // .cc-defs est en position: relative
        const bas = haut + row.offsetHeight;
        if (haut < elDefs.scrollTop) elDefs.scrollTo({ top: haut - 8, behavior: "smooth" });
        else if (bas > elDefs.scrollTop + elDefs.clientHeight) elDefs.scrollTo({ top: bas - elDefs.clientHeight + 8, behavior: "smooth" });
      }
    }

    function sauver() {
      let s = "";
      for (let i = 1; i <= N; i++) s += saisie[i] || ".";
      UI.Store.set(cleStock(g), { s, r: [...reveles], f: st.fini });
    }

    // ---------- Déplacements ----------
    function suivant(pos, ctx, sens) {
      if (ctx === "acro") {
        const i = posAcro.indexOf(pos) + sens;
        return i >= 0 && i < posAcro.length ? posAcro[i] : null;
      }
      if (ctx === "def") {
        const p = proprio[pos];
        const nums = g.defs[p.d][3];
        const i = p.i + sens;
        return i >= 0 && i < nums.length ? nums[i] : null;
      }
      const q = pos + sens;
      return q >= 1 && q <= N ? q : null;
    }

    function definitionVoisine(sens) {
      const p = proprio[sel.pos];
      const d = p.d + sens;
      if (d < 0 || d >= g.defs.length) return;
      const nums = g.defs[d][3];
      selectionner(nums[Math.min(p.i, nums.length - 1)], "def");
    }

    // ---------- Saisie ----------
    function ecrire(l) {
      const pos = sel.pos;
      if (!reveles.has(pos)) {
        saisie[pos] = l;
        erreurs.delete(pos);
        majCase(pos);
        sauver();
      }
      const n = suivant(pos, sel.ctx, 1);
      if (n) selectionner(n, sel.ctx);
      verifierFin();
    }

    function effacer() {
      let pos = sel.pos;
      if (!saisie[pos] || reveles.has(pos)) {
        const p = suivant(pos, sel.ctx, -1);
        if (!p) return;
        pos = p;
        selectionner(pos, sel.ctx);
      }
      if (reveles.has(pos)) return;
      saisie[pos] = "";
      erreurs.delete(pos);
      majCase(pos);
      sauver();
    }

    function toucheClavier(k) {
      if (k === "EFFACER") effacer();
      else if (k === "GAUCHE") { const p = suivant(sel.pos, sel.ctx, -1); if (p) selectionner(p, sel.ctx); }
      else if (k === "DROITE") { const p = suivant(sel.pos, sel.ctx, 1); if (p) selectionner(p, sel.ctx); }
      else if (/^[A-Z]$/.test(k)) ecrire(k);
    }

    // ---------- Vérification, aides, victoire ----------
    function verifier() {
      erreurs.clear();
      let remplies = 0;
      for (let pos = 1; pos <= N; pos++) {
        if (!saisie[pos]) continue;
        remplies++;
        if (saisie[pos] !== lettres[pos - 1]) erreurs.add(pos);
      }
      for (let pos = 1; pos <= N; pos++) majCase(pos);
      if (!remplies) UI.toast("La grille est encore vide.");
      else if (!erreurs.size) UI.toast(`Aucune erreur parmi les ${remplies} lettres. Bravo !`);
      else UI.toast(erreurs.size === 1 ? "1 lettre à revoir (en rouge)." : `${erreurs.size} lettres à revoir (en rouge).`, 5000);
    }

    function verifierFin() {
      for (let pos = 1; pos <= N; pos++) if (!saisie[pos]) return;
      for (let pos = 1; pos <= N; pos++) {
        if (saisie[pos] !== lettres[pos - 1]) {
          UI.toast("La grille est remplie, mais il reste des erreurs. Touchez « Vérifier ».", 5000);
          return;
        }
      }
      st.fini = true;
      sauver();
      if (!victoireAffichee) {
        victoireAffichee = true;
        afficherVictoire();
      }
    }

    function afficherVictoire() {
      UI.modal({
        titre: "Bravo ! Grille terminée",
        html: `<blockquote>${UI.echap(g.citation)}</blockquote>
               <p class="signature">${UI.echap(g.auteur)}<br><i>${UI.echap(g.oeuvre)}</i></p>`,
        boutons: [
          { label: "Rester sur la grille" },
          { label: "↺ Recommencer la grille", action: demanderRecommencer },
          { label: "Retour aux grilles", classe: "btn-principal", action: () => { location.hash = base; } },
        ],
      });
    }

    function demanderRecommencer() {
      UI.modal({
        titre: "Effacer toute la grille ?",
        html: "<p>Toutes les lettres seront effacées pour recommencer la grille. Cette action ne peut pas être annulée.</p>",
        boutons: [
          { label: "Non, garder" },
          {
            label: "Oui, effacer", classe: "btn-danger",
            action: () => {
              for (let pos = 1; pos <= N; pos++) saisie[pos] = "";
              reveles.clear();
              erreurs.clear();
              st.fini = false;
              victoireAffichee = false;
              for (let pos = 1; pos <= N; pos++) majCase(pos);
              sauver();
              selectionner(g.defs[0][3][0], "def");
            },
          },
        ],
      });
    }

    function reveler(liste) {
      liste.forEach((pos) => {
        saisie[pos] = lettres[pos - 1];
        reveles.add(pos);
        erreurs.delete(pos);
        majCase(pos);
      });
      sauver();
      verifierFin();
    }

    function aide() {
      const p = proprio[sel.pos];
      const d = g.defs[p.d];
      UI.modal({
        titre: "Aide",
        html: `<p>${UI.echap(g.consigne)}</p>
          <p>Chaque lettre trouvée dans une définition se reporte automatiquement dans la citation, et inversement.
          Touchez une case pour la choisir, puis une lettre du clavier.</p>`,
        boutons: [
          { label: "Montrer la lettre choisie", action: () => reveler([sel.pos]) },
          { label: `Montrer le mot ${d[0]} (« ${d[1]} »)`, action: () => reveler(d[3]) },
          { label: "Effacer toute la grille", classe: "btn-danger", action: demanderRecommencer },
          { label: "Fermer", classe: "btn-principal" },
        ],
      });
    }

    // ---------- Événements ----------
    function surClic(e) {
      const c = e.target.closest(".case[data-pos]");
      if (c) {
        selectionner(+c.dataset.pos, c.dataset.ctx, true);
        return;
      }
      const row = e.target.closest(".def");
      if (row) {
        const di = ligneDef.indexOf(row);
        const nums = g.defs[di][3];
        selectionner(nums.find((q) => !saisie[q]) || nums[0], "def");
      }
    }
    elDefs.addEventListener("click", surClic);
    elGrille.addEventListener("click", surClic);
    elAcro.addEventListener("click", surClic);

    elClavier.addEventListener("click", (e) => {
      const b = e.target.closest("[data-k]");
      if (b) toucheClavier(b.dataset.k);
    });

    racine.querySelector(".barre").addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      if (b.dataset.act === "verifier") verifier();
      else if (b.dataset.act === "aide") aide();
      else if (b.dataset.act === "zoom") {
        zoom = zoom >= 1.3 ? 1 : Math.round((zoom + 0.15) * 100) / 100;
        UI.Store.set("cc-zoom", zoom);
        miseEnPage();
      } else if (b.dataset.act === "numeros") {
        numeros = !numeros;
        UI.Store.set("cc-numeros", numeros);
        appliquerNumeros();
      }
    });

    function appliquerNumeros() {
      elCC.classList.toggle("sans-num", !numeros);
      const b = racine.querySelector('[data-act="numeros"]');
      b.classList.toggle("eteint", !numeros);
      b.setAttribute("aria-pressed", String(numeros));
      b.setAttribute("aria-label", numeros ? "Masquer les numéros des cases" : "Afficher les numéros des cases");
    }
    appliquerNumeros();

    function surTouche(e) {
      if (document.querySelector(".modal-fond")) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const k = e.key;
      if (/^[a-zA-Z]$/.test(k)) { toucheClavier(k.toUpperCase()); e.preventDefault(); }
      else if (k.length === 1 && /^[A-Z]$/.test(norm(k))) { toucheClavier(norm(k)); e.preventDefault(); }
      else if (k === "Backspace" || k === "Delete") { effacer(); e.preventDefault(); }
      else if (k === "ArrowLeft") { toucheClavier("GAUCHE"); e.preventDefault(); }
      else if (k === "ArrowRight") { toucheClavier("DROITE"); e.preventDefault(); }
      else if (k === "ArrowUp" && sel.ctx === "def") { definitionVoisine(-1); e.preventDefault(); }
      else if (k === "ArrowDown" && sel.ctx === "def") { definitionVoisine(1); e.preventDefault(); }
    }
    document.addEventListener("keydown", surTouche);

    let rTimer = null;
    const surResize = () => { clearTimeout(rTimer); rTimer = setTimeout(() => { miseEnPage(); surligner(); }, 120); };
    window.addEventListener("resize", surResize);

    // ---------- Démarrage ----------
    miseEnPage();
    for (let pos = 1; pos <= N; pos++) majCase(pos);
    const premier = g.defs.map((d) => d[3]).flat().find((q) => !saisie[q]) || g.defs[0][3][0];
    selectionner(premier, "def", false);

    return function nettoyer() {
      document.removeEventListener("keydown", surTouche);
      window.removeEventListener("resize", surResize);
    };
  }

  window.ChasseCroise = { ouvrir, progression, reinitialiser, valider, analyser, disposer };
})();
