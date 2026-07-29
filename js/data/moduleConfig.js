import { PALETTE } from '../core/NeonMaterials.js';

/**
 * Catalogue data-driven des modules. Chaque module :
 *  - kind    : 'weapon' | 'interceptor' | 'radar' | 'passive'
 *  - slotType: type de slot requis ('weapon' | 'engine' | 'utility')
 *  - levels  : tableau des stats par niveau (1 → N). Monter de niveau
 *              ré-applique stats + visuel.
 *
 * Ajouter un module = ajouter une entrée ici + (si comportement spécifique)
 * une petite classe dans entities/modules/.
 */
export const MODULE_CONFIG = {
  laser: {
    id: 'laser', name: 'Canon Laser', kind: 'weapon', slotType: 'weapon',
    color: PALETTE.laser,
    levels: [
      { damage: 6,  fireRate: 7,  range: 84, energyCost: 5 },
      { damage: 10, fireRate: 9,  range: 97, energyCost: 7 },
      { damage: 16, fireRate: 11, range: 109, energyCost: 9 },
    ],
  },

  missile: {
    id: 'missile', name: 'Lance-Missiles', kind: 'weapon', slotType: 'weapon',
    color: PALETTE.missile,
    levels: [
      // ⚠ VITESSE à l'échelle (×2,1) en même temps que la portée. Restée à 22-30, elle
      // rendait le missile inutile contre un chasseur : avec `enemySpeedMul` passé de
      // 0,6 à 1,26, celui-ci file à 18,9 — la tête chercheuse ne le rattrapait plus
      // qu'à 3 unités/s. Une arme autoguidée doit rester NETTEMENT plus rapide que sa
      // cible, sinon elle ne poursuit pas, elle accompagne.
      { damage: 34, fireRate: 1.4, speed: 46, range: 126, ammo: 6 },
      { damage: 52, fireRate: 1.8, speed: 55, range: 147, ammo: 9 },
      { damage: 78, fireRate: 2.3, speed: 63, range: 168, ammo: 12 },
    ],
  },

  ciws: {
    id: 'ciws', name: 'Canon Anti-Drone', kind: 'weapon', slotType: 'weapon',
    color: 0xffe066, // jaune flak
    // `targets: 'small'` => ne tire QUE sur les drones. `autoTrack` => conduite de
    // tir automatique : pas d'erreur humaine (contrairement au laser, que la
    // vivacité des drones met systématiquement en échec).
    targets: 'small',
    autoTrack: true,
    levels: [
      { damage: 3, fireRate: 14, range: 34, energyCost: 0.8 },
      { damage: 4, fireRate: 18, range: 40, energyCost: 0.9 },
      { damage: 5, fireRate: 22, range: 46, energyCost: 1.0 },
    ],
  },

  interceptor: {
    id: 'interceptor', name: 'Baie Intercepteurs', kind: 'interceptor', slotType: 'weapon',
    color: PALETTE.interceptor,
    levels: [
      { count: 2, orbitSpeed: 1.0, radius: 4.5 },
      { count: 3, orbitSpeed: 1.3, radius: 5.2 },
      { count: 4, orbitSpeed: 1.6, radius: 6.0 },
    ],
  },

  reactor: {
    id: 'reactor', name: 'Réacteur', kind: 'passive', slotType: 'engine',
    color: PALETTE.reactor,
    // power = régénération d'énergie/s, energyCap = capacité ajoutée
    levels: [
      { thrust: 5,  power: 14, energyCap: 40 },
      { thrust: 8,  power: 22, energyCap: 70 },
      { thrust: 12, power: 32, energyCap: 110 },
    ],
  },

  shield: {
    id: 'shield', name: 'Bouclier', kind: 'passive', slotType: 'utility',
    color: PALETTE.shield,
    levels: [
      { shieldHp: 40 },
      { shieldHp: 80 },
      { shieldHp: 140 },
    ],
  },

  armor: {
    id: 'armor', name: 'Armure', kind: 'passive', slotType: 'utility',
    color: PALETTE.armor,
    levels: [
      { armorHp: 60 },
      { armorHp: 120 },
      { armorHp: 200 },
    ],
  },

  emp: {
    id: 'emp', name: 'IEM', kind: 'emp', slotType: 'weapon',
    color: 0x8fdfff,
    // radius = rayon d'effet, stun = paralysie des vaisseaux (s), cooldown = recharge (s)
    levels: [
      { radius: 12, stun: 1.0, cooldown: 12 },
      { radius: 16, stun: 1.5, cooldown: 10 },
      { radius: 20, stun: 2.0, cooldown: 8 },
    ],
  },

  radar: {
    id: 'radar', name: 'Radar', kind: 'radar', slotType: 'utility',
    color: PALETTE.radar,
    levels: [
      { range: 42, maxTargets: 1 },
      { range: 63, maxTargets: 2 },
      { range: 88, maxTargets: 3 },
    ],
  },
};

/** Coût d'achat/équipement d'un module (crédits). */
export const MODULE_COST = {
  laser: 300, missile: 350, interceptor: 450, ciws: 280, emp: 450, reactor: 250, shield: 350, armor: 300, radar: 200,
};

/** Coût pour améliorer un module actuellement au niveau `level` (vers level+1). */
export function upgradeCost(level) { return level * 250; }

/** Modules acceptés par type de slot (pour le menu du hangar). */
export const SLOT_ACCEPTS = {
  weapon: ['laser', 'missile', 'ciws', 'interceptor', 'emp'],
  engine: ['reactor'],
  utility: ['radar', 'shield', 'armor'],
};

/** Build par défaut au tout premier lancement (jouable d'emblée). */
export const DEFAULT_BUILD = [
  { slotId: 'dorsal_fwd', moduleId: 'laser', level: 1 },
  { slotId: 'core', moduleId: 'radar', level: 1 },
  { slotId: 'engine', moduleId: 'reactor', level: 1 },
];
