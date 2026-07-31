import { TUNE } from '../core/Tune.js';

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
    // DEUX HORLOGES distinctes :
    //  - les 33 minutes = délai avant l'arrivée des Cylons (jouées au CIC) ;
    //  - le calcul de saut tourne PENDANT ce répit et arrive INCOMPLET au
    //    contact (`ftlPreCharge`), puis il reste `ftlTime` secondes à tenir.
    // Traversée du couloir : ~167 s (668 unités à 4,0/s, le plus lent commande).
    // Le calcul aboutit avant l'arrivée du traînard, et l'écart se resserre de
    // secteur en secteur : 57 s ici, 2 s à la Porte.
    ftlPreCharge: 74,   // % de calcul acquis pendant les 33 minutes
    ftlTime: 110,       // secondes de calcul RESTANT après le contact
    // ⚠ Les `assaultEvery` se comptent en secondes de JEU : l'introduction de
    // `gameSpeed` (0,8) les a donc tous étirés de 25 % en temps réel — 26 s de jeu
    // étaient devenues 32,5 s d'attente réelle, et le premier retour est tombé :
    // « sur le 1er saut ça manque un peu d'action, de vaisseaux ennemis ». L'échelle
    // 26/23/20/18/16 a été resserrée à 21/18/16/14/13 pour retrouver, à 0,8, le
    // rythme réel calibré à l'origine. Réglage global : `TUNE.assaultRateMul`.
    assaultEvery: 21,   // intervalle entre deux assauts (s de jeu)
    themes: ['patrol', 'harass'],
    capital: false,
  },
  {
    id: 'ceinture', name: 'LA CEINTURE',
    subtitle: 'Roches serrées · radar aveugle',
    terrain: 'belt',
    ftlPreCharge: 70,
    ftlTime: 125,
    assaultEvery: 18,
    themes: ['harass', 'swarm', 'patrol'],
    capital: false,
  },
  {
    id: 'cimetiere', name: 'CIMETIÈRE DE COQUES',
    subtitle: 'Les restes d\'une autre flotte',
    terrain: 'wreck',
    ftlPreCharge: 64,
    ftlTime: 140,
    assaultEvery: 16,
    themes: ['carriers', 'swarm', 'armored'],
    capital: true,      // un basestar coupe la route
  },
  {
    id: 'blocus', name: 'LE BLOCUS',
    subtitle: 'Vide dégagé · rien pour se cacher',
    terrain: 'void',
    ftlPreCharge: 58,
    ftlTime: 150,
    assaultEvery: 14,
    themes: ['armored', 'battle', 'carriers'],
    capital: false,
  },
  {
    id: 'porte', name: 'LA PORTE',
    subtitle: 'Dernier saut avant le refuge',
    terrain: 'hulks',
    ftlPreCharge: 50,
    ftlTime: 165,
    assaultEvery: 13,
    themes: ['battle', 'siege', 'swarm'],
    capital: true,
    // DÉNOUEMENT : ici, sauter ne suffit plus. Tant que le transport compromis
    // n'est pas identifié et détruit, la boucle recommence — et la seule autre
    // issue est l'extinction de la flotte. Cf. `core/SignalHunt.js`.
    finale: true,
  },
];

/**
 * Remise en état après un saut : on répare avec ce qu'on a, jamais tout.
 * `noWorkshop` s'applique si le REMORQUEUR est perdu — c'est lui qui porte
 * l'atelier (cf. `FLEET_ROLES` dans `data/convoyConfig.js`). Les munitions, elles,
 * ne se rechargent plus du tout : sans atelier on ne fabrique rien.
 */
export const JUMP_REPAIR = {
  get structure() { return TUNE.jumpRepairHull; },
  get noWorkshop() { return TUNE.jumpRepairNoWorkshop; },
  ammo: true,
  get salvage() { return TUNE.jumpRepairCredits; },
};

export function sectorAt(i) { return SECTORS[Math.min(i, SECTORS.length - 1)]; }
export const SECTOR_COUNT = SECTORS.length;
