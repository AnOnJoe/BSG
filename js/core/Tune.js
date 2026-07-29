/**
 * Valeurs d'équilibrage ajustables EN JEU (panneau « Réglages », touche T).
 * Le code lit ces valeurs en direct ; le panneau les modifie via des jauges.
 * Quand un réglage te convient, le bouton « Copier » exporte ce JSON et on
 * fige les chiffres dans le code (Ship / moduleConfig / Range / EnemyShip).
 */
export const TUNE = {
  energyRegen: 12,     // régén d'énergie de base (hors réacteurs), /s
  laserCostMul: 1.0,   // multiplicateur du coût énergie du laser
  manualAimBonus: 1.15, // dégâts (×) quand le joueur tient la tourelle lui-même
  stationSwitchTime: 1.5, // temps d'installation à un nouveau poste (s)
  helmStandoff: 24,     // distance de combat que tient le barreur IA
  helmEscortDist: 16,   // distance à laquelle il escorte un civil (plus serré)
  helmReactionTau: 0.8, // retard de réaction du barreur IA (s) : il barre mollement
  // --- Conduite de tir de l'ÉQUIPAGE (il n'est pas une machine : il rate) ---
  crewReactionTau: 0.35, // retard de suivi de la cible (s) : rate ce qui manœuvre
  crewAcquireTime: 0.5,  // temps de verrouillage avant le premier tir (s)
  crewSpread: 0.10,      // dispersion angulaire (rad) à la portée maximale
  crewNoRadarMul: 2.5,   // dispersion (×) sur une cible hors portée radar
  crewBiasTime: 0.5,     // durée d'un même biais de visée (s) : rafales cohérentes
  crewHoldFactor: 3,     // au-delà de ce ratio erreur/taille de cible, l'équipage ne tire plus
  powerOutputMul: 1.4, // débit total des réacteurs (×) réparti entre les 3 bus
  shieldRegenPerPower: 1.0, // PV de bouclier régénérés par point de débit du bus boucliers
  powerShiftTime: 0.6, // durée de bascule d'un profil d'énergie à l'autre (s)
  engineMinMul: 0.4,   // accél./virage quand le bus moteurs est à 0 % (1.0 au tiers)
  slowMoScale: 0.25,   // vitesse du temps quand l'anneau de passerelle est ouvert
  shipAccel: 7,        // accélération de la baleine
  shipDrag: 0.7,       // traînée (plus haut = s'arrête plus vite)
  angAccel: 3.0,       // accélération de virage
  angDrag: 1.8,        // amortissement du virage
  // Rythme : jeu de POSTES, pas de beat'em all. Le combat doit laisser le temps
  // de changer de poste et de décider — d'où des ennemis lents, qui tirent
  // moins souvent, arrivent de plus loin, et des vagues espacées.
  enemySpeedMul: 0.6,  // vitesse des ennemis (×)
  enemyFireMul: 1.6,   // cadence de tir ennemi (× l'intervalle : >1 = tire moins souvent)
  spawnDist: 78,       // distance d'apparition des ennemis (approche longue et lisible)
  waveBreak: 8,        // respiration entre deux vagues (s) — hérité, peu utilisé
  ftlChargeRate: 1.0,  // multiplicateur global du calcul de saut (le rythme de
                       // base vient de sector.ftlTime, pas d'ici)
  // « 33 » : dans la série les Cylons reviennent toutes les 33 minutes. On affiche
  // ce décompte en temps FICTION, comprimé par ce facteur pour tenir dans une
  // partie (33 min / 16.5 ≈ 2 min de répit réel avant le premier contact).
  dradisCompress: 16.5,
  ftlMinClarity: 0.42, // qualité du calcul À L'ENTRÉE du couloir (perturbation du
                       // saut précédent) : avancer vers la sortie la ramène à 1,
                       // ce qui donne une raison mécanique de traverser
  jumpSpoolTime: 5.5,  // amorçage du saut : durée d'immobilité vulnérable (s)
  contactDelay: 12,    // sursis à l'arrivée dans le couloir avant le contact (s)
                       // — les 33 minutes sont jouées au CIC, pas ici
  cylonPlayerAggro: 26, // en dessous de cette distance, un Cylon traite la baleine
                        // avant les civils ; au-delà il va droit sur la flotte
  capitalCamZoom: 1.55, // recul de caméra (×) quand un cuirassé est en vue
  viewZoom: 1.15,      // recul de caméra général (vue plus large)
  screenRefH: 800,     // hauteur d'écran de référence : en dessous, on dézoome d'autant
  shieldRadius: 9,     // rayon de la bulle de bouclier
  pickupEvery: 15,     // délai moyen entre bonus (s)
  pickupLife: 22,      // durée de vie d'un bonus avant disparition (s)
  repairAmount: 45,    // PV de coque rendus par un kit de réparation
  shipPivot: 3.5,      // pivot de rotation vers la proue (0 = centre)
  // DEUX portées distinctes, et il faut les séparer : détecter un écho n'est pas
  // avoir une solution de tir. Un DRADIS qui porte loin ne doit pas rendre
  // l'équipage précis partout (cf. crewNoRadarMul).
  radarRangeMul: 1.5,   // portée utile à la CONDUITE DE TIR
  dradisRangeMul: 11,   // portée d'AFFICHAGE du DRADIS (couvre le couloir)
  empRangeMul: 1,      // rayon d'effet de l'IEM (× le rayon du module)
};

// Copie des valeurs par défaut (pour le bouton Réinitialiser)
const DEFAULTS = { ...TUNE };
const TKEY = 'bsg.tune.v1';

/** Charge les réglages persistés (localStorage) par-dessus les valeurs par défaut. */
export function loadTune() {
  try {
    const raw = localStorage.getItem(TKEY);
    if (raw) {
      const data = JSON.parse(raw);
      for (const k of Object.keys(DEFAULTS)) if (typeof data[k] === 'number') TUNE[k] = data[k];
    }
  } catch (e) { /* ignore */ }
}

/** Persiste les réglages courants en JSON. */
export function saveTune() {
  try { localStorage.setItem(TKEY, JSON.stringify(TUNE)); } catch (e) { /* ignore */ }
}

/** Restaure les valeurs par défaut (et persiste). */
export function resetTune() {
  Object.assign(TUNE, DEFAULTS);
  saveTune();
}

/** Descripteurs des jauges du panneau : [clé, label, min, max, pas]. */
export const TUNE_SPECS = [
  ['energyRegen', 'Régén énergie /s', 0, 40, 1],
  ['laserCostMul', 'Coût laser (×)', 0.2, 2, 0.1],
  ['manualAimBonus', 'Bonus tir manuel (×)', 1, 2.5, 0.05],
  ['stationSwitchTime', 'Changement de poste (s)', 0, 4, 0.1],
  ['helmStandoff', 'Barreur IA : distance tenue', 10, 40, 1],
  ['helmEscortDist', 'Barreur IA : distance d\'escorte', 6, 40, 1],
  ['helmReactionTau', 'Barreur IA : mollesse (s)', 0.1, 2, 0.1],
  ['crewReactionTau', 'Équipage : retard suivi (s)', 0.05, 1.5, 0.05],
  ['crewAcquireTime', 'Équipage : verrouillage (s)', 0, 2, 0.1],
  ['crewSpread', 'Équipage : dispersion (rad)', 0, 0.4, 0.01],
  ['crewNoRadarMul', 'Équipage : sans radar (×)', 1, 5, 0.25],
  ['crewBiasTime', 'Équipage : durée du biais (s)', 0.1, 2, 0.1],
  ['crewHoldFactor', 'Équipage : seuil abandon tir', 1, 8, 0.5],
  ['powerOutputMul', 'Débit réacteurs (×)', 0.6, 2.5, 0.1],
  ['shieldRegenPerPower', 'Régén bouclier / débit', 0.2, 2, 0.1],
  ['powerShiftTime', 'Bascule profil (s)', 0.1, 2, 0.1],
  ['engineMinMul', 'Moteurs à 0 % (×)', 0.1, 1, 0.05],
  ['slowMoScale', 'Ralenti anneau (×)', 0.1, 1, 0.05],
  ['shipAccel', 'Accélération vaisseau', 3, 20, 0.5],
  ['shipDrag', 'Traînée (freinage)', 0.2, 2, 0.05],
  ['angAccel', 'Accél. virage', 1, 8, 0.2],
  ['angDrag', 'Amorti virage', 0.5, 4, 0.1],
  ['enemySpeedMul', 'Vitesse ennemis (×)', 0.3, 2, 0.1],
  ['enemyFireMul', 'Intervalle tir ennemi (×)', 0.4, 3, 0.1],
  ['spawnDist', 'Distance d\'apparition', 40, 130, 2],
  ['waveBreak', 'Respiration entre vagues (s)', 1, 20, 0.5],
  ['ftlChargeRate', 'Calcul de saut (×)', 0.3, 3, 0.05],
  ['dradisCompress', 'Compression des 33 min (×)', 4, 40, 0.5],
  ['contactDelay', 'Sursis avant contact (s)', 2, 40, 1],
  ['jumpSpoolTime', 'Amorçage du saut (s)', 1, 15, 0.5],
  ['ftlMinClarity', 'Calcul perturbé à l\'entrée (×)', 0.1, 1, 0.02],
  ['cylonPlayerAggro', 'Cylons : distance d\'agressivité', 8, 60, 2],
  ['capitalCamZoom', 'Recul caméra cuirassé (×)', 1, 2.5, 0.05],
  ['viewZoom', 'Recul caméra général (×)', 0.8, 2.2, 0.05],
  ['shieldRadius', 'Rayon bouclier', 5, 16, 0.5],
  ['pickupEvery', 'Délai bonus (s)', 4, 30, 1],
  ['pickupLife', 'Durée bonus (s)', 5, 45, 1],
  ['repairAmount', 'Réparation (PV)', 10, 100, 5],
  ['shipPivot', 'Pivot rotation (± proue/poupe)', -7, 7, 0.5],
  ['radarRangeMul', 'Portée conduite de tir (×)', 0.5, 6, 0.25],
  ['dradisRangeMul', 'Portée DRADIS (×)', 1, 24, 0.5],
  ['empRangeMul', 'Portée IEM (×)', 0.5, 3, 0.25],
];
