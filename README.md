# Mes jeux

Application web installable (PWA) de jeux pour tablette : Chassé-croisé et Puzzle.
Aucune dépendance, aucun build : fichiers statiques servis tels quels (GitHub Pages).
Cible prioritaire : les tablettes, en mode portrait.

## Contenus

- Deux grilles de Chassé-croisé sont livrées avec l'appli ([js/data-chasse-croise.js](js/data-chasse-croise.js)),
  tirées d'œuvres du domaine public. Vérification : `node tools/validate.js`.
- Tout le reste (packs d'images pour le puzzle, carnets de grilles) vient de la **Bibliothèque** :
  l'appli interroge l'API décrite dans [docs/specification-bibliotheque.md](docs/specification-bibliotheque.md)
  (`https://www.stansgames.fr/jeux-tablette/api`) et conserve les contenus téléchargés sur l'appareil (IndexedDB).
- Aucune photo personnelle ne doit être ajoutée à ce dépôt public.

## Mise en ligne

Incrémenter `VERSION` dans [sw.js](sw.js) et `VERSION_APP` dans [js/app.js](js/app.js), puis pousser sur GitHub.

## Tester en local

`python -m http.server 8000` puis http://localhost:8000.
L'API n'autorise que l'origine de production (CORS) : pour tester la Bibliothèque en local,
ajouter l'origine locale à `JEUX_TABLETTE_CORS_ORIGINS` côté serveur.

## Sauvegarde

La progression est enregistrée dans le navigateur de l'appareil (localStorage), les contenus téléchargés dans IndexedDB.
