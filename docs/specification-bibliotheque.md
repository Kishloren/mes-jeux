# Spécification : API « Bibliothèque » de l'appli Mes jeux

**Version de la spécification : 1.0 (22/11/2026)**

**Destinataires : les agents qui développent le back-office Node.js.**

## 1. Contexte

« Mes jeux » est une application web installable (PWA, sans framework ni étape de build) pour un public âgé. Elle contient pour l'instant deux jeux :

- **Puzzle** : une photo découpée en pièces que l'on remet en place ;
- **Chassé-croisé** : un jeu de lettres où les réponses à des définitions reconstituent une citation.

L'appli comporte un espace **Bibliothèque**. L'utilisateur y voit des éléments à télécharger :

- des **packs d'images** libres de droits, pour le puzzle ;
- des **carnets de grilles** de chassé-croisé.

Tout ce qui est téléchargé est stocké **sur l'appareil**, dans IndexedDB, et reste jouable hors connexion.

Le back-office génère ces contenus et les publie selon cette spécification. L'appli ne fait que des **lectures** (requêtes `GET`) : elle n'envoie jamais de données.

**Livrable attendu en retour : une URL de base**, par exemple `https://exemple.fr/mes-jeux/api`. Elle est notée `{BASE}` dans la suite.

## 2. Règles générales

| Sujet | Règle |
|---|---|
| Transport | HTTPS uniquement. |
| Format | JSON en UTF-8, avec `Content-Type: application/json; charset=utf-8`. |
| CORS | Les requêtes `GET` et `HEAD` doivent être autorisées pour l'origine de l'appli : `https://kishloren.github.io` aujourd'hui, peut-être un domaine propre plus tard. La liste des origines doit donc être paramétrable. Il faut répondre aussi à la requête préliminaire `OPTIONS`. L'en-tête `Access-Control-Expose-Headers: ETag` doit être présent. |
| Cookies, traçage | Aucun cookie, aucun traceur, aucune donnée personnelle collectée. Les journaux techniques (IP, user-agent) ne sont conservés que le temps strictement nécessaire. |
| URLs | Toutes les URLs présentes dans les réponses sont **absolues**. L'appli n'en construit aucune elle-même, sauf `{BASE}/v1/bibliotheque`. |
| Fichiers immuables | Un fichier binaire (image) ou un manifeste versionné ne change **jamais** une fois publié à une URL donnée. Toute modification produit une nouvelle URL, par exemple avec l'empreinte ou la version dans le chemin. Ces fichiers sont servis avec `Cache-Control: public, max-age=31536000, immutable`. |
| Index | `{BASE}/v1/bibliotheque` est servi avec `Cache-Control: no-cache` et un `ETag`. L'appli renvoie `If-None-Match`, et le serveur répond `304` si rien n'a changé. |
| Dates | Format ISO 8601 en UTC, par exemple `"2026-11-22T10:00:00Z"`. |
| Identifiants | Les `id` contiennent de 1 à 64 caractères parmi `[a-z0-9-]`. Ils sont **stables et définitifs** : l'appli s'en sert pour savoir ce qu'elle possède déjà et pour enregistrer la progression du joueur. Un `id` ne doit jamais être réutilisé pour un autre contenu. |
| Textes | Texte brut, sans HTML et sans Markdown. L'appli les affiche tels quels, en échappant les caractères spéciaux. |
| Langue | Français uniquement pour l'instant. Chaque élément porte quand même `"langue": "fr"`. |
| Erreurs | Code HTTP adapté (`404`, `500`, etc.) et corps `{ "erreur": "code_court", "message": "explication lisible" }`. |
| Compatibilité | L'appli **ignore** les champs et les types d'éléments qu'elle ne connaît pas. On peut donc ajouter des champs sans changer la version de l'API. Retirer un champ ou en changer le sens oblige à passer à `/v2/`. |

## 3. Point d'entrée : l'index de la bibliothèque

`GET {BASE}/v1/bibliotheque`

```json
{
  "format": "mes-jeux-bibliotheque",
  "version_format": 1,
  "genere": "2026-11-22T10:00:00Z",
  "elements": [
    {
      "id": "animaux-de-la-ferme",
      "type": "images",
      "titre": "Animaux de la ferme",
      "description": "12 photos d'animaux : vaches, chevaux, poules…",
      "langue": "fr",
      "version": 3,
      "maj": "2026-11-20T08:00:00Z",
      "nombre": 12,
      "octets": { "standard": 2400000, "grande": 5200000 },
      "vignette": "https://…/packs/animaux-de-la-ferme/v3/couverture.webp",
      "tags": ["animaux", "campagne"],
      "acces": "libre",
      "manifeste": "https://…/packs/animaux-de-la-ferme/v3/manifeste.json"
    },
    {
      "id": "carnet-classiques-01",
      "type": "chasse-croise",
      "titre": "Classiques français n° 1",
      "description": "10 grilles autour de Hugo, Zola, Maupassant…",
      "langue": "fr",
      "version": 1,
      "maj": "2026-11-21T08:00:00Z",
      "nombre": 10,
      "niveaux": [1, 2],
      "octets": { "total": 38000 },
      "vignette": "https://…/carnets/carnet-classiques-01/v1/couverture.webp",
      "tags": ["littérature"],
      "acces": "libre",
      "manifeste": "https://…/carnets/carnet-classiques-01/v1/carnet.json"
    }
  ]
}
```

| Champ | Obligatoire | Description |
|---|---|---|
| `id` | oui | Identifiant stable de l'élément (voir § 2). |
| `type` | oui | `"images"` pour un pack d'images, `"chasse-croise"` pour un carnet de grilles. D'autres types viendront ; l'appli ignore ceux qu'elle ne connaît pas. |
| `titre` | oui | 60 caractères au plus. |
| `description` | non | 200 caractères au plus. |
| `langue` | oui | `"fr"`. |
| `version` | oui | Entier qui augmente à chaque modification du contenu. Si la version publiée dépasse celle qu'il a installée, l'appli propose « Mettre à jour ». |
| `maj` | oui | Date de la dernière modification. |
| `nombre` | oui | Nombre d'images ou de grilles. |
| `octets` | oui | Taille du téléchargement, pour l'afficher et vérifier la place disponible. Pour un pack d'images, une taille par variante (voir § 4.2). |
| `niveaux` | non | Pour les grilles : niveaux de difficulté présents, de 1 (facile) à 4 (expert). |
| `vignette` | oui | Image de couverture : WebP, 480 × 720 px (rapport 2:3), 60 Ko au plus. |
| `tags` | non | Mots-clés servant aux filtres. |
| `acces` | oui | `"libre"` en v1. Les valeurs `"abonnement"` et `"achat"` sont réservées à la monétisation future (voir § 7). |
| `manifeste` | oui | URL du manifeste versionné de l'élément (§ 4 ou § 5). |

Il n'y a pas de pagination en v1 : l'index entier tient en une réponse, en dessous de 500 éléments. Si le catalogue dépasse cette taille, un champ `"suivant": "<url>"` sera ajouté.

## 4. Packs d'images

### 4.1 Manifeste

`GET` sur l'URL donnée par `manifeste`.

```json
{
  "format": "mes-jeux-pack-images",
  "version_format": 1,
  "id": "animaux-de-la-ferme",
  "version": 3,
  "titre": "Animaux de la ferme",
  "images": [
    {
      "id": "vache-normande-pre",
      "titre": "Vache normande dans un pré",
      "ratio": "2:3",
      "variantes": {
        "vignette": { "url": "https://…/img/9c1e…a7.webp", "largeur": 320,  "hauteur": 480,  "octets": 21000,  "sha256": "9c1e…a7" },
        "standard": { "url": "https://…/img/41bd…02.webp", "largeur": 1000, "hauteur": 1500, "octets": 190000, "sha256": "41bd…02" },
        "grande":   { "url": "https://…/img/d07f…9e.webp", "largeur": 1600, "hauteur": 2400, "octets": 430000, "sha256": "d07f…9e" }
      },
      "credit": {
        "auteur": "Jeanne Martin",
        "source": "https://commons.wikimedia.org/wiki/File:…",
        "licence": "CC0 1.0",
        "licence_url": "https://creativecommons.org/publicdomain/zero/1.0/"
      },
      "tags": ["vache", "normandie"]
    }
  ]
}
```

L'`id` d'une image est stable et **unique dans tout le catalogue**, pas seulement dans son pack : une même image peut figurer dans deux packs sans être stockée deux fois. Les champs `id`, `titre`, `ratio`, `variantes` et `credit` sont obligatoires ; `tags` est facultatif.

### 4.2 Variantes et appareils visés

L'appli vise **d'abord les tablettes** (les téléphones passent après), en mode portrait verrouillé. Elle ne travaille plus en tailles absolues : le plateau du puzzle occupe la place disponible, au rapport de l'image.

Le serveur fournit trois variantes de chaque image, et l'appli télécharge **une seule** grande variante par appareil. Elle prend la plus petite de `standard` et `grande` dont la largeur atteint au moins « largeur du plateau en px CSS × `devicePixelRatio` ». La `vignette` est toujours téléchargée.

| Variante | Taille (px) | Usage visé | Poids conseillé (maximum) |
|---|---|---|---|
| `vignette` | 320 × 480 | Listes et choix de l'image | 25 Ko (40 Ko) |
| `standard` | 1000 × 1500 | Téléphones, petites tablettes | 200 Ko (350 Ko) |
| `grande` | 1600 × 2400 | Tablettes haute définition ; c'est la référence « meilleur appareil » (environ 800 px CSS × DPR 2) | 450 Ko (700 Ko) |

Exigences communes à toutes les variantes :

- **Format WebP**, qualité de 80 à 85, profil sRGB, sans transparence.
- **Rapport exact 2:3, en portrait**. En v1, `ratio` vaut toujours `"2:3"`. Le recadrage est fait par le back-office, centré sur le sujet. Il ne doit couper ni un visage ni le sujet principal, ni laisser de bande vide.
- **Aucune métadonnée** : EXIF, XMP, IPTC et GPS sont supprimés, et la rotation est déjà appliquée aux pixels.
- **Bon choix d'image pour le puzzle** : une image nette, contrastée et variée en couleurs et en détails, se reconstitue bien. Il faut éviter les grands aplats uniformes (ciel entier, mur, neige) : ils rendent les pièces impossibles à distinguer pour le public visé.
- **Contrôle d'intégrité** : `sha256` est l'empreinte en hexadécimal minuscule du fichier exact servi. L'appli la vérifie après téléchargement et rejette l'image si elle ne correspond pas.

### 4.3 Licences

Seules des images réellement réutilisables dans une **application commerciale, sans obligation de partager à l'identique**, sont acceptées :

- domaine public, CC0 ;
- licence Unsplash ou licence Pexels ;
- CC BY, à condition que `credit.auteur` soit renseigné (l'appli affiche le crédit).

Les licences CC BY-SA, NC et ND sont exclues, de même que toute image dont la licence n'est pas vérifiée. `credit.source` pointe vers la page d'origine de l'image. Le back-office conserve une trace de cette vérification.

## 5. Carnets de chassé-croisé

### 5.1 Principe du jeu (pour le générateur)

Une **citation** est numérotée lettre par lettre, de 1 à N, dans l'ordre de lecture. Seules les lettres comptent : espaces, ponctuation, apostrophes et traits d'union ne reçoivent pas de numéro.

Chaque **définition** a une réponse dont chaque lettre correspond à une case précise de la citation. Toutes les lettres de la citation sont réparties **exactement une fois** entre les réponses.

La lettre de rang `acrostiche` de chaque réponse, lue dans l'ordre des définitions, forme l'**acrostiche** : un texte qui donne l'auteur et/ou le titre de l'œuvre citée.

### 5.2 Manifeste d'un carnet

```json
{
  "format": "mes-jeux-carnet-cc",
  "version_format": 1,
  "id": "carnet-classiques-01",
  "version": 1,
  "titre": "Classiques français n° 1",
  "grilles": [
    {
      "id": "cc-hugo-miserables-01",
      "titre": "Grille 1",
      "niveau": 2,
      "consigne": "La colonne encadrée donne le nom de l'auteur et le titre de l'œuvre dont est tiré l'extrait.",
      "citation": "Il y a des gens qui observent les règles de l'honneur comme on observe les étoiles, de très loin.",
      "auteur": "Victor Hugo",
      "oeuvre": "Les Misérables",
      "source": { "annee": 1862, "domaine_public": true },
      "acrostiche": 0,
      "acrostiche_texte": "HUGOLESMISERABLES",
      "colonnes": 20,
      "definitions": [
        { "lettre": "A", "intitule": "Altitude", "reponse": "HAUTEUR", "cases": [12, 3, 45, 7, 60, 22, 31] }
      ]
    }
  ]
}
```

*Cet exemple est tronqué : un carnet réel contient toutes ses définitions, qui doivent respecter les règles du § 5.4.*

### 5.3 Champs d'une grille

| Champ | Obligatoire | Description |
|---|---|---|
| `id` | oui | Unique dans tout le catalogue et définitif : la progression du joueur y est rattachée. |
| `titre` | oui | Titre court affiché dans la liste, 30 caractères au plus. |
| `niveau` | oui | Entier de 1 à 4 : 1 = facile, 4 = expert. |
| `consigne` | oui | Phrase qui dit ce que donne l'acrostiche. Elle doit correspondre exactement à `acrostiche_texte` : prénom et nom, initiale et nom, nom seul, avec ou sans le titre… |
| `citation` | oui | Texte de l'extrait, avec accents et ponctuation d'origine. Elle doit compter **entre 120 et 260 lettres**. |
| `auteur`, `oeuvre` | oui | Affichés à la fin de la grille et dans la bande « auteur / titre ». |
| `source` | oui | `annee` (année de publication) et `domaine_public` (booléen). Ajouter `traducteur` et sa date de décès s'il s'agit d'une traduction. |
| `acrostiche` | oui | Rang (en partant de 0) de la lettre de chaque réponse qui forme l'acrostiche. 0 = la première lettre. |
| `acrostiche_texte` | oui | Texte de l'acrostiche, normalisé (§ 5.4). Sert de contrôle. |
| `colonnes` | non | Largeur de grille suggérée, entre 14 et 24. L'appli peut l'adapter à l'écran. |
| `definitions` | oui | Liste ordonnée des définitions. |
| `definitions[].lettre` | oui | Étiquette : `"A"`, `"B"`, … dans l'ordre, sans trou. |
| `definitions[].intitule` | oui | Définition en français, claire, sans ambiguïté, 60 caractères au plus. |
| `definitions[].reponse` | oui | Réponse normalisée (§ 5.4). |
| `definitions[].cases` | oui | Pour chaque lettre de la réponse, le numéro de case dans la citation (de 1 à N). |

### 5.4 Règles de validation (bloquantes)

Le back-office **doit** vérifier chaque grille avant de la publier. L'appli refait les mêmes contrôles et écarte toute grille non conforme.

**Normalisation** des textes :

1. décomposer en NFD ;
2. supprimer les diacritiques (U+0300 à U+036F) ;
3. passer en majuscules ;
4. remplacer `Œ` par `OE` et `Æ` par `AE`.

Après normalisation, un caractère compte comme **lettre** s'il est dans `[A-Z]`.

Pour la mise en page uniquement, les caractères `'`, `’`, `-` et `‑` placés entre deux lettres sont des **liaisons**, sans case noire. Tout autre caractère sépare deux mots.

Règles :

1. N = nombre de lettres de la citation normalisée, entre 120 et 260.
2. Chaque `reponse` ne contient que des lettres `[A-Z]` et compte de 3 à 12 lettres.
3. `cases.length === reponse.length` pour chaque définition.
4. Chaque numéro de case est compris entre 1 et N.
5. L'ensemble de tous les numéros de case, toutes définitions réunies, couvre 1..N **exactement une fois**.
6. Pour chaque définition et chaque rang i : la lettre n° `cases[i]` de la citation normalisée est égale à `reponse[i]`.
7. Le nombre de définitions est compris entre 12 et 26 (les étiquettes vont de A à Z).
8. Chaque réponse a au moins `acrostiche + 1` lettres.
9. La concaténation des `reponse[acrostiche]`, dans l'ordre des définitions, est égale à `acrostiche_texte`.
10. `acrostiche_texte` est égal à la normalisation, lettres seules, de ce qu'annonce la `consigne`. Exemple : « Victor Hugo, Les Misérables » donne `VICTORHUGOLESMISERABLES`.

Exemple validé par ces règles : la première grille de `docs/exemples/carnet-exemple.json`.

- auteur « Victor Hugo », œuvre « Les Contemplations » ;
- `acrostiche: 0` ;
- 21 définitions de A à U ;
- `acrostiche_texte` = `HUGOLESCONTEMPLATIONS` ;
- citation de 147 lettres, chaque lettre utilisée une fois.

### 5.5 Qualité attendue (non bloquante, mais importante)

- **Réponses** : mots courants du français (noms, adjectifs, verbes conjugués, participes), sans nom propre, sans sigle, sans mot rare ou vulgaire. Une même réponse n'apparaît pas deux fois dans une grille.
- **Répartition des cases** : les cases d'une même réponse sont dispersées dans la citation. Une réponse ne doit pas reprendre des lettres consécutives de la citation sur plus de 2 positions de suite.
- **Correspondance avec le niveau** :
  - niveau 1 : définitions directes (synonyme simple), réponses de 4 à 7 lettres ;
  - niveaux 3 et 4 : définitions plus allusives, vocabulaire plus riche ;
  - les jeux de mots restent rares, même à l'expert.
- **Citation** : une phrase complète, au sens clair, d'une longueur proche des 180 à 220 lettres pour le niveau 2.

### 5.6 Droits sur les citations (impératif pour une appli commerciale)

Les citations doivent provenir d'œuvres **dans le domaine public**. En France, c'est le cas lorsque l'auteur est mort depuis plus de 70 ans au 1er janvier de l'année en cours, avec des prorogations de guerre possibles pour certains auteurs. Une traduction est elle-même protégée par les droits du traducteur.

Le droit de courte citation ne couvre pas un usage dans un jeu commercial. Toute citation d'une œuvre récente est donc exclue, sauf licence obtenue. `source.domaine_public` doit valoir `true` et refléter une vérification réelle.

## 6. Comportement de l'appli (pour information)

1. À l'ouverture de « Bibliothèque », l'appli interroge `{BASE}/v1/bibliotheque` en envoyant `If-None-Match`. Hors connexion, elle affiche seulement ce qui est déjà installé.
2. Pour chaque élément, elle affiche un état : « Télécharger » si l'élément n'est pas installé, « Installé », ou « Mettre à jour » si sa version est plus récente que celle installée.
3. Au téléchargement :
   - elle récupère le manifeste ;
   - elle vérifie `format` et `version_format`, et refuse un format inconnu ;
   - elle télécharge les fichiers (pas plus de 4 à la fois), vérifie chaque `sha256`, valide les grilles selon le § 5.4 et enregistre le tout dans IndexedDB.
   - En cas d'échec, rien n'est installé à moitié.
4. Lors d'une mise à jour, les images et grilles dont l'`id` est inchangé conservent la progression du joueur.
5. L'utilisateur peut supprimer un élément pour libérer de la place.

## 7. Monétisation future (réservé, à ne pas implémenter en v1)

- L'index pourra contenir des éléments avec `acces` = `"abonnement"` ou `"achat"`, ainsi qu'un champ `prix` (par exemple `{ "montant": 2.99, "devise": "EUR" }`).
- Les manifestes de ces éléments exigeront `Authorization: Bearer <jeton>` et répondront `401` sans jeton ou `403` si le jeton ne donne pas accès à l'élément. Le mode d'obtention du jeton (compte, achat intégré, code cadeau) sera spécifié plus tard.
- Les URLs d'images d'un élément payant pourront être signées et expirer. L'appli copie les images dans IndexedDB dès le téléchargement et n'a donc pas besoin d'URLs permanentes.
- En v1, tous les éléments sont `"libre"` et aucune authentification n'est demandée.

## 8. Recette : ce qu'il faut fournir pour valider

1. L'URL `{BASE}`.
2. Un index contenant au moins **2 packs d'images** de 8 images ou plus, et **1 carnet** de 5 grilles ou plus, si possible de niveaux variés.
3. Un script de validation côté serveur, appliquant les règles des § 4.2 et 5.4, exécuté avant chaque publication.
4. La vérification des en-têtes : CORS depuis l'origine de l'appli, `ETag` et réponse `304` sur l'index, `immutable` sur les fichiers.

Je testerai l'intégration depuis l'appli avec ces éléments et signalerai tout écart.
