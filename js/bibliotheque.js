// Bibliothèque : contenus téléchargés depuis le serveur et conservés sur l'appareil
// (IndexedDB). Contrat d'API : docs/specification-bibliotheque.md.
(function () {
  "use strict";

  const BASE = "https://www.stansgames.fr/jeux-tablette/api";
  const URL_INDEX = BASE + "/v1/bibliotheque";
  // Version de la lecture des contenus par l'appli, par type : quand elle augmente, les
  // éléments installés avant doivent être retéléchargés (bouton « Mettre à jour »).
  // Mots codés 2 : lettres isolées révélées au lieu d'écarter la grille.
  const LECTURE = { "mots-codes": 2 };
  const aRelire = (inst) => (inst.lecture || 1) < (LECTURE[inst.type] || 1);

  // Formats de manifeste acceptés pour chaque type.
  const TYPES = {
    images: ["mes-jeux-pack-images"],
    "chasse-croise": ["mes-jeux-carnet-cc"],
    "mots-codes": ["mes-jeux-carnet-mc", "mes-jeux-pack-mots-codes"],
    "mot-mysterieux": ["mes-jeux-pack-mot-mysterieux"],
    alphamot: ["mes-jeux-pack-alphamot"],
    "mots-zigzag": ["mes-jeux-pack-mots-zigzag"],
  };

  // ---------- IndexedDB ----------
  // elements : éléments installés { id, type, version, titre, description, contenu: [ids],
  //            couverture: Blob (packs d'images), local: true pour les packs « Mes images » }
  // images   : { id, titre, credit, vignette: Blob, image: Blob, variante, elements: [ids] }
  // grilles  : { id, jeu ("cc" ou "mc"), grille (format interne du jeu), carnet, elements: [ids] }
  let dbPromesse = null;
  function db() {
    if (!dbPromesse) {
      dbPromesse = new Promise((ok, ko) => {
        const r = indexedDB.open("mes-jeux", 1);
        r.onupgradeneeded = () => {
          const d = r.result;
          for (const s of ["elements", "images", "grilles"]) {
            if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: "id" });
          }
        };
        r.onsuccess = () => ok(r.result);
        r.onerror = () => ko(r.error);
      });
    }
    return dbPromesse;
  }
  const req = (r) => new Promise((ok, ko) => { r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
  async function tout(store) {
    const d = await db();
    return req(d.transaction(store).objectStore(store).getAll());
  }
  const finTx = (tx) => new Promise((ok, ko) => {
    tx.oncomplete = () => ok();
    tx.onerror = () => ko(tx.error);
    tx.onabort = () => ko(tx.error || new Error("transaction annulée"));
  });

  // ---------- État en mémoire (chargé au démarrage) ----------
  const etat = { elements: [], photos: [], packs: [], grilles: [], motsCodes: [] };
  const urls = new Map(); // Blob -> URL d'objet, pour ne pas les recréer

  function urlDe(blob) {
    if (!urls.has(blob)) urls.set(blob, URL.createObjectURL(blob));
    return urls.get(blob);
  }

  let migre = false;
  async function charger() {
    if (!migre) { migre = true; await migrer().catch(() => {}); }
    const [elements, images, grilles] = await Promise.all([tout("elements"), tout("images"), tout("grilles")]);
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls.clear();
    const ordre = new Map();
    // Mes images d'abord, puis les contenus téléchargés par ordre alphabétique.
    elements.sort((a, b) => (b.local ? 1 : 0) - (a.local ? 1 : 0) || a.titre.localeCompare(b.titre, "fr", { numeric: true }));
    elements.forEach((e, i) => (e.contenu || []).forEach((id, j) => { if (!ordre.has(id)) ordre.set(id, i * 1000 + j); }));
    const rang = (x) => (ordre.has(x.id) ? ordre.get(x.id) : 1e9);
    etat.elements = elements;
    etat.photos = images.sort((a, b) => rang(a) - rang(b)).map((im) => ({
      id: im.id,
      titre: im.titre,
      credit: im.credit,
      element: im.elements[0],
      perso: im.elements[0].startsWith(MES_IMAGES),
      get image() { return urlDe(im.image); },
      get mini() { return urlDe(im.vignette); },
    }));
    const parId = new Map(etat.photos.map((p) => [p.id, p]));
    grilles.sort((a, b) => rang(a) - rang(b));
    const enClair = (g) => Object.assign({ carnet: g.carnet }, g.grille);
    const grParId = new Map(grilles.map((g) => [g.id, enClair(g)]));
    etat.packs = elements.map((e) => ({
      id: e.id,
      type: e.type,
      titre: e.titre,
      local: !!e.local,
      archive: !!e.archive,
      version: e.version,
      photos: e.type === "images" ? (e.contenu || []).map((id) => parId.get(id)).filter(Boolean) : [],
      grilles: e.type !== "images" ? (e.contenu || []).map((id) => grParId.get(id)).filter(Boolean) : [],
      get couverture() { return e.couverture ? urlDe(e.couverture) : null; },
    }));
    etat.grilles = grilles.filter((g) => g.jeu === "cc").map(enClair);
    etat.motsCodes = grilles.filter((g) => g.jeu === "mc").map(enClair);
  }

  // ---------- Index du serveur ----------
  // Renvoie { index, horsLigne }. L'index reçu est gardé pour l'affichage hors connexion.
  async function lireIndex() {
    const memo = UI.Store.get("bib-index", null);
    try {
      const entetes = memo && memo.etag ? { "If-None-Match": memo.etag } : {};
      const rep = await fetch(URL_INDEX, { headers: entetes, cache: "no-store" });
      if (rep.status === 304 && memo) return { index: memo.index, horsLigne: false };
      if (!rep.ok) throw new Error("HTTP " + rep.status);
      const index = await rep.json();
      if (index.format !== "mes-jeux-bibliotheque" || index.version_format !== 1) throw new Error("format d'index inconnu");
      UI.Store.set("bib-index", { etag: rep.headers.get("ETag"), index });
      return { index, horsLigne: false };
    } catch (e) {
      return { index: memo ? memo.index : null, horsLigne: true };
    }
  }

  // ---------- Téléchargement ----------
  async function sha256(blob) {
    const h = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function telechargerFichier(v) {
    const rep = await fetch(v.url);
    if (!rep.ok) throw new Error("HTTP " + rep.status);
    const blob = await rep.blob();
    if ((await sha256(blob)) !== v.sha256) throw new Error("fichier altéré");
    return blob;
  }

  // Exécute les tâches avec au plus `n` en parallèle.
  async function enParallele(taches, n, progres) {
    let i = 0, faits = 0;
    const res = new Array(taches.length);
    const ouvrier = async () => {
      while (i < taches.length) {
        const k = i++;
        res[k] = await taches[k]();
        progres(++faits, taches.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(n, taches.length) }, ouvrier));
    return res;
  }

  // Variante adaptée à l'écran : la plus petite assez grande pour le plateau du puzzle.
  function varianteVoulue(variantes) {
    const largeurPlateau = Math.min(window.innerWidth, ((window.innerHeight - 60) * 2) / 3);
    const besoin = largeurPlateau * (window.devicePixelRatio || 1);
    const s = variantes.standard;
    return s && s.largeur >= besoin ? "standard" : "grande";
  }

  // Convertit une grille du format de l'API vers le format interne du jeu.
  function versInterne(g) {
    return {
      id: g.id,
      nom: g.titre,
      niveau: g.niveau,
      consigne: g.consigne,
      acrostiche: g.acrostiche,
      colonnes: g.colonnes || 20,
      citation: g.citation,
      auteur: g.auteur,
      oeuvre: g.oeuvre,
      defs: g.definitions.map((d) => [d.lettre, d.intitule, d.reponse, d.cases]),
    };
  }

  // Mots codés : deux formats. « mes-jeux-carnet-mc » est déjà le format interne ;
  // « mes-jeux-pack-mots-codes » (back-office) donne la solution et une correspondance sur
  // 26 nombres, que l'on renumérote de 1 à n sur les seules lettres présentes.
  function versInterneMC(g) {
    if (g.lignes) return { id: g.id, nom: g.titre, niveau: g.niveau, lignes: g.lignes, codes: g.codes, devoiles: g.devoiles || [] };
    const lignes = (g.solution || []).map((l) => (Array.isArray(l) ? l.join("") : String(l)));
    const presentes = new Set(lignes.join("").replace(/#/g, ""));
    const numero = {}; // lettre -> nombre d'origine
    Object.entries(g.correspondance || {}).forEach(([n, ch]) => { numero[ch] = +n; });
    const ordre = [...presentes].sort((a, b) => (numero[a] || 99) - (numero[b] || 99));
    const codes = {};
    ordre.forEach((ch, i) => { codes[ch] = i + 1; });
    const devoiles = new Set((g.lettres_donnees || []).map((x) => x.lettre).filter((ch) => presentes.has(ch)));
    // Une lettre présente une seule fois, hors d'un croisement, n'aurait qu'un mot pour être
    // devinée : on la donne d'office (règle 7 de la spécification).
    const blanc = (l, c) => l >= 0 && l < lignes.length && c >= 0 && c < lignes[l].length && lignes[l][c] !== "#";
    const pos = {};
    lignes.forEach((ligne, l) => [...ligne].forEach((ch, c) => { if (ch !== "#") (pos[ch] = pos[ch] || []).push([l, c]); }));
    Object.entries(pos).forEach(([ch, p]) => {
      if (p.length !== 1) return;
      const [l, c] = p[0];
      if (!((blanc(l, c - 1) || blanc(l, c + 1)) && (blanc(l - 1, c) || blanc(l + 1, c)))) devoiles.add(ch);
    });
    return { id: g.id, nom: g.titre, niveau: g.niveau, lignes, codes, devoiles: [...devoiles] };
  }

  // Installe (ou met à jour) un élément de l'index. `progres(fait, total)`.
  // Rien n'est écrit tant que tout n'est pas téléchargé et vérifié.
  async function installer(el, progres) {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    const rep = await fetch(el.manifeste);
    if (!rep.ok) throw new Error("HTTP " + rep.status);
    const m = await rep.json();
    if (!(TYPES[el.type] || []).includes(m.format) || m.version_format !== 1 || m.id !== el.id) throw new Error("format inconnu");
    // Couverture du pack (tous les types). « reload » : l'image a pu être affichée avant
    // sans en-têtes CORS, et le navigateur ne doit pas resservir cette copie.
    const couvP = el.vignette
      ? fetch(el.vignette, { cache: "reload" }).then((r) => (r.ok ? r.blob() : null)).catch(() => null)
      : Promise.resolve(null);

    let nouveaux = [];
    let couvertureRecue = null;
    const store = el.type === "images" ? "images" : "grilles";
    if (el.type === "images") {
      const images = m.images.filter((im) => im.ratio === "2:3" && im.variantes && im.variantes.vignette);
      const taches = [];
      images.forEach((im) => {
        const v = varianteVoulue(im.variantes);
        taches.push(() => telechargerFichier(im.variantes.vignette));
        taches.push(() => telechargerFichier(im.variantes[v]));
      });
      const blobs = await enParallele(taches, 4, progres);
      nouveaux = images.map((im, i) => ({
        id: im.id,
        titre: im.titre || "",
        credit: im.credit || null,
        vignette: blobs[2 * i],
        image: blobs[2 * i + 1],
        variante: varianteVoulue(im.variantes),
      }));
    } else if (el.type === "chasse-croise") {
      progres(0, 1);
      nouveaux = m.grilles
        .map(versInterne)
        .filter((g) => window.ChasseCroise.valider(g).length === 0)
        .map((g) => ({ id: g.id, jeu: "cc", grille: g, carnet: m.titre }));
      progres(1, 1);
    } else if (el.type === "alphamot") {
      progres(0, 1);
      nouveaux = m.grilles
        .map((g) => ({ id: g.id, nom: g.titre, niveau: g.niveau, solution: g.solution, definitions: g.definitions }))
        .filter((g) => window.Alphamot.valider(g).length === 0)
        .map((g) => ({ id: g.id, jeu: "am", grille: g, carnet: m.titre }));
      progres(1, 1);
    } else if (el.type === "mots-zigzag") {
      progres(0, 1);
      nouveaux = m.grilles
        .map((g) => ({ id: g.id, nom: g.titre, niveau: g.niveau, lignes: g.lignes, mots: g.mots, chemins: g.chemins, mystere: g.mystere, definition: g.definition }))
        .filter((g) => window.MotsZigzag.valider(g).length === 0)
        .map((g) => ({ id: g.id, jeu: "zz", grille: g, carnet: m.titre }));
      progres(1, 1);
    } else if (el.type === "mot-mysterieux") {
      progres(0, 1);
      nouveaux = m.grilles
        .map((g) => ({ id: g.id, nom: g.titre, theme: g.theme, niveau: g.niveau, lignes: g.lignes, mots: g.mots, placements: g.placements, mystere: g.mystere }))
        .filter((g) => window.MotMysterieux.valider(g).length === 0)
        .map((g) => ({ id: g.id, jeu: "mm", grille: g, carnet: m.titre }));
      progres(1, 1);
    } else {
      progres(0, 1);
      nouveaux = m.grilles
        .map(versInterneMC)
        .filter((g) => window.MotsCodes.valider(g).length === 0)
        .map((g) => ({ id: g.id, jeu: "mc", grille: g, carnet: m.titre }));
      progres(1, 1);
    }
    if (!nouveaux.length) throw new Error("aucun contenu valide");
    couvertureRecue = await couvP;

    // Écriture en une seule transaction.
    const d = await db();
    const tx = d.transaction(["elements", store], "readwrite");
    const sEl = tx.objectStore("elements"), sC = tx.objectStore(store);
    const ancien = await req(sEl.get(el.id));
    const ids = new Set(nouveaux.map((x) => x.id));
    for (const x of nouveaux) {
      const exist = await req(sC.get(x.id));
      x.elements = [...new Set([...(exist ? exist.elements : []), el.id])];
      sC.put(x);
    }
    // Contenus retirés de l'élément lors d'une mise à jour.
    for (const id of (ancien ? ancien.contenu : [])) {
      if (ids.has(id)) continue;
      const x = await req(sC.get(id));
      if (!x) continue;
      x.elements = x.elements.filter((e) => e !== el.id);
      if (x.elements.length) sC.put(x); else sC.delete(id);
    }
    const enr = {
      id: el.id, type: el.type, version: el.version, titre: el.titre,
      description: el.description || "", contenu: nouveaux.map((x) => x.id),
      lecture: LECTURE[el.type] || 1,
    };
    enr.couverture = couvertureRecue && couvertureRecue.type.startsWith("image/") ? couvertureRecue : null;
    sEl.put(enr);
    await finTx(tx);
    // Couverture absente (téléchargement raté) : on la fabrique à partir des images.
    if (el.type === "images" && !enr.couverture) await refaireCouverture(el.id);
    await charger();
  }

  async function supprimer(id) {
    if (id.startsWith(MES_IMAGES)) return archiver(id); // jamais d'effacement d'un pack personnel
    const d = await db();
    const tx = d.transaction(["elements", "images", "grilles"], "readwrite");
    const sEl = tx.objectStore("elements");
    const el = await req(sEl.get(id));
    if (el) {
      const sC = tx.objectStore(el.type === "images" ? "images" : "grilles");
      for (const cid of el.contenu) {
        const x = await req(sC.get(cid));
        if (!x) continue;
        x.elements = x.elements.filter((e) => e !== id);
        if (x.elements.length) sC.put(x); else sC.delete(cid);
      }
      sEl.delete(id);
    }
    await finTx(tx);
    await charger();
  }

  // ---------- Photos personnelles : packs « Mes images » de 12 photos ----------
  // Elles restent sur l'appareil. Chaque pack local a sa couverture, fabriquée comme
  // celles du catalogue (js/couverture.js).
  const MES_IMAGES = "mes-images-";
  const PAR_PACK = 12;
  const nomPack = (n) => (n === 1 ? "Mes images" : "Mes images " + n);

  // Refait la couverture d'un pack à partir de ses vignettes (hors transaction : le
  // dessin est asynchrone).
  async function refaireCouverture(idPack) {
    const d = await db();
    const el = await req(d.transaction("elements").objectStore("elements").get(idPack));
    if (!el) return;
    const sIm = d.transaction("images").objectStore("images");
    const ims = await Promise.all(el.contenu.map((id) => req(sIm.get(id))));
    let couverture = null;
    try { couverture = await window.Couverture.generer(el.titre, ims.filter(Boolean).map((im) => im.vignette)); } catch (e) { /* sans couverture */ }
    const tx = d.transaction("elements", "readwrite");
    const sEl = tx.objectStore("elements");
    const frais = await req(sEl.get(idPack));
    if (frais) { frais.couverture = couverture; sEl.put(frais); }
    await finTx(tx);
  }

  // Ajoute une photo au premier pack « Mes images » qui a de la place, ou à un nouveau pack.
  // Renvoie l'identifiant du pack.
  async function ajouterPhoto({ image, vignette, titre, pack }) {
    const d = await db();
    const tx = d.transaction(["elements", "images"], "readwrite");
    const sEl = tx.objectStore("elements");
    const locaux = (await req(sEl.getAll())).filter((e) => e.local && e.id.startsWith(MES_IMAGES))
      .sort((a, b) => a.numero - b.numero);
    const ouverts = locaux.filter((e) => !e.archive && e.contenu.length < PAR_PACK);
    let el = ouverts.find((e) => e.id === pack) || ouverts[0];
    if (!el) {
      const n = locaux.reduce((m, e) => Math.max(m, e.numero), 0) + 1;
      el = { id: MES_IMAGES + n, numero: n, type: "images", local: true, version: 0, titre: nomPack(n), description: "", contenu: [] };
    }
    const id = "perso-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    tx.objectStore("images").put({ id, titre: titre || "", credit: null, vignette, image, variante: "perso", elements: [el.id] });
    el.contenu = [...el.contenu, id];
    sEl.put(el);
    await finTx(tx);
    await refaireCouverture(el.id);
    await charger();
    return el.id;
  }

  // Les packs personnels ne sont jamais effacés : ils sont archivés (masqués, mais conservés).
  async function archiver(id, oui = true) {
    const d = await db();
    const tx = d.transaction("elements", "readwrite");
    const sEl = tx.objectStore("elements");
    const el = await req(sEl.get(id));
    if (el && el.local) { el.archive = oui; sEl.put(el); }
    await finTx(tx);
    await charger();
  }

  async function retirerPhoto(id) {
    const d = await db();
    const tx = d.transaction(["elements", "images"], "readwrite");
    const sIm = tx.objectStore("images"), sEl = tx.objectStore("elements");
    const im = await req(sIm.get(id));
    const packs = im ? im.elements : [];
    sIm.delete(id);
    const vides = [];
    for (const p of packs) {
      const el = await req(sEl.get(p));
      if (!el) continue;
      el.contenu = el.contenu.filter((x) => x !== id);
      if (el.contenu.length) sEl.put(el); else { sEl.delete(p); vides.push(p); }
    }
    await finTx(tx);
    for (const p of packs) if (!vides.includes(p)) await refaireCouverture(p);
    await charger();
  }

  // Versions 20 et 21 : les photos personnelles étaient dans un seul élément « mes-photos »
  // (la plus récente en premier). On les range par 12 dans des packs « Mes images ».
  // On fabrique aussi les couvertures manquantes des packs téléchargés avant la version 22.
  async function migrer() {
    const d = await db();
    let tx = d.transaction(["elements", "images"], "readwrite");
    let sEl = tx.objectStore("elements");
    const ancien = await req(sEl.get("mes-photos"));
    const aRefaire = [];
    if (ancien) {
      const sIm = tx.objectStore("images");
      const ids = [...ancien.contenu].reverse();
      for (let k = 0; k * PAR_PACK < ids.length; k++) {
        const n = k + 1, idPack = MES_IMAGES + n, part = ids.slice(k * PAR_PACK, (k + 1) * PAR_PACK);
        sEl.put({ id: idPack, numero: n, type: "images", local: true, version: 0, titre: nomPack(n), description: "", contenu: part });
        for (const id of part) {
          const im = await req(sIm.get(id));
          if (im) { im.elements = [idPack]; sIm.put(im); }
        }
        aRefaire.push(idPack);
      }
      sEl.delete("mes-photos");
    }
    await finTx(tx);
    const tous = await tout("elements");
    tous.forEach((e) => { if (e.type === "images" && !e.couverture && !aRefaire.includes(e.id)) aRefaire.push(e.id); });
    for (const id of aRefaire) await refaireCouverture(id);
  }

  window.Bibliotheque = {
    charger, lireIndex, installer, supprimer, aRelire, ajouterPhoto, retirerPhoto, archiver, varianteVoulue,
    get elements() { return etat.elements; },
    get photos() { return etat.photos; },
    get packs() { return etat.packs; },
    get grilles() { return etat.grilles; },
    get motsCodes() { return etat.motsCodes; },
  };
})();
