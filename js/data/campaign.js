/**
 * LA TRAVERSÉE. « Survivre à des vagues » n'a ni début, ni fin, ni direction :
 * `_end('victory')` existait dans le code mais n'était jamais appelé.
 *
 * On traverse maintenant une suite de SECTEURS jusqu'à un refuge. Chaque secteur
 * a son terrain, ses thèmes d'opposition et son nombre de vagues ; le dernier se
 * conclut sur un cuirassé. Franchir un secteur = un saut, avec réparations.
 *
 * `themes` restreint les thèmes de vague au caractère du secteur : la ceinture
 * grouille de petits chasseurs, le blocus aligne des bâtiments lourds.
 */
export const SECTORS = [
  {
    id: 'peripherie',
    name: 'PÉRIPHÉRIE',
    subtitle: 'Zone patrouillée · reprendre son souffle',
    terrain: 'asteroids',
    waves: 3,
    themes: ['patrol', 'harass'],
    capital: false,
  },
  {
    id: 'ceinture',
    name: 'LA CEINTURE',
    subtitle: 'Roches serrées · radar brouillé',
    terrain: 'belt',
    waves: 4,
    themes: ['harass', 'swarm', 'patrol'],
    capital: false,
  },
  {
    id: 'cimetiere',
    name: 'CIMETIÈRE DE COQUES',
    subtitle: 'Épaves à la dérive · embuscades',
    terrain: 'wreck',
    waves: 4,
    themes: ['carriers', 'swarm', 'armored'],
    capital: true,        // un cuirassé garde la sortie
  },
  {
    id: 'blocus',
    name: 'LE BLOCUS',
    subtitle: 'Vide dégagé · rien pour se cacher',
    terrain: 'void',
    waves: 4,
    themes: ['armored', 'battle', 'carriers'],
    capital: false,
  },
  {
    id: 'porte',
    name: 'LA PORTE',
    subtitle: 'Dernier verrou avant le refuge',
    terrain: 'wreck',
    waves: 5,
    themes: ['battle', 'siege', 'swarm'],
    capital: true,        // affrontement final
  },
];

/** Réparations offertes à chaque saut (le passage doit soigner, pas juste enchaîner). */
export const JUMP_REPAIR = { structure: 45, ammo: true, credits: 260 };

export function sectorAt(i) { return SECTORS[Math.min(i, SECTORS.length - 1)]; }
export const SECTOR_COUNT = SECTORS.length;
