// Portail, navigation et petits outils communs.
(function () {
  "use strict";

  const VERSION_APP = "24"; // à incrémenter avec VERSION dans sw.js

  const Store = {
    get(cle, defaut) {
      try {
        const v = localStorage.getItem(cle);
        return v == null ? defaut : JSON.parse(v);
      } catch (e) {
        return defaut;
      }
    },
    set(cle, valeur) {
      try {
        localStorage.setItem(cle, JSON.stringify(valeur));
      } catch (e) { /* stockage indisponible : on continue sans sauvegarde */ }
    },
    del(cle) {
      try { localStorage.removeItem(cle); } catch (e) { /* rien */ }
    },
  };

  let toastTimer = null;
  function toast(msg, duree) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("visible"), duree || 3500);
  }

  // Boîte de dialogue simple, gros boutons.
  function modal({ titre, html, boutons }) {
    const fond = document.createElement("div");
    fond.className = "modal-fond";
    const boite = document.createElement("div");
    boite.className = "modal";
    boite.innerHTML = (titre ? `<h2>${titre}</h2>` : "") + (html ? `<div class="modal-texte">${html}</div>` : "");
    const zone = document.createElement("div");
    zone.className = "modal-boutons";
    const fermer = () => fond.remove();
    (boutons || [{ label: "Fermer" }]).forEach((b) => {
      const btn = document.createElement("button");
      btn.className = "btn " + (b.classe || "");
      btn.textContent = b.label;
      btn.addEventListener("click", () => {
        fermer();
        if (b.action) b.action();
      });
      zone.appendChild(btn);
    });
    boite.appendChild(zone);
    fond.appendChild(boite);
    fond.addEventListener("click", (e) => { if (e.target === fond) fermer(); });
    document.body.appendChild(fond);
    return fermer;
  }

  function echap(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  window.UI = { Store, toast, modal, echap };

  // ---------- Écrans ----------
  const app = document.getElementById("app");
  let nettoyage = null;

  function vider() {
    if (nettoyage) { nettoyage(); nettoyage = null; }
    document.querySelectorAll(".modal-fond").forEach((m) => m.remove());
    document.getElementById("toast").classList.remove("visible");
    app.innerHTML = "";
  }

  // Toutes les grilles : celles livrées avec l'appli puis celles de la Bibliothèque.
  const grilles = () => [...window.CC_GRILLES, ...window.Bibliotheque.grilles];
  const photos = () => window.Bibliotheque.photos;
  const grillesMC = () => [...window.MC_GRILLES, ...window.Bibliotheque.motsCodes];

  function ecranPortail() {
    vider();
    document.title = "Mes jeux";
    const p = photos()[0];
    const icPuzzle = p
      ? [0, 1, 2, 3].map((i) => `<span style="background-image:url('${p.mini}');background-position:${-(i % 2) * 58}px ${-Math.floor(i / 2) * 58 - 29}px"></span>`).join("")
      : "<span></span><span></span><span></span><span></span>";
    app.innerHTML = `
      <div class="page">
        <header class="entete-portail">
          <h1>Mes jeux</h1>
          <p>Choisissez une activité</p>
        </header>
        <div class="tuiles">
          <a class="tuile" href="#/chasse-croise">
            <span class="tuile-icone" aria-hidden="true">
              <span>C</span><span>H</span><span>A</span><span>S</span>
            </span>
            <span class="tuile-nom">Chassé-croisé</span>
          </a>
          <a class="tuile" href="#/mots-codes">
            <span class="tuile-icone tuile-mc" aria-hidden="true">
              <span><small>7</small>M</span><span><small>3</small>O</span><span><small>12</small>T</span><span><small>9</small>S</span>
            </span>
            <span class="tuile-nom">Mots codés</span>
          </a>
          <a class="tuile" href="#/puzzle">
            <span class="tuile-icone ${p ? "tuile-puzzle" : ""}" aria-hidden="true">${icPuzzle}</span>
            <span class="tuile-nom">Puzzle</span>
          </a>
          <a class="tuile tuile-biblio" href="#/bibliotheque">
            <span class="tuile-livres" aria-hidden="true"><span></span><span></span><span></span><span></span></span>
            <span class="tuile-nom">Bibliothèque</span>
          </a>
        </div>
        <p class="version">version ${VERSION_APP}</p>
      </div>`;
  }

  function ecranListeCC() {
    vider();
    document.title = "Chassé-croisé";
    const carte = (g) => {
      const p = window.ChasseCroise.progression(g);
      let etat, classe = "";
      if (p.fini) { etat = "Terminée ✓"; classe = "finie"; }
      else if (p.remplies === 0) etat = "Pas encore commencée";
      else etat = `En cours : ${Math.round((100 * p.remplies) / p.total)} %`;
      const sous = p.fini ? `<span class="carte-sous">${echap(g.auteur)} — <i>${echap(g.oeuvre)}</i></span>` : "";
      const raz = p.remplies ? `<button class="btn btn-raz" data-raz="${echap(g.id)}">↺ Recommencer cette grille</button>` : "";
      return `
        <div class="carte-bloc">
          <a class="carte ${classe}" href="#/chasse-croise/${encodeURIComponent(g.id)}">
            <span class="carte-nom">${echap(g.nom)}</span>
            <span class="carte-etat">${etat}</span>
            <span class="barre-prog"><span style="width:${(100 * p.remplies) / p.total}%"></span></span>
            ${sous}
          </a>
          ${raz}
        </div>`;
    };
    // Regroupement par carnet, dans l'ordre d'apparition.
    const carnets = new Map();
    grilles().forEach((g) => {
      const c = g.carnet || "Grilles";
      if (!carnets.has(c)) carnets.set(c, []);
      carnets.get(c).push(g);
    });
    const sections = [...carnets].map(([nom, gs]) => `
        <h2 class="section-titre">${echap(nom)}</h2>
        <div class="cartes">${gs.map(carte).join("")}</div>`).join("");
    app.innerHTML = `
      <div class="page">
        <header class="barre">
          <a class="btn btn-retour" href="#/">← Accueil</a>
          <h1>Chassé-croisé</h1>
        </header>
        ${sections}
        <p class="vers-biblio">D'autres grilles sont disponibles dans la <a href="#/bibliotheque">Bibliothèque</a>.</p>
      </div>`;
    app.querySelectorAll("[data-raz]").forEach((b) => b.addEventListener("click", () => {
      const g = grilles().find((x) => x.id === b.dataset.raz);
      modal({
        titre: `Recommencer « ${echap(g.nom)} » ?`,
        html: "<p>Toutes les lettres de cette grille seront effacées.</p>",
        boutons: [
          { label: "Non, garder" },
          { label: "Oui, recommencer", classe: "btn-danger", action: () => { window.ChasseCroise.reinitialiser(g); ecranListeCC(); } },
        ],
      });
    }));
  }

  function ecranJeuCC(id) {
    const g = grilles().find((x) => x.id === id);
    if (!g) { location.hash = "#/chasse-croise"; return; }
    vider();
    document.title = "Chassé-croisé — " + g.nom;
    nettoyage = window.ChasseCroise.ouvrir(app, g);
  }

  function ecranListeMC() {
    vider();
    document.title = "Mots codés";
    const carte = (g) => {
      const p = window.MotsCodes.progression(g);
      let etat, classe = "";
      if (p.fini) { etat = "Terminée ✓"; classe = "finie"; }
      else etat = `${p.trouves} lettres sur ${p.total}`;
      const raz = p.fini || p.trouves > g.devoiles.length
        ? `<button class="btn btn-raz" data-raz="${echap(g.id)}">↺ Recommencer cette grille</button>` : "";
      return `
        <div class="carte-bloc">
          <a class="carte ${classe}" href="#/mots-codes/${encodeURIComponent(g.id)}">
            <span class="carte-nom">${echap(g.nom)}</span>
            <span class="carte-etat">${etat}</span>
            <span class="barre-prog"><span style="width:${(100 * p.trouves) / p.total}%"></span></span>
          </a>
          ${raz}
        </div>`;
    };
    const carnets = new Map();
    grillesMC().forEach((g) => {
      const c = g.carnet || "Grilles";
      if (!carnets.has(c)) carnets.set(c, []);
      carnets.get(c).push(g);
    });
    const sections = [...carnets].map(([nom, gs]) => `
        <h2 class="section-titre">${echap(nom)}</h2>
        <div class="cartes">${gs.map(carte).join("")}</div>`).join("");
    app.innerHTML = `
      <div class="page">
        <header class="barre">
          <a class="btn btn-retour" href="#/">← Accueil</a>
          <h1>Mots codés</h1>
        </header>
        ${sections}
        <p class="vers-biblio">D'autres grilles sont disponibles dans la <a href="#/bibliotheque">Bibliothèque</a>.</p>
      </div>`;
    app.querySelectorAll("[data-raz]").forEach((b) => b.addEventListener("click", () => {
      const g = grillesMC().find((x) => x.id === b.dataset.raz);
      modal({
        titre: `Recommencer « ${echap(g.nom)} » ?`,
        html: "<p>Toutes les lettres trouvées dans cette grille seront effacées.</p>",
        boutons: [
          { label: "Non, garder" },
          { label: "Oui, recommencer", classe: "btn-danger", action: () => { window.MotsCodes.reinitialiser(g); ecranListeMC(); } },
        ],
      });
    }));
  }

  function ecranJeuMC(id) {
    const g = grillesMC().find((x) => x.id === id);
    if (!g) { location.hash = "#/mots-codes"; return; }
    vider();
    document.title = "Mots codés — " + g.nom;
    nettoyage = window.MotsCodes.ouvrir(app, g);
  }

  // ---------- Puzzle : packs d'images ----------
  const packs = () => window.Bibliotheque.packs;
  const lienPack = (id) => "#/puzzle/" + encodeURIComponent(id);
  const reussies = (pk) => pk.photos.filter((ph) => window.Puzzle.etat(ph).reussites).length;

  // Accueil du Puzzle : les packs présents sur la tablette ; « + » pour en ajouter.
  function ecranAccueilPZ() {
    vider();
    document.title = "Puzzle";
    const liste = packs().filter((pk) => pk.photos.length);
    const cartes = liste.map((pk) => {
      const n = reussies(pk);
      const etat = n ? `${n} sur ${pk.photos.length} réussi${n > 1 ? "s" : ""}` : `${pk.photos.length} image${pk.photos.length > 1 ? "s" : ""}`;
      const img = pk.couverture
        ? `<img src="${pk.couverture}" alt="">`
        : `<span class="pz-pack-sans">${echap(pk.titre)}</span>`;
      return `<a class="pz-pack${n === pk.photos.length ? " fini" : ""}" href="${lienPack(pk.id)}" aria-label="${echap(pk.titre)}">
          <span class="pz-pack-couv">${img}</span>
          <span class="pz-pack-etat">${n === pk.photos.length ? "✓ " : ""}${etat}</span>
        </a>`;
    }).join("");
    const vide = `
        <div class="vide">
          <p>Aucune image pour l'instant.</p>
          <a class="btn btn-principal" href="#/puzzle-ajouter">＋ Ajouter des images</a>
        </div>`;
    app.innerHTML = `
      <div class="page">
        <header class="barre">
          <a class="btn btn-retour" href="#/">← Accueil</a>
          <h1>Puzzle</h1>
          <span class="espace"></span>
          <a class="btn btn-plus" href="#/puzzle-ajouter" aria-label="Ajouter des images">＋</a>
        </header>
        ${liste.length ? `<p class="pz-consigne">Choisissez un pack d'images</p><div class="pz-packs">${cartes}</div>` : vide}
      </div>`;
  }

  // Un pack : ses images. Pour « Mes images » : ajout et retrait de photos.
  function ecranPackPZ(id) {
    const pk = packs().find((x) => x.id === id);
    if (!pk || !pk.photos.length) { location.hash = "#/puzzle"; return; }
    vider();
    document.title = pk.titre;
    const cartes = pk.photos.map((ph) => {
      const e = window.Puzzle.etat(ph);
      let badge = "";
      if (e.enCours) badge = `<span class="pz-badge encours">En cours</span>`;
      else if (e.reussites) badge = `<span class="pz-badge fini">✓ Réussi${e.reussites > 1 ? " ×" + e.reussites : ""}</span>`;
      const retirer = pk.local ? `<button class="pz-retirer" data-retirer="${echap(ph.id)}" aria-label="Retirer cette photo">✕</button>` : "";
      return `<div class="pz-bloc"><a class="pz-carte" href="${lienPack(pk.id)}/${encodeURIComponent(ph.id)}">
          <img src="${ph.mini}" alt="${echap(ph.titre)}">${badge}
        </a>${retirer}</div>`;
    }).join("");
    const ajout = pk.local && pk.photos.length < 12
      ? `<div class="pz-bloc"><a class="pz-carte pz-ajout" href="#/ajouter-photo/${encodeURIComponent(pk.id)}"><span>＋</span>Ajouter des photos</a></div>` : "";
    const credits = pk.photos.some((ph) => ph.credit);
    app.innerHTML = `
      <div class="page">
        <header class="barre">
          <a class="btn btn-retour" href="#/puzzle">← Packs</a>
          <h1>${echap(pk.titre)}</h1>
          <span class="espace"></span>
          ${credits ? `<a class="btn" href="${lienPack(pk.id)}/credits">Crédits</a>` : ""}
        </header>
        <p class="pz-consigne">Choisissez une image</p>
        <div class="pz-cartes">${cartes}${ajout}</div>
        <p class="pz-pied"><button class="btn btn-discret" data-retirer-pack>${pk.local ? "Supprimer ce pack" : "Retirer ce pack de la tablette"}</button></p>
      </div>`;
    app.querySelectorAll("[data-retirer]").forEach((b) => b.addEventListener("click", () => {
      modal({
        titre: "Retirer cette photo ?",
        html: "<p>Elle sera effacée de l'appli. La photo d'origine n'est pas touchée.</p>",
        boutons: [
          { label: "Non, garder" },
          { label: "Oui, retirer", classe: "btn-danger", action: async () => {
            await window.Bibliotheque.retirerPhoto(b.dataset.retirer);
            if (location.hash === lienPack(pk.id)) ecranPackPZ(pk.id);
          } },
        ],
      });
    }));
    app.querySelector("[data-retirer-pack]").addEventListener("click", () => {
      modal({
        titre: pk.local ? `Supprimer « ${echap(pk.titre)} » ?` : `Retirer « ${echap(pk.titre)} » ?`,
        html: pk.local
          ? "<p>Les photos de ce pack seront effacées de l'appli. Les photos d'origine ne sont pas touchées.</p>"
          : "<p>Ces images seront effacées de la tablette. Vous pourrez les télécharger à nouveau avec le bouton ＋.</p>",
        boutons: [
          { label: "Non, garder" },
          { label: pk.local ? "Oui, supprimer" : "Oui, retirer", classe: "btn-danger", action: async () => {
            await window.Bibliotheque.supprimer(pk.id);
            location.hash = "#/puzzle";
          } },
        ],
      });
    });
  }

  // Crédits des images d'un pack (obligatoires pour les licences CC BY).
  function ecranCreditsPZ(id) {
    const pk = packs().find((x) => x.id === id);
    if (!pk) { location.hash = "#/puzzle"; return; }
    vider();
    document.title = "Crédits — " + pk.titre;
    const lien = (url, texte) => (/^https:\/\//.test(url || "") ? `<a href="${echap(url)}" target="_blank" rel="noopener">${echap(texte)}</a>` : echap(texte));
    const lignes = pk.photos.map((ph) => {
      const c = ph.credit || {};
      return `
        <li class="credit">
          <img src="${ph.mini}" alt="">
          <div>
            ${ph.titre ? `<span class="credit-titre">${echap(ph.titre)}</span>` : ""}
            <span>Auteur : ${echap(c.auteur || "inconnu")}</span>
            ${c.licence ? `<span>Licence : ${lien(c.licence_url, c.licence)}</span>` : ""}
            ${c.source ? `<span>${lien(c.source, "Voir l'original")}</span>` : ""}
          </div>
        </li>`;
    }).join("");
    app.innerHTML = `
      <div class="page">
        <header class="barre">
          <a class="btn btn-retour" href="${lienPack(pk.id)}">← ${echap(pk.titre)}</a>
          <h1>Crédits</h1>
        </header>
        <ul class="credits">${lignes}</ul>
        <p class="vers-biblio">Liste complète : <a href="https://www.stansgames.fr/jeux-tablette/credits" target="_blank" rel="noopener">stansgames.fr/jeux-tablette/credits</a></p>
      </div>`;
  }

  // « + » : packs à télécharger, et création d'un pack avec ses photos.
  function ecranAjoutPZ() {
    ecranCatalogue({
      titre: "Ajouter des images",
      retour: ["#/puzzle", "← Packs"],
      sections: [{ type: "images", titre: "Packs à télécharger", unite: (n) => n + (n > 1 ? " images" : " image") }],
      avant: `
        <h2 class="section-titre">Mes photos</h2>
        <a class="biblio-carte pz-mes-photos" href="#/ajouter-photo">
          <div class="biblio-vignette"><span>＋</span></div>
          <div class="biblio-corps">
            <span class="biblio-titre">Créer un pack avec mes photos</span>
            <span class="biblio-desc">Depuis les photos de la tablette${window.GooglePhotos.disponible ? " ou Google Photos" : ""}. Elles sont rangées par 12 dans «&nbsp;Mes&nbsp;images&nbsp;».</span>
          </div>
        </a>`,
      ouvrir: (el) => lienPack(el.id),
    });
  }

  // ---------- Ajout d'une photo personnelle ----------
  // Source : Google Photos ou les photos de la tablette ; puis recadrage au format du puzzle (2:3).
  // La photo est réencodée : ses métadonnées (lieu, appareil, date) ne sont pas conservées.
  // cible : pack « Mes images » à compléter en priorité (facultatif).
  let packCible = null;
  function ecranAjoutPhoto(cible) {
    if (cible !== undefined) packCible = cible || null;
    vider();
    document.title = "Ajouter une photo";
    const gp = window.GooglePhotos.disponible;
    app.innerHTML = `
      <div class="page">
        <header class="barre">
          <a class="btn btn-retour" href="${packCible ? lienPack(packCible) : "#/puzzle-ajouter"}">← Retour</a>
          <h1>Mes photos</h1>
        </header>
        <div class="ajout">
          <p class="ajout-texte">Où se trouvent les photos ?</p>
          <p class="ajout-note">Vous pouvez en choisir plusieurs à la fois.</p>
          ${gp ? `<button class="btn btn-principal ajout-source" data-src="google">Google Photos</button>` : ""}
          <button class="btn ${gp ? "" : "btn-principal "}ajout-source" data-src="tablette">Photos de la tablette</button>
          <input type="file" accept="image/*" multiple hidden>
          <div class="ajout-etat"></div>
          <p class="ajout-note">Les photos restent sur cette tablette : elles ne sont envoyées nulle part.</p>
        </div>
      </div>`;
    const ecran = app.firstElementChild;
    const etat = ecran.querySelector(".ajout-etat");
    const fichier = ecran.querySelector("input[type=file]");
    const ici = () => app.firstElementChild === ecran;
    let abandon = false;
    nettoyage = () => { abandon = true; };
    if (gp) window.GooglePhotos.preparer();

    fichier.addEventListener("change", () => {
      const liste = [...fichier.files];
      if (liste.length) { etat.innerHTML = `<p>Ouverture des photos…</p>`; recadrerSuite(liste, 0, 0); }
    });
    ecran.querySelectorAll("[data-src]").forEach((b) => b.addEventListener("click", async () => {
      if (b.dataset.src === "tablette") { fichier.value = ""; fichier.click(); return; }
      abandon = false;
      etat.innerHTML = `<p>Connexion à Google…</p>`;
      try {
        const blobs = await window.GooglePhotos.choisirPhotos({
          pret: (url) => {
            if (!ici()) return;
            etat.innerHTML = `
              <p>Touchez « Ouvrir Google Photos », choisissez une ou plusieurs photos, puis revenez ici.</p>
              <a class="btn btn-principal" href="${echap(url)}" target="_blank" rel="noopener">Ouvrir Google Photos</a>
              <button class="btn btn-discret" data-annuler>Annuler</button>`;
            etat.querySelector("[data-annuler]").addEventListener("click", () => { abandon = true; etat.innerHTML = ""; });
          },
          telechargement: (fait, total) => { if (ici()) etat.innerHTML = `<p>Téléchargement des photos… ${fait} sur ${total}</p>`; },
          annule: () => abandon || !ici(),
        });
        if (!ici()) return;
        if (!blobs || !blobs.length) { etat.innerHTML = ""; return; }
        recadrerSuite(blobs, 0, 0);
      } catch (e) {
        if (!ici()) return;
        etat.innerHTML = "";
        toast("Google Photos n'a pas répondu. Vérifiez la connexion et réessayez.", 5000);
      }
    }));
  }

  async function ouvrirPhoto(blob) {
    try {
      let bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
      // Les très grandes photos sont réduites (mémoire de la tablette).
      const k = 3000 / Math.max(bmp.width, bmp.height);
      if (k < 1) {
        const petit = await createImageBitmap(bmp, { resizeWidth: Math.round(bmp.width * k), resizeHeight: Math.round(bmp.height * k), resizeQuality: "high" });
        bmp.close();
        bmp = petit;
      }
      return bmp;
    } catch (e) {
      return null;
    }
  }

  // Recadre les photos choisies l'une après l'autre (on peut en choisir plusieurs d'un coup,
  // pour ne pas revenir sans cesse dans la galerie). `ajoutees` : photos déjà enregistrées.
  // Le recadrage s'affiche sans changer d'adresse.
  let dernierPack = null;
  async function recadrerSuite(liste, i, ajoutees) {
    if (i >= liste.length) {
      if (ajoutees) {
        toast(ajoutees > 1 ? `${ajoutees} photos ajoutées.` : "Photo ajoutée.");
        location.hash = dernierPack ? lienPack(dernierPack) : "#/puzzle";
      } else ecranAjoutPhoto();
      return;
    }
    const avant = app.firstElementChild;
    const bmp = await ouvrirPhoto(liste[i]);
    if (app.firstElementChild !== avant) { if (bmp) bmp.close(); return; } // l'utilisateur est parti
    if (!bmp) {
      toast("Une photo n'a pas pu être ouverte.", 4000);
      recadrerSuite(liste, i + 1, ajoutees);
      return;
    }
    vider();
    const plusieurs = liste.length > 1;
    document.title = "Recadrer la photo";
    const fin = window.Recadrage.ouvrir(app, bmp, {
      ratio: 2 / 3,
      titre: plusieurs ? `Photo ${i + 1} sur ${liste.length}` : "Recadrer",
      annuler: plusieurs ? "Passer" : "Annuler",
      surAnnuler: () => recadrerSuite(liste, i + 1, ajoutees),
      surValider: async (rect) => {
        let ok = false;
        try {
          const cible = window.Bibliotheque.varianteVoulue({ standard: { largeur: 1000 } }) === "standard" ? 1000 : 1600;
          const l = Math.max(640, Math.min(cible, rect.w));
          const image = await encoder(bmp, rect, l, Math.round(l * 1.5), 0.86);
          const vignette = await encoder(bmp, rect, 320, 480, 0.8);
          dernierPack = await window.Bibliotheque.ajouterPhoto({ image, vignette, pack: packCible });
          ok = true;
        } catch (e) {
          toast("La photo n'a pas pu être enregistrée.", 5000);
        }
        recadrerSuite(liste, i + 1, ajoutees + (ok ? 1 : 0));
      },
    });
    nettoyage = () => { fin(); bmp.close(); };
  }

  function encoder(source, r, l, h, qualite) {
    const c = document.createElement("canvas");
    c.width = l; c.height = h;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, r.x, r.y, r.w, r.h, 0, 0, l, h);
    const vers = (type) => new Promise((ok) => c.toBlob(ok, type, qualite));
    return vers("image/webp").then((b) => (b && b.type === "image/webp" ? b : vers("image/jpeg")))
      .then((b) => { if (!b) throw new Error("encodage"); return b; });
  }

  function ecranJeuPZ(idPack, id) {
    const pk = packs().find((x) => x.id === idPack);
    const p = pk && pk.photos.find((x) => x.id === id);
    if (!p) { location.hash = pk ? lienPack(idPack) : "#/puzzle"; return; }
    vider();
    document.title = "Puzzle";
    nettoyage = window.Puzzle.ouvrir(app, p, pk.photos, lienPack(idPack));
  }

  // ---------- Bibliothèque ----------
  const mo = (o) => (o >= 1e6 ? (o / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " Mo" : Math.max(1, Math.round(o / 1e3)) + " Ko");
  // La Bibliothèque ne propose plus que les grilles : les images s'ajoutent depuis le Puzzle.
  const SECTIONS = [
    { type: "chasse-croise", titre: "Grilles de chassé-croisé", unite: (n) => n + (n > 1 ? " grilles" : " grille") },
    { type: "mots-codes", titre: "Grilles de mots codés", unite: (n) => n + (n > 1 ? " grilles" : " grille") },
  ];

  function ecranBibliotheque() {
    ecranCatalogue({ titre: "Bibliothèque", retour: ["#/", "← Accueil"], sections: SECTIONS });
  }

  // Liste des contenus du serveur pour les types de `sections`, avec leur état sur la tablette.
  // `avant` : HTML affiché en tête ; `ouvrir(el)` : lien vers un contenu installé.
  async function ecranCatalogue({ titre, retour, sections, avant, ouvrir }) {
    const SECTIONS = sections;
    vider();
    document.title = titre;
    app.innerHTML = `
      <div class="page">
        <header class="barre">
          <a class="btn btn-retour" href="${retour[0]}">${retour[1]}</a>
          <h1>${echap(titre)}</h1>
        </header>
        ${avant || ""}
        <p class="biblio-attente">Chargement…</p>
      </div>`;
    const ecran = app.firstElementChild;
    const { index, horsLigne } = await window.Bibliotheque.lireIndex();
    if (app.firstElementChild !== ecran) return; // l'utilisateur est parti entre-temps
    const installes = new Map(window.Bibliotheque.elements.map((e) => [e.id, e]));
    // Éléments du serveur, puis éléments installés qui n'y figurent plus.
    const connus = (index ? index.elements : []).filter((e) => SECTIONS.some((s) => s.type === e.type));
    const ids = new Set(connus.map((e) => e.id));
    const liste = [...connus, ...[...installes.values()].filter((e) => !ids.has(e.id) && !e.local && SECTIONS.some((s) => s.type === e.type))];
    const enCours = new Set();

    const carte = (el, sec) => {
      const inst = installes.get(el.id);
      const enLigne = ids.has(el.id);
      const octets = el.octets ? (el.type === "images" ? (el.octets.grande || el.octets.standard) : el.octets.total) : 0;
      const infos = [sec.unite(el.nombre || (inst ? inst.contenu.length : 0))];
      if (octets && !inst) infos.push(mo(octets));
      let actions;
      if (enCours.has(el.id)) {
        actions = `<div class="biblio-prog"><span style="width:0%"></span></div><span class="biblio-etat">Téléchargement…</span>`;
      } else if (!inst) {
        actions = enLigne && !horsLigne
          ? `<button class="btn btn-principal" data-act="installer" data-id="${echap(el.id)}">Télécharger</button>`
          : `<span class="biblio-etat">Indisponible hors connexion</span>`;
      } else {
        const maj = enLigne && !horsLigne && el.version > inst.version;
        actions = (maj ? `<button class="btn btn-principal" data-act="installer" data-id="${echap(el.id)}">Mettre à jour</button>`
          : (ouvrir ? `<a class="btn btn-principal" href="${ouvrir(el)}">Ouvrir</a>` : `<span class="biblio-etat ok">✓ Sur la tablette</span>`))
          + `<button class="btn btn-discret" data-act="supprimer" data-id="${echap(el.id)}">Retirer</button>`;
      }
      const vignette = el.vignette && !horsLigne ? `<img src="${echap(el.vignette)}" alt="" loading="lazy">` : "";
      return `
        <div class="biblio-carte${inst ? " installe" : ""}" data-carte="${echap(el.id)}">
          <div class="biblio-vignette">${vignette}</div>
          <div class="biblio-corps">
            <span class="biblio-titre">${echap(el.titre)}</span>
            ${el.description ? `<span class="biblio-desc">${echap(el.description)}</span>` : ""}
            <span class="biblio-infos">${infos.join(" · ")}</span>
            <div class="biblio-actions">${actions}</div>
          </div>
        </div>`;
    };

    const rendre = () => {
      const corps = SECTIONS.map((sec) => {
        const els = liste.filter((e) => e.type === sec.type);
        if (!els.length) return "";
        return `<h2 class="section-titre">${sec.titre}</h2><div class="biblio-liste">${els.map((e) => carte(e, sec)).join("")}</div>`;
      }).join("");
      const avis = horsLigne
        ? `<p class="biblio-avis">Pas de connexion à Internet : seuls les contenus déjà sur la tablette sont affichés.</p>` : "";
      ecran.querySelector(".biblio-attente, .biblio-contenu").outerHTML =
        `<div class="biblio-contenu">${avis}${corps || `<p class="biblio-avis">Rien à afficher pour l'instant.</p>`}</div>`;
    };
    rendre();

    ecran.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      const el = liste.find((x) => x.id === b.dataset.id);
      if (b.dataset.act === "supprimer") {
        modal({
          titre: `Retirer « ${echap(el.titre)} » ?`,
          html: "<p>Ces contenus seront effacés de la tablette. Vous pourrez les télécharger à nouveau plus tard.</p>",
          boutons: [
            { label: "Non, garder" },
            { label: "Oui, retirer", classe: "btn-danger", action: async () => {
              await window.Bibliotheque.supprimer(el.id);
              installes.delete(el.id);
              if (app.firstElementChild === ecran) rendre();
            } },
          ],
        });
        return;
      }
      enCours.add(el.id);
      rendre();
      try {
        await window.Bibliotheque.installer(el, (fait, total) => {
          const barre = ecran.querySelector(`[data-carte="${CSS.escape(el.id)}"] .biblio-prog span`);
          if (barre) barre.style.width = Math.round((100 * fait) / total) + "%";
        });
        installes.set(el.id, window.Bibliotheque.elements.find((x) => x.id === el.id));
        toast(`« ${el.titre} » est sur la tablette.`);
      } catch (err) {
        toast("Le téléchargement n'a pas abouti. Vérifiez la connexion et réessayez.", 5000);
      }
      enCours.delete(el.id);
      if (app.firstElementChild === ecran) rendre();
    });
  }

  function route() {
    const h = location.hash.replace(/^#\/?/, "");
    const parts = h.split("/").filter(Boolean).map(decodeURIComponent);
    if (parts[0] === "chasse-croise" && parts[1]) ecranJeuCC(parts[1]);
    else if (parts[0] === "chasse-croise") ecranListeCC();
    else if (parts[0] === "puzzle" && parts[2] === "credits") ecranCreditsPZ(parts[1]);
    else if (parts[0] === "puzzle" && parts[2]) ecranJeuPZ(parts[1], parts[2]);
    else if (parts[0] === "puzzle" && parts[1]) ecranPackPZ(parts[1]);
    else if (parts[0] === "puzzle") ecranAccueilPZ();
    else if (parts[0] === "puzzle-ajouter") ecranAjoutPZ();
    else if (parts[0] === "mots-codes" && parts[1]) ecranJeuMC(parts[1]);
    else if (parts[0] === "mots-codes") ecranListeMC();
    else if (parts[0] === "bibliotheque") ecranBibliotheque();
    else if (parts[0] === "ajouter-photo") ecranAjoutPhoto(parts[1] || "");
    else ecranPortail();
    window.scrollTo(0, 0);
  }

  // Nouveau départ (version 17) : on efface les données des versions précédentes.
  if (Store.get("schema", 0) < 2) {
    try { localStorage.clear(); } catch (e) { /* rien */ }
    Store.set("schema", 2);
  }

  window.addEventListener("hashchange", route);
  window.Bibliotheque.charger()
    .catch(() => {}) // stockage indisponible : l'appli fonctionne avec ses grilles intégrées
    .then(route);

  // Pas de zoom par pincement (la taille du texte se règle dans les jeux).
  document.addEventListener("touchmove", (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  document.addEventListener("gesturestart", (e) => e.preventDefault());

  // Toujours en portrait : le manifeste le demande à l'appli installée ; on insiste
  // ici (accepté en plein écran), sans effet ni erreur si le navigateur refuse.
  function verrouillerPortrait() {
    try {
      const p = screen.orientation && screen.orientation.lock && screen.orientation.lock("portrait");
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* non pris en charge */ }
  }
  verrouillerPortrait();
  document.addEventListener("fullscreenchange", verrouillerPortrait);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") verrouillerPortrait();
  });

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    // Quand une nouvelle version prend la main, on recharge une fois pour l'afficher.
    const avaitUnControleur = !!navigator.serviceWorker.controller;
    let recharge = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!avaitUnControleur || recharge) return;
      recharge = true;
      location.reload();
    });
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" })
      .then((reg) => {
        reg.update();
        // Vérifie aussi quand l'appli revient au premier plan.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") reg.update();
        });
      })
      .catch(() => {});
  }
})();
