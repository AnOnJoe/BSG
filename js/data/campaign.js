/**
 * LA FUITE. Structure reprise de la première saison : les Cylons retrouvent la
 * flotte à chaque fois, on ne sait pas comment, et le seul recours est de sauter.
 * Un « secteur » n'est donc plus une arène à nettoyer mais un SAUT à préparer :
 * traverser le couloir jusqu'au point de saut en tenant le calcul FTL.
 *
 * La difficulté ne monte pas par les PV mais par la PRESSION : calcul plus long,
 * assauts plus rapprochés, thèmes plus lourds. Les Cylons n'ont pas de nombre
 * fini — c'est l'échéance qu'on affronte, pas un stock d'ennemis.
 */
export const SECTORS = [
  {
    id: 'ragnar', name: 'NÉBULEUSE DE RAGNAR',
    subtitle: 'Premier saut · ils nous ont déjà retrouvés',
    terrain: 'asteroids',
    // Traversée du couloir : ~167 s (668 unités à 4,0/s, la vitesse du plus lent).
    // Le calcul doit aboutir AVANT, pour qu'on passe la fin à couvrir le traînard
    // en sachant qu'on pourrait partir — c'est là qu'est le dilemme. L'écart se
    // resserre de secteur en secteur : 57 s ici, 2 s à la Porte.
    ftlTime: 110,       // secondes de calcul au rythme normal
    assaultEvery: 26,   // intervalle entre deux assauts (s)
    themes: ['patrol', 'harass'],
    capital: false,
  },
  {
    id: 'ceinture', name: 'LA CEINTURE',
    subtitle: 'Roches serrées · radar aveugle',
    terrain: 'belt',
    ftlTime: 125,
    assaultEvery: 23,
    themes: ['harass', 'swarm', 'patrol'],
    capital: false,
  },
  {
    id: 'cimetiere', name: 'CIMETIÈRE DE COQUES',
    subtitle: 'Les restes d\'une autre flotte',
    terrain: 'wreck',
    ftlTime: 140,
    assaultEvery: 20,
    themes: ['carriers', 'swarm', 'armored'],
    capital: true,      // un basestar coupe la route
  },
  {
    id: 'blocus', name: 'LE BLOCUS',
    subtitle: 'Vide dégagé · rien pour se cacher',
    terrain: 'void',
    ftlTime: 150,
    assaultEvery: 18,
    themes: ['armored', 'battle', 'carriers'],
    capital: false,
  },
  {
    id: 'porte', name: 'LA PORTE',
    subtitle: 'Dernier saut avant le refuge',
    terrain: 'hulks',
    ftlTime: 165,
    assaultEvery: 16,
    themes: ['battle', 'siege', 'swarm'],
    capital: true,
  },
];

/** Remise en état après un saut : on répare avec ce qu'on a, jamais tout. */
export const JUMP_REPAIR = { structure: 40, ammo: true, credits: 240 };

export function sectorAt(i) { return SECTORS[Math.min(i, SECTORS.length - 1)]; }
export const SECTOR_COUNT = SECTORS.length;
