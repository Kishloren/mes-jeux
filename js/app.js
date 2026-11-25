// Portail, navigation et petits outils communs.
(function () {
  "use strict";

  const VERSION_APP = "33"; // à incrémenter avec VERSION dans sw.js

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

  // Paramètres de l'appli. parametres() les lit ; parametres({ cle: valeur }) les modifie.
  const DEFAUTS = { clavier: "azerty", mmAffichage: "couleur" };
  function parametres(modif) {
    const p = Object.assign({}, DEFAUTS, Store.get("parametres", {}));
    if (modif) { Object.assign(p, modif); Store.set("parametres", p); }
    return p;
  }
  // Rangées du clavier des jeux (la troisième reçoit aussi les touches ◀ ▶ ⌫).
  const clavier = () => (parametres().clavier === "alpha"
    ? ["ABCDEFGHIJ", "KLMNOPQRST", "UVWXYZ"]
    : ["AZERTYUIOP", "QSDFGHJKLM", "WXCVBN"]);

  window.UI = { Store, toast, modal, echap, parametres, clavier };

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
  const photos = () => window.Bibliotheque.photos;

  // Portail : une petite tuile par jeu, dans la charte graphique de ses couvertures.
  function ecranPortail() {
    vider();
    document.title = "Mes jeux";
    const p = photos()[0];
    const carre = (n, plein) => Array.from({ length: n }, (_, i) => `<i${plein(i) ? ' class="plein"' : ""}></i>`).join("");
    const mosaique = p
      ? Array.from({ length: 12 }, (_, i) => `<i style="background-image:url('${p.mini}');background-position:${(i % 4) * 33.3}% ${Math.floor(i / 4) * 50}%"></i>`).join("")
      : Array.from({ length: 12 }, () => "<i></i>").join("");
    app.innerHTML = `
      <div class="page">
        <header class="entete-portail">
          <a class="btn-reglages" href="#/parametres" aria-label="Paramètres">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.6 7.6 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.6 7.6 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.6 7.6 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.6 7.6 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5A3.5 3.5 0 1 1 13 8.5a3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/></svg>
          </a>
          <h1>Mes jeux</h1>
          <p>Choisissez une activité</p>
        </header>
        <div class="tuiles">
          <a class="tuile t-carnet" href="#/chasse-croise">
            <span class="t-carte"><span class="t-nom">Chassé-<br>croisé</span><span class="t-cc">${carre(5, () => true)}</span></span>
          </a>
          <a class="tuile t-carnet" href="#/mots-codes">
            <span class="t-carte"><span class="t-nom t-serif">Mots<br>codés</span><span class="t-grille">${carre(16, (i) => i % 5 === 0)}</span></span>
          </a>
          <a class="tuile t-carnet" href="#/mot-mysterieux">
            <span class="t-carte"><span class="t-nom t-serif">Mot<br>mystérieux</span><span class="t-mm">${[..."MOTSLIRE"].map((l) => `<i>${l}</i>`).join("")}<b></b></span></span>
          </a>
          <a class="tuile t-alpha" href="#/alphamot">
            <span class="t-pastille">Alphamot</span>
            <span class="t-am"><i class="d">AEIST<br>T ↴</i><i>A</i><i>T</i><i>T</i><i>I</i><i class="d">**→</i><i>S</i></span>
          </a>
          <a class="tuile t-puzzle" href="#/puzzle">
            <span class="t-bandeau">Puzzle</span>
            <span class="t-mosaique">${mosaique}</span>
          </a>
        </div>
        <p class="version">version ${VERSION_APP}</p>
      </div>`;
  }

  // ---------- Paramètres ----------
  function ecranParametres() {
    vider();
    document.title = "Paramètres";
    const P = UI.parametres();
    const choix = (cle, options) => `<div class="choix" role="radiogroup">${options.map(([v, titre, apercu]) => `
          <button class="choix-opt${P[cle] === v ? " actif" : ""}" role="radio" aria-checked="${P[cle] === v}" data-cle="${cle}" data-v="${v}">
            <span class="choix-titre">${titre}</span>${apercu}
          </button>`).join("")}</div>`;
    const touches = (t) => `<span class="apercu-clavier">${[...t].map((l) => `<i>${l}</i>`).join("")}…</span>`;
    const mot = (classe) => `<span class="apercu-mm ${classe}"><span>P</span><span>A</span><span>N</span><span>I</span><span>E</span><span>R</span></span>`;
    app.innerHTML = `
      <div class="page">
        <header class="barre">
          <a class="btn btn-retour" href="#/">← Accueil</a>
          <h1>Paramètres</h1>
        </header>
        <div class="reglages">
          <section>
            <h2>Clavier des jeux</h2>
            <p>Pour le chassé-croisé, les mots codés et l'alphamot.</p>
            ${choix("clavier", [["azerty", "AZERTY", touches("AZERTY")], ["alpha", "Alphabétique", touches("ABCDEF")]])}
          </section>
          <section>
            <h2>Mot mystérieux : mots trouvés</h2>
            <p>Comment les mots trouvés sont marqués dans la grille.</p>
            ${choix("mmAffichage", [["couleur", "Surlignés en couleur", mot("couleur")], ["biffage", "Barrés d'un trait", mot("biffage")]])}
          </section>
        </div>
      </div>`;
    app.querySelector(".reglages").addEventListener("click", (e) => {
      const b = e.target.closest("[data-cle]");
      if (!b) return;
      UI.parametres({ [b.dataset.cle]: b.dataset.v });
      b.parentElement.querySelectorAll(".choix-opt").forEach((o) => {
        o.classList.toggle("actif", o === b);
        o.setAttribute("aria-checked", o === b);
      });
    });
  }

  // ---------- Accueil d'un jeu : les packs présents sur la tablette ----------
  // Tuiles de couverture (un tiers de la largeur), communes au Puzzle et aux jeux de grilles.
  // items : [{ href, titre, couverture (URL ou null), etat, fini, cle }]
  function tuilesPacks(items) {
    return items.map((it) => `<a class="pz-pack${it.fini ? " fini" : ""}" href="${it.href}" aria-label="${echap(it.titre)}">
          <span class="pz-pack-couv" data-couv="${echap(it.cle || "")}">${it.couverture
            ? `<img src="${it.couverture}" alt="">` : `<span class="pz-pack-sans">${echap(it.titre)}</span>`}</span>
          <span class="pz-pack-etat">${it.fini ? "✓ " : ""}${it.etat}</span>
        </a>`).join("");
  }

  function pageAccueilJeu({ titre, plus, consigne, items, vide }) {
    app.innerHTML = `
      <div class="page">
        <header class="barre">
          <a class="btn btn-retour" href="#/">← Accueil</a>
          <h1>${echap(titre)}</h1>
          <span class="espace"></span>
          <a class="btn btn-plus" href="${plus}" aria-label="Ajouter des packs">＋</a>
        </header>
        ${items.length ? `<p class="pz-consigne">${consigne}</p><div class="pz-packs">${tuilesPacks(items)}</div>`
          : `<div class="vide"><p>${vide}</p><a class="btn btn-principal" href="${plus}">＋ Ajouter des packs</a></div>`}
      </div>`;
  }

  // ---------- Jeux de grilles : chassé-croisé, mots codés ----------
  const JEUX = {
    "chasse-croise": {
      nom: "Chassé-croisé",
      motif: "cc",
      module: () => window.ChasseCroise,
      fini: (g) => window.ChasseCroise.progression(g).fini,
      carte(g, href) {
        const p = window.ChasseCroise.progression(g);
        let etat, classe = "";
        if (p.fini) { etat = "Terminée ✓"; classe = "finie"; }
        else if (p.remplies === 0) etat = "Pas encore commencée";
        else etat = `En cours : ${Math.round((100 * p.remplies) / p.total)} %`;
        const sous = p.fini && g.auteur ? `<span class="carte-sous">${echap(g.auteur)}${g.oeuvre ? ` — <i>${echap(g.oeuvre)}</i>` : ""}</span>` : "";
        return { html: `<a class="carte ${classe}" href="${href}">
            <span class="carte-nom">${echap(g.nom)}</span>
            <span class="carte-etat">${etat}</span>
            <span class="barre-prog"><span style="width:${(100 * p.remplies) / p.total}%"></span></span>
            ${sous}
          </a>`, entamee: p.remplies > 0 };
      },
      raz: "Toutes les lettres de cette grille seront effacées.",
    },
    "mots-codes": {
      nom: "Mots codés",
      motif: "mc",
      module: () => window.MotsCodes,
      fini: (g) => window.MotsCodes.progression(g).fini,
      carte(g, href) {
        const p = window.MotsCodes.progression(g);
        let etat, classe = "";
        if (p.fini) { etat = "Terminée ✓"; classe = "finie"; }
        else etat = `${p.trouves} lettres sur ${p.total}`;
        return { html: `<a class="carte ${classe}" href="${href}">
            <span class="carte-nom">${echap(g.nom)}</span>
            <span class="carte-etat">${etat}</span>
            <span class="barre-prog"><span style="width:${(100 * p.trouves) / p.total}%"></span></span>
          </a>`, entamee: p.fini || p.trouves > g.devoiles.length };
      },
      raz: "Toutes les lettres trouvées dans cette grille seront effacées.",
    },
    "mot-mysterieux": {
      nom: "Mot mystérieux",
      motif: "mm",
      module: () => window.MotMysterieux,
      fini: (g) => window.MotMysterieux.progression(g).fini,
      carte(g, href) {
        const p = window.MotMysterieux.progression(g);
        let etat, classe = "";
        if (p.fini) { etat = `Terminée ✓ — ${echap(g.mystere)}`; classe = "finie"; }
        else if (p.mots) etat = "Reste le mot mystérieux";
        else if (!p.trouves) etat = `${p.total} mots à trouver`;
        else etat = `${p.trouves} mots sur ${p.total}`;
        return { html: `<a class="carte ${classe}" href="${href}">
            <span class="carte-nom">${echap(g.nom)}</span>
            <span class="carte-etat">${etat}</span>
            <span class="barre-prog"><span style="width:${(100 * p.trouves) / p.total}%"></span></span>
          </a>`, entamee: p.trouves > 0 };
      },
      raz: "Tous les mots trouvés dans cette grille seront effacés.",
    },
    alphamot: {
      nom: "Alphamot",
      motif: "am",
      module: () => window.Alphamot,
      fini: (g) => window.Alphamot.progression(g).fini,
      carte(g, href) {
        const p = window.Alphamot.progression(g);
        let etat, classe = "";
        if (p.fini) { etat = "Terminée ✓"; classe = "finie"; }
        else if (!p.remplies) etat = "Pas encore commencée";
        else etat = `En cours : ${Math.round((100 * p.remplies) / p.total)} %`;
        return { html: `<a class="carte ${classe}" href="${href}">
            <span class="carte-nom">${echap(g.nom)}</span>
            <span class="carte-etat">${etat}</span>
            <span class="barre-prog"><span style="width:${(100 * p.remplies) / p.total}%"></span></span>
          </a>`, entamee: p.remplies > 0 };
      },
      raz: "Toutes les lettres de cette grille seront effacées.",
    },
  };
  const lienJeu = (type, ...ids) => "#/" + [type, ...ids.map(encodeURIComponent)].join("/");

  // Packs d'un jeu : les carnets téléchargés (l'appli n'embarque plus de grilles).
  function packsJeu(type) {
    return window.Bibliotheque.packs.filter((pk) => pk.type === type && !pk.archive && pk.grilles.length);
  }

  // Couvertures fabriquées par l'appli (carnet téléchargé sans couverture).
  const couvFabriquees = new Map();
  function completerCouvertures(type, liste) {
    liste.filter((pk) => !pk.couverture).forEach((pk) => {
      const cle = type + "|" + pk.id + "|" + pk.grilles.length;
      const poser = (url) => {
        const el = app.querySelector(`[data-couv="${CSS.escape(cle)}"]`);
        if (el && url) el.innerHTML = `<img src="${url}" alt="">`;
      };
      if (couvFabriquees.has(cle)) { couvFabriquees.get(cle).then(poser); return; }
      const pr = window.Couverture.carnet(JEUX[type].nom, pk.titre, pk.grilles.length, JEUX[type].motif)
        .then((b) => (b ? URL.createObjectURL(b) : null)).catch(() => null);
      couvFabriquees.set(cle, pr);
      pr.then(poser);
    });
  }

  function ecranAccueilJeu(type) {
    const J = JEUX[type];
    vider();
    document.title = J.nom;
    const liste = packsJeu(type);
    pageAccueilJeu({
      titre: J.nom,
      plus: "#/" + type + "-ajouter",
      consigne: "Choisissez un carnet",
      vide: "Aucune grille pour l'instant.",
      items: liste.map((pk) => {
        const n = pk.grilles.filter(J.fini).length, t = pk.grilles.length;
        return {
          href: lienJeu(type, pk.id), titre: pk.titre, couverture: pk.couverture, fini: n === t,
          cle: type + "|" + pk.id + "|" + t,
          etat: n ? `${n} sur ${t} terminée${n > 1 ? "s" : ""}` : `${t} grille${t > 1 ? "s" : ""}`,
        };
      }),
    });
    completerCouvertures(type, liste);
  }

  function ecranPackJeu(type, id) {
    const J = JEUX[type];
    const pk = packsJeu(type).find((x) => x.id === id);
    if (!pk) { location.hash = "#/" + type; return; }
    vider();
    document.title = pk.titre;
    const cartes = pk.grilles.map((g) => {
      const c = J.carte(g, lienJeu(type, pk.id, g.id));
      return `<div class="grille-bloc">${c.html}${c.entamee ? `<button class="grille-raz" data-raz="${echap(g.id)}" aria-label="Recommencer cette grille">↺</button>` : ""}</div>`;
    }).join("");
    app.innerHTML = `
      <div class="page">
        <header class="barre">
          <a class="btn btn-retour" href="#/${type}">← Carnets</a>
          <h1>${echap(pk.titre)}</h1>
        </header>
        <div class="grilles-carnet">${cartes}</div>
        ${pk.integre ? "" : `<p class="pz-pied"><button class="btn btn-discret" data-retirer-pack>Retirer ce carnet de la tablette</button></p>`}
      </div>`;
    app.querySelectorAll("[data-raz]").forEach((b) => b.addEventListener("click", () => {
      const g = pk.grilles.find((x) => x.id === b.dataset.raz);
      modal({
        titre: `Recommencer « ${echap(g.nom)} » ?`,
        html: `<p>${J.raz}</p>`,
        boutons: [
          { label: "Non, garder" },
          { label: "Oui, recommencer", classe: "btn-danger", action: () => { J.module().reinitialiser(g); ecranPackJeu(type, id); } },
        ],
      });
    }));
    const retirer = app.querySelector("[data-retirer-pack]");
    if (retirer) retirer.addEventListener("click", () => {
      modal({
        titre: `Retirer « ${echap(pk.titre)} » ?`,
        html: "<p>Ces grilles seront effacées de la tablette. Vous pourrez les télécharger à nouveau avec le bouton ＋.</p>",
        boutons: [
          { label: "Non, garder" },
          { label: "Oui, retirer", classe: "btn-danger", action: async () => {
            await window.Bibliotheque.supprimer(pk.id);
            location.hash = "#/" + type;
          } },
        ],
      });
    });
  }

  function ecranGrille(type, idPack, id) {
    const J = JEUX[type];
    const pk = packsJeu(type).find((x) => x.id === idPack);
    const g = pk && pk.grilles.find((x) => x.id === id);
    if (!g) { location.hash = pk ? lienJeu(type, idPack) : "#/" + type; return; }
    vider();
    document.title = J.nom + " — " + g.nom;
    nettoyage = J.module().ouvrir(app, g, lienJeu(type, idPack));
  }

  function ecranAjoutJeu(type) {
    ecranCatalogue({
      titre: "Ajouter des carnets",
      retour: ["#/" + type, "← Carnets"],
      sections: [{ type, titre: "Carnets à télécharger", unite: (n) => n + (n > 1 ? " grilles" : " grille") }],
      ouvrir: (el) => lienJeu(type, el.id),
      vide: "Aucun carnet disponible pour l'instant.",
    });
  }

  // ---------- Puzzle : packs d'images ----------
  const packs = () => window.Bibliotheque.packs.filter((pk) => pk.type === "images");
  const lienPack = (id) => "#/puzzle/" + encodeURIComponent(id);
  const reussies = (pk) => pk.photos.filter((ph) => window.Puzzle.etat(ph).reussites).length;

  // Accueil du Puzzle : les packs présents sur la tablette ; « + » pour en ajouter.
  function ecranAccueilPZ() {
    vider();
    document.title = "Puzzle";
    pageAccueilJeu({
      titre: "Puzzle",
      plus: "#/puzzle-ajouter",
      consigne: "Choisissez un pack d'images",
      vide: "Aucune image pour l'instant.",
      items: packs().filter((pk) => pk.photos.length && !pk.archive).map((pk) => {
        const n = reussies(pk), t = pk.photos.length;
        return {
          href: lienPack(pk.id), titre: pk.titre, couverture: pk.couverture, fini: n === t,
          etat: n ? `${n} sur ${t} réussi${n > 1 ? "s" : ""}` : `${t} image${t > 1 ? "s" : ""}`,
        };
      }),
    });
  }

  // Un pack : ses images. Pour « Mes images » : ajout et retrait de photos.
  function ecranPackPZ(id) {
    const pk = packs().find((x) => x.id === id);
    if (!pk || !pk.photos.length) { location.hash = "#/puzzle"; return; }
    // Pack archivé : consultable par son adresse, mais en lecture seule.
    vider();
    document.title = pk.titre;
    const cartes = pk.photos.map((ph) => {
      const e = window.Puzzle.etat(ph);
      let badge = "";
      if (e.enCours) badge = `<span class="pz-badge encours">En cours</span>`;
      else if (e.reussites) badge = `<span class="pz-badge fini">✓ Réussi${e.reussites > 1 ? " ×" + e.reussites : ""}</span>`;
      const retirer = pk.local && !pk.archive ? `<button class="pz-retirer" data-retirer="${echap(ph.id)}" aria-label="Retirer cette photo">✕</button>` : "";
      return `<div class="pz-bloc"><a class="pz-carte" href="${lienPack(pk.id)}/${encodeURIComponent(ph.id)}">
          <img src="${ph.mini}" alt="${echap(ph.titre)}">${badge}
        </a>${retirer}</div>`;
    }).join("");
    const ajout = pk.local && !pk.archive && pk.photos.length < 12
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
        ${pk.archive ? "" : `<p class="pz-pied"><button class="btn btn-discret" data-retirer-pack>${pk.local ? "Archiver ce pack" : "Retirer ce pack de la tablette"}</button></p>`}
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
    const btnRetirer = app.querySelector("[data-retirer-pack]");
    if (btnRetirer) btnRetirer.addEventListener("click", () => {
      modal({
        titre: pk.local ? `Archiver « ${echap(pk.titre)} » ?` : `Retirer « ${echap(pk.titre)} » ?`,
        html: pk.local
          ? "<p>Le pack n'apparaîtra plus dans le Puzzle, mais ses photos sont conservées sur la tablette.</p>"
          : "<p>Ces images seront effacées de la tablette. Vous pourrez les télécharger à nouveau avec le bouton ＋.</p>",
        boutons: [
          { label: "Non, garder" },
          { label: pk.local ? "Oui, archiver" : "Oui, retirer", classe: pk.local ? "btn-principal" : "btn-danger", action: async () => {
            if (pk.local) await window.Bibliotheque.archiver(pk.id); else await window.Bibliotheque.supprimer(pk.id);
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
  // Liste des contenus du serveur pour les types de `sections`, avec leur état sur la tablette.
  // `avant` : HTML affiché en tête ; `ouvrir(el)` : lien vers un contenu installé.
  async function ecranCatalogue({ titre, retour, sections, avant, ouvrir, vide }) {
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
        const maj = enLigne && !horsLigne && (el.version > inst.version || window.Bibliotheque.aRelire(inst));
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
        `<div class="biblio-contenu">${avis}${corps || `<p class="biblio-avis">${vide || "Rien à afficher pour l'instant."}</p>`}</div>`;
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
    const [ecran, a, b] = parts;
    if (JEUX[ecran] && b) ecranGrille(ecran, a, b);
    else if (JEUX[ecran] && a) ecranPackJeu(ecran, a);
    else if (JEUX[ecran]) ecranAccueilJeu(ecran);
    else if (ecran && ecran.endsWith("-ajouter") && JEUX[ecran.slice(0, -8)]) ecranAjoutJeu(ecran.slice(0, -8));
    else if (ecran === "puzzle" && b === "credits") ecranCreditsPZ(a);
    else if (ecran === "puzzle" && b) ecranJeuPZ(a, b);
    else if (ecran === "puzzle" && a) ecranPackPZ(a);
    else if (ecran === "puzzle") ecranAccueilPZ();
    else if (ecran === "puzzle-ajouter") ecranAjoutPZ();
    else if (ecran === "ajouter-photo") ecranAjoutPhoto(a || "");
    else if (ecran === "parametres") ecranParametres();
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
