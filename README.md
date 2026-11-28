# Mes jeux

Application web installable (PWA) de jeux pour tablette : Chassé-croisé, Mots codés et Puzzle.
Aucune dépendance, aucun build : fichiers statiques servis tels quels (GitHub Pages).
Cible prioritaire : les tablettes, en mode portrait.

## Contenus

- L'appli n'embarque aucune grille : tout vient des carnets téléchargés depuis le serveur.
  `node tools/validate.js <carnet.json>` vérifie un carnet de chassé-croisé ; `node tools/mots-codes-gen.js
  <Lexique383.tsv> 12 10 <nombre> [graine]` est un générateur de mots codés de référence (Lexique 3, non inclus).
- Chaque jeu a une page d'accueil qui présente ses packs (carnets de grilles, packs d'images) présents
  sur la tablette ; le bouton ＋ ouvre le catalogue du serveur pour ce jeu. L'appli interroge l'API décrite
  dans [docs/specification-bibliotheque.md](docs/specification-bibliotheque.md)
  (`https://www.stansgames.fr/jeux-tablette/api`) et conserve les contenus téléchargés sur l'appareil (IndexedDB).
  Les mots codés sont acceptés aux formats `mes-jeux-carnet-mc` et `mes-jeux-pack-mots-codes`.
- Jeux : Chassé-croisé, Mots codés, Mot mystérieux (`mes-jeux-pack-mot-mysterieux`), Alphamot (`mes-jeux-pack-alphamot`), Mots en zigzag (`mes-jeux-pack-mots-zigzag`), Mots casés (`mes-jeux-pack-mots-cases`), Puzzle.
- Aucune photo personnelle ne doit être ajoutée à ce dépôt public.
- Puzzle : l'accueil présente les packs d'images de la tablette ; le bouton ＋ permet d'en télécharger
  et de créer des packs avec ses photos (tablette ou Google Photos, mise en place : `docs/google-photos.md`).
  Les photos sont recadrées, réencodées sans métadonnées, rangées par 12 dans des packs « Mes images »
  et restent sur l'appareil. Un pack personnel n'est jamais effacé : il est archivé (masqué). Les couvertures des packs suivent le § 4 de l'API (`js/couverture.js`),
  avec la police DejaVu Serif Bold (licence libre, `fonts/LICENSE-DejaVu.txt`).

## Mise en ligne

Incrémenter `VERSION` dans [sw.js](sw.js) et `VERSION_APP` dans [js/app.js](js/app.js), puis pousser sur GitHub.

## Tester en local

`python -m http.server 8000` puis http://localhost:8000.
L'API n'autorise que l'origine de production (CORS) : pour tester la Bibliothèque en local,
ajouter l'origine locale à `JEUX_TABLETTE_CORS_ORIGINS` côté serveur.

## Sauvegarde

La progression est enregistrée dans le navigateur de l'appareil (localStorage), les contenus téléchargés dans IndexedDB.
