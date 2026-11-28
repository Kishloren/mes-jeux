// Mots casés : une grille à cases noires et la liste de tous ses mots, rangés par longueur.
// Le joueur case chaque mot : il touche un mot de la liste, puis son emplacement. Un mot est
// donné d'avance (l'amorce) ; à partir de lui, la solution est unique.
// Grille (format interne) : { id, nom, niveau, solution: ["#MENTAL#…"], mots: ["ANS", …],
//   amorce: { mot, x, y, sens: "H" | "V" } }
(function () {
  "use strict";

  function analyser(g) {
    const S = g.solution, R = S.length, C = S[0].length;
    const emplacements = []; // { cases, sens, mot (solution) }
    for (let y = 0; y < R; y++) {
      for (let x = 0; x < C; x++) {
        if (S[y][x] === "#") continue;
        if ((x === 0 || S[y][x - 1] === "#") && x + 1 < C && S[y][x + 1] !== "#") {
          const cases = []; for (let k = x; k < C && S[y][k] !== "#"; k++) cases.push(y * C + k);
          emplacements.push({ cases, sens: "H" });
        }
        if ((y === 0 || S[y - 1][x] === "#") && y + 1 < R && S[y + 1][x] !== "#") {
          const cases = []; for (let k = y; k < R && S[k][x] !== "#"; k++) cases.push(k * C + x);
          emplacements.push({ cases, sens: "V" });
        }
      }
    }
    const sol = [...S.join("")];
    emplacements.forEach((e) => { e.mot = e.cases.map((k) => sol[k]).join(""); });
    const parCase = {}; // case -> { H, V } (indices d'emplacements)
    emplacements.forEach((e, i) => e.cases.forEach((k) => { (parCase[k] = parCase[k] || {})[e.sens] = i; }));
    // Amorce : son emplacement et le mot de la liste qui lui correspond.
    const a = g.amorce;
    const eA = emplacements.findIndex((e) => e.sens === a.sens && e.cases[0] === a.y * C + a.x);
    const mA = g.mots.indexOf(a.mot);
    return { R, C, sol, emplacements, parCase, eA, mA };
  }

  function valider(g) {
    const err = [];
    try {
      const S = g.solution;
      if (!Array.isArray(S) || S.length < 6 || S.length > 24) err.push("nombre de lignes");
      const C = S[0].length;
      if (C < 6 || C > 18 || S.some((l) => l.length !== C || !/^[A-Z#]+$/.test(l))) err.push("lignes");
      const A = analyser(g);
      const trie = (l) => [...l].sort().join(",");
      if (trie(A.emplacements.map((e) => e.mot)) !== trie(g.mots)) err.push("liste de mots");
      if (A.eA < 0 || A.mA < 0 || A.emplacements[A.eA].mot !== g.amorce.mot) err.push("amorce");
    } catch (e) {
      err.push("grille illisible");
    }
    return err;
  }

  const cle = (g) => "mk-" + g.id;
  // État : p = { emplacement: indice du mot de la liste } ; f = grille terminée.
  function charger(g, A) {
    const s = UI.Store.get(cle(g), null) || {};
    const place = new Map();
    const pris = new Set();
    if (s.p && typeof s.p === "object") {
      Object.entries(s.p).forEach(([e, m]) => {
        e = +e;
        if (!A.emplacements[e] || !Number.isInteger(m) || !g.mots[m] || pris.has(m)) return;
        if (g.mots[m].length !== A.emplacements[e].cases.length) return;
        place.set(e, m); pris.add(m);
      });
    }
    // L'amorce est toujours en place.
    if (A.eA >= 0) { [...place].forEach(([e, m]) => { if (m === A.mA) place.delete(e); }); place.set(A.eA, A.mA); }
    return { place, fini: !!s.f };
  }
  function progression(g) {
    const A = analyser(g);
    const st = charger(g, A);
    return { places: st.place.size, total: g.mots.length, fini: st.fini };
  }
  function reinitialiser(g) { UI.Store.del(cle(g)); }

  // base : adresse du carnet (retour).
  function ouvrir(racine, g, base = "#/mots-cases") {
    const A = analyser(g);
    const { R, C, sol, emplacements, parCase, eA, mA } = A;
    const st = charger(g, A);
    const { place } = st; // emplacement -> mot
    const motPlace = () => new Map([...place].map(([e, m]) => [m, e])); // mot -> emplacement
    let choisi = null;      // mot de la liste choisi (indice)
    let selEmpl = null;     // emplacement d'un mot placé, sélectionné pour le retirer
    const erreurs = new Set();
    let victoireAffichee = st.fini;

    racine.innerHTML = `
      <div class="mk">
        <header class="barre">
          <a class="btn btn-retour" href="${base}">← Retour</a>
          <h1>${UI.echap(g.nom)}</h1>
          <span class="espace"></span>
          <button class="btn" data-act="verifier">Vérifier</button>
          <button class="btn" data-act="aide">Aide</button>
        </header>
        <div class="mk-zone"><div class="mk-grille"></div></div>
        <div class="mk-info"></div>
        <div class="mk-mots"></div>
      </div>`;
    const elMK = racine.querySelector(".mk");
    const elZone = racine.querySelector(".mk-zone");
    const elGrille = racine.querySelector(".mk-grille");
    const elInfo = racine.querySelector(".mk-info");
    const elMots = racine.querySelector(".mk-mots");

    elGrille.style.gridTemplateColumns = `repeat(${C}, var(--mk))`;
    const elCases = sol.map((ch, k) => {
      const c = document.createElement("div");
      c.className = ch === "#" ? "mk-case noire" : "mk-case";
      c.dataset.k = k;
      elGrille.appendChild(c);
      return c;
    });

    // Liste par longueur, dans l'ordre alphabétique (comme dans le magazine).
    const longueurs = [...new Set(g.mots.map((m) => m.length))].sort((a, b) => a - b);
    elMots.innerHTML = longueurs.map((n) => {
      const ids = g.mots.map((m, i) => i).filter((i) => g.mots[i].length === n)
        .sort((a, b) => g.mots[a].localeCompare(g.mots[b], "fr"));
      return `<span class="mk-long">${n} lettres</span>` + ids.map((i) => `<span class="mk-mot" data-m="${i}">${g.mots[i]}</span>`).join("");
    }).join("");
    const elMot = new Map([...elMots.querySelectorAll(".mk-mot")].map((s) => [+s.dataset.m, s]));

    const sauver = () => UI.Store.set(cle(g), { p: Object.fromEntries(place), f: resolu() });
    function lettres() {
      const l = new Array(R * C).fill("");
      place.forEach((m, e) => emplacements[e].cases.forEach((k, j) => { l[k] = g.mots[m][j]; }));
      return l;
    }
    const resolu = () => {
      if (place.size !== emplacements.length) return false;
      const l = lettres();
      return sol.every((ch, k) => ch === "#" || l[k] === ch);
    };

    function majTout() {
      const l = lettres();
      const mp = motPlace();
      const actives = new Set(selEmpl !== null ? emplacements[selEmpl].cases : []);
      const amorce = new Set(emplacements[eA] ? emplacements[eA].cases : []);
      elCases.forEach((c, k) => {
        if (sol[k] === "#") return;
        c.textContent = l[k];
        c.classList.toggle("sel", actives.has(k));
        c.classList.toggle("amorce", amorce.has(k));
        c.classList.toggle("err", [...erreurs].some((e) => emplacements[e].cases.includes(k)));
      });
      elMot.forEach((s, m) => {
        s.classList.toggle("place", mp.has(m));
        s.classList.toggle("choisi", m === choisi);
        s.classList.toggle("selectionne", selEmpl !== null && place.get(selEmpl) === m);
      });
      // Bandeau d'information.
      if (choisi !== null) {
        elInfo.innerHTML = `<span class="mk-info-mot">${g.mots[choisi]}</span><span>${g.mots[choisi].length} lettres — touchez son emplacement dans la grille</span>
          <button class="btn btn-discret" data-info="annuler">Annuler</button>`;
      } else if (selEmpl !== null) {
        const m = place.get(selEmpl);
        elInfo.innerHTML = `<span class="mk-info-mot">${g.mots[m]}</span>`
          + (selEmpl === eA ? "<span>Ce mot est donné au départ.</span>"
            : `<button class="btn" data-info="retirer">Retirer ce mot</button><button class="btn btn-discret" data-info="annuler">Fermer</button>`);
      } else {
        elInfo.innerHTML = `<span>${place.size} mot${place.size > 1 ? "s" : ""} casé${place.size > 1 ? "s" : ""} sur ${g.mots.length}.</span><span class="mk-info-aide">Touchez un mot de la liste, puis son emplacement.</span>`;
      }
      elMK.classList.toggle("termine", resolu());
    }

    function refus(cases) {
      cases.forEach((k) => elCases[k].classList.add("refus"));
      setTimeout(() => cases.forEach((k) => elCases[k].classList.remove("refus")), 600);
    }

    // Le mot tient-il dans cet emplacement, avec les lettres déjà posées par les autres mots ?
    function compatible(m, e) {
      const mot = g.mots[m], E = emplacements[e];
      if (mot.length !== E.cases.length) return false;
      const l = new Array(R * C).fill("");
      place.forEach((mm, ee) => { if (ee !== e) emplacements[ee].cases.forEach((k, j) => { l[k] = g.mots[mm][j]; }); });
      return E.cases.every((k, j) => !l[k] || l[k] === mot[j]);
    }

    function poser(m, e) {
      if (e === eA) { refus(emplacements[e].cases); return; }
      if (!compatible(m, e)) {
        refus(emplacements[e].cases);
        UI.toast("Ce mot ne s'accorde pas avec les lettres déjà placées.");
        return;
      }
      const avant = motPlace().get(m);
      if (avant !== undefined) place.delete(avant);
      place.set(e, m); // un mot déjà là retourne dans la liste
      erreurs.delete(e);
      choisi = null;
      selEmpl = null;
      sauver();
      majTout();
      verifierFin();
    }

    function verifierFin() {
      if (!resolu()) {
        if (place.size === emplacements.length) UI.toast("Tous les mots sont casés, mais certains ne sont pas à leur place.");
        return;
      }
      sauver();
      if (victoireAffichee) return;
      victoireAffichee = true;
      setTimeout(() => UI.modal({
        titre: "Bravo ! Grille terminée",
        html: "<p>Tous les mots sont à leur place.</p>",
        boutons: [
          { label: "Retour aux grilles", classe: "btn-principal", action: () => { location.hash = base; } },
          { label: "Rester sur la grille" },
        ],
      }), 400);
    }

    // ---------- Événements ----------
    elMots.addEventListener("click", (e) => {
      const s = e.target.closest(".mk-mot");
      if (!s) return;
      const m = +s.dataset.m;
      const e2 = motPlace().get(m);
      if (e2 !== undefined) { choisi = null; selEmpl = selEmpl === e2 ? null : e2; }
      else { selEmpl = null; choisi = choisi === m ? null : m; }
      majTout();
    });

    let dernierToucher = null; // pour alterner entre horizontal et vertical
    elGrille.addEventListener("click", (e) => {
      const c = e.target.closest(".mk-case");
      if (!c || c.classList.contains("noire")) return;
      const k = +c.dataset.k;
      const pc = parCase[k] || {};
      const cand = ["H", "V"].map((s) => pc[s]).filter((x) => x !== undefined);
      if (choisi !== null) {
        // Emplacements de la bonne longueur ; s'il y en a deux, celui où le mot s'accorde,
        // puis l'horizontal d'abord ; un nouveau toucher sur la même case essaie l'autre.
        const bons = cand.filter((x) => emplacements[x].cases.length === g.mots[choisi].length);
        if (!bons.length) { refus([k]); return; }
        let ordre = [...bons.filter((x) => compatible(choisi, x)), ...bons.filter((x) => !compatible(choisi, x))];
        if (dernierToucher && dernierToucher.k === k && dernierToucher.m === choisi && ordre.length > 1) ordre = [ordre[1], ordre[0]];
        dernierToucher = { k, m: choisi };
        poser(choisi, ordre[0]);
        return;
      }
      // Sans mot choisi : sélection d'un mot placé (un nouveau toucher passe à l'autre sens).
      const places = cand.filter((x) => place.has(x));
      if (!places.length) { selEmpl = null; majTout(); return; }
      const i = places.indexOf(selEmpl);
      selEmpl = i >= 0 ? places[(i + 1) % places.length] : places[0];
      majTout();
    });

    elInfo.addEventListener("click", (e) => {
      const b = e.target.closest("[data-info]");
      if (!b) return;
      if (b.dataset.info === "retirer" && selEmpl !== null && selEmpl !== eA) {
        place.delete(selEmpl); erreurs.delete(selEmpl); sauver();
      }
      choisi = null; selEmpl = null;
      majTout();
    });

    function verifier() {
      erreurs.clear();
      place.forEach((m, e) => { if (g.mots[m] !== emplacements[e].mot) erreurs.add(e); });
      majTout();
      UI.toast(erreurs.size ? `${erreurs.size} mot${erreurs.size > 1 ? "s" : ""} mal placé${erreurs.size > 1 ? "s" : ""} (en rouge).` : "Aucune erreur pour l'instant.");
    }

    // Place un mot à sa bonne place (retire au besoin ce qui la gêne).
    function placerJuste(m) {
      const mp = motPlace();
      // Un emplacement dont la solution est ce mot et qui n'est pas déjà juste.
      const e = emplacements.findIndex((E, i) => E.mot === g.mots[m] && !(place.has(i) && g.mots[place.get(i)] === E.mot));
      if (e < 0) return;
      if (mp.has(m)) place.delete(mp.get(m));
      // Retire les mots qui contredisent la solution sur ces cases.
      emplacements[e].cases.forEach((k) => {
        const pc = parCase[k] || {};
        ["H", "V"].forEach((s) => {
          const x = pc[s];
          if (x !== undefined && x !== e && x !== eA && place.has(x) && g.mots[place.get(x)] !== emplacements[x].mot) place.delete(x);
        });
      });
      place.set(e, m);
      erreurs.delete(e);
      choisi = null; selEmpl = e;
      sauver(); majTout(); verifierFin();
    }

    function aide() {
      const mp = motPlace();
      const libres = g.mots.map((w, i) => i).filter((i) => !mp.has(i) || g.mots[i] !== emplacements[mp.get(i)].mot);
      const boutons = [];
      if (choisi !== null) boutons.push({ label: `Placer « ${g.mots[choisi]} »`, classe: "btn-principal", action: () => placerJuste(choisi) });
      if (libres.length) boutons.push({ label: "Placer un mot au hasard", classe: choisi === null ? "btn-principal" : "", action: () => placerJuste(libres[Math.floor(Math.random() * libres.length)]) });
      boutons.push({ label: "Effacer toute la grille", classe: "btn-danger", action: () => {
        UI.modal({
          titre: "Effacer toute la grille ?",
          html: "<p>Tous les mots casés retourneront dans la liste (sauf le mot donné).</p>",
          boutons: [
            { label: "Non, garder" },
            { label: "Oui, effacer", classe: "btn-danger", action: () => {
              place.clear(); place.set(eA, mA); erreurs.clear(); choisi = null; selEmpl = null;
              victoireAffichee = false; sauver(); majTout();
            } },
          ],
        });
      } });
      boutons.push({ label: "Fermer" });
      UI.modal({
        titre: "Aide",
        html: `<p>Il faut placer chaque mot de la liste dans la grille. Le mot en vert est donné : commencez par les mots qui le croisent.</p>
          <p>Touchez un mot de la liste, puis une case de son emplacement. Touchez un mot déjà casé pour le retirer.</p>`,
        boutons,
      });
    }

    racine.querySelector(".mk .barre").addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      if (b.dataset.act === "verifier") verifier();
      else if (b.dataset.act === "aide") aide();
    });

    // ---------- Taille : la liste est toujours entière, la grille prend le reste ----------
    function dimensionner() {
      elMK.style.setProperty("--mk", "10px");
      for (let f = 18; f >= 12; f--) {
        elMK.style.setProperty("--mkf", f + "px");
        const z = elZone.getBoundingClientRect();
        if (Math.min((z.width - 8) / C, (z.height - 8) / R) >= 32) break;
      }
      const r = elZone.getBoundingClientRect();
      const s = Math.max(14, Math.floor(Math.min(56, (r.width - 8 - (C - 1)) / C, (r.height - 8 - (R - 1)) / R)));
      elMK.style.setProperty("--mk", s + "px");
    }
    const ro = new ResizeObserver(() => dimensionner());
    ro.observe(elZone);

    majTout();
    dimensionner();
    return () => ro.disconnect();
  }

  window.MotsCases = { valider, progression, reinitialiser, ouvrir };
})();
