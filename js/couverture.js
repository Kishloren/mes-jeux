// Couverture d'un pack de puzzles (480 × 720), identique à celle du générateur du catalogue :
// bandeau de titre, filet, mosaïque 4 × 3 des images. Spécification : API Bibliothèque, § 4.
(function () {
  "use strict";

  const L = 480, H = 720, BANDEAU = 185;
  const FOND = "#18232B", FILET = "#D18745", TEXTE = "#F6EFE2";
  const VW = 115, VH = 173, XS = [4, 123, 242, 361], YS = [189, 366, 543];
  const POLICE = "DejaVu Serif Couverture";

  let policePromesse = null;
  function chargerPolice() {
    if (!policePromesse) {
      const f = new FontFace(POLICE, "url(fonts/DejaVuSerif-Bold-latin.woff2)", { weight: "bold" });
      policePromesse = f.load().then((ok) => { document.fonts.add(ok); }).catch(() => { policePromesse = null; });
    }
    return policePromesse;
  }

  // Coupure du titre : algorithme du catalogue, reproduit tel quel.
  function couper(titre) {
    const mots = String(titre).trim().split(/\s+/).filter(Boolean);
    for (let taille = 46; taille >= 22; taille -= 2) {
      const max = Math.floor(440 / (taille * 0.7));
      const lignes = [];
      for (const m of mots) {
        const n = lignes.length;
        if (n && (lignes[n - 1] + " " + m).length <= max) lignes[n - 1] += " " + m;
        else lignes.push(m);
      }
      if (lignes.length <= 3 && lignes.every((l) => l.length <= max)) return { taille, lignes };
    }
    return { taille: 22, lignes: [String(titre).trim().slice(0, 30)] };
  }

  // Dessine l'image en mode « cover » (remplissage, recadrage centré).
  function dessinerCover(ctx, img, x, y, w, h) {
    const k = Math.max(w / img.width, h / img.height);
    const sw = w / k, sh = h / k;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
  }

  // titre : texte du bandeau ; images : jusqu'à 12 Blobs (les vignettes du pack), dans l'ordre.
  async function generer(titre, images) {
    await chargerPolice();
    const c = document.createElement("canvas");
    c.width = L; c.height = H;
    const ctx = c.getContext("2d");
    ctx.fillStyle = FOND;
    ctx.fillRect(0, 0, L, H);
    ctx.fillStyle = FILET;
    ctx.fillRect(0, 180, L, 3);

    const bitmaps = await Promise.all(images.slice(0, 12).map((b) => createImageBitmap(b).catch(() => null)));
    ctx.imageSmoothingQuality = "high";
    bitmaps.forEach((bm, i) => {
      if (!bm) return;
      dessinerCover(ctx, bm, XS[i % 4], YS[Math.floor(i / 4)], VW, VH);
      bm.close();
    });

    const { taille, lignes } = couper(titre);
    const interligne = Math.round(taille * 1.18);
    const y0 = Math.round(BANDEAU / 2 - ((lignes.length - 1) * interligne) / 2 + taille * 0.36);
    ctx.fillStyle = TEXTE;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = `bold ${taille}px "${POLICE}", "DejaVu Serif", Georgia, serif`;
    lignes.forEach((l, i) => ctx.fillText(l, L / 2, y0 + i * interligne));

    // WebP qualité 82, abaissée par paliers de 6 si le fichier dépasse 60 Ko.
    const vers = (type, q) => new Promise((ok) => c.toBlob(ok, type, q));
    let blob = null;
    for (let q = 82; q >= 40; q -= 6) {
      blob = await vers("image/webp", q / 100);
      if (!blob || blob.type !== "image/webp") { blob = await vers("image/jpeg", 0.85); break; }
      if (blob.size <= 60000) break;
    }
    return blob;
  }

  // Couverture d'un carnet de grilles fabriquée par l'appli (grilles intégrées, ou carnet
  // téléchargé sans couverture), dans l'esprit de celles du catalogue : carte claire sur
  // fond bleu nuit, nom du jeu, titre du carnet, motif, nombre de grilles.
  async function carnet(jeu, titre, nombre, motif) {
    await chargerPolice();
    const c = document.createElement("canvas");
    c.width = L; c.height = H;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#1B324B";
    ctx.fillRect(0, 0, L, H);
    const rect = (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    };
    ctx.fillStyle = "#F5EAD8";
    rect(38, 38, 404, 644, 22); ctx.fill();
    ctx.textAlign = "center";
    const police = (t) => `bold ${t}px "${POLICE}", "DejaVu Serif", Georgia, serif`;
    // Nom du jeu, en capitales, réduit si besoin pour tenir dans la carte.
    let t = 40;
    ctx.font = police(t);
    while (ctx.measureText(jeu.toUpperCase()).width > 360 && t > 22) ctx.font = police(t -= 2);
    ctx.fillStyle = "#1B324B";
    ctx.fillText(jeu.toUpperCase(), L / 2, 152);
    ctx.font = police(30);
    ctx.fillStyle = "#8A3D24";
    const { lignes } = couper(titre);
    lignes.slice(0, 2).forEach((l, i) => ctx.fillText(l, L / 2, 228 + i * 38, 380));
    // Motif
    const carre = (x, y, s, plein) => {
      rect(x, y, s, s, 5);
      ctx.fillStyle = plein ? "#1B324B" : "#FFFDF8"; ctx.fill();
      if (!plein) { ctx.strokeStyle = "#C8843F"; ctx.lineWidth = 2; ctx.stroke(); }
    };
    if (motif === "mm") {
      // Petite grille de lettres barrée d'un trait, comme un mot trouvé.
      const lettres = "MOTSCACHESTROUVERLIRE";
      ctx.font = police(26);
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
        ctx.fillStyle = "#1B324B";
        ctx.fillText(lettres[(i * 5 + j) % lettres.length], 148 + j * 46, 340 + i * 46);
      }
      ctx.strokeStyle = "rgba(200, 132, 63, 0.55)"; ctx.lineWidth = 34; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(148, 330); ctx.lineTo(148 + 4 * 46, 330 + 4 * 46); ctx.stroke();
    } else if (motif === "mc") {
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) carre(130 + j * 46, 300 + i * 46, 40, i === j);
    } else {
      ctx.fillStyle = "#C8843F";
      for (let j = 0; j < 5; j++) { rect(88 + j * 62, 380, 48, 48, 5); ctx.fill(); }
    }
    ctx.font = `24px "DejaVu Sans", Verdana, sans-serif`;
    ctx.fillStyle = "#1B324B";
    ctx.fillText(`${nombre} grille${nombre > 1 ? "s" : ""}`, L / 2, 600);
    return new Promise((ok) => c.toBlob(ok, "image/webp", 0.85));
  }

  window.Couverture = { generer, couper, carnet };
})();
