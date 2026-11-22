// Bibliothèque : contenus téléchargés depuis le serveur et conservés sur l'appareil
// (IndexedDB). Contrat d'API : docs/specification-bibliotheque.md.
(function () {
  "use strict";

  const BASE = "https://www.stansgames.fr/jeux-tablette/api";
  const URL_INDEX = BASE + "/v1/bibliotheque";
  const TYPES = { images: "mes-jeux-pack-images", "chasse-croise": "mes-jeux-carnet-cc", "mots-codes": "mes-jeux-carnet-mc" };

  // ---------- IndexedDB ----------
  // elements : éléments installés { id, type, version, titre, description, octets, contenu: [ids] }
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
  const etat = { elements: [], photos: [], grilles: [], motsCodes: [] };
  const urls = new Map(); // Blob -> URL d'objet, pour ne pas les recréer

  function urlDe(blob) {
    if (!urls.has(blob)) urls.set(blob, URL.createObjectURL(blob));
    return urls.get(blob);
  }

  async function charger() {
    const [elements, images, grilles] = await Promise.all([tout("elements"), tout("images"), tout("grilles")]);
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls.clear();
    const ordre = new Map();
    // Mes photos d'abord, puis les contenus téléchargés par ordre alphabétique.
    elements.sort((a, b) => (b.local ? 1 : 0) - (a.local ? 1 : 0) || a.titre.localeCompare(b.titre, "fr"));
    elements.forEach((e, i) => (e.contenu || []).forEach((id, j) => { if (!ordre.has(id)) ordre.set(id, i * 1000 + j); }));
    const rang = (x) => (ordre.has(x.id) ? ordre.get(x.id) : 1e9);
    etat.elements = elements;
    etat.photos = images.sort((a, b) => rang(a) - rang(b)).map((im) => ({
      id: im.id,
      titre: im.titre,
      credit: im.credit,
      element: im.elements[0],
      perso: im.elements[0] === MES_PHOTOS,
      get image() { return urlDe(im.image); },
      get mini() { return urlDe(im.vignette); },
    }));
    grilles.sort((a, b) => rang(a) - rang(b));
    const enClair = (g) => Object.assign({ carnet: g.carnet }, g.grille);
    etat.grilles = grilles.filter((g) => g.jeu !== "mc").map(enClair);
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

  // Installe (ou met à jour) un élément de l'index. `progres(fait, total)`.
  // Rien n'est écrit tant que tout n'est pas téléchargé et vérifié.
  async function installer(el, progres) {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    const rep = await fetch(el.manifeste);
    if (!rep.ok) throw new Error("HTTP " + rep.status);
    const m = await rep.json();
    if (m.format !== TYPES[el.type] || m.version_format !== 1 || m.id !== el.id) throw new Error("format inconnu");

    let nouveaux = [];
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
    } else {
      progres(0, 1);
      nouveaux = m.grilles
        .map((g) => ({ id: g.id, nom: g.titre, niveau: g.niveau, lignes: g.lignes, codes: g.codes, devoiles: g.devoiles || [] }))
        .filter((g) => window.MotsCodes.valider(g).length === 0)
        .map((g) => ({ id: g.id, jeu: "mc", grille: g, carnet: m.titre }));
      progres(1, 1);
    }
    if (!nouveaux.length) throw new Error("aucun contenu valide");

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
    sEl.put({
      id: el.id, type: el.type, version: el.version, titre: el.titre,
      description: el.description || "", contenu: nouveaux.map((x) => x.id),
    });
    await finTx(tx);
    await charger();
  }

  async function supprimer(id) {
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

  // ---------- Photos importées depuis la tablette ou Google Photos ----------
  // Elles restent sur l'appareil, rangées dans l'élément local « mes-photos ».
  const MES_PHOTOS = "mes-photos";

  async function ajouterPhoto({ image, vignette, titre }) {
    const d = await db();
    const tx = d.transaction(["elements", "images"], "readwrite");
    const sEl = tx.objectStore("elements");
    const el = (await req(sEl.get(MES_PHOTOS))) || {
      id: MES_PHOTOS, type: "images", local: true, version: 0, titre: "Mes photos",
      description: "Photos ajoutées depuis la tablette ou Google Photos", contenu: [],
    };
    const id = "perso-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    tx.objectStore("images").put({ id, titre: titre || "", credit: null, vignette, image, variante: "perso", elements: [MES_PHOTOS] });
    el.contenu = [id, ...el.contenu]; // la plus récente en premier
    sEl.put(el);
    await finTx(tx);
    await charger();
    return id;
  }

  async function retirerPhoto(id) {
    const d = await db();
    const tx = d.transaction(["elements", "images"], "readwrite");
    const sEl = tx.objectStore("elements");
    const el = await req(sEl.get(MES_PHOTOS));
    tx.objectStore("images").delete(id);
    if (el) {
      el.contenu = el.contenu.filter((x) => x !== id);
      if (el.contenu.length) sEl.put(el); else sEl.delete(MES_PHOTOS);
    }
    await finTx(tx);
    await charger();
  }

  window.Bibliotheque = {
    charger, lireIndex, installer, supprimer, ajouterPhoto, retirerPhoto, varianteVoulue,
    get elements() { return etat.elements; },
    get photos() { return etat.photos; },
    get grilles() { return etat.grilles; },
    get motsCodes() { return etat.motsCodes; },
  };
})();
