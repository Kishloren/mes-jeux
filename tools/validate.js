// Vérifie la cohérence des grilles : node tools/validate.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/data-chasse-croise.js"), "utf8"), ctx);

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()
  .replace(/Œ/g, "OE").replace(/Æ/g, "AE");

let ok = true;
for (const g of ctx.window.CC_GRILLES) {
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
