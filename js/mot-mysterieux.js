// Jeux de mots cachés dans une grille de lettres, avec un mot mystérieux à reconstituer :
// - Mot mystérieux : les mots se lisent en ligne droite, dans les 8 directions ;
// - Mots en zigzag : chaque mot suit un chemin de cases voisines (sans diagonale), avec des
//   virages ; les chemins ne se croisent jamais.
// Les lettres qui restent forment le mot mystérieux (ou mot caché), dans le désordre : une
// fois tous les mots trouvés, le joueur les fait glisser dans les cases du mot.
// Grilles (format interne) :
//   Mot mystérieux : { id, nom, theme, niveau, lignes, mots, placements: [{ mot, x, y, dx, dy }], mystere }
//   Mots en zigzag : { id, nom, niveau, lignes, mots, chemins: [{ mot, cases: [[x, y], …] }], mystere, definition }
(function () {
  "use strict";

  const COULEURS = ["#ffd43b", "#8ce99a", "#74c0fc", "#ffa8a8", "#b197fc", "#ffc078", "#63e6be", "#faa2c1", "#a9e34b", "#66d9e8"];
  const trie = (t) => [...t].sort().join("");

  // Mots de la grille, sous une forme commune : [{ mot, cases: [indices de cases] }].
  function motsDe(g) {
    const C = g.lignes[0].length;
    if (g.chemins) return g.chemins.map((c) => ({ mot: c.mot, cases: c.cases.map(([x, y]) => y * C + x) }));
    return g.placements.map((p) => ({ mot: p.mot, cases: [...p.mot].map((_, i) => (p.y + i * p.dy) * C + p.x + i * p.dx) }));
  }

  function creer(mode) {
    const ZZ = mode === "zigzag";
    const prefixe = ZZ ? "zz-" : "mm-";
    const nomMot = ZZ ? "mot caché" : "mot mystérieux";
    const baseDefaut = ZZ ? "#/mots-zigzag" : "#/mot-mysterieux";

    function valider(g) {
      const err = [];
      try {
        const L = g.lignes;
        if (!Array.isArray(L) || L.length < 8 || L.length > 22) err.push("nombre de lignes");
        const R = L.length, C = L[0].length;
        if (C < 8 || C > 20 || L.some((l) => l.length !== C || !/^[A-Z]+$/.test(l))) err.push("lignes");
        if (ZZ) {
          if (!Array.isArray(g.chemins) || !g.chemins.length) err.push("chemins");
          const prises = new Set();
          for (const c of g.chemins) {
            const ok = /^[A-Z]{2,}$/.test(c.mot) && c.cases.length === c.mot.length && c.cases.every(([x, y], i) => {
              if (y < 0 || y >= R || x < 0 || x >= C || L[y][x] !== c.mot[i] || prises.has(y * C + x)) return false;
              prises.add(y * C + x);
              if (!i) return true;
              const [a, b] = c.cases[i - 1];
              return Math.abs(x - a) + Math.abs(y - b) === 1;
            });
            if (!ok) err.push("chemin " + c.mot);
          }
        } else {
          if (!Array.isArray(g.placements) || !g.placements.length) err.push("placements");
          for (const p of g.placements) {
            if (!/^[A-Z]{2,}$/.test(p.mot) || Math.abs(p.dx) > 1 || Math.abs(p.dy) > 1 || (!p.dx && !p.dy)) { err.push("placement " + p.mot); continue; }
            for (let i = 0; i < p.mot.length; i++) {
              const x = p.x + i * p.dx, y = p.y + i * p.dy;
              if (y < 0 || y >= R || x < 0 || x >= C || L[y][x] !== p.mot[i]) { err.push("placement " + p.mot); break; }
            }
          }
        }
        if (!err.length) {
          const couvertes = new Set(motsDe(g).flatMap((m) => m.cases));
          let reste = "";
          L.forEach((l, y) => [...l].forEach((ch, x) => { if (!couvertes.has(y * C + x)) reste += ch; }));
          // Les lettres restantes sont celles du mot mystérieux, dans n'importe quel ordre.
          if (!g.mystere || trie(reste) !== trie(g.mystere)) err.push(nomMot);
        }
      } catch (e) {
        err.push("grille illisible");
      }
      return err;
    }

    const cle = (g) => prefixe + g.id;
    // État : t = mots trouvés ; c = chemins tracés par le joueur (zigzag) ; p = pour chaque
    // case du mot mystérieux, la case de la grille dont la lettre y est placée (ou null) ;
    // f = grille finie (mot mystérieux reconstitué).
    function charger(g) {
      const s = UI.Store.get(cle(g), null) || {};
      const n = motsDe(g).length;
      const t = new Set((Array.isArray(s.t) ? s.t : []).filter((i) => Number.isInteger(i) && i >= 0 && i < n));
      const chemins = {};
      if (s.c && typeof s.c === "object") Object.entries(s.c).forEach(([i, cs]) => { if (t.has(+i) && Array.isArray(cs)) chemins[+i] = cs; });
      return { trouves: t, chemins, p: Array.isArray(s.p) ? s.p : [], fini: !!s.f && t.size === n };
    }
    function progression(g) {
      const st = charger(g);
      const total = motsDe(g).length;
      return { trouves: st.trouves.size, total, mots: st.trouves.size === total, fini: st.fini };
    }
    function reinitialiser(g) { UI.Store.del(cle(g)); }

    // base : adresse du carnet (retour).
    function ouvrir(racine, g, base = baseDefaut) {
      const R = g.lignes.length, C = g.lignes[0].length;
      const MOTS = motsDe(g);
      const st = charger(g);
      const { trouves, chemins } = st;
      const lettreDe = (k) => g.lignes[Math.floor(k / C)][k % C];
      const casesDe = (i) => chemins[i] || MOTS[i].cases;
      const tousTrouves = () => trouves.size === MOTS.length;

      // Lettres restantes : cases hors des mots trouvés (chemins du joueur). Si le joueur a
      // tracé un chemin inattendu qui fausse le compte, on revient aux chemins de la grille.
      function calculerReste(sources) {
        const couvertes = new Set([...sources].flat());
        const r = [];
        for (let k = 0; k < R * C; k++) if (!couvertes.has(k)) r.push(k);
        return r;
      }
      let reste = calculerReste(MOTS.map((m, i) => casesDe(i)));
      if (trie(reste.map(lettreDe).join("")) !== trie(g.mystere)) reste = calculerReste(MOTS.map((m) => m.cases));
      const setReste = new Set(reste);
      const vus = new Set();
      const place = Array.from({ length: g.mystere.length }, (_, b) => {
        const k = st.p[b];
        if (!Number.isInteger(k) || !setReste.has(k) || vus.has(k)) return null;
        vus.add(k);
        return k;
      });

      const motForme = () => place.map((k) => (k === null ? " " : lettreDe(k))).join("");
      const resolu = () => tousTrouves() && motForme() === g.mystere;
      const sauver = () => UI.Store.set(cle(g), { t: [...trouves], c: chemins, p: place, f: resolu() });
      // Ordre d'affichage de la liste : alphabétique.
      const ordre = MOTS.map((m, i) => i).sort((a, b) => MOTS[a].mot.localeCompare(MOTS[b].mot, "fr"));
      const couleur = (i) => COULEURS[i % COULEURS.length];

      racine.innerHTML = `
        <div class="mm${ZZ ? " zz" : ""}">
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
      // Mots trouvés surlignés en couleur, ou barrés d'un trait (paramètre de l'appli).
      elMM.classList.toggle("biffage", UI.parametres().mmAffichage === "biffage");
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

      elMots.innerHTML = ordre.map((i) => `<li data-i="${i}">${MOTS[i].mot}</li>`).join("");
      const elMot = new Map([...elMots.children].map((li) => [+li.dataset.i, li]));
      // Largeur des colonnes selon le mot le plus long.
      const plusLong = Math.max(...MOTS.map((m) => m.mot.length));
      elMots.style.setProperty("--mmcol", `calc(${plusLong} * 0.7em + 14px)`);

      // ---------- Dessin : un trait passant par le centre des cases ----------
      const SVG = "http://www.w3.org/2000/svg";
      const points = (cases) => cases.map((k) => `${(k % C) + 0.5},${Math.floor(k / C) + 0.5}`).join(" ");
      function trait(cases, classe, coul) {
        const l = document.createElementNS(SVG, "polyline");
        l.setAttribute("points", points(cases.length > 1 ? cases : [cases[0], cases[0]]));
        l.setAttribute("class", classe);
        if (coul) l.style.stroke = coul;
        elTraits.appendChild(l);
        return l;
      }

      function dessiner() {
        elTraits.querySelectorAll(".mm-trouve").forEach((l) => l.remove());
        trouves.forEach((i) => trait(casesDe(i), "mm-trouve", couleur(i)));
        elMot.forEach((li, i) => {
          li.classList.toggle("trouve", trouves.has(i));
          li.style.setProperty("--c", couleur(i));
        });
        const total = MOTS.length;
        const phase2 = tousTrouves(), fini = resolu();
        elMM.classList.toggle("phase2", phase2);
        elMM.classList.toggle("termine", fini);
        // Seconde phase : les lettres restantes sont mises en avant ; celles déjà placées
        // dans le mot mystérieux sont estompées.
        const utilisees = new Set(place.filter((k) => k !== null));
        elCases.forEach((c, k) => {
          c.classList.toggle("reste", phase2 && setReste.has(k));
          c.classList.toggle("utilisee", phase2 && utilisees.has(k));
          c.classList.toggle("choisie", choisie === k);
          c.classList.toggle("trace", !phase2 && traceTouchers.includes(k));
        });
        const cases = [...g.mystere].map((ch, b) => {
          const k = place[b];
          return `<span class="mm-boite${k !== null ? " pleine" : ""}" data-b="${b}">${k !== null ? lettreDe(k) : ""}</span>`;
        }).join("");
        const definition = ZZ && g.definition ? `<span class="mm-definition">« ${UI.echap(g.definition)} »</span>` : "";
        if (!phase2) {
          elMystere.innerHTML = `<span class="mm-mystere-titre">${ZZ ? "Mot caché" : "Mot mystérieux"}</span>${definition}<span class="mm-lettres">${[...g.mystere]
            .map(() => "<span></span>").join("")}</span>
            <span class="mm-compte">${trouves.size} mot${trouves.size > 1 ? "s" : ""} sur ${total}</span>`;
        } else {
          elMystere.innerHTML = `<p class="mm-consigne">${fini ? `Bravo ! Voici le ${nomMot} :`
            : `Tous les mots sont trouvés ! Faites glisser les lettres restantes dans les cases pour former le ${nomMot}.`}</p>
            ${definition}<span class="mm-lettres mm-cible">${cases}</span>`;
        }
      }

      // ---------- Taille ----------
      function dimensionner() {
        elMM.style.setProperty("--mm", "10px");
        // La liste des mots est toujours entière ; sur un petit écran, son texte rapetisse un
        // peu pour laisser à la grille des cases d'au moins 30 px.
        for (let f = 17; f >= 13; f--) {
          elMM.style.setProperty("--mmf", f + "px");
          const z = elZone.getBoundingClientRect();
          if (Math.min((z.width - 12) / C, (z.height - 12) / R) >= 30) break;
        }
        const r = elZone.getBoundingClientRect();
        const s = Math.max(16, Math.floor(Math.min(64, (r.width - 12) / C, (r.height - 12) / R)));
        elMM.style.setProperty("--mm", s + "px");
        // Cases du mot mystérieux : aussi grandes que possible sur une ligne.
        const n = g.mystere.length;
        elMM.style.setProperty("--bx", Math.max(26, Math.min(58, Math.floor((elMM.clientWidth - 24) / n) - 5)) + "px");
      }

      function caseSous(e) {
        const r = elGrille.getBoundingClientRect();
        const x = Math.floor(((e.clientX - r.left) / r.width) * C);
        const y = Math.floor(((e.clientY - r.top) / r.height) * R);
        return [Math.min(C - 1, Math.max(0, x)), Math.min(R - 1, Math.max(0, y))];
      }

      // ---------- Reconnaissance d'un mot ----------
      let elSel = null;
      function montrerSel(cases) {
        if (!elSel) elSel = trait(cases, "mm-sel");
        elSel.setAttribute("points", points(cases.length > 1 ? cases : [cases[0], cases[0]]));
      }
      function effacerSel() { if (elSel) { elSel.remove(); elSel = null; } }
      function rate() {
        if (elSel) { elSel.classList.add("rate"); const l = elSel; elSel = null; setTimeout(() => l.remove(), 450); }
      }

      // Essaie les cases sélectionnées ; renvoie true si un mot est trouvé.
      function essayer(cases) {
        const lu = cases.map(lettreDe).join("");
        const envers = [...lu].reverse().join("");
        const libres = MOTS.map((m, i) => i).filter((i) => !trouves.has(i));
        const memes = (i) => {
          const a = MOTS[i].cases;
          return a.length === cases.length && (a.every((k, j) => k === cases[j]) || a.every((k, j) => k === cases[cases.length - 1 - j]));
        };
        let i = libres.find(memes);
        if (i === undefined) {
          // Même mot par un autre chemin : accepté s'il ne passe pas sur un mot déjà trouvé.
          const prises = new Set([...trouves].flatMap(casesDe));
          if (!cases.some((k) => prises.has(k))) i = libres.find((j) => MOTS[j].mot === lu || MOTS[j].mot === envers);
        }
        if (i === undefined) { rate(); return false; }
        effacerSel();
        trouves.add(i);
        const dansLOrdre = MOTS[i].mot === lu ? cases : [...cases].reverse();
        if (!MOTS[i].cases.every((k, j) => k === dansLOrdre[j])) chemins[i] = dansLOrdre;
        if (tousTrouves()) {
          reste = calculerReste(MOTS.map((m, j) => casesDe(j)));
          if (trie(reste.map(lettreDe).join("")) !== trie(g.mystere)) reste = calculerReste(MOTS.map((m) => m.cases));
          setReste.clear(); reste.forEach((k) => setReste.add(k));
        }
        sauver();
        dessiner();
        const li = elMot.get(i);
        if (li) { li.classList.add("vient"); setTimeout(() => li.classList.remove("vient"), 900); }
        if (tousTrouves()) {
          setTimeout(() => UI.modal({
            titre: "Tous les mots sont trouvés !",
            html: `<p>Il reste à former le <b>${nomMot}</b> : les lettres restantes sont en jaune dans la grille.</p><p>Faites-les glisser une à une dans les cases du mot, sous la grille. Vous pouvez aussi toucher une lettre, puis une case.</p>`,
            boutons: [{ label: "C'est parti", classe: "btn-principal" }],
          }), 500);
        }
        return true;
      }

      // ---------- Sélection en ligne droite (mot mystérieux) ----------
      const ligne = (x0, y0, x1, y1) => {
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        const ux = Math.sign(x1 - x0), uy = Math.sign(y1 - y0);
        return Array.from({ length: n + 1 }, (_, k) => (y0 + k * uy) * C + x0 + k * ux);
      };
      // Ramène le second bout sur l'une des 8 directions.
      function aligner(x0, y0, x, y) {
        const dx = x - x0, dy = y - y0;
        if (!dx && !dy) return [x0, y0];
        const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
        const ux = Math.round(Math.cos(a)), uy = Math.round(Math.sin(a));
        let n = Math.max(Math.abs(dx), Math.abs(dy));
        while (n > 0 && (x0 + n * ux < 0 || x0 + n * ux >= C || y0 + n * uy < 0 || y0 + n * uy >= R)) n--;
        return [x0 + n * ux, y0 + n * uy];
      }

      // ---------- Sélection en zigzag : chemin de cases voisines ----------
      // Prolonge le chemin jusqu'à la case visée, pas à pas (le doigt peut sauter des cases) ;
      // revenir sur la case précédente efface le dernier pas.
      function prolonger(chemin, cible) {
        for (let garde = 0; garde < R + C; garde++) {
          const der = chemin[chemin.length - 1];
          if (der === cible) return;
          const lx = der % C, ly = Math.floor(der / C), tx = cible % C, ty = Math.floor(cible / C);
          const dx = tx - lx, dy = ty - ly;
          const suiv = Math.abs(dx) >= Math.abs(dy) ? der + Math.sign(dx) : der + Math.sign(dy) * C;
          if (chemin.length > 1 && suiv === chemin[chemin.length - 2]) chemin.pop();
          else if (chemin.includes(suiv)) return;
          else chemin.push(suiv);
        }
      }
      const voisines = (a, b) => Math.abs((a % C) - (b % C)) + Math.abs(Math.floor(a / C) - Math.floor(b / C)) === 1;

      // ---------- Gestes de la première phase ----------
      let geste = null;          // glisser en cours
      let depart = null;         // ligne droite : premier bout choisi au toucher
      let traceTouchers = [];    // zigzag : chemin construit case par case au toucher

      elPlateau.addEventListener("pointerdown", (e) => {
        if (geste || tousTrouves()) return;
        e.preventDefault();
        const [x, y] = caseSous(e);
        geste = { x0: x, y0: y, x1: x, y1: y, id: e.pointerId, bouge: false, chemin: [y * C + x] };
        elPlateau.setPointerCapture(e.pointerId);
      });
      elPlateau.addEventListener("pointermove", (e) => {
        if (!geste || e.pointerId !== geste.id) return;
        const [x, y] = caseSous(e);
        if (x === geste.x0 && y === geste.y0 && !geste.bouge) return;
        if (!geste.bouge) {
          geste.bouge = true;
          depart = null;
          traceTouchers = [];
          effacerSel();
          dessiner();
        }
        if (ZZ) { prolonger(geste.chemin, y * C + x); montrerSel(geste.chemin); }
        else { [geste.x1, geste.y1] = aligner(geste.x0, geste.y0, x, y); montrerSel(ligne(geste.x0, geste.y0, geste.x1, geste.y1)); }
      });
      elPlateau.addEventListener("pointerup", (e) => {
        if (!geste || e.pointerId !== geste.id) return;
        const gst = geste;
        geste = null;
        if (gst.bouge) {
          if (ZZ) { if (gst.chemin.length > 1) essayer(gst.chemin); else effacerSel(); }
          else if (gst.x1 !== gst.x0 || gst.y1 !== gst.y0) essayer(ligne(gst.x0, gst.y0, gst.x1, gst.y1));
          else effacerSel();
          return;
        }
        const k = gst.y0 * C + gst.x0;
        if (ZZ) toucherZigzag(k); else toucherLigne(gst.x0, gst.y0);
      });
      elPlateau.addEventListener("pointercancel", (e) => { if (geste && e.pointerId === geste.id) { geste = null; effacerSel(); } });

      // Ligne droite au toucher : premier bout, puis second bout.
      function toucherLigne(x, y) {
        if (!depart) { depart = [x, y]; elCases.forEach((c) => c.classList.remove("depart")); elCases[y * C + x].classList.add("depart"); return; }
        const [x0, y0] = depart;
        depart = null;
        elCases.forEach((c) => c.classList.remove("depart"));
        if (x0 === x && y0 === y) { effacerSel(); return; }
        const [x1, y1] = aligner(x0, y0, x, y);
        const cs = ligne(x0, y0, x1, y1);
        montrerSel(cs);
        essayer(cs);
      }
      // Zigzag au toucher : on ajoute les cases une à une (une voisine de la dernière) ;
      // toucher la dernière case la retire ; le mot est reconnu dès qu'il est complet.
      function toucherZigzag(k) {
        const der = traceTouchers[traceTouchers.length - 1];
        if (k === der) traceTouchers.pop();
        else if (der !== undefined && voisines(der, k) && !traceTouchers.includes(k)) traceTouchers.push(k);
        else traceTouchers = [k];
        if (traceTouchers.length > 1) montrerSel(traceTouchers); else effacerSel();
        if (traceTouchers.length > 1) {
          const lu = traceTouchers.map(lettreDe).join(""), envers = [...lu].reverse().join("");
          if (MOTS.some((m, i) => !trouves.has(i) && (m.mot === lu || m.mot === envers)) && essayer(traceTouchers)) traceTouchers = [];
        }
        dessiner();
      }

      // ---------- Seconde phase : former le mot mystérieux avec les lettres restantes ----------
      let choisie = null; // case de la grille choisie au toucher
      let tire = null;    // { de: { k } ou { b }, id, x0, y0, el }

      function deposer(de, b) {
        if (de.b !== undefined) { const k = place[de.b]; place[de.b] = place[b]; place[b] = k; }
        else {
          const avant = place.indexOf(de.k);
          if (avant >= 0) place[avant] = null;
          place[b] = de.k;
        }
        choisie = null;
        sauver();
        dessiner();
        controlerMot();
      }
      function retirer(b) { place[b] = null; sauver(); dessiner(); }

      function controlerMot() {
        if (place.some((k) => k === null)) return;
        if (resolu()) { sauver(); dessiner(); victoire(); return; }
        const cible = elMystere.querySelector(".mm-cible");
        if (cible) { cible.classList.add("faux"); setTimeout(() => cible.classList.remove("faux"), 700); }
        UI.toast("Ce n'est pas encore le bon mot : déplacez les lettres.");
      }

      function debutTirer(e, de) {
        if (resolu()) return;
        e.preventDefault();
        tire = { de, id: e.pointerId, x0: e.clientX, y0: e.clientY, el: null };
      }
      function bougerTirer(e) {
        if (!tire || e.pointerId !== tire.id) return;
        if (!tire.el) {
          if (Math.hypot(e.clientX - tire.x0, e.clientY - tire.y0) < 8) return;
          tire.el = document.createElement("div");
          tire.el.className = "mm-volante";
          tire.el.textContent = lettreDe(tire.de.k !== undefined ? tire.de.k : place[tire.de.b]);
          document.body.appendChild(tire.el);
          choisie = null;
          dessiner();
        }
        tire.el.style.left = e.clientX + "px";
        tire.el.style.top = e.clientY + "px";
      }
      function finTirer(e) {
        if (!tire || e.pointerId !== tire.id) return;
        const t = tire;
        tire = null;
        if (t.el) {
          t.el.remove();
          const sous = document.elementFromPoint(e.clientX, e.clientY);
          const boite = sous && sous.closest(".mm-boite");
          if (boite && elMystere.contains(boite)) deposer(t.de, +boite.dataset.b);
          else if (t.de.b !== undefined) retirer(t.de.b); // lettre sortie du mot : elle revient
          return;
        }
        // Toucher simple : une lettre de la grille, puis une case du mot.
        if (t.de.k !== undefined) { choisie = choisie === t.de.k ? null : t.de.k; dessiner(); return; }
        if (choisie !== null) deposer({ k: choisie }, t.de.b);
        else if (place[t.de.b] !== null) retirer(t.de.b);
      }

      elPlateau.addEventListener("pointerdown", (e) => {
        if (!tousTrouves()) return;
        const [x, y] = caseSous(e);
        const k = y * C + x;
        if (setReste.has(k) && !place.includes(k)) debutTirer(e, { k });
      });
      elMystere.addEventListener("pointerdown", (e) => {
        const boite = e.target.closest(".mm-boite");
        if (!boite || !tousTrouves()) return;
        const b = +boite.dataset.b;
        if (place[b] !== null || choisie !== null) debutTirer(e, { b });
      });
      document.addEventListener("pointermove", bougerTirer);
      document.addEventListener("pointerup", finTirer);
      document.addEventListener("pointercancel", finTirer);

      // ---------- Aide ----------
      let minuteurAide = null;
      // Première phase : montre un mot pendant quelques secondes.
      function aide() {
        if (tousTrouves()) { aideMystere(); return; }
        const libres = ordre.filter((i) => !trouves.has(i));
        if (!libres.length) return;
        const i = libres[Math.floor(Math.random() * libres.length)];
        elTraits.querySelectorAll(".mm-aide").forEach((l) => l.remove());
        trait(MOTS[i].cases, "mm-aide");
        const li = elMot.get(i);
        if (li) li.classList.add("aide");
        clearTimeout(minuteurAide);
        minuteurAide = setTimeout(() => {
          elTraits.querySelectorAll(".mm-aide").forEach((l) => l.remove());
          if (li) li.classList.remove("aide");
        }, 3000);
      }

      // Seconde phase : place une bonne lettre dans la première case fausse ou vide.
      function aideMystere() {
        if (resolu()) return;
        const b = [...g.mystere].findIndex((ch, i) => place[i] === null || lettreDe(place[i]) !== ch);
        const voulue = g.mystere[b];
        // Une case de la grille avec cette lettre : libre, sinon mal placée ailleurs.
        let k = reste.find((x) => lettreDe(x) === voulue && !place.includes(x));
        if (k === undefined) k = reste.find((x) => { const i = place.indexOf(x); return lettreDe(x) === voulue && i >= 0 && g.mystere[i] !== voulue; });
        if (k === undefined) return;
        const i = place.indexOf(k);
        if (i >= 0) deposer({ b: i }, b); else deposer({ k }, b);
        const boite = elMystere.querySelector(`[data-b="${b}"]`);
        if (boite) { boite.classList.add("aidee"); setTimeout(() => boite.classList.remove("aidee"), 1200); }
      }

      function victoire() {
        setTimeout(() => {
          UI.modal({
            titre: "Bravo ! Grille terminée",
            html: `<p>Vous avez trouvé le ${nomMot} :</p><p class="mm-reponse">${UI.echap(g.mystere)}</p>`,
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
      return () => {
        ro.disconnect();
        clearTimeout(minuteurAide);
        document.removeEventListener("pointermove", bougerTirer);
        document.removeEventListener("pointerup", finTirer);
        document.removeEventListener("pointercancel", finTirer);
        if (tire && tire.el) tire.el.remove();
      };
    }

    return { valider, progression, reinitialiser, ouvrir };
  }

  window.MotMysterieux = creer("ligne");
  window.MotsZigzag = creer("zigzag");
})();
