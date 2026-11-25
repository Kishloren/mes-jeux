// Vérifie la cohérence d'un carnet de chassé-croisé (format mes-jeux-carnet-cc de l'API) :
// node tools/validate.js <carnet.json>
const fs = require("fs");

const carnet = JSON.parse(fs.readFileSync(process.argv[2] || "docs/exemples/carnet-exemple.json", "utf8"));
const grilles = carnet.grilles.map((g) => ({
  id: g.id, citation: g.citation, acrostiche: g.acrostiche,
  defs: g.definitions.map((d) => [d.lettre, d.intitule, d.reponse, d.cases]),
}));

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()
  .replace(/Œ/g, "OE").replace(/Æ/g, "AE");

let ok = true;
for (const g of grilles) {
  const letters = [...norm(g.citation)].filter((c) => /[A-Z]/.test(c));
  const N = letters.length;
  const seen = new Map();
  const errs = [];
  for (const [l, , rep, nums] of g.defs) {
    if (rep.length !== nums.length) errs.push(`${l}: ${rep} a ${rep.length} lettres mais ${nums.length} numéros`);
    nums.forEach((n, i) => {
      if (seen.has(n)) errs.push(`${l}: numéro ${n} déjà utilisé par ${seen.get(n)}`);
      seen.set(n, l + (i + 1));
      if (n < 1 || n > N) errs.push(`${l}: numéro ${n} hors limites (1..${N})`);
      else if (letters[n - 1] !== rep[i]) errs.push(`${l}${i + 1}: case ${n} = ${letters[n - 1]} dans la citation, ${rep[i]} dans ${rep}`);
    });
  }
  for (let n = 1; n <= N; n++) if (!seen.has(n)) errs.push(`case ${n} (${letters[n - 1]}) non utilisée`);
  const acro = g.defs.map((d) => d[2][g.acrostiche] || "").join("");
  console.log(`${g.id}: ${N} lettres, ${g.defs.length} définitions, acrostiche = ${acro}`);
  errs.forEach((e) => console.log("  ✗ " + e));
  if (errs.length) ok = false;
}
console.log(ok ? "OK" : "ERREURS");
process.exit(ok ? 0 : 1);
