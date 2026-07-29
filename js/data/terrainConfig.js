/**
 * TERRAINS. L'arène était un rectangle vide : on tournait en rond dans le même
 * néant, et la position sur la carte ne voulait rien dire.
 *
 * Un terrain est un jeu d'OBSTACLES (cercles) qui bloquent les tirs et les
 * coques. Dès lors, se placer devient une décision : on se met à couvert, on
 * coupe la ligne de vue d'une batterie, on force l'ennemi à contourner.
 *
 * `blocks` : un obstacle qui bloque les tirs (astéroïde, épave). Les nuages de
 * poussière, eux, ne bloquent rien — ils masquent seulement le radar.
 */
export const TERRAINS = {
  void: {
    id: 'void', name: 'VIDE PROFOND',
    // « Rien pour se cacher » ne veut pas dire un écran vide : des débris
    // lointains donnent l'échelle et le mouvement, sans offrir de couvert.
    clusters: [
      { kind: 'debris', count: 290, rMin: 0.7, rMax: 2.8, spread: 0.96 },
    ],
  },

  asteroids: {
    id: 'asteroids',
    lanes: 3, laneHalf: 14, name: 'CHAMP D\'ASTÉROÏDES',
    clusters: [
      // Volontairement CLAIRSEMÉ : le champ dense est réservé à « belt », sinon
      // le même motif se répète à chaque secteur.
      // ⚠ Comptes remontés avec le rescale : l'aire du couloir a été multipliée par
      // 4,4 (430×108 → 900×226), donc les valeurs d'avant vidaient le champ. Les
      // TAILLES ne bougent pas — c'est justement ce qui rend l'espace grand.
      { kind: 'rock', count: 34, rMin: 5, rMax: 16, spread: 0.92 },
      { kind: 'debris', count: 260, rMin: 0.8, rMax: 3.2, spread: 0.96 },
    ],
  },

  belt: {
    id: 'belt', name: 'CEINTURE DENSE',
    lanes: 3, laneHalf: 13,
    clusters: [
      { kind: 'rock', count: 120, rMin: 4, rMax: 15, spread: 0.94 },
      { kind: 'debris', count: 320, rMin: 0.7, rMax: 3.4, spread: 0.96 },
      { kind: 'dust', count: 26, rMin: 24, rMax: 48, spread: 0.9 },
    ],
  },

  hulks: {
    id: 'hulks',
    lanes: 2, laneHalf: 16, name: 'ÉPAVES DE GUERRE',
    clusters: [
      { kind: 'wreckage', count: 48, rMin: 13, rMax: 24, spread: 0.92 },
      { kind: 'debris', count: 400, rMin: 0.7, rMax: 3.8, spread: 0.96 },
      { kind: 'dust', count: 12, rMin: 28, rMax: 52, spread: 0.88 },
    ],
  },

  wreck: {
    id: 'wreck', name: 'CIMETIÈRE DE COQUES',
    lanes: 3, laneHalf: 15,
    clusters: [
      { kind: 'wreckage', count: 36, rMin: 11, rMax: 22, spread: 0.9 },
      { kind: 'hulk', count: 22, rMin: 8, rMax: 15, spread: 0.9 },
      { kind: 'rock', count: 58, rMin: 3, rMax: 8, spread: 0.92 },
      { kind: 'debris', count: 370, rMin: 0.7, rMax: 3.4, spread: 0.96 },
      { kind: 'dust', count: 18, rMin: 26, rMax: 48, spread: 0.88 },
    ],
  },
};

/** Aspect de chaque type d'obstacle. `blocks` = coupe les tirs et les coques. */
export const OBSTACLE_KINDS = {
  // `detail`/`jag`/`flat` pilotent le volume (cf. Terrain._rockGeo), `zSpread` la
  // profondeur, `spin` la dérive. Un décor figé et plat ne fait pas un lieu.
  // Arêtes franchement lumineuses : un obstacle sombre serait invisible dans un
  // décor néon, alors qu'il arrête les tirs ET la coque. Il doit se lire d'un
  // coup d'œil. Le remplissage reste sombre et opaque (il masque le fond).
  rock: { blocks: true, color: 0xd8bb92, fill: 0x1d1a18, detail: 1, jag: 0.85, flat: 0.8, zSpread: 6, spin: 0.18 },
  hulk: { blocks: true, color: 0x9fc6dc, fill: 0x141c22, detail: 1, jag: 0.45, flat: 0.6, zSpread: 5, spin: 0.1 },
  // Carcasses de vaisseaux : le décor de la série, des épaves qui dérivent
  wreckage: { blocks: true, wreck: true, color: 0x9fc6dc, fill: 0x141c22, zSpread: 6, spin: 0.07 },
  // Menus débris : ne bloquent rien, ils peuplent l'espace
  debris: { blocks: false, color: 0xa9b6c2, fill: 0x11161c, detail: 0, jag: 1.2, flat: 0.5, zSpread: 14, spin: 0.9 },
  // Poussière : traversable, mais elle brouille le radar (aveugle l'équipage)
  dust: { blocks: false, color: 0x5a4a6b, fill: 0x120e18, faces: 16, jag: 0.1, jams: true },
};
