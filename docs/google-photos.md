# Import depuis Google Photos — mise en place

L'appli choisit une photo dans Google Photos grâce à l'API **Google Photos Picker**. Tout se passe dans le navigateur : il n'y a pas de serveur intermédiaire et la photo ne transite que de Google vers la tablette.

Tant que l'identifiant client n'est pas renseigné, le bouton « Google Photos » est masqué et seul « Photos de la tablette » est proposé.

## 1. Créer le projet Google Cloud (une fois)

1. Ouvrir https://console.cloud.google.com/ et créer un projet, par exemple « Mes jeux ».
2. **API et services → Bibliothèque** : activer **Google Photos Picker API**.
3. **Google Auth Platform** (écran de consentement OAuth) :
   - **Branding** : nom de l'appli (« Mes jeux »), adresse d'assistance, logo facultatif.
   - **Audience** : type « Externe », statut « En test ». Ajouter comme **utilisateurs test** les comptes Google qui vont importer des photos.
   - **Accès aux données** : ajouter le champ d'application `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`.
4. **Clients → Créer un client** :
   - type **Application Web** ;
   - **Origines JavaScript autorisées** : `https://kishloren.github.io`, et `http://localhost:8787` pour les essais en local ;
   - aucune URI de redirection n'est nécessaire.
5. Copier l'**ID client** (de la forme `123…-abc….apps.googleusercontent.com`) dans `CLIENT_ID`, en tête de `js/google-photos.js`. Cet identifiant n'est pas un secret : il peut figurer dans le dépôt public.

## 2. Déroulé pour l'utilisateur

1. Puzzle → « Ajouter une photo » → « Google Photos ».
2. Fenêtre de connexion Google : choisir le compte et accepter. Tant que l'appli n'est pas vérifiée par Google, un avertissement « Application non validée » s'affiche ; il faut passer par « Paramètres avancés → Accéder à Mes jeux ».
3. Bouton « Ouvrir Google Photos » : Google Photos s'ouvre (l'appli Google Photos sur Android, ou un onglet). On choisit une ou plusieurs photos (30 au plus), on valide, puis on revient dans Mes jeux.
4. L'appli détecte le choix, télécharge les photos (2400 px au plus) et ouvre le recadrage de chacune, l'une après l'autre.

L'autorisation Google dure une heure : au-delà, la fenêtre de connexion réapparaît (souvent sans rien à saisir).

## 3. Points à vérifier au premier essai

- **Téléchargement depuis le navigateur.** La documentation de Google ne dit pas si l'adresse de la photo (`baseUrl`) accepte les requêtes faites depuis une page web. Si le message « Google Photos n'a pas répondu » apparaît après le choix, c'est la cause probable ; il faudrait alors un petit relais sur le serveur stansgames.fr.
- **Retour dans l'appli** après le choix dans Google Photos, sur la tablette : l'appli continue d'interroger Google à son retour au premier plan.

## 4. Avant une diffusion publique

- Google impose une **vérification de l'application** pour toute appli publique utilisant les API Google Photos ; en mode test, l'accès est limité aux utilisateurs test déclarés.
- Une page de règles de confidentialité et des conditions d'utilisation seront demandées.

## 5. Alternative sans configuration

Le bouton « Photos de la tablette » ouvre le sélecteur de photos d'Android. Sur la plupart des tablettes Android récentes, ce sélecteur affiche aussi les photos de Google Photos, y compris celles qui ne sont que dans le cloud, sans aucune configuration ni vérification Google.
