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
    clusters: [],
  },

  asteroids: {
    id: 'asteroids', name: 'CHAMP D\'ASTÉROÏDES',
    clusters: [
      { kind: 'rock', count: 14, rMin: 4, rMax: 11, spread: 0.85 },
    ],
  },

  belt: {
    id: 'belt', name: 'CEINTURE DENSE',
    clusters: [
      { kind: 'rock', count: 22, rMin: 3, rMax: 9, spread: 0.9 },
      { kind: 'dust', count: 5, rMin: 16, rMax: 26, spread: 0.8 },
    ],
  },

  wreck: {
    id: 'wreck', name: 'CIMETIÈRE DE COQUES',
    clusters: [
      { kind: 'hulk', count: 3, rMin: 12, rMax: 18, spread: 0.6 },
      { kind: 'rock', count: 8, rMin: 3, rMax: 7, spread: 0.9 },
      { kind: 'dust', count: 3, rMin: 18, rMax: 28, spread: 0.7 },
    ],
  },
};

/** Aspect de chaque type d'obstacle. `blocks` = coupe les tirs et les coques. */
export const OBSTACLE_KINDS = {
  // Arêtes franchement lumineuses : un obstacle sombre serait invisible dans un
  // décor néon, alors qu'il arrête les tirs ET la coque. Il doit se lire d'un
  // coup d'œil. Le remplissage reste sombre et opaque (il masque le fond).
  rock: { blocks: true, color: 0xd8bb92, fill: 0x1d1a18, faces: 9, jag: 0.32 },
  hulk: { blocks: true, color: 0x9fc6dc, fill: 0x141c22, faces: 13, jag: 0.18 },
  // Poussière : traversable, mais elle brouille le radar (aveugle l'équipage)
  dust: { blocks: false, color: 0x5a4a6b, fill: 0x120e18, faces: 16, jag: 0.1, jams: true },
};
