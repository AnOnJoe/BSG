/**
 * PROGRESSION — ce que le vaisseau sait faire, et ce qu'il faut mériter.
 *
 * Deux griefs de partie test, et ils tiennent ensemble :
 *
 * 1. « au départ il ne devrait pas y avoir autant de modules dispo ni
 *    d'emplacements dispo — il faudrait pouvoir les débloquer ». Tout était ouvert
 *    d'emblée : douze emplacements, neuf modules, et un stock de départ qui
 *    permettait de tout tester tout de suite. Il n'y avait donc rien à découvrir et
 *    rien à espérer, alors que la traversée est censée être une descente où l'on
 *    bricole avec ce qu'on trouve.
 *
 * 2. « l'argent n'est pas une bonne monnaie vu que c'est notre flotte et nos
 *    ingénieurs ». Exact : il n'y a personne à qui acheter. On ne paie pas, on
 *    RÉCUPÈRE et on FABRIQUE. D'où deux ressources qui ne se remplacent pas :
 *
 *    - le MATÉRIEL, arraché aux épaves, aux Cylons abattus et aux décisions du CIC.
 *      C'est le stock de pièces.
 *    - les CHANTIERS, la capacité de l'équipe de pont pendant une escale. Ils se
 *      renouvellent à chaque saut et ne s'accumulent pas.
 *
 *    C'est cette seconde ressource qui fait le jeu : avec dix mille pièces en soute
 *    on ne peut toujours mener que deux travaux entre deux sauts. On ne demande donc
 *    plus « ai-je les moyens ? » mais « qu'est-ce qui passe en premier ? ». Et elle
 *    est liée au REMORQUEUR (l'atelier, cf. `FLEET_ROLES`) : le perdre, c'est perdre
 *    la moitié de sa capacité de travail.
 *
 * Les PLANS complètent le tableau : un module inconnu ne s'achète pas, son plan se
 * récupère — dans les épaves d'un secteur, ou en démontant un cuirassé.
 */

/** Emplacements aménagés au tout premier départ. Les autres sont des coques nues. */
export const START_SLOTS = ['dorsal_fwd', 'core', 'engine'];

/**
 * Coût d'AMÉNAGEMENT d'un emplacement, par type. Aménager n'est pas équiper : on
 * tire les câbles, on renforce le bâti. Un emplacement d'arme coûte plus cher qu'un
 * utilitaire — il faut l'alimenter et encaisser le recul.
 */
export const SLOT_FITOUT = { weapon: 260, engine: 220, utility: 160 };

/** Modules dont on a les plans au départ : le strict nécessaire pour tenir. */
export const START_PLANS = ['laser', 'reactor', 'radar'];

/**
 * Plans récupérables, dans l'ordre où ils deviennent disponibles. À l'arrivée dans
 * un secteur, on récupère `PLANS_PER_SECTOR` plans de cette liste (les premiers non
 * encore acquis) — la progression est donc lisible et jamais bloquée par le hasard.
 * Démonter un cuirassé en donne un de plus (cf. `Range._destroyCapital`).
 */
export const PLAN_ORDER = ['armor', 'shield', 'missile', 'ciws', 'interceptor', 'emp'];
export const PLANS_PER_SECTOR = 1;

/** Libellé de chaque plan pour l'annonce au journal. */
export const PLAN_SOURCE = {
  armor: 'plaques de blindage relevées sur une épave',
  shield: 'schéma de générateur de bouclier',
  missile: 'rampe de lancement récupérée intacte',
  ciws: 'plans d\'un canon de défense rapprochée',
  interceptor: 'baie d\'intercepteurs remontée pièce par pièce',
  emp: 'condensateurs d\'impulsion, encore chargés',
};

/**
 * CHANTIERS disponibles par escale. Avec l'atelier (le remorqueur) on en mène
 * `withWorkshop` ; sans lui, `withoutWorkshop`. L'écart est le prix réel de cette
 * coque de 900 âmes qu'on est tenté d'abandonner.
 */
export const WORKS = { withWorkshop: 2, withoutWorkshop: 1 };

/** Matériel en soute au tout premier départ : de quoi un seul travail, pas trois. */
export const START_SALVAGE = 320;
