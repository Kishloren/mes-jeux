// Choix d'une photo dans Google Photos (API « Picker » de Google Photos).
// Tout se passe dans le navigateur : connexion Google (Google Identity Services),
// session de choix, ouverture de Google Photos, puis téléchargement de la photo choisie.
// Mise en place (une fois) : voir docs/google-photos.md.
(function () {
  "use strict";

  // Identifiant client OAuth (type « Application Web ») du projet Google Cloud.
  // Vide tant que le projet n'est pas créé : le bouton Google Photos est alors masqué.
  const CLIENT_ID = "";
  const PORTEE = "https://www.googleapis.com/auth/photospicker.mediaitems.readonly";
  const API = "https://photospicker.googleapis.com/v1";

  let jeton = null; // { valeur, expire }
  let gisPromesse = null;

  function chargerGIS() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (!gisPromesse) {
      gisPromesse = new Promise((ok, ko) => {
        const s = document.createElement("script");
        s.src = "https://accounts.google.com/gsi/client";
        s.async = true;
        s.onload = () => ok();
        s.onerror = () => { gisPromesse = null; ko(new Error("connexion")); };
        document.head.appendChild(s);
      });
    }
    return gisPromesse;
  }

  // Doit être appelé pendant un geste de l'utilisateur (ouverture d'une fenêtre Google).
  function connecter() {
    if (jeton && jeton.expire > Date.now() + 60000) return Promise.resolve(jeton.valeur);
    return new Promise((ok, ko) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: PORTEE,
        callback: (rep) => {
          if (rep.error || !rep.access_token) { ko(new Error("refus")); return; }
          jeton = { valeur: rep.access_token, expire: Date.now() + (rep.expires_in || 3600) * 1000 };
          ok(jeton.valeur);
        },
        error_callback: () => ko(new Error("refus")),
      });
      client.requestAccessToken();
    });
  }

  async function appel(methode, chemin, corps) {
    const rep = await fetch(API + chemin, {
      method: methode,
      headers: Object.assign({ Authorization: "Bearer " + jeton.valeur }, corps ? { "Content-Type": "application/json" } : {}),
      body: corps ? JSON.stringify(corps) : undefined,
    });
    if (rep.status === 401) jeton = null;
    if (!rep.ok) throw new Error("HTTP " + rep.status);
    return rep.status === 204 ? {} : rep.json();
  }

  const duree = (s) => Math.max(1, parseFloat(s || "3")) * 1000;
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));

  // Déroulé complet. `etapes` reçoit l'avancement pour l'interface :
  //   etapes.pret(urlGooglePhotos) : la session est créée, il faut ouvrir Google Photos
  //   (l'appelant affiche un lien, que l'utilisateur touche lui-même) ;
  //   etapes.annule() : renvoie true si l'utilisateur a abandonné.
  // Renvoie un Blob (la photo, sans ses métadonnées de lieu), ou null si abandon.
  async function choisirPhoto(etapes) {
    await chargerGIS();
    await connecter();
    const session = await appel("POST", "/sessions", { pickingConfig: { maxItemCount: "1" } });
    try {
      etapes.pret(session.pickerUri + "/autoclose");
      let s = session;
      const limite = Date.now() + 30 * 60000;
      while (!s.mediaItemsSet) {
        if (etapes.annule() || Date.now() > limite) return null;
        await pause(s.pollingConfig ? duree(s.pollingConfig.pollInterval) : 3000);
        if (etapes.annule()) return null;
        s = await appel("GET", "/sessions/" + encodeURIComponent(session.id));
        if (s.pollingConfig && s.pollingConfig.timeoutIn === "0s" && !s.mediaItemsSet) return null;
      }
      const liste = await appel("GET", "/mediaItems?pageSize=10&sessionId=" + encodeURIComponent(session.id));
      const item = (liste.mediaItems || []).find((m) => m.type === "PHOTO" || /^image\//.test(m.mediaFile && m.mediaFile.mimeType));
      if (!item) throw new Error("pas de photo");
      // Taille demandée : assez pour le recadrage (2400 px de haut au maximum).
      const rep = await fetch(item.mediaFile.baseUrl + "=w2400-h2400", { headers: { Authorization: "Bearer " + jeton.valeur } });
      if (!rep.ok) throw new Error("HTTP " + rep.status);
      return await rep.blob();
    } finally {
      appel("DELETE", "/sessions/" + encodeURIComponent(session.id)).catch(() => {});
    }
  }

  window.GooglePhotos = {
    get disponible() { return !!CLIENT_ID; },
    // Charge à l'avance la bibliothèque de connexion Google, pour que la fenêtre de
    // connexion s'ouvre bien au toucher du bouton.
    preparer() { chargerGIS().catch(() => {}); },
    choisirPhoto,
  };
})();
