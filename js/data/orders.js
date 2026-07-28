/**
 * CONSIGNES données à l'équipage. Elles vivent ici (et non dans `Range`) parce
 * que le HUD comme le champ de tir en ont besoin : les mettre dans `Range`
 * créerait un cycle d'imports avec `Hud`.
 *
 * Distinction structurante du jeu :
 *  - la CONSIGNE dit QUOI faire. Le commandant peut la poser pour n'importe quel
 *    poste depuis sa console — c'est son métier, commander.
 *  - l'EXÉCUTION est le COMMENT, et n'appartient qu'au poste : barrer à la main,
 *    viser soi-même, désigner la cible de l'escadron.
 * L'équipage applique la consigne sans jamais l'adapter ; le joueur juge du moment.
 */

/** Poste PILOTE — conduite du vaisseau. */
export const HELM_ORDERS = [
  { id: 'engage', name: 'ENGAGER' },
  { id: 'salvage', name: 'RÉCUPÉRER' },
  { id: 'break', name: 'ROMPRE' },
];

/** Poste DRONES — emploi de l'escadron. */
export const DRONE_ORDERS = [
  { id: 'attack', name: 'ATTAQUE' },
  { id: 'escort', name: 'ESCORTE' },
  { id: 'recall', name: 'REPLI' },
];
