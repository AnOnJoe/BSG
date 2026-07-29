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
  helmFleetLead: 45,    // avance (unités) au-delà de laquelle le barreur attend la flotte
                        // (bien sous le rayon de la bulle, sinon elle se vide)
  // --- Conduite de tir de l'ÉQUIPAGE (il n'est pas une machine : il rate) ---
  crewReactionTau: 0.35, // retard de suivi de la cible (s) : rate ce qui manœuvre
  crewAcquireTime: 0.5,  // temps de verrouillage avant le premier tir (s)
  crewSpread: 0.10,      // dispersion angulaire (rad) à la portée maximale
  crewNoRadarMul: 2.5,   // dispersion (×) sur une cible hors portée radar
  // Dispersion ET retard (×) quand le navire-hôpital est perdu. Calibré à 2,2 :
  // mesuré, la fenêtre de tir tombe de 100 → 71 % sur une cible qui manœuvre
  // lentement et de 66 → 37 % sur une cible lointaine, mais reste à 100 % sur une
  // cible proche et immobile. L'insuffisance est donc VISIBLE ET SITUÉE, ce qui est
  // la règle du projet. À 1,7 l'écart n'était que de 9-10 points (invisible en jeu),
  // à 2,8 la cible lointaine tombait à 24 % — punitif.
  crewFatigueMul: 2.2,
  // INGÉNIEUR : débit de réparation des sections de coque (PV/s), et le facteur
  // gagné en tenant soi-même le poste. Le joueur doit y gagner assez pour que
  // descendre à la machine vaille le transit — mais l'équipage doit rester utile.
  engRepairRate: 4.5,
  engRepairPlayerMul: 2.4,
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
  // DÉNOUEMENT : un relevé écarte un innocent mais se paie en charge FTL, donc en
  // assauts supplémentaires. C'est tout l'arbitrage — la certitude contre le temps.
  signalFixCost: 11,   // % de charge FTL consommée par relevé
  loopAssaultTighten: 0.82, // assauts ×(ce facteur) à chaque tour de boucle refusé
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
  // ===== FUITE & SAUT =====
  gatherRadius: 78,    // rayon de la bulle de rassemblement (qui part, qui reste)
  ftlForcedRate: 2.4,  // vitesse du calcul en mode FORCÉ (×)
  ftlForcedDrain: 14,  // énergie ponctionnée par le mode FORCÉ (/s)
  // ===== FLOTTE CIVILE (elle est l'économie de la partie) =====
  convoySpeedMul: 1,   // allure de tous les transports (×)
  convoyHpMul: 1,      // PV de tous les transports (×) — appliqué au montage
  crippledAt: 0.4,     // part de coque sous laquelle un transport DÉCROCHE
  crippledSpeedMin: 0.2, // allure d'un transport à 0 % de coque (× la nominale)
  convoyCatchup: 1.45, // allure (×) qu'un transport distancé s'autorise pour recoller
  jumpRepairHull: 40,  // coque rendue par un saut (avec l'atelier)
  jumpRepairNoWorkshop: 12, // ... sans le remorqueur
  jumpRepairCredits: 240,   // prime de saut
  fleetPushSpeed: 1.35, // ordre FORCER : allure (×)
  fleetPushWear: 1.7,   // ordre FORCER : usure de coque (PV/s)
  fleetSpreadMul: 1,    // étalement des ordres DISPERSER / FORCER (×)
  // ===== SECTIONS DE COQUE (ingénieur) =====
  sectionHpMul: 1,      // PV de toutes les sections (×) — appliqué à la remise à neuf
  sectionBackAt: 0.25,  // part de section à retrouver pour qu'elle reparte
  // ===== MODES DE TIR =====
  // ⚠ Le classement SEMI < RAFALE < AUTO en cadence soutenue doit rester STRICT :
  // un mode posé plus rapide que la rafale annulerait le compromis (déjà arrivé).
  fireSemiRate: 0.3,    // cadence du mode SEMI (× la nominale)
  fireBurstPause: 0.45, // pause après une rafale (s)
  fireAutoCost: 1.15,   // coût énergie du mode AUTO (×)
  // ===== ENNEMIS & RÉCOMPENSES =====
  enemyHpMul: 1,        // PV des ennemis (×)
  enemyDmgMul: 1,       // dégâts des ennemis (×)
  rewardMul: 1,         // crédits gagnés par ennemi détruit (×)
};

/**
 * Copie des valeurs par défaut. EXPORTÉE : le panneau s'en sert pour marquer les
 * réglages modifiés et proposer un retour au défaut, ce qui évite de se perdre
 * après vingt minutes de tâtonnement.
 */
export const TUNE_DEFAULTS = { ...TUNE };
const DEFAULTS = TUNE_DEFAULTS;
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

/**
 * Descripteurs des jauges du panneau : [clé, label, min, max, pas, groupe, aide].
 *
 * Le GROUPE n'est pas cosmétique : à 68 réglages, une liste à plat est
 * inutilisable, donc on ne règle rien. Le panneau les replie par groupe et offre
 * un filtre — cf. `game/TunePanel.js`.
 *
 * L'AIDE est affichée en clair sous chaque libellé, pas en infobulle : cachée, elle
 * n'aide pas. Elle dit ce que le réglage change ET ce qu'il coûte, parce qu'un
 * chiffre isolé (« 0,45 ») ne se règle pas sans savoir contre quoi il s'échange.
 *
 * Règle du projet : TOUTE valeur qui peut poser un problème d'équilibrage ou de
 * gameplay doit être ici. Si on doit toucher au code pour tester un chiffre, c'est
 * qu'il manque une entrée.
 */
export const TUNE_SPECS = [
  // --- Fuite & saut ---
  ['ftlChargeRate', 'Calcul de saut (×)', 0.3, 3, 0.05, 'Fuite & saut', 'Vitesse globale du calcul de saut. Monter = on part plus tôt, donc moins d\'assauts subis. C\'est le levier le plus brutal sur la difficulté.'],
  ['ftlMinClarity', 'Calcul perturbé à l\'entrée (×)', 0.1, 1, 0.02, 'Fuite & saut', 'Qualité du calcul à l\'ENTRÉE du couloir (perturbation du saut précédent). Bas = avancer vers la sortie rapporte beaucoup, donc on ose DISPERSER. À 1, traverser ne sert plus à rien.'],
  ['ftlForcedRate', 'Mode FORCÉ : vitesse (×)', 1, 5, 0.1, 'Fuite & saut', 'Accélération du calcul en mode FORCÉ. C\'est l\'arbitrage central : gagner du temps contre encaisser.'],
  ['ftlForcedDrain', 'Mode FORCÉ : énergie (/s)', 0, 40, 1, 'Fuite & saut', 'Énergie ponctionnée par le mode FORCÉ. Monter = forcer devient un vrai sacrifice (armes et boucliers à sec).'],
  ['gatherRadius', 'Rayon de la bulle de saut', 20, 160, 2, 'Fuite & saut', 'Rayon de la bulle : ce qui est dedans part au saut, le reste est abandonné. Grand = pardonne les traînards ; petit = il faut vraiment rassembler la flotte.'],
  ['jumpSpoolTime', 'Amorçage du saut (s)', 1, 15, 0.5, 'Fuite & saut', 'Durée d\'immobilité après l\'ordre de saut. Tout le monde est une cible fixe pendant ce temps : c\'est ce qui fait qu\'on choisit son moment.'],
  ['dradisCompress', 'Compression des 33 min (×)', 4, 40, 0.5, 'Fuite & saut', 'Compression des 33 minutes de fiction en temps réel. Monter = répit plus court avant le premier contact.'],
  ['contactDelay', 'Sursis avant contact (s)', 2, 40, 1, 'Fuite & saut', 'Sursis en arrivant dans le couloir, avant que les Cylons ne tombent. Le temps de se placer.'],

  // --- Flotte civile ---
  ['convoySpeedMul', 'Allure des transports (×)', 0.4, 2.5, 0.05, 'Flotte civile', 'Allure de tous les transports. Monter = la flotte traverse vite, donc moins d\'assauts et un calcul moins perturbé. Effet fort sur la durée d\'un secteur.'],
  ['convoyHpMul', 'PV des transports (×)', 0.3, 3, 0.1, 'Flotte civile', 'PV de tous les transports. Appliqué au montage de la flotte, donc au prochain départ — pas en pleine bataille.'],
  ['crippledAt', 'Décrochage sous (part de coque)', 0.1, 0.9, 0.05, 'Flotte civile', 'Part de coque sous laquelle un transport perd sa propulsion et DÉCROCHE. Monter = des traînards plus tôt et plus souvent.'],
  ['crippledSpeedMin', 'Allure d\'un éclopé à 0 % (×)', 0.05, 0.5, 0.05, 'Flotte civile', 'Allure d\'un transport à 0 % de coque. Bas = un éclopé est vraiment perdu ; haut = il suit encore et le dilemme disparaît.'],
  ['convoyCatchup', 'Rattrapage d\'un distancé (×)', 1, 2.5, 0.05, 'Flotte civile', 'Allure qu\'un transport distancé s\'autorise pour recoller sur la baleine. À 1, l\'écart croît sans borne dès que tu vas plus vite qu\'eux. Trop haut, « le plus lent commande le départ » ne veut plus rien dire.'],
  ['fleetPushSpeed', 'FORCER : allure (×)', 1, 2.5, 0.05, 'Flotte civile', 'Ordre FORCER : gain d\'allure. C\'est ce qui rend l\'ordre tentant.'],
  ['fleetPushWear', 'FORCER : usure (PV/s)', 0, 6, 0.1, 'Flotte civile', 'Ordre FORCER : usure de coque des transports. C\'est ce qui le rend coûteux. À 0, FORCER devient le choix évident et le triangle d\'ordres s\'effondre.'],
  ['fleetSpreadMul', 'DISPERSER : étalement (×)', 0.2, 2.5, 0.1, 'Flotte civile', 'Étalement des ordres DISPERSER et FORCER. Grand = pertes diluées mais flotte incouvrable, et il faudra rallier avant de sauter.'],
  ['jumpRepairHull', 'Saut : coque rendue', 0, 100, 5, 'Flotte civile', 'Coque rendue à chaque saut, remorqueur vivant. C\'est ce qui décide si la traversée est une usure ou une suite de matchs.'],
  ['jumpRepairNoWorkshop', 'Saut sans atelier : coque', 0, 60, 2, 'Flotte civile', 'Coque rendue si le remorqueur (l\'atelier) est perdu. L\'écart avec la valeur ci-dessus est le prix réel de cette coque.'],
  ['jumpRepairCredits', 'Saut : prime (crédits)', 0, 800, 20, 'Flotte civile', 'Prime encaissée à chaque saut. Monter = on peut s\'équiper au pont hangar plus tôt dans la traversée.'],

  // --- Dénouement ---
  ['signalFixCost', 'Relevé : coût en calcul (%)', 0, 30, 1, 'Dénouement', 'Coût en calcul de saut d\'un relevé au dernier secteur. Il faut 5 relevés pour être certain : à 11 %, la certitude coûte 55 % du calcul. LE réglage dont dépend le dénouement.'],
  ['loopAssaultTighten', 'Boucle refusée : assauts (×)', 0.5, 1, 0.02, 'Dénouement', 'Resserrement des assauts à chaque tour de boucle refusé. Bas = refuser de rompre la boucle se paie vite ; à 1, on peut tourner indéfiniment.'],

  // --- Ingénieur ---
  ['engRepairRate', 'Réparation par l\'équipage (PV/s)', 0.5, 20, 0.5, 'Ingénieur', 'Vitesse de réparation d\'une section par l\'équipage. Bas = une section percée reste hors service longtemps, donc descendre à la machine compte.'],
  ['engRepairPlayerMul', 'Réparation au poste (×)', 1, 5, 0.1, 'Ingénieur', 'Gain de vitesse quand tu tiens toi-même le poste. C\'est ce qui justifie de payer le transit pour y aller.'],
  ['sectionHpMul', 'PV des sections (×)', 0.3, 3, 0.1, 'Ingénieur', 'PV de toutes les sections de coque. Bas = les modules tombent souvent en panne. Appliqué à la remise à neuf, pas en pleine bataille.'],
  ['sectionBackAt', 'Remise en service à (part)', 0.05, 1, 0.05, 'Ingénieur', 'Part de section à retrouver pour que ses modules repartent. Haut = on ne finit jamais un chantier en combat et le poste devient inutile.'],

  // --- Artillerie ---
  ['laserCostMul', 'Coût laser (×)', 0.2, 2, 0.1, 'Artillerie', 'Coût énergie de chaque tir laser. Monter = la cadence dépend vraiment de la répartition d\'énergie.'],
  ['manualAimBonus', 'Bonus tir manuel (×)', 1, 2.5, 0.05, 'Artillerie', 'Dégâts supplémentaires quand tu vises toi-même. C\'est la récompense d\'être à la tourelle.'],
  ['fireSemiRate', 'SEMI : cadence (×)', 0.1, 1, 0.05, 'Artillerie', 'Cadence du mode SEMI. ⚠ Doit rester SOUS la rafale, sinon le mode posé devient le meilleur partout et le choix de mode ne veut plus rien dire.'],
  ['fireBurstPause', 'RAFALE : pause (s)', 0, 1.5, 0.05, 'Artillerie', 'Pause après chaque rafale. C\'est elle qui place RAFALE entre SEMI et AUTO.'],
  ['fireAutoCost', 'AUTO : coût énergie (×)', 0.8, 2, 0.05, 'Artillerie', 'Coût énergie du mode AUTO. C\'est ce qui l\'empêche d\'être gratuitement le meilleur.'],
  ['radarRangeMul', 'Portée conduite de tir (×)', 0.5, 6, 0.25, 'Artillerie', 'Portée utile à la CONDUITE DE TIR (pas à l\'affichage). Au-delà, la dispersion de l\'équipage explose.'],
  ['dradisRangeMul', 'Portée DRADIS (×)', 1, 24, 0.5, 'Artillerie', 'Portée d\'AFFICHAGE du DRADIS. Sert à voir qui se fait mordre à l\'autre bout du couloir ; ne rend pas l\'équipage plus précis.'],
  ['empRangeMul', 'Portée IEM (×)', 0.5, 3, 0.25, 'Artillerie', 'Rayon d\'effet de l\'IEM.'],

  // --- Équipage IA ---
  ['crewReactionTau', 'Retard de suivi (s)', 0.05, 1.5, 0.05, 'Équipage IA', 'Retard avec lequel l\'équipage suit sa cible. C\'est LUI qui fait rater ce qui manœuvre — le levier principal de la médiocrité de l\'IA.'],
  ['crewAcquireTime', 'Verrouillage (s)', 0, 2, 0.1, 'Équipage IA', 'Délai de verrouillage avant le premier tir sur une nouvelle cible.'],
  ['crewSpread', 'Dispersion (rad)', 0, 0.4, 0.01, 'Équipage IA', 'Dispersion angulaire à portée maximale. Nulle à bout portant.'],
  ['crewNoRadarMul', 'Sans radar (×)', 1, 5, 0.25, 'Équipage IA', 'Multiplicateur de dispersion sur une cible hors portée radar. C\'est ce qui donne un rôle mécanique au module radar.'],
  ['crewFatigueMul', 'Épuisé, sans hôpital (×)', 1, 4, 0.1, 'Équipage IA', 'Dégradation quand le navire-hôpital est perdu (dispersion ET retard). À 2,2 : 100 % de touches maintenu à bout portant, mais 66 → 37 % à longue portée.'],
  ['crewBiasTime', 'Durée du biais (s)', 0.1, 2, 0.1, 'Équipage IA', 'Durée pendant laquelle l\'équipage garde le même biais de visée. Court = tremblement ; long = rafales cohérentes qui manquent ensemble.'],
  ['crewHoldFactor', 'Seuil d\'abandon du tir', 1, 8, 0.5, 'Équipage IA', 'Au-delà de ce rapport erreur/taille de cible, l\'équipage RENONCE au lieu de vider ta réserve. ⚠ Commande aussi les seuils de « solution de tir ».'],

  // --- Ennemis ---
  ['enemyHpMul', 'PV des ennemis (×)', 0.2, 3, 0.1, 'Ennemis', 'PV des ennemis. Monter = chaque assaut prend plus longtemps à nettoyer, donc la pression s\'accumule.'],
  ['enemyDmgMul', 'Dégâts des ennemis (×)', 0.2, 3, 0.1, 'Ennemis', 'Dégâts des ennemis, sur toi comme sur les civils.'],
  ['enemySpeedMul', 'Vitesse ennemis (×)', 0.3, 2, 0.1, 'Ennemis', 'Vitesse des ennemis. Volontairement basse : un jeu de postes a besoin de temps pour changer de poste.'],
  ['enemyFireMul', 'Intervalle tir ennemi (×)', 0.4, 3, 0.1, 'Ennemis', 'Intervalle entre leurs tirs (>1 = ils tirent MOINS souvent).'],
  ['spawnDist', 'Distance d\'apparition', 40, 130, 2, 'Ennemis', 'Distance d\'apparition. Grand = approche longue et lisible, on a le temps de préparer.'],
  ['cylonPlayerAggro', 'Distance d\'agressivité', 8, 60, 2, 'Ennemis', 'En dessous de cette distance, un Cylon s\'occupe de toi plutôt que des civils. Grand = ils te suivent, donc « escorter » perd son sens.'],
  ['rewardMul', 'Crédits par ennemi (×)', 0, 4, 0.1, 'Ennemis', 'Crédits gagnés par ennemi détruit. Monter = pont hangar accessible plus tôt.'],
  ['waveBreak', 'Respiration entre vagues (s)', 1, 20, 0.5, 'Ennemis', 'Respiration entre deux vagues (hérité de l\'ancienne boucle, peu utilisé depuis les assauts continus).'],

  // --- Vaisseau ---
  ['energyRegen', 'Régén énergie /s', 0, 40, 1, 'Vaisseau', 'Régénération d\'énergie de base, hors réacteurs. Elle est répartie entre les trois bus.'],
  ['powerOutputMul', 'Débit réacteurs (×)', 0.6, 2.5, 0.1, 'Vaisseau', 'Débit total des réacteurs, que les trois bus se partagent. Le levier global de puissance.'],
  ['shieldRegenPerPower', 'Régén bouclier / débit', 0.2, 2, 0.1, 'Vaisseau', 'PV de bouclier régénérés par point de débit du bus BOUCLIERS.'],
  ['powerShiftTime', 'Bascule de profil (s)', 0.1, 2, 0.1, 'Vaisseau', 'Durée d\'établissement d\'un changement de profil d\'énergie. Long = on ne micro-gère pas.'],
  ['engineMinMul', 'Moteurs à 0 % (×)', 0.1, 1, 0.05, 'Vaisseau', 'Accélération et virage quand le bus MOTEURS est à zéro. Exactement 1,0 au tiers (profil ÉQUILIBRE).'],
  ['shipAccel', 'Accélération', 3, 20, 0.5, 'Vaisseau', 'Accélération de la baleine. Elle est lourde à dessein : le plaisir vient du triage, pas du pilotage.'],
  ['shipDrag', 'Traînée (freinage)', 0.2, 2, 0.05, 'Vaisseau', 'Traînée. Haut = elle s\'arrête vite ; bas = elle patine sur son erre.'],
  ['angAccel', 'Accél. de virage', 1, 8, 0.2, 'Vaisseau', 'Accélération de virage.'],
  ['angDrag', 'Amorti de virage', 0.5, 4, 0.1, 'Vaisseau', 'Amortissement du virage.'],
  ['shipPivot', 'Pivot (± proue/poupe)', -7, 7, 0.5, 'Vaisseau', 'Décalage du pivot de rotation vers la proue (positif) ou la poupe. Change complètement la sensation de manœuvre.'],
  ['shieldRadius', 'Rayon du bouclier', 5, 16, 0.5, 'Vaisseau', 'Rayon de la bulle de bouclier : elle intercepte les tirs à son bord et bloque les drones.'],
  ['repairAmount', 'Kit de réparation (PV)', 10, 100, 5, 'Vaisseau', 'Coque rendue par un kit de réparation ramassé.'],
  ['pickupEvery', 'Délai entre bonus (s)', 4, 30, 1, 'Vaisseau', 'Délai moyen entre deux bonus.'],
  ['pickupLife', 'Durée d\'un bonus (s)', 5, 45, 1, 'Vaisseau', 'Durée avant qu\'un bonus non ramassé disparaisse.'],

  // --- Postes ---
  ['stationSwitchTime', 'Transit entre postes (s)', 0, 4, 0.1, 'Postes', 'Temps d\'installation à un nouveau poste. Pendant ce transit, le poste rejoint est VACANT. À 0, tu es partout à la fois et l\'équipage ne sert plus à rien.'],
  ['slowMoScale', 'Ralenti de l\'anneau (×)', 0.1, 1, 0.05, 'Postes', 'Vitesse du temps quand un panneau de commandement est ouvert. Bas = on peut réfléchir sans être puni.'],
  ['helmStandoff', 'Barreur IA : distance tenue', 10, 40, 1, 'Postes', 'Distance de combat que tient le barreur IA.'],
  ['helmEscortDist', 'Barreur IA : distance d\'escorte', 6, 40, 1, 'Postes', 'Distance à laquelle le barreur IA escorte un civil (plus serré qu\'une distance de combat).'],
  ['helmReactionTau', 'Barreur IA : mollesse (s)', 0.1, 2, 0.1, 'Postes', 'Mollesse du barreur IA. Haut = il barre approximativement, donc prendre la barre soi-même compte.'],
  ['helmFleetLead', 'Barreur IA : avance tolérée sur la flotte', 20, 200, 5, 'Postes', 'Au-delà de cette avance sur la flotte, le barreur IA lève le pied et attend — mais seulement si la flotte est en RALLIEMENT. Sans ça la baleine distance le convoi et la bulle de saut se vide, donc ordonner le saut abandonne tout le monde.'],

  // --- Vue ---
  ['viewZoom', 'Recul caméra général (×)', 0.8, 2.2, 0.05, 'Vue', 'Recul général de la caméra, donc largeur de vue. Décide de ce qu\'on voit arriver.'],
  ['capitalCamZoom', 'Recul caméra cuirassé (×)', 1, 2.5, 0.05, 'Vue', 'Recul supplémentaire quand un cuirassé est en vue : sans lui il déborde du cadre.'],
  // Affecte la largeur de vue réelle, donc ce qu'on voit arriver : c'est un
  // réglage de gameplay, pas seulement d'affichage.
  ['screenRefH', 'Hauteur d\'écran de référence', 400, 1400, 20, 'Vue', 'Hauteur d\'écran de référence pour la compensation de dézoom. En dessous, la vue s\'élargit d\'autant.'],
];
