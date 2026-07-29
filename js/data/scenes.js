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
 * Effets disponibles (appliqués par Range._applyPendingEffects) :
 *   transportHp:   ['freighter', +60]   PV d'un transport, par type
 *   transportSpeed:['tanker', +0.8]     vitesse d'un transport
 *   modulesOffline: 1                   modules coupés au prochain combat
 *   energy:        -25                  réserve de départ
 *   credits:       +150
 *   ftlBonus:      +8                   % de calcul déjà fait au contact
 */
export const SCENES = [
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

/** Les intervenants, pour la vue du CIC (celui qui parle s'allume). */
export const CREW = [
  { id: 'ADAMA', role: 'commandant', station: 'centre' },
  { id: 'GAETA', role: 'tactique', station: 'gauche' },
  { id: 'DUALLA', role: 'communications', station: 'droite' },
  { id: 'TYROL', role: 'chef mécanicien', station: 'gauche' },
];
