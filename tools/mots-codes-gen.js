// Générateur de grilles de Mots codés (grilles de mots croisés sans définitions).
// Usage : node tools/mots-codes-gen.js <Lexique383.tsv> <lignes> <colonnes> <nombre> [graine]
// Lexique 3 (http://www.lexique.org) sert de dictionnaire. Le résultat (JSON) est écrit
// sur la sortie standard, au format interne du jeu (js/data-mots-codes.js).
"use strict";
const fs = require("fs");

const [, , fichierLex, L0, C0, N0, graine0] = process.argv;
const LIGNES = +L0 || 12, COLS = +C0 || 10, NOMBRE = +N0 || 1;
let graine = +graine0 || Date.now() % 1e9;
// Mulberry32 : générateur pseudo-aléatoire reproductible à partir de la graine.
const hasard = () => {
  graine = (graine + 0x6d2b79f5) | 0;
  let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const melanger = (t) => { for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(hasard() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; } return t; };

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/Œ/g, "OE").replace(/Æ/g, "AE");

// ---------- Dictionnaire ----------
const DEUX = new Set("AI AN AS AU BU CE CI DE DO DU EN ES ET EU FA IL LA LE LU MA ME MI NE NI NU ON OR OS OU PU RE RI SA SE SI SU TA TE TU UN VA VU".split(" "));
const INTERDITS = "ASSASSIN EXPLOS VIOLENC DEBAUCH GONZESS MEURT CADAVR SUICID CANCER DROGU OPIUM COCAIN HEROIN SALOP PUTAIN PROSTITU BORDEL MERDE FOUT CRIMIN TORTUR BOURREAU CERCUEIL FUNER FUNEB AGONI DECES MOURI MORTEL NAZI SEXE SEXU EROTI OBSCEN BATARD ENCUL CONNARD CONNASS CONNERI CRETIN IMBECIL MASSACR TERROR CARNAG SANGLAN CHARNIER NEGR PEDE GOUIN BRANL BAIS CHIER CHIE PISS COUILL BITE NIBAR".split(" ");
const INTERDITS_EXACT = new Set("CUL CULS CON CONS PET PETS PUE ZOB TUER TUE TUES TUEE NAZI MORT MORTS".split(" "));
function dictionnaire() {
  const lignes = fs.readFileSync(fichierLex, "utf8").split("\n");
  const h = lignes[0].split("\t");
  const ix = (n) => h.indexOf(n);
  const freq = new Map();
  for (const l of lignes.slice(1)) {
    const c = l.split("\t");
    if (c.length < 10) continue;
    const o = c[ix("ortho")];
    if (!/^[a-zàâäçéèêëîïôöùûüœæ]+$/.test(o)) continue;
    const w = norm(o);
    if (!/^[A-Z]+$/.test(w) || w.length < 2 || w.length > Math.max(LIGNES, COLS)) continue;
    if (w.length === 2 && !DEUX.has(w)) continue;
    if (INTERDITS_EXACT.has(w) || INTERDITS.some((p) => w.startsWith(p))) continue;
    const f = +c[ix("freqlivres")] || 0;
    if (f > (freq.get(w) || 0)) freq.set(w, f);
  }
  const seuil = (n) => (n <= 3 ? 4 : 2);
  return [...freq].filter(([w, f]) => f >= seuil(w.length)).map(([w, f]) => ({ w, f }));
}

// Index par longueur : pour chaque position et lettre, un ensemble de bits des mots.
function indexer(mots) {
  const parLong = new Map();
  for (const m of mots) {
    if (!parLong.has(m.w.length)) parLong.set(m.w.length, []);
    parLong.get(m.w.length).push(m);
  }
  const index = new Map();
  for (const [L, liste] of parLong) {
    const n = liste.length, B = Math.ceil(n / 32);
    const bits = [];
    for (let p = 0; p < L; p++) {
      bits.push(Array.from({ length: 26 }, () => new Uint32Array(B)));
    }
    liste.forEach((m, k) => { for (let p = 0; p < L; p++) bits[p][m.w.charCodeAt(p) - 65][k >> 5] |= 1 << (k & 31); });
    const tous = new Uint32Array(B).fill(0xffffffff);
    if (n % 32) tous[B - 1] = (1 << (n % 32)) - 1;
    index.set(L, { liste, bits, tous, B });
  }
  return index;
}

// ---------- Motif de cases noires ----------
function motif() {
  const g = Array.from({ length: LIGNES }, () => new Array(COLS).fill(false)); // true = noire
  const noire = (l, c) => l < 0 || l >= LIGNES || c < 0 || c >= COLS || g[l][c];
  const cible = Math.round(LIGNES * COLS * (0.15 + hasard() * 0.04));
  let n = 0, essais = 0;
  while (n < cible && essais++ < 5000) {
    const l = Math.floor(hasard() * LIGNES), c = Math.floor(hasard() * COLS);
    if (g[l][c]) continue;
    // Pas de noires côte à côte (ni en ligne ni en colonne).
    if ((l > 0 && g[l - 1][c]) || (l < LIGNES - 1 && g[l + 1][c]) || (c > 0 && g[l][c - 1]) || (c < COLS - 1 && g[l][c + 1])) continue;
    g[l][c] = true;
    // Chaque case blanche voisine doit rester dans au moins un mot de 2 lettres ou plus.
    let ok = true;
    for (const [a, b] of [[l - 1, c], [l + 1, c], [l, c - 1], [l, c + 1]]) {
      if (noire(a, b)) continue;
      const h = !noire(a, b - 1) || !noire(a, b + 1);
      const v = !noire(a - 1, b) || !noire(a + 1, b);
      if (!h && !v) ok = false;
    }
    if (!ok) { g[l][c] = false; continue; }
    n++;
  }
  // Cases blanches toutes reliées.
  const blanches = [];
  for (let l = 0; l < LIGNES; l++) for (let c = 0; c < COLS; c++) if (!g[l][c]) blanches.push([l, c]);
  const vu = new Set([blanches[0].join()]), pile = [blanches[0]];
  while (pile.length) {
    const [l, c] = pile.pop();
    for (const [a, b] of [[l - 1, c], [l + 1, c], [l, c - 1], [l, c + 1]]) {
      if (!noire(a, b) && !vu.has(a + "," + b)) { vu.add(a + "," + b); pile.push([a, b]); }
    }
  }
  if (vu.size !== blanches.length) return null;
  // Pas de mot plus long que 9 lettres.
  for (let l = 0; l < LIGNES; l++) { let run = 0; for (let c = 0; c < COLS; c++) { run = g[l][c] ? 0 : run + 1; if (run > 9) return null; } }
  for (let c = 0; c < COLS; c++) { let run = 0; for (let l = 0; l < LIGNES; l++) { run = g[l][c] ? 0 : run + 1; if (run > 9) return null; } }
  return g;
}

function emplacements(g) {
  const res = [];
  for (let l = 0; l < LIGNES; l++) {
    for (let c = 0; c < COLS; c++) {
      if (g[l][c]) continue;
      if ((c === 0 || g[l][c - 1]) && c + 1 < COLS && !g[l][c + 1]) {
        const cases = []; for (let k = c; k < COLS && !g[l][k]; k++) cases.push(l * COLS + k);
        res.push({ cases, sens: "h" });
      }
      if ((l === 0 || g[l - 1][c]) && l + 1 < LIGNES && !g[l + 1][c]) {
        const cases = []; for (let k = l; k < LIGNES && !g[k][c]; k++) cases.push(k * COLS + c);
        res.push({ cases, sens: "v" });
      }
    }
  }
  return res;
}

// ---------- Remplissage (retour arrière, emplacement le plus contraint d'abord) ----------
function remplir(g, index) {
  const slots = emplacements(g);
  if (slots.some((s) => !index.has(s.cases.length))) return null;
  const lettres = new Array(LIGNES * COLS).fill(0); // 0 = vide, sinon code 65..90
  const parCase = new Map();
  slots.forEach((s, i) => s.cases.forEach((k) => { if (!parCase.has(k)) parCase.set(k, []); parCase.get(k).push(i); }));
  const choisi = new Array(slots.length).fill(null);
  const utilises = new Set();
  let budget = 60000;

  function candidats(s) {
    const I = index.get(s.cases.length);
    let acc = null;
    s.cases.forEach((k, p) => {
      if (!lettres[k]) return;
      const b = I.bits[p][lettres[k] - 65];
      if (!acc) acc = b.slice(); else for (let i = 0; i < I.B; i++) acc[i] &= b[i];
    });
    return acc || I.tous;
  }
  const compte = (bs) => { let n = 0; for (let v of bs) { while (v) { v &= v - 1; n++; } } return n; };
  const liste = (bs, I) => { const r = []; for (let i = 0; i < bs.length; i++) { let v = bs[i]; while (v) { const t = 31 - Math.clz32(v & -v); r.push(I.liste[i * 32 + t]); v &= v - 1; } } return r; };

  // Toute lettre présente une seule fois doit être à un croisement (deux mots pour la deviner).
  function uniquesCroisees() {
    const nb = new Map();
    lettres.forEach((x, k) => { if (x) nb.set(x, (nb.get(x) || 0) + 1); });
    return lettres.every((x, k) => !x || nb.get(x) > 1 || parCase.get(k).length === 2);
  }

  function etape() {
    if (--budget < 0) return false;
    let mieux = -1, mieuxN = Infinity, mieuxBs = null;
    for (let i = 0; i < slots.length; i++) {
      if (choisi[i]) continue;
      const bs = candidats(slots[i]);
      const n = compte(bs);
      if (n === 0) return false;
      if (n < mieuxN) { mieuxN = n; mieux = i; mieuxBs = bs; }
    }
    if (mieux < 0) return uniquesCroisees();
    const s = slots[mieux], I = index.get(s.cases.length);
    // Ordre : tirage pondéré par la fréquence (les mots courants d'abord, avec du hasard).
    // Bonus pour les lettres encore absentes de la grille (on vise les 26 lettres).
    const presentes = new Set(lettres.filter(Boolean));
    const nouvelles = (w) => { let n = 0; const vu = new Set(); for (const ch of w) { const c = ch.charCodeAt(0); if (!presentes.has(c) && !vu.has(c)) { vu.add(c); n++; } } return n; };
    const cands = liste(mieuxBs, I).filter((m) => !utilises.has(m.w))
      .map((m) => [Math.log(m.f + 1) + 2.5 * nouvelles(m.w) + hasard() * 3, m]).sort((a, b) => b[0] - a[0]).slice(0, 12).map((x) => x[1]);
    for (const m of cands) {
      const avant = s.cases.map((k) => lettres[k]);
      s.cases.forEach((k, p) => { lettres[k] = m.w.charCodeAt(p); });
      choisi[mieux] = m; utilises.add(m.w);
      // Vérification en avant sur les emplacements croisés.
      let ok = true;
      for (const k of s.cases) for (const j of parCase.get(k)) if (!choisi[j] && compte(candidats(slots[j])) === 0) ok = false;
      if (ok && etape()) return true;
      choisi[mieux] = null; utilises.delete(m.w);
      s.cases.forEach((k, p) => { lettres[k] = avant[p]; });
      if (budget < 0) return false;
    }
    return false;
  }
  if (!etape()) return null;
  return { lettres, mots: choisi.map((m) => m.w) };
}

// ---------- Production d'une grille ----------
function produire(index, num) {
  for (let essai = 0; essai < 400; essai++) {
    const g = motif();
    if (!g) continue;
    const r = remplir(g, index);
    if (!r) continue;
    const lignes = [];
    for (let l = 0; l < LIGNES; l++) {
      let t = "";
      for (let c = 0; c < COLS; c++) t += g[l][c] ? "#" : String.fromCharCode(r.lettres[l * COLS + c]);
      lignes.push(t);
    }
    const presentes = [...new Set(lignes.join("").replace(/#/g, ""))];
    // Numérotation aléatoire des lettres présentes (1..n).
    const ordre = melanger(presentes.slice());
    const codes = {};
    ordre.forEach((ch, i) => { codes[ch] = i + 1; });
    // Lettres données : celles du premier mot horizontal d'au moins 4 lettres.
    const hs = emplacements(g).filter((s) => s.sens === "h");
    const premier = hs.find((s) => s.cases.length >= 4 && s.cases.length <= 5) || hs.find((s) => s.cases.length >= 4);
    const mot = premier ? premier.cases.map((k) => String.fromCharCode(r.lettres[k])).join("") : "";
    return { lignes, codes, devoiles: [...new Set(mot)], premierMot: mot, lettres: presentes.length, essais: essai + 1 };
  }
  return null;
}

const index = indexer(dictionnaire());
const res = [];
for (let i = 0; i < NOMBRE; i++) {
  const t0 = Date.now();
  const g = produire(index, i);
  if (g) { g.ms = Date.now() - t0; res.push(g); }
  process.stderr.write(g ? `grille ${i + 1} : ${g.lettres} lettres, ${g.essais} essais, ${g.ms} ms\n` : `grille ${i + 1} : échec\n`);
}
process.stdout.write(JSON.stringify(res, null, 1) + "\n");
