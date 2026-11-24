// Jeu : Puzzle. Pièces rectangulaires ou triangulaires mélangées sur place ;
// les pièces voisines comme dans l'image se soudent et se déplacent en bloc.
(function () {
  "use strict";

  const NIVEAUX = () => window.PZ_NIVEAUX;
  const niveau = (id) => NIVEAUX().find((n) => n.id === id) || NIVEAUX()[0];
  const coupe = (id) => window.PZ_COUPES.find((c) => c.id === id) || window.PZ_COUPES[0];
  const cle = (photo) => "pz-" + photo.id;
  const REGLAGES_DEFAUT = { coupe: "rect", rotation: false, niv: "facile" };

  function reglages() { return Object.assign({}, REGLAGES_DEFAUT, UI.Store.get("pz-reglages", {})); }
  function finis() { return UI.Store.get("pz-fini", {}); }
  const cleReussite = (r) => `${r.coupe}${r.rotation ? "+r" : ""}:${r.niv}`;

  function etat(photo) {
    const s = UI.Store.get(cle(photo), null);
    return { enCours: !!(s && !s.fini && s.m > 0), reussites: (finis()[photo.id] || []).length };
  }

  function dimensions(r) {
    const n = niveau(r.niv);
    const [cols, lignes] = r.coupe === "rect" ? n.rect : n.diag;
    return { cols, lignes, P: coupe(r.coupe).parts };
  }

  function libelle(r) {
    const d = dimensions(r);
    return `${coupe(r.coupe).nom}${r.rotation ? " · à l'envers" : ""} · ${d.cols * d.lignes * d.P} pièces`;
  }

  // Entier aléatoire dans [0, max[ (générateur cryptographique si disponible).
  function hasard(max) {
    if (window.crypto && crypto.getRandomValues) {
      const a = new Uint32Array(1);
      crypto.getRandomValues(a);
      return a[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  // ---------- Géométrie d'une découpe ----------
  // Les places (« slots ») sont numérotées case × P + partie. La pièce n° k a pour
  // place d'origine la place n° k. Parties : rect 0 ; diag2 0 = NO, 1 = SE ;
  // diag4 0 = N, 1 = E, 2 = S, 3 = O.
  const E = "0.8px"; // léger débord pour éviter un liseré entre triangles voisins
  const POLY = {
    rect: [null],
    diag2: [
      `polygon(-${E} -${E}, calc(100% + ${E}) -${E}, -${E} calc(100% + ${E}))`,
      `polygon(calc(100% + ${E}) -${E}, calc(100% + ${E}) calc(100% + ${E}), -${E} calc(100% + ${E}))`,
    ],
    diag4: [
      `polygon(-${E} -${E}, calc(100% + ${E}) -${E}, 50% calc(50% + ${E}))`,
      `polygon(calc(100% + ${E}) -${E}, calc(100% + ${E}) calc(100% + ${E}), calc(50% - ${E}) 50%)`,
      `polygon(calc(100% + ${E}) calc(100% + ${E}), -${E} calc(100% + ${E}), 50% calc(50% - ${E}))`,
      `polygon(-${E} calc(100% + ${E}), -${E} -${E}, calc(50% + ${E}) 50%)`,
    ],
  };
  const OPPOSE = { rect: [0], diag2: [1, 0], diag4: [2, 3, 0, 1] };

  function geometrie(r) {
    const { cols, lignes, P } = dimensions(r);
    const total = cols * lignes * P;
    const cellule = (s) => Math.floor(s / P);
    const partie = (s) => s % P;
    const ligne = (s) => Math.floor(cellule(s) / cols);
    const colonne = (s) => cellule(s) % cols;
    const place = (l, c, p) => (l * cols + c) * P + p;
    const aretes = []; // { a, b (-1 = bord), x1, y1, x2, y2 } en unités de case
    const ajoute = (a, b, x1, y1, x2, y2) => aretes.push({ a, b, x1, y1, x2, y2 });
    for (let l = 0; l < lignes; l++) {
      for (let c = 0; c < cols; c++) {
        const k = place(l, c, 0);
        const droite = c < cols - 1, bas = l < lignes - 1;
        if (r.coupe === "rect") {
          ajoute(k, droite ? place(l, c + 1, 0) : -1, c + 1, l, c + 1, l + 1);
          ajoute(k, bas ? place(l + 1, c, 0) : -1, c, l + 1, c + 1, l + 1);
          if (l === 0) ajoute(k, -1, c, l, c + 1, l);
          if (c === 0) ajoute(k, -1, c, l, c, l + 1);
        } else if (r.coupe === "diag2") {
          ajoute(k, k + 1, c, l + 1, c + 1, l); // diagonale SO-NE
          ajoute(k + 1, droite ? place(l, c + 1, 0) : -1, c + 1, l, c + 1, l + 1);
          ajoute(k + 1, bas ? place(l + 1, c, 0) : -1, c, l + 1, c + 1, l + 1);
          if (l === 0) ajoute(k, -1, c, l, c + 1, l);
          if (c === 0) ajoute(k, -1, c, l, c, l + 1);
        } else {
          const cx = c + 0.5, cy = l + 0.5;
          ajoute(k, k + 1, cx, cy, c + 1, l);
          ajoute(k + 1, k + 2, cx, cy, c + 1, l + 1);
          ajoute(k + 2, k + 3, cx, cy, c, l + 1);
          ajoute(k + 3, k, cx, cy, c, l);
          ajoute(k + 1, droite ? place(l, c + 1, 3) : -1, c + 1, l, c + 1, l + 1);
          ajoute(k + 2, bas ? place(l + 1, c, 0) : -1, c, l + 1, c + 1, l + 1);
          if (l === 0) ajoute(k, -1, c, l, c + 1, l);
          if (c === 0) ajoute(k + 3, -1, c, l, c, l + 1);
        }
      }
    }
    // Partie de case sous un point (u, v ∈ [0, 1[ dans la case)
    const partieEn = (u, v) => {
      if (r.coupe === "rect") return 0;
      if (r.coupe === "diag2") return u + v < 1 ? 0 : 1;
      if (v < u) return u + v < 1 ? 0 : 1;
      return u + v < 1 ? 3 : 2;
    };
    const internes = aretes.filter((e) => e.b >= 0);
    return { cols, lignes, P, total, cellule, partie, ligne, colonne, place, aretes, internes, partieEn,
      poly: POLY[r.coupe], oppose: OPPOSE[r.coupe] };
  }

  // Deux places voisines a, b sont soudées si leurs pièces sont à l'endroit, dans
  // une place de leur forme, et décalées de la même façon par rapport à leur origine.
  function soudees(G, o, rot, a, b) {
    const pa = o[a], pb = o[b];
    if (rot[pa] || rot[pb]) return false;
    if (G.partie(pa) !== G.partie(a) || G.partie(pb) !== G.partie(b)) return false;
    return G.ligne(pa) - G.ligne(a) === G.ligne(pb) - G.ligne(b)
      && G.colonne(pa) - G.colonne(a) === G.colonne(pb) - G.colonne(b);
  }

  // Orientation d'une pièce dans une place : à l'endroit 0, retournée 2 (demi-tours).
  function orientation(G, piece, s) {
    return G.partie(piece) === G.partie(s) ? 0 : 2;
  }

  // Nouveau tirage : aucune pièce à sa place à l'endroit, aucun bloc déjà constitué.
  function tirage(r) {
    const G = geometrie(r);
    // Classes de places interchangeables (même forme, ou forme opposée si on peut retourner)
    const classeDe = (s) => {
      if (r.coupe === "rect") return 0;
      const p = G.partie(s);
      return r.rotation ? Math.min(p, G.oppose[p]) : p;
    };
    const classes = new Map();
    for (let s = 0; s < G.total; s++) {
      const k = classeDe(s);
      if (!classes.has(k)) classes.set(k, []);
      classes.get(k).push(s);
    }
    const o = new Array(G.total), rot = new Array(G.total).fill(0);
    const melangerClasse = (places) => {
      const pieces = places.slice();
      for (let i = pieces.length - 1; i > 0; i--) {
        const j = hasard(i + 1);
        [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
      }
      places.forEach((s, i) => { o[s] = pieces[i]; });
    };
    const orienter = (s) => {
      const p = o[s];
      if (r.coupe === "rect") rot[p] = r.rotation ? 2 * hasard(2) : 0;
      else rot[p] = orientation(G, p, s);
    };
    // Places en défaut : pièce à sa place et à l'endroit, ou soudée à une voisine.
    const defauts = () => {
      const d = [];
      for (let s = 0; s < G.total; s++) if (o[s] === s && !rot[s]) d.push(s);
      for (const e of G.internes) if (soudees(G, o, rot, e.a, e.b)) d.push(hasard(2) ? e.a : e.b);
      return d;
    };
    // Un mélange au hasard, puis on défait chaque défaut en échangeant la pièce
    // fautive avec une pièce prise au hasard dans sa classe.
    classes.forEach(melangerClasse);
    for (let s = 0; s < G.total; s++) orienter(s);
    for (let k = 0; k < 100000; k++) {
      const d = defauts();
      if (!d.length) break;
      const s = d[hasard(d.length)];
      const places = classes.get(classeDe(s));
      const t = places[hasard(places.length)];
      [o[s], o[t]] = [o[t], o[s]];
      orienter(s);
      orienter(t);
    }
    return { o, rot };
  }

  // ---------- Écran de jeu ----------
  // photos : les images du même pack ; base : adresse du pack (« #/puzzle/<pack> »).
  function ouvrir(racine, photo, photos, base) {
    let st = UI.Store.get(cle(photo), null);
    const nouveau = (r) => {
      const t = tirage(r);
      return { coupe: r.coupe, rotation: r.rotation, niv: r.niv, o: t.o, rot: t.rot, m: 0, fini: false };
    };
    const valide = (s) => {
      if (!s || !Array.isArray(s.o)) return false;
      if (!s.coupe) { s.coupe = "rect"; s.rotation = false; }
      if (!Array.isArray(s.rot)) s.rot = new Array(s.o.length).fill(0);
      const d = dimensions(s);
      return s.o.length === d.cols * d.lignes * d.P && s.rot.length === s.o.length;
    };
    // On ne reprend qu'une partie réellement entamée ; sinon, nouveau tirage.
    if (!(valide(st) && !st.fini && st.m > 0)) st = nouveau(reglages());

    racine.innerHTML = `
      <div class="pz">
        <header class="barre pz-barre">
          <a class="btn btn-retour" href="${base}">← Retour</a>
          <span class="espace"></span>
          <button class="btn pz-btn-partie" data-act="partie"></button>
          <button class="btn" data-act="modele">Modèle</button>
          <button class="btn" data-act="melanger">Mélanger</button>
        </header>
        <div class="pz-zone">
          <div class="pz-plateau"><svg class="pz-traits" preserveAspectRatio="none"></svg></div>
        </div>
      </div>`;
    const elZone = racine.querySelector(".pz-zone");
    const elPlateau = racine.querySelector(".pz-plateau");
    const elTraits = racine.querySelector(".pz-traits");
    const btnPartie = racine.querySelector('[data-act="partie"]');

    let G = null;
    let pieces = [];
    let pw = 0, ph = 0;
    let choisie = null;
    let groupeDe = [];

    const sauver = () => UI.Store.set(cle(photo), st);
    const slotDe = (id) => st.o.indexOf(id);
    const memeGroupe = (a, b) => groupeDe[a] === groupeDe[b];

    function construire() {
      G = geometrie(st);
      const n = niveau(st.niv);
      btnPartie.innerHTML = `<b>${n.nom}</b><small>${UI.echap(coupe(st.coupe).nom)}${st.rotation ? " · à l'envers" : ""}</small>`;
      elPlateau.querySelectorAll(".pz-piece").forEach((p) => p.remove());
      pieces = [];
      const frag = document.createDocumentFragment();
      for (let id = 0; id < G.total; id++) {
        const p = document.createElement("div");
        p.className = "pz-piece";
        p.style.backgroundImage = `url("${photo.image}")`;
        const poly = G.poly[G.partie(id)];
        if (poly) p.style.clipPath = poly;
        frag.appendChild(p);
        pieces[id] = p;
      }
      elPlateau.insertBefore(frag, elTraits);
      elTraits.setAttribute("viewBox", `0 0 ${G.cols} ${G.lignes}`);
      choisie = null;
      calculerGroupes();
      dimensionner();
      elPlateau.classList.toggle("termine", st.fini);
    }

    function dimensionner() {
      const W = elZone.clientWidth - 16;
      const H = elZone.clientHeight - 16;
      const bw = Math.floor(Math.min(W, (H * 2) / 3));
      const bh = Math.floor((bw * 3) / 2);
      elPlateau.style.width = bw + "px";
      elPlateau.style.height = bh + "px";
      pw = bw / G.cols;
      ph = bh / G.lignes;
      pieces.forEach((p, id) => {
        p.style.width = pw + "px";
        p.style.height = ph + "px";
        p.style.backgroundSize = `${bw}px ${bh}px`;
        p.style.backgroundPosition = `${-G.colonne(id) * pw}px ${-G.ligne(id) * ph}px`;
      });
      placerTout(false);
    }

    // Groupes de pièces soudées pour une disposition donnée : res[id] = tableau partagé.
    function groupesPour(o, rot) {
      const parent = [...Array(G.total).keys()];
      const chef = (x) => { while (parent[x] !== x) x = parent[x] = parent[parent[x]]; return x; };
      for (const e of G.internes) {
        if (soudees(G, o, rot, e.a, e.b)) parent[chef(o[e.a])] = chef(o[e.b]);
      }
      const groupes = new Map();
      for (let id = 0; id < G.total; id++) {
        const c = chef(id);
        if (!groupes.has(c)) groupes.set(c, []);
        groupes.get(c).push(id);
      }
      const res = [];
      groupes.forEach((g) => g.forEach((id) => { res[id] = g; }));
      return res;
    }
    function calculerGroupes() { groupeDe = groupesPour(st.o, st.rot); }

    // Un déplacement ne doit jamais séparer des pièces déjà soudées.
    function separerait(o, rot) {
      const apres = groupesPour(o, rot);
      return groupeDe.some((g) => g.length > 1 && g.some((id) => apres[id] !== apres[g[0]]));
    }

    function placer(id, anime) {
      const s = slotDe(id);
      const p = pieces[id];
      p.classList.toggle("sans-anim", !anime);
      p.style.transform = `translate(${G.colonne(s) * pw}px, ${G.ligne(s) * ph}px) rotate(${st.rot[id] * 90}deg)`;
    }

    // Traits de découpe entre pièces non soudées, contour jaune du groupe choisi.
    function dessinerTraits() {
      const dansChoix = (s) => s >= 0 && choisie !== null && memeGroupe(st.o[s], choisie);
      let blancs = "", jaunes = "";
      for (const e of G.aretes) {
        const seg = `M${e.x1} ${e.y1}L${e.x2} ${e.y2}`;
        if (e.b >= 0 && !memeGroupe(st.o[e.a], st.o[e.b])) blancs += seg;
        if (choisie !== null && dansChoix(e.a) !== dansChoix(e.b)) jaunes += seg;
      }
      elTraits.innerHTML = `<path class="t-blanc" d="${blancs}"/><path class="t-jaune" d="${jaunes}"/>`;
    }

    function placerTout(anime) {
      pieces.forEach((_, id) => placer(id, anime));
      dessinerTraits();
    }

    function eclats(avant) {
      groupeDe.forEach((grp, pid) => {
        if (grp.length > avant[pid]) {
          const el = pieces[pid];
          el.classList.remove("eclat");
          void el.offsetWidth;
          el.classList.add("eclat");
        }
      });
    }

    function apresCoup(avant) {
      st.m++;
      choisie = null;
      calculerGroupes();
      placerTout(true);
      eclats(avant);
      sauver();
      verifierFin();
    }

    // ---------- Déplacements : un groupe n'est jamais séparé ----------
    const retournable = () => st.rotation && st.coupe !== "rect";

    // Calcule, sans l'appliquer, le résultat du déplacement des pièces `g` des places
    // `depart` vers les places `arrivee` ; (dl, dc) donne le sens du mouvement.
    // Les groupes recouverts sont déplacés en entier vers des places libres (ou occupées
    // par des pièces isolées), de préférence à l'opposé du mouvement ; les pièces
    // isolées comblent le reste. Renvoie { o, rot } ou { erreur }.
    function ranger(g, depart, arrivee, dl, dc) {
      const arr = new Set(arrivee);
      const dansG = new Set(g);

      // Groupes délogés (entiers) et places qui se libèrent
      const deloges = [];
      for (const t of arrivee) {
        const pid = st.o[t];
        if (!dansG.has(pid) && !deloges.includes(groupeDe[pid])) deloges.push(groupeDe[pid]);
      }
      const libres = new Set();
      for (const s of depart) if (!arr.has(s)) libres.add(s);
      for (const gr of deloges) for (const pid of gr) { const s = slotDe(pid); if (!arr.has(s)) libres.add(s); }

      const o = st.o.slice(), rot = st.rot.slice();
      g.forEach((pid, i) => {
        o[arrivee[i]] = pid;
        if (st.coupe !== "rect") rot[pid] = orientation(G, pid, arrivee[i]);
      });

      // 1) Groupes de plusieurs pièces : translation d'un bloc vers des places libres,
      //    ou occupées par des pièces isolées (qui seront déplacées à leur tour).
      const gros = deloges.filter((gr) => gr.length > 1).sort((x, y) => y.length - x.length);
      const evincables = new Set();
      for (let t = 0; t < G.total; t++) {
        const pid = st.o[t];
        if (!arr.has(t) && !libres.has(t) && !dansG.has(pid) && groupeDe[pid].length === 1) evincables.add(t);
      }
      const expulses = [];
      let budget = 40000;
      const poser = (i) => {
        if (i === gros.length) return true;
        const gr = gros[i];
        const places = gr.map(slotDe);
        const cands = [];
        for (let a = 1 - G.lignes; a < G.lignes; a++) {
          for (let b = 1 - G.cols; b < G.cols; b++) {
            if (--budget < 0) return false;
            const cible = [], evince = [];
            let ok = true;
            for (const s of places) {
              const l = G.ligne(s) + a, c = G.colonne(s) + b;
              const t = l >= 0 && l < G.lignes && c >= 0 && c < G.cols ? G.place(l, c, G.partie(s)) : -1;
              if (t >= 0 && libres.has(t)) cible.push(t);
              else if (t >= 0 && evincables.has(t)) { cible.push(t); evince.push(t); }
              else { ok = false; break; }
            }
            // préférence : sans déloger d'autres pièces, à l'opposé du mouvement, au plus près
            if (ok) cands.push({ cible, evince, cout: 4 * evince.length + Math.abs(a + dl) + Math.abs(b + dc) + 0.01 * (Math.abs(a) + Math.abs(b)) });
          }
        }
        cands.sort((x, y) => x.cout - y.cout);
        for (const cand of cands.slice(0, 30)) {
          const ev = new Set(cand.evince);
          cand.cible.forEach((t) => { if (ev.has(t)) evincables.delete(t); else libres.delete(t); });
          cand.evince.forEach((t) => expulses.push(st.o[t]));
          if (poser(i + 1)) { cand.cible.forEach((t, k) => { o[t] = gr[k]; }); return true; }
          cand.evince.forEach(() => expulses.pop());
          cand.cible.forEach((t) => { if (ev.has(t)) evincables.add(t); else libres.add(t); });
        }
        return false;
      };
      if (!poser(0)) return { erreur: "separation" };

      // 2) Pièces isolées : à l'opposé du mouvement si possible, sinon la place libre
      //    de même forme la plus proche (ou de forme opposée, retournée, si permis).
      const isolees = deloges.filter((gr) => gr.length === 1).map((gr) => gr[0]).concat(expulses);
      for (const pid of isolees) {
        const s = slotDe(pid);
        let u = -1;
        if (dl || dc) {
          for (let l = G.ligne(s) - dl, c = G.colonne(s) - dc;
            l >= 0 && l < G.lignes && c >= 0 && c < G.cols; l -= dl, c -= dc) {
            const t = G.place(l, c, G.partie(s));
            if (libres.has(t)) { u = t; break; }
          }
        }
        const plusProche = (forme) => {
          let mieux = Infinity, v = -1;
          for (const t of libres) {
            if (G.partie(t) !== forme) continue;
            const d = Math.abs(G.ligne(t) - G.ligne(s)) + Math.abs(G.colonne(t) - G.colonne(s));
            if (d < mieux) { mieux = d; v = t; }
          }
          return v;
        };
        if (u < 0) u = plusProche(G.partie(s));
        if (u < 0 && retournable()) u = plusProche(G.oppose[G.partie(s)]);
        if (u < 0) return { erreur: "separation" }; // ne devrait pas arriver
        libres.delete(u);
        o[u] = pid;
        if (st.coupe !== "rect") rot[pid] = orientation(G, pid, u);
      }
      if (separerait(o, rot)) return { erreur: "separation" }; // sécurité
      return { o, rot };
    }

    // Translation du groupe de la pièce `id`
    function planifier(id, dl, dc) {
      const g = groupeDe[id];
      const depart = g.map(slotDe);
      const arrivee = [];
      for (const s of depart) {
        const l = G.ligne(s) + dl, c = G.colonne(s) + dc;
        if (l < 0 || l >= G.lignes || c < 0 || c >= G.cols) return { erreur: "bord" };
        arrivee.push(G.place(l, c, G.partie(s)));
      }
      return ranger(g, depart, arrivee, dl, dc);
    }

    // Triangle isolé amené dans une place de forme opposée : il se retourne.
    function planRetourne(a, t) {
      const sa = slotDe(a);
      return ranger([a], [sa], [t], G.ligne(t) - G.ligne(sa), G.colonne(t) - G.colonne(sa));
    }

    // Ancienne règle (les pièces recouvertes glissent une à une, quitte à séparer
    // des groupes) : seulement en dernier recours, avec l'accord de la joueuse.
    function planChaine(id, dl, dc) {
      const g = groupeDe[id];
      const depart = g.map(slotDe);
      const arrivee = depart.map((s) => G.place(G.ligne(s) + dl, G.colonne(s) + dc, G.partie(s)));
      const dep = new Set(depart), arr = new Set(arrivee);
      const recule = (t) => G.place(G.ligne(t) - dl, G.colonne(t) - dc, G.partie(t));
      const o = st.o.slice();
      for (const t of arrivee) {
        if (dep.has(t)) continue;
        let u = recule(t);
        while (arr.has(u)) u = recule(u);
        o[u] = st.o[t];
      }
      g.forEach((pid, i) => { o[arrivee[i]] = pid; });
      return { o, rot: st.rot.slice() };
    }
    function planEchange(a, t) {
      const sa = slotDe(a), b = st.o[t];
      const o = st.o.slice(), rot = st.rot.slice();
      o[sa] = b;
      o[t] = a;
      rot[a] = orientation(G, a, t);
      rot[b] = orientation(G, b, sa);
      return { o, rot };
    }

    // Reste-t-il au moins un coup qui ne sépare rien ?
    function existeCoup() {
      const vus = new Set();
      for (let id = 0; id < G.total; id++) {
        const gr = groupeDe[id];
        if (vus.has(gr)) continue;
        vus.add(gr);
        for (let dl = 1 - G.lignes; dl < G.lignes; dl++) {
          for (let dc = 1 - G.cols; dc < G.cols; dc++) {
            if ((dl || dc) && !planifier(id, dl, dc).erreur) return true;
          }
        }
      }
      if (retournable()) {
        const seules = [...Array(G.total).keys()].filter((id) => groupeDe[id].length === 1);
        for (const a of seules) {
          for (let t = 0; t < G.total; t++) {
            if (G.partie(t) === G.oppose[G.partie(slotDe(a))] && !planRetourne(a, t).erreur) return true;
          }
        }
      }
      return false;
    }

    // Applique un plan ; s'il séparerait des pièces et qu'aucun autre coup n'est
    // possible, propose le plan de secours.
    function executer(plan, secours) {
      // Coup impossible : la pièce revient simplement à sa place, sans message.
      if (plan.erreur === "bord") return false;
      if (plan.erreur) {
        if (existeCoup()) return false;
        UI.modal({
          titre: "Pièces coincées",
          html: "<p>Plus aucun déplacement n'est possible sans séparer des pièces déjà assemblées.</p><p>Faire ce déplacement quand même ?</p>",
          boutons: [
            { label: "Oui, déplacer quand même", classe: "btn-principal", action: () => {
              const avant = groupeDe.map((x) => x.length);
              const r = secours();
              st.o = r.o;
              st.rot = r.rot;
              apresCoup(avant);
            } },
            { label: "Non" },
          ],
        });
        return false;
      }
      const avant = groupeDe.map((x) => x.length);
      st.o = plan.o;
      st.rot = plan.rot;
      apresCoup(avant);
      return true;
    }

    function deplacer(id, dl, dc) {
      if (!dl && !dc) return false;
      return executer(planifier(id, dl, dc), () => planChaine(id, dl, dc));
    }

    // Amène la pièce `a` (et son groupe) vers la place `t`.
    function amener(a, t) {
      const sa = slotDe(a);
      const seule = groupeDe[a].length === 1;
      const pa = G.partie(sa), pt = G.partie(t);
      if (retournable() && seule && pt === G.oppose[pa]) {
        executer(planRetourne(a, t), () => planEchange(a, t));
        return;
      }
      const dl = G.ligne(t) - G.ligne(sa), dc = G.colonne(t) - G.colonne(sa);
      if (!dl && !dc) {
        choisie = null;
        dessinerTraits();
        return;
      }
      deplacer(a, dl, dc);
    }

    function retourner(id) {
      const avant = groupeDe.map((x) => x.length);
      st.rot[id] = st.rot[id] ? 0 : 2;
      st.m++;
      calculerGroupes();
      if (groupeDe[id].length > 1) choisie = null;
      placerTout(true);
      eclats(avant);
      sauver();
      verifierFin();
    }

    function verifierFin() {
      // Réussi quand toutes les pièces ne forment plus qu'un seul bloc
      // (le plateau ayant la taille de l'image, ce bloc est forcément à sa place).
      if (groupeDe[0].length !== G.total) return;
      st.fini = true;
      choisie = null;
      dessinerTraits();
      sauver();
      const f = finis();
      f[photo.id] = [...new Set([...(f[photo.id] || []), cleReussite(st)])];
      UI.Store.set("pz-fini", f);
      setTimeout(() => {
        elPlateau.classList.add("termine");
        setTimeout(() => {
          const i = photos.indexOf(photo);
          const suivante = photos[(i + 1) % photos.length];
          UI.modal({
            titre: "Bravo ! Puzzle terminé",
            html: `<p>Terminé en <b>${st.m}</b> coup${st.m > 1 ? "s" : ""}.</p><p>${UI.echap(niveau(st.niv).nom)} — ${UI.echap(libelle(st))}</p>`,
            boutons: [
              { label: "Image suivante", classe: "btn-principal", action: () => { location.hash = base + "/" + encodeURIComponent(suivante.id); } },
              { label: "Rejouer cette image", action: () => recommencer(reglages()) },
              { label: "Retour aux images", action: () => { location.hash = base; } },
            ],
          });
        }, 900);
      }, 300);
    }

    function recommencer(r) {
      st = nouveau(r);
      sauver();
      construire();
    }

    // ---------- Réglages de la partie ----------
    function choisirPartie() {
      const r = { coupe: st.coupe, rotation: st.rotation, niv: st.niv };
      const fond = document.createElement("div");
      fond.className = "modal-fond";
      const icone = (c) => {
        const d = { rect: "", diag2: '<path d="M2 30L30 2"/>', diag4: '<path d="M2 2L30 30M2 30L30 2"/>' }[c];
        return `<svg viewBox="0 0 32 32" class="pz-ico" aria-hidden="true"><rect x="2" y="2" width="28" height="28"/>${d}</svg>`;
      };
      const rendu = () => {
        fond.innerHTML = `
          <div class="modal pz-reglages">
            <h2>Nouvelle partie</h2>
            <h3>Découpe</h3>
            <div class="pz-choix">${window.PZ_COUPES.map((c) =>
              `<button class="btn ${r.coupe === c.id ? "btn-principal" : ""}" data-coupe="${c.id}">${icone(c.id)}${c.nom}</button>`).join("")}</div>
            <h3>Pièces à l'envers</h3>
            <div class="pz-choix">
              <button class="btn ${!r.rotation ? "btn-principal" : ""}" data-rot="0">Non</button>
              <button class="btn ${r.rotation ? "btn-principal" : ""}" data-rot="1">Oui</button>
            </div>
            <h3>Niveau</h3>
            <div class="pz-choix pz-choix-niv">${NIVEAUX().map((n) => {
              const d = dimensions({ coupe: r.coupe, niv: n.id });
              return `<button class="btn ${r.niv === n.id ? "btn-principal" : ""}" data-niv="${n.id}">${n.nom}<small>${d.cols * d.lignes * d.P} pièces</small></button>`;
            }).join("")}</div>
            <div class="modal-boutons">
              <button class="btn btn-principal" data-ok="1">Commencer</button>
              <button class="btn btn-discret" data-annuler="1">Annuler</button>
            </div>
          </div>`;
      };
      rendu();
      fond.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (e.target === fond || (b && b.dataset.annuler)) { fond.remove(); return; }
        if (!b) return;
        if (b.dataset.coupe) r.coupe = b.dataset.coupe;
        else if (b.dataset.rot) r.rotation = b.dataset.rot === "1";
        else if (b.dataset.niv) r.niv = b.dataset.niv;
        else if (b.dataset.ok) {
          fond.remove();
          UI.Store.set("pz-reglages", r);
          recommencer(r);
          if (r.rotation && r.coupe === "rect") UI.toast("Touchez deux fois une pièce pour la retourner.", 4000);
          return;
        }
        rendu();
      });
      document.body.appendChild(fond);
    }

    function modele() {
      const fond = document.createElement("div");
      fond.className = "pz-modele";
      const c = photo.credit;
      const credit = c && (c.auteur || c.licence)
        ? `<p class="pz-credit">${UI.echap(photo.titre || "")}${photo.titre ? " — " : ""}${UI.echap([c.auteur, c.licence].filter(Boolean).join(", "))}</p>` : "";
      fond.innerHTML = `<img src="${photo.image}" alt="Modèle">${credit}<p>Touchez l'écran pour revenir au puzzle</p>`;
      fond.addEventListener("click", () => fond.remove());
      document.body.appendChild(fond);
    }

    function demanderMelange() {
      if (st.fini || st.m === 0) { recommencer(st); return; }
      UI.modal({
        titre: "Mélanger à nouveau ?",
        html: "<p>Le puzzle en cours sera recommencé depuis le début.</p>",
        boutons: [
          { label: "Non, continuer" },
          { label: "Oui, mélanger", classe: "btn-principal", action: () => recommencer(st) },
        ],
      });
    }

    // ---------- Toucher, stylet, souris ----------
    // Les triangles se chevauchent dans leur case : on repère la place par le calcul.
    function placeSous(x, y) {
      const r = elPlateau.getBoundingClientRect();
      const fx = (x - r.left) / pw, fy = (y - r.top) / ph;
      if (fx < 0 || fy < 0 || fx >= G.cols || fy >= G.lignes) return -1;
      const c = Math.floor(fx), l = Math.floor(fy);
      return G.place(l, c, G.partieEn(fx - c, fy - l));
    }

    let geste = null;
    elZone.addEventListener("pointerdown", (e) => {
      if (st.fini) return;
      const s = placeSous(e.clientX, e.clientY);
      if (s < 0) {
        if (choisie !== null) { choisie = null; dessinerTraits(); }
        return;
      }
      e.preventDefault();
      elZone.setPointerCapture(e.pointerId);
      geste = { id: st.o[s], x: e.clientX, y: e.clientY, glisse: false };
    });
    elZone.addEventListener("pointermove", (e) => {
      if (!geste) return;
      const dx = e.clientX - geste.x, dy = e.clientY - geste.y;
      if (!geste.glisse && Math.hypot(dx, dy) < 10) return;
      if (!geste.glisse) {
        geste.glisse = true;
        elPlateau.classList.add("glissement");
      }
      for (const pid of groupeDe[geste.id]) {
        const s = slotDe(pid);
        const el = pieces[pid];
        el.classList.add("glisse", "sans-anim");
        el.style.transform = `translate(${G.colonne(s) * pw + dx}px, ${G.ligne(s) * ph + dy}px) rotate(${st.rot[pid] * 90}deg)`;
      }
    });
    const fin = (e) => {
      if (!geste) return;
      const g = geste;
      geste = null;
      if (g.glisse) {
        elPlateau.classList.remove("glissement");
        groupeDe[g.id].forEach((pid) => pieces[pid].classList.remove("glisse"));
        const t = e.type === "pointerup" ? placeSous(e.clientX, e.clientY) : -1;
        const avantCoups = st.m;
        // (la place visée peut être occupée par le groupe lui-même : décalage d'un cran)
        if (t >= 0 && t !== slotDe(g.id)) amener(g.id, t);
        if (st.m === avantCoups) placerTout(true);
        return;
      }
      // Simple toucher : on choisit une pièce (et son groupe), puis la place où l'amener.
      if (choisie === null) { choisie = g.id; dessinerTraits(); return; }
      if (memeGroupe(choisie, g.id)) {
        if (st.rotation && st.coupe === "rect" && groupeDe[g.id].length === 1) { retourner(g.id); return; }
        choisie = null;
        dessinerTraits();
        return;
      }
      amener(choisie, slotDe(g.id));
    };
    elZone.addEventListener("pointerup", fin);
    elZone.addEventListener("pointercancel", fin);

    racine.querySelector(".pz-barre").addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      if (b.dataset.act === "partie") choisirPartie();
      else if (b.dataset.act === "modele") modele();
      else if (b.dataset.act === "melanger") demanderMelange();
    });

    let rTimer = null;
    const surResize = () => { clearTimeout(rTimer); rTimer = setTimeout(dimensionner, 120); };
    window.addEventListener("resize", surResize);

    sauver();
    construire();
    // Accès pour les tests automatiques
    window.__pz = { existeCoup: () => existeCoup(), retourner: (id) => retourner(id), deplacer: (id, dl, dc) => deplacer(id, dl, dc), amener: (a, t) => amener(a, t), etat: () => st, groupes: () => groupeDe };

    return () => {
      window.removeEventListener("resize", surResize);
      document.querySelectorAll(".pz-modele").forEach((m) => m.remove());
    };
  }

  window.Puzzle = { ouvrir, etat, tirage, geometrie, soudees };
})();
