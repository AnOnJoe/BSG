/**
 * THÈMES DE VAGUE.
 *
 * Le problème d'origine : `_composeWave` renvoyait la même composition dès la
 * vague 3, et seuls les PV montaient. Vague 5 et vague 25 étaient le même combat
 * contre des sacs de points de vie — rien à réapprendre, jamais.
 *
 * Chaque thème demande une réponse DIFFÉRENTE, et donc un emploi différent des
 * postes :
 *  - NUÉE            → beaucoup de petites cibles vives : IEM et canon anti-drone ;
 *  - COLONNE BLINDÉE → peu de cibles très coriaces : missiles, tir focalisé, mode SEMI ;
 *  - PORTE-DRONES    → l'essaim est la vraie menace : défense rapprochée, escadron en escorte ;
 *  - HARCÈLEMENT     → rapides et dispersés : le barreur compte plus que l'artilleur ;
 *  - GROUPE DE COMBAT→ mixte, il faut arbitrer les priorités.
 *
 * `weight` : à partir de quelle progression (0 → 1) le thème peut sortir. Les
 * thèmes lourds n'apparaissent pas d'entrée.
 */
export const WAVE_THEMES = {
  // ⚠ Les deux thèmes du PREMIER secteur, renforcés d'une coque chacun : « sur le 1er
  // saut ça manque un peu d'action, de vaisseaux ennemis ». À 3-4 chasseurs légers
  // étalés sur un couloir de 8 écrans, l'assaut se dissolvait — on voyait deux points
  // orange mordre un transport au loin. La difficulté réelle bouge peu (chasseurs et
  // raiders restent les coques les plus faibles), c'est la DENSITÉ à l'écran qui monte.
  patrol: {
    id: 'patrol', name: 'PATROUILLE', from: 0,
    comp: ['raider', 'raider', 'fighter', 'fighter'],
  },
  harass: {
    id: 'harass', name: 'HARCÈLEMENT', from: 0.1,
    comp: ['fighter', 'fighter', 'fighter', 'fighter', 'raider'],
  },
  swarm: {
    id: 'swarm', name: 'NUÉE', from: 0.25,
    comp: ['fighter', 'fighter', 'fighter', 'fighter', 'fighter', 'fighter', 'fighter'],
  },
  carriers: {
    id: 'carriers', name: 'ESCADRE PORTE-DRONES', from: 0.3,
    comp: ['carrier', 'carrier', 'fighter'],
  },
  armored: {
    id: 'armored', name: 'COLONNE BLINDÉE', from: 0.45,
    comp: ['gunship', 'gunship', 'raider'],
  },
  battle: {
    id: 'battle', name: 'GROUPE DE COMBAT', from: 0.6,
    comp: ['gunship', 'carrier', 'raider', 'raider', 'fighter'],
  },
  siege: {
    id: 'siege', name: 'FORCE DE SIÈGE', from: 0.8,
    comp: ['gunship', 'gunship', 'carrier', 'carrier', 'raider', 'fighter'],
  },
};

/** Thème du cuirassé : pas de composition, l'escorte est réduite au minimum. */
export const CAPITAL_THEME = { id: 'capital', name: 'CUIRASSÉ', comp: ['raider'] };

/**
 * Choisit un thème parmi ceux autorisés par le secteur, jouables à cette
 * progression, en évitant de répéter le précédent : la variété est le sujet.
 */
export function pickTheme(allowed, progress, previousId) {
  const pool = allowed
    .map((id) => WAVE_THEMES[id])
    .filter((t) => t && t.from <= progress);
  if (!pool.length) return WAVE_THEMES.patrol;
  const fresh = pool.filter((t) => t.id !== previousId);
  const list = fresh.length ? fresh : pool;
  return list[Math.floor(Math.random() * list.length)];
}
