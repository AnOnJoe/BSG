/**
 * SCÈNES DE PASSERELLE — les « 33 minutes », jouées à l'intérieur du vaisseau.
 *
 * Avant, ce répit se passait sur l'écran tactique : rien à faire, rien à voir,
 * une baleine immobile et un compteur qui descend. C'était long et fade.
 *
 * Désormais on est dans le CIC et on écoute son équipage. Les choix ne sont pas
 * décoratifs : chacun **se paie dans le combat qui suit** (`effect`), et l'effet
 * est annoncé au journal au début de l'action — sinon le joueur subit un malus
 * sans savoir d'où il vient.
 *
 * `at` = minutes de fiction restantes. Le décompte descend PAR SCÈNE et non en
 * temps réel : on lit à son rythme, la tension vient du contenu et du compteur.
 *
 * ⚠ UN ARC PAR SECTEUR. Servir les mêmes scènes aux cinq sauts tuait l'effet :
 * on relisait le même répit en sachant déjà quoi répondre. Chaque secteur a
 * donc son propre arc, sa distribution et son sujet — l'incrédulité au premier
 * saut, l'épuisement dans la Ceinture, la tentation du Cimetière, l'attrition
 * du Blocus, le va-tout de la Porte. Le CIC n'affiche que les officiers qui
 * parlent dans le secteur courant, ce qui change aussi la scène à l'œil.
 *
 * Effets disponibles (appliqués par Range._applyPendingEffects) :
 *   transportHp:   ['freighter', +60]   PV d'un transport, par type
 *   transportSpeed:['tanker', +0.8]     vitesse d'un transport
 *   modulesOffline: 1                   modules coupés au prochain combat
 *   energy:        -25                  réserve de départ
 *   structure:     -20                  coque de départ (jamais sous 1 PV)
 *   credits:       +150
 *   ftlBonus:      +8                   % de calcul déjà fait au contact
 */

/** Les intervenants possibles ; le CIC n'affiche que ceux du secteur courant. */
export const CREW = [
  { id: 'ADAMA', role: 'commandant', station: 'centre' },
  { id: 'ROSLIN', role: 'présidente', station: 'centre' },
  { id: 'GAETA', role: 'tactique', station: 'gauche' },
  { id: 'DUALLA', role: 'communications', station: 'droite' },
  { id: 'TYROL', role: 'chef mécanicien', station: 'gauche' },
  { id: 'STARBUCK', role: 'chef d\'escadrille', station: 'droite' },
  { id: 'COTTLE', role: 'médecin-chef', station: 'droite' },
];

/**
 * PREMIER SAUT — l'incrédulité. C'est la première fois qu'ils reviennent, et
 * personne à bord ne comprend encore que ça va se reproduire indéfiniment.
 */
const RAGNAR = [
  {
    at: 33, speaker: 'GAETA', role: 'tactique',
    text: 'Saut terminé. DRADIS vide, commandant. Le décompte est lancé — trente-trois minutes, comme les fois précédentes.',
  },
  {
    at: 31, speaker: 'DUALLA', role: 'communications',
    text: 'Les six vaisseaux civils répondent. Le Remorqueur demande la permission de couper ses moteurs pour économiser le tylium.',
    choices: [
      {
        text: 'Accordé. Qu\'il économise.',
        note: 'Remorqueur : +180 crédits, mais −0,6 de vitesse',
        effect: { credits: +180, transportSpeed: ['tug', -0.6] },
      },
      {
        text: 'Refusé. Moteurs chauds, on peut partir à tout moment.',
        note: 'Remorqueur : +0,4 de vitesse',
        effect: { transportSpeed: ['tug', +0.4] },
      },
    ],
  },
  {
    at: 27, speaker: 'TYROL', role: 'chef mécanicien',
    text: 'Le Cargo lourd signale une avarie de propulsion. Sans intervention il traînera derrière la flotte au prochain saut.',
    choices: [
      {
        text: 'Détachez une équipe. Réparez-le.',
        note: 'Cargo : +90 de coque · un module coupé au prochain combat',
        effect: { transportHp: ['freighter', +90], modulesOffline: 1 },
      },
      {
        text: 'Personne ne quitte le bord. Il suivra comme il peut.',
        note: 'Cargo : −0,5 de vitesse (il sera le retardataire)',
        effect: { transportSpeed: ['freighter', -0.5] },
      },
    ],
  },
  {
    at: 22, speaker: 'ADAMA', role: 'commandant',
    text: 'Cinq jours sans dormir. Les pilotes s\'endorment dans leurs cockpits, et je ne peux pas leur donner mieux qu\'un roulement de deux heures.',
  },
  {
    at: 18, speaker: 'DUALLA', role: 'communications',
    text: 'Le Navire-hôpital demande du courant pour ses blocs opératoires. Ils ont trente-deux blessés en attente.',
    choices: [
      {
        text: 'Donnez-leur le courant.',
        note: 'Hôpital : +120 de coque · votre réserve : −30 d\'énergie',
        effect: { transportHp: ['hospital', +120], energy: -30 },
      },
      {
        text: 'Impossible. Nous en aurons besoin pour le calcul.',
        note: 'Calcul de saut : +10 % déjà acquis',
        effect: { ftlBonus: +10 },
      },
    ],
  },
  {
    at: 13, speaker: 'GAETA', role: 'tactique',
    text: 'Toujours rien sur le DRADIS. Vingt-six minutes qu\'ils sont en retard, commandant. Ça n\'est jamais arrivé.',
  },
  {
    at: 8, speaker: 'TYROL', role: 'chef mécanicien',
    text: 'On peut pré-charger les condensateurs du moteur de saut. Ça grille de la réserve, mais on gagnerait du temps sur le calcul.',
    choices: [
      {
        text: 'Pré-chargez. Je veux pouvoir sauter tôt.',
        note: 'Calcul : +18 % · réserve : −40 d\'énergie',
        effect: { ftlBonus: +18, energy: -40 },
      },
      {
        text: 'Non. Gardez chaque ampère pour les canons.',
        note: 'Aucun effet',
        effect: {},
      },
    ],
  },
  {
    at: 4, speaker: 'ADAMA', role: 'commandant',
    text: 'Postes de combat. Ils vont venir — ils viennent toujours. Et cette fois nous serons prêts avant eux.',
  },
  {
    at: 1, speaker: 'GAETA', role: 'tactique',
    text: 'Contacts multiples sur le DRADIS ! Raiders, relèvement zéro-neuf-zéro, ils foncent sur la flotte !',
    last: true,
  },
];

/**
 * LA CEINTURE — l'épuisement. Le répit n'est plus une nouvelle, c'est une
 * routine, et la routine tue : l'équipage commence à faire des erreurs.
 */
const CEINTURE = [
  {
    at: 33, speaker: 'GAETA', role: 'tactique',
    text: 'Saut terminé. Champ d\'astéroïdes dense, commandant — le DRADIS ne porte pas à travers la roche. On est aveugles d\'un côté.',
  },
  {
    at: 30, speaker: 'STARBUCK', role: 'chef d\'escadrille',
    text: 'Mes pilotes ont fait quatre sorties en deux jours. Le dernier qui s\'est posé a raté le pont de trois mètres. Je peux les faire tourner encore une fois, ou les laisser dormir six heures.',
    choices: [
      {
        text: 'Qu\'ils dorment. On tiendra sans eux.',
        note: 'Réserve : +25 d\'énergie · un module coupé au prochain combat',
        effect: { energy: +25, modulesOffline: 1 },
      },
      {
        text: 'Encore une sortie. On n\'a pas le choix.',
        note: 'Aucun repos : −15 de coque au départ',
        effect: { structure: -15 },
      },
    ],
  },
  {
    at: 26, speaker: 'DUALLA', role: 'communications',
    text: 'Le Paquebot veut se ranger contre un gros astéroïde pour se masquer. Vingt mille personnes à bord, commandant, et ils ont peur.',
    choices: [
      {
        text: 'Accordé. Qu\'ils se cachent dans la roche.',
        note: 'Paquebot : +140 de coque, mais −0,7 de vitesse (il décrochera)',
        effect: { transportHp: ['liner', +140], transportSpeed: ['liner', -0.7] },
      },
      {
        text: 'Refusé. Un vaisseau immobile est un vaisseau mort.',
        note: 'Paquebot : +0,5 de vitesse',
        effect: { transportSpeed: ['liner', +0.5] },
      },
    ],
  },
  {
    at: 21, speaker: 'TYROL', role: 'chef mécanicien',
    text: 'La roche, c\'est de la matière première. Donnez-moi une équipe et deux heures, je vous ramène de quoi refaire des plaques de blindage.',
    choices: [
      {
        text: 'Prenez votre équipe. On a besoin de matériel.',
        note: '+320 crédits · deux modules coupés au prochain combat',
        effect: { credits: +320, modulesOffline: 2 },
      },
      {
        text: 'Pas maintenant. Tout le monde à son poste.',
        note: 'Aucun effet',
        effect: {},
      },
    ],
  },
  {
    at: 16, speaker: 'ADAMA', role: 'commandant',
    text: 'Personne ne dit plus « quand ils arriveront ». On dit « quand ils reviendront ». Ce n\'est plus une poursuite, c\'est une horloge.',
  },
  {
    at: 11, speaker: 'GAETA', role: 'tactique',
    text: 'Commandant… j\'ai recalculé. Ils tombent à trente-trois minutes exactement. Pas trente-deux, pas trente-quatre. À la seconde. Ce n\'est pas une recherche, c\'est un rendez-vous.',
  },
  {
    at: 6, speaker: 'STARBUCK', role: 'chef d\'escadrille',
    text: 'Je peux emmener deux appareils dans les rochers et les prendre de flanc quand ils sortiront. Ou rester collée à la flotte.',
    choices: [
      {
        text: 'Prenez-les de flanc.',
        note: 'Calcul de saut : +12 % · réserve : −20 d\'énergie',
        effect: { ftlBonus: +12, energy: -20 },
      },
      {
        text: 'Restez sur la flotte. C\'est elle qu\'on protège.',
        note: 'Remorqueur : +80 de coque',
        effect: { transportHp: ['tug', +80] },
      },
    ],
  },
  {
    at: 1, speaker: 'GAETA', role: 'tactique',
    text: 'Contacts ! Ils sortent de la roche, commandant — ils étaient derrière l\'astéroïde, le DRADIS ne les voyait pas !',
    last: true,
  },
];

/**
 * CIMETIÈRE DE COQUES — la tentation, et le premier soupçon. On traverse les
 * restes d'une flotte qui a fait exactement ce qu'on fait. Elle n'a pas tenu.
 * C'est ici qu'on plante le mystère, sans le résoudre.
 */
const CIMETIERE = [
  {
    at: 33, speaker: 'GAETA', role: 'tactique',
    text: 'Saut terminé. Commandant… il y a des coques partout. Une trentaine de bâtiments, tous civils. Et un basestar en travers de notre route.',
  },
  {
    at: 30, speaker: 'DUALLA', role: 'communications',
    text: 'Je capte une balise de détresse automatique. Elle tourne en boucle depuis onze jours. Personne ne répond derrière.',
  },
  {
    at: 27, speaker: 'TYROL', role: 'chef mécanicien',
    text: 'Ces épaves sont pleines de pièces compatibles. Je n\'aurai jamais mieux. Laissez-moi deux équipes dessus.',
    choices: [
      {
        text: 'Deux équipes. Prenez tout ce que vous pouvez.',
        note: '+520 crédits · deux modules coupés · −20 de coque',
        effect: { credits: +520, modulesOffline: 2, structure: -20 },
      },
      {
        text: 'Une seule équipe, et vite.',
        note: '+240 crédits · un module coupé',
        effect: { credits: +240, modulesOffline: 1 },
      },
      {
        text: 'On ne pille pas des tombes. En avant.',
        note: 'Coque : +25 au départ (personne hors du bord)',
        effect: { structure: +25 },
      },
    ],
  },
  {
    at: 22, speaker: 'COTTLE', role: 'médecin-chef',
    text: 'J\'ai besoin de sang et de plasma, et il y en a dans ces carcasses. Mais si j\'envoie mes gens dehors, je n\'ai plus personne au bloc pendant l\'assaut.',
    choices: [
      {
        text: 'Envoyez-les. Nous aurons des blessés.',
        note: 'Hôpital : +180 de coque · réserve : −25 d\'énergie',
        effect: { transportHp: ['hospital', +180], energy: -25 },
      },
      {
        text: 'Gardez votre monde au bloc.',
        note: 'Coque : +20 au départ',
        effect: { structure: +20 },
      },
    ],
  },
  {
    at: 17, speaker: 'GAETA', role: 'tactique',
    text: 'J\'ai lu leurs journaux de bord, commandant. Ils sautaient toutes les trente-trois minutes. Comme nous. Ils l\'ont fait dix-neuf fois. La vingtième, ils n\'ont pas sauté.',
  },
  {
    at: 13, speaker: 'ADAMA', role: 'commandant',
    text: 'Alors ce n\'est pas nous qu\'ils traquent. C\'est cette manière de fuir. Quelque chose part avec nous à chaque saut — et je ne sais pas encore quoi.',
  },
  {
    at: 8, speaker: 'ROSLIN', role: 'présidente',
    text: 'Commandant, les civils exigent de savoir pourquoi nous nous arrêtons dans un cimetière. Je peux leur dire la vérité, ou leur dire que nous réparons.',
    choices: [
      {
        text: 'Dites-leur la vérité.',
        note: 'Toute la flotte se resserre : +0,4 de vitesse au Cargo et à la Citerne',
        effect: { transportSpeed: [['freighter', +0.4], ['tanker', +0.4]] },
      },
      {
        text: 'Dites-leur que nous réparons.',
        note: '+200 crédits (le calme évite les incidents) · calcul : −6 %',
        effect: { credits: +200, ftlBonus: -6 },
      },
    ],
  },
  {
    at: 1, speaker: 'GAETA', role: 'tactique',
    text: 'Le basestar s\'allume ! Contacts multiples, il lance ses Raiders — commandant, il nous attendait !',
    last: true,
  },
];

/**
 * LE BLOCUS — l'attrition. Plus rien pour se cacher, plus rien à récupérer, et
 * une flotte qui commence à discuter les ordres.
 */
const BLOCUS = [
  {
    at: 33, speaker: 'GAETA', role: 'tactique',
    text: 'Saut terminé. Vide complet, commandant. Pas un caillou, pas une épave. Rien derrière quoi se mettre.',
  },
  {
    at: 30, speaker: 'ROSLIN', role: 'présidente',
    text: 'Trois vaisseaux civils demandent l\'autorisation de faire route seuls. Ils disent que la flotte est ce qui les rend visibles, et ils n\'ont pas complètement tort.',
    choices: [
      {
        text: 'Refusé. On reste groupés, sans exception.',
        note: 'Cargo et Transport : +0,3 de vitesse · réserve : −20 d\'énergie',
        effect: { transportSpeed: ['ferry', +0.3], energy: -20 },
      },
      {
        text: 'Qu\'ils s\'écartent s\'ils le veulent.',
        note: '+280 crédits · Transport Gemenon : −0,8 de vitesse (isolé)',
        effect: { credits: +280, transportSpeed: ['ferry', -0.8] },
      },
    ],
  },
  {
    at: 26, speaker: 'TYROL', role: 'chef mécanicien',
    text: 'La Citerne fuit. Micro-fissures sur trois réservoirs. Je peux la souder, mais il faut couper ses moteurs pendant l\'opération — donc pendant l\'assaut.',
    choices: [
      {
        text: 'Soudez. On ne peut pas perdre le tylium.',
        note: 'Citerne : +200 de coque, mais −1,0 de vitesse',
        effect: { transportHp: ['tanker', +200], transportSpeed: ['tanker', -1.0] },
      },
      {
        text: 'Elle tiendra. On soudera après le saut.',
        note: 'Citerne : −0,3 de vitesse (elle perd de la poussée)',
        effect: { transportSpeed: ['tanker', -0.3] },
      },
    ],
  },
  {
    at: 21, speaker: 'COTTLE', role: 'médecin-chef',
    text: 'Je n\'ai plus de morphine. Je rationne depuis quatre jours. Si on prend encore une vague comme la dernière, j\'opère à sec.',
  },
  {
    at: 17, speaker: 'STARBUCK', role: 'chef d\'escadrille',
    text: 'Il n\'y a rien ici pour se planquer, donc la seule couverture, c\'est nous. Je peux mettre l\'escadrille en écran devant la flotte — mais alors elle prend tout.',
    choices: [
      {
        text: 'En écran. Ils passeront par vous d\'abord.',
        note: 'Paquebot et Hôpital : +100 de coque · un module coupé',
        effect: { transportHp: ['liner', +100], modulesOffline: 1 },
      },
      {
        text: 'Non. Gardez vos appareils pour les Raiders.',
        note: 'Calcul de saut : +8 %',
        effect: { ftlBonus: +8 },
      },
    ],
  },
  {
    at: 12, speaker: 'ADAMA', role: 'commandant',
    text: 'Nous avons quitté les Colonies avec cinquante mille personnes. Je ne demande plus combien il en reste. On me le dira quand nous serons arrivés.',
  },
  {
    at: 7, speaker: 'GAETA', role: 'tactique',
    text: 'Commandant, j\'ai une anomalie. À chaque saut, une émission courte part de la flotte deux minutes avant leur arrivée. Trop faible pour la localiser. Mais elle part de chez nous.',
  },
  {
    at: 1, speaker: 'DUALLA', role: 'communications',
    text: 'Contacts ! Et ils arrivent en ligne, commandant — ils savent exactement où nous sommes, il n\'y a pas eu de recherche.',
    last: true,
  },
];

/**
 * LA PORTE — le va-tout. Dernier saut avant le refuge, et le soupçon devient
 * une accusation. C'est ici que viendra la DÉCISION FINALE (le transport
 * compromis) : rompre la boucle, ou refuser et la laisser tourner.
 */
const PORTE = [
  {
    at: 33, speaker: 'GAETA', role: 'tactique',
    text: 'Saut terminé. Commandant, c\'est le dernier. Les coordonnées du refuge sont dans la machine — après celui-là, plus personne ne nous suit.',
  },
  {
    at: 30, speaker: 'ADAMA', role: 'commandant',
    text: 'Dix-neuf sauts pour l\'autre flotte. C\'est le nôtre qui compte, et je n\'ai pas l\'intention de faire le vingtième.',
  },
  {
    at: 27, speaker: 'TYROL', role: 'chef mécanicien',
    text: 'On peut tout donner au moteur de saut : déposer du blindage, débrancher des circuits d\'armes. Le calcul irait beaucoup plus vite. On serait beaucoup plus nus.',
    choices: [
      {
        text: 'Tout au moteur. Je veux partir le premier.',
        note: 'Calcul : +26 % · deux modules coupés · −30 de coque',
        effect: { ftlBonus: +26, modulesOffline: 2, structure: -30 },
      },
      {
        text: 'La moitié. Gardez-moi de quoi tirer.',
        note: 'Calcul : +12 % · un module coupé',
        effect: { ftlBonus: +12, modulesOffline: 1 },
      },
      {
        text: 'Rien. On passera en force.',
        note: 'Coque : +30 au départ',
        effect: { structure: +30 },
      },
    ],
  },
  {
    at: 22, speaker: 'ROSLIN', role: 'présidente',
    text: 'Gaeta m\'a montré ses relevés. Une émission part de la flotte avant chaque attaque. Vous et moi savons ce que ça veut dire, commandant : l\'un de ces vaisseaux les appelle.',
  },
  {
    at: 18, speaker: 'GAETA', role: 'tactique',
    text: 'Je peux affiner le relèvement pendant l\'assaut, si on me laisse du calculateur. Mais ce calculateur, c\'est celui du saut.',
    choices: [
      {
        // `trackSignal` est un JALON, pas encore une mécanique : il note que le
        // commandant a payé pour chercher. Le dénouement (transport compromis à
        // identifier puis détruire) s'y branchera — d'ici là le joueur ne paie
        // que ce qui est annoncé, jamais une promesse en l'air.
        text: 'Cherchez. Je veux savoir lequel.',
        note: 'Calcul : −10 % · +240 crédits (Gaeta réquisitionne du matériel)',
        effect: { ftlBonus: -10, credits: +240, trackSignal: true },
      },
      {
        text: 'Plus tard. On saute d\'abord.',
        note: 'Calcul : +6 %',
        effect: { ftlBonus: +6 },
      },
    ],
  },
  {
    at: 12, speaker: 'COTTLE', role: 'médecin-chef',
    text: 'Si nous arrivons, j\'aurai besoin de quatre jours pour vider mes couloirs. Si nous n\'arrivons pas, ça n\'aura pas d\'importance. Alors arrivez.',
  },
  {
    at: 7, speaker: 'STARBUCK', role: 'chef d\'escadrille',
    text: 'Tout le monde est en vol. Je n\'ai plus rien en réserve, plus de rechange, plus de pilote frais. Ce qui décolle maintenant, c\'est tout ce qu\'on a.',
  },
  {
    at: 3, speaker: 'ADAMA', role: 'commandant',
    text: 'Que chaque vaisseau se tienne prêt à sauter à mon ordre et pas une seconde après. Ceux qui traînent resteront. Dites-le-leur clairement.',
  },
  {
    at: 1, speaker: 'GAETA', role: 'tactique',
    text: 'Ils sont là ! Deux basestars, commandant — ils ont mis le paquet. Ils savent que c\'est le dernier aussi.',
    last: true,
  },
];

/** Arc par secteur, indexé sur l'`id` de `data/campaign.js`. */
export const SECTOR_SCENES = {
  ragnar: RAGNAR,
  ceinture: CEINTURE,
  cimetiere: CIMETIERE,
  blocus: BLOCUS,
  porte: PORTE,
};

/** Les scènes d'un secteur (repli sur le premier arc si l'id est inconnu). */
export function scenesFor(sectorId) {
  return SECTOR_SCENES[sectorId] || RAGNAR;
}

/** Les officiers qui prennent la parole dans ce secteur, dans l'ordre de CREW. */
export function crewFor(sectorId) {
  const speaking = new Set(scenesFor(sectorId).map((s) => s.speaker));
  return CREW.filter((c) => speaking.has(c.id));
}
