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

  window.Couverture = { generer, couper };
})();
