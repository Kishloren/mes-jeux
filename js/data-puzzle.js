// Réglages du puzzle. Les photos viennent de la Bibliothèque (js/bibliotheque.js).

// Découpes : chaque case de la grille donne 1, 2 ou 4 pièces.
window.PZ_COUPES = [
  { id: "rect", nom: "Rectangles", parts: 1 },
  { id: "diag2", nom: "2 triangles", parts: 2 }, // diagonale SO-NE
  { id: "diag4", nom: "4 triangles", parts: 4 }, // les deux diagonales
];

// Grille (colonnes × lignes) selon le niveau et la découpe.
window.PZ_NIVEAUX = [
  { id: "facile", nom: "Facile", rect: [4, 5], diag: [3, 4] },
  { id: "moyen", nom: "Moyen", rect: [5, 7], diag: [4, 5] },
  { id: "difficile", nom: "Difficile", rect: [6, 9], diag: [5, 7] },
  { id: "expert", nom: "Expert", rect: [7, 10], diag: [6, 9] },
];
