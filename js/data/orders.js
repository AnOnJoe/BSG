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

/**
 * ORDRES À LA FLOTTE CIVILE (console du commandant).
 *
 * Trois consignes qui forment un vrai triangle : chacune est bonne contre une
 * situation et mauvaise contre les autres, et **aucune n'est jamais le bon choix
 * par défaut**.
 *
 *  - SERRER    : ils convergent sur la baleine. Tous dans la bulle de saut, tous
 *                couvrables — mais une cible dense (un tir manqué en touche un
 *                autre) et une allure réduite, puisqu'ils s'attendent.
 *  - DISPERSER : ils s'écartent au large. Les Cylons doivent choisir et les pertes
 *                se diluent — mais on ne peut plus tous les couvrir, et il faudra
 *                les RAPPELER avant d'amorcer le saut, ce qui prend du temps.
 *  - FORCER    : plein régime. On traverse plus vite, donc on subit moins
 *                d'assauts — mais les moteurs s'usent et la coque part avec.
 *
 * Le lien avec le saut est le nerf de l'affaire : on ne saute qu'en étant serré.
 */
export const FLEET_ORDERS = [
  { id: 'tighten', name: 'SERRER', speedMul: 0.85, spread: 0.16, wear: 0 },
  { id: 'disperse', name: 'DISPERSER', speedMul: 1.0, spread: 1.05, wear: 0 },
  { id: 'push', name: 'FORCER', speedMul: 1.35, spread: 0.34, wear: 1.7 },
];

/** Poste DRONES — emploi de l'escadron. */
export const DRONE_ORDERS = [
  { id: 'attack', name: 'ATTAQUE' },
  { id: 'escort', name: 'ESCORTE' },
  { id: 'recall', name: 'REPLI' },
];
