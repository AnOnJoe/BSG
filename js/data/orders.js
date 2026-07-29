import { TUNE } from '../core/Tune.js';

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

/**
 * Poste PILOTE — conduite du vaisseau.
 *
 * TENIR est né d'une partie test : « quand je suis capitaine je voudrais pouvoir
 * ordonner au pilote de ne pas bouger ». Il manquait, et son absence était une
 * vraie gêne — les trois autres consignes *font* toutes quelque chose, il n'y avait
 * aucun moyen de dire « reste là ». C'est pourtant la consigne qu'on veut pour
 * couvrir un point, attendre un traînard, ou tenir la flotte groupée dans la bulle
 * avant d'amorcer.
 *
 * ⚠ Elle immobilise aussi la flotte quand celle-ci est en RALLIEMENT (elle suit la
 * baleine) : c'est justement l'usage principal.
 */
export const HELM_ORDERS = [
  { id: 'engage', name: 'ENGAGER' },
  { id: 'hold', name: 'TENIR' },
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
 *  - RALLIEMENT: ils convergent sur la baleine et la SUIVENT — c'est toi qui
 *                mènes. Tous dans la bulle de saut, tous couvrables — mais une
 *                cible dense, et ils n'avancent plus par eux-mêmes vers la sortie
 *                du secteur (donc le calcul reste perturbé si tu traînes).
 *  - DISPERSER : ils s'écartent au large. Les Cylons doivent choisir et les pertes
 *                se diluent — mais on ne peut plus tous les couvrir, et il faudra
 *                les RAPPELER avant d'amorcer le saut, ce qui prend du temps.
 *  - FORCER    : plein régime. On traverse plus vite, donc on subit moins
 *                d'assauts — mais les moteurs s'usent et la coque part avec.
 *
 * Le lien avec le saut est le nerf de l'affaire : on ne saute qu'en étant serré.
 */
export const FLEET_ORDERS = [
  // `spread` 0,16 donnait ±17 par créneau, plus les décalages personnels : la
  // flotte sortait de la hauteur visible (±28). Réduit pour qu'elle tienne à l'écran.
  { id: 'tighten', name: 'RALLIEMENT', speedMul: 0.95, spread: 0.1, wear: 0, follow: true },
  { id: 'disperse', name: 'DISPERSER', speedMul: 1.0,
    get spread() { return 1.05 * TUNE.fleetSpreadMul; }, wear: 0 },
  // FORCER est le sommet du triangle qui se paie : allure contre usure. Les deux
  // chiffres sont réglables (panneau T) parce que c'est là que l'équilibre se joue.
  { id: 'push', name: 'FORCER', get speedMul() { return TUNE.fleetPushSpeed; },
    get spread() { return 0.34 * TUNE.fleetSpreadMul; },
    get wear() { return TUNE.fleetPushWear; } },
];

/**
 * Poste INGÉNIEUR — priorité de réparation des sections de coque.
 *
 * `sections` restreint le champ de l'équipage. Aucune de ces trois consignes n'est
 * bonne partout : ARMEMENT rend du feu mais laisse la propulsion en vrac (donc on
 * ne peut plus rompre), PROPULSION rend la manœuvre mais on tire moins, et
 * AVARIES colmate le plus abîmé — ce qui est souvent la section la moins utile,
 * puisque le plus abîmé n'est pas le plus nécessaire.
 */
export const ENGINEER_ORDERS = [
  { id: 'damage', name: 'AVARIES', sections: null },
  { id: 'weapons', name: 'ARMEMENT', sections: ['bow', 'core', 'aft'] },
  { id: 'engines', name: 'PROPULSION', sections: ['engines'] },
];

/** Poste DRONES — emploi de l'escadron. */
export const DRONE_ORDERS = [
  { id: 'attack', name: 'ATTAQUE' },
  { id: 'escort', name: 'ESCORTE' },
  { id: 'recall', name: 'REPLI' },
];
