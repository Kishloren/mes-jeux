// Portail, navigation et petits outils communs.
(function () {
  "use strict";

  const VERSION_APP = "17"; // à incrémenter avec VERSION dans sw.js

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

  function ecranListePZ() {
    vider();
    document.title = "Puzzle";
    const liste = photos();
    const cartes = liste.map((p) => {
      const e = window.Puzzle.etat(p);
      let badge = "";
      if (e.enCours) badge = `<span class="pz-badge encours">En cours</span>`;
      else if (e.reussites) badge = `<span class="pz-badge fini">✓ Réussi${e.reussites > 1 ? " ×" + e.reussites : ""}</span>`;
      return `<a class="pz-carte" href="#/puzzle/${encodeURIComponent(p.id)}">
          <img src="${p.mini}" alt="${echap(p.titre)}">${badge}
        </a>`;
    }).join("");
    const vide = `
        <div class="vide">
          <p>Aucune image pour l'instant.</p>
          <a class="btn btn-principal" href="#/bibliotheque">Choisir des images dans la Bibliothèque</a>
        </div>`;
    app.innerHTML = `
      <div class="page">
        <header class="barre">
          <a class="btn btn-retour" href="#/">← Accueil</a>
          <h1>Puzzle</h1>
        </header>
        ${liste.length ? `<p class="pz-consigne">Choisissez une image</p><div class="pz-cartes">${cartes}</div>
        <p class="vers-biblio">D'autres images sont disponibles dans la <a href="#/bibliotheque">Bibliothèque</a>.</p>` : vide}
      </div>`;
  }

  function ecranJeuPZ(id) {
    const p = photos().find((x) => x.id === id);
    if (!p) { location.hash = "#/puzzle"; return; }
    vider();
    document.title = "Puzzle";
    nettoyage = window.Puzzle.ouvrir(app, p, photos());
  }

  // ---------- Bibliothèque ----------
  const mo = (o) => (o >= 1e6 ? (o / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " Mo" : Math.max(1, Math.round(o / 1e3)) + " Ko");
  const SECTIONS = [
    { type: "images", titre: "Images pour le puzzle", unite: (n) => n + (n > 1 ? " images" : " image") },
    { type: "chasse-croise", titre: "Grilles de chassé-croisé", unite: (n) => n + (n > 1 ? " grilles" : " grille") },
  ];

  async function ecranBibliotheque() {
    vider();
    document.title = "Bibliothèque";
    app.innerHTML = `
      <div class="page">
        <header class="barre">
          <a class="btn btn-retour" href="#/">← Accueil</a>
          <h1>Bibliothèque</h1>
        </header>
        <p class="biblio-attente">Chargement…</p>
      </div>`;
    const ecran = app.firstElementChild;
    const { index, horsLigne } = await window.Bibliotheque.lireIndex();
    if (app.firstElementChild !== ecran) return; // l'utilisateur est parti entre-temps
    const installes = new Map(window.Bibliotheque.elements.map((e) => [e.id, e]));
    // Éléments du serveur, puis éléments installés qui n'y figurent plus.
    const connus = (index ? index.elements : []).filter((e) => SECTIONS.some((s) => s.type === e.type));
    const ids = new Set(connus.map((e) => e.id));
    const liste = [...connus, ...[...installes.values()].filter((e) => !ids.has(e.id))];
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
          : `<span class="biblio-etat ok">✓ Sur la tablette</span>`)
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
    else if (parts[0] === "puzzle" && parts[1]) ecranJeuPZ(parts[1]);
    else if (parts[0] === "puzzle") ecranListePZ();
    else if (parts[0] === "bibliotheque") ecranBibliotheque();
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
