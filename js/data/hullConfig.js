/**
 * Définition de la coque « baleine » (vaisseau mère du MVP).
 *
 * - `profile` : silhouette 2D (plan XY) parcourue dans le sens anti-horaire,
 *   longueur le long de X (la tête regarde +X), hauteur le long de Y.
 *   Elle est extrudée en épaisseur (Z) par `depth` pour donner le volume 2.5D.
 * - `slots` : points d'ancrage 3D des modules, avec le type de slot accepté.
 *
 * L'archi est data-driven : ajouter une autre forme de vaisseau = ajouter un
 * autre fichier de config du même format.
 */
export const HULL_CONFIG = {
  id: 'whale',
  name: 'Baleine',
  depth: 1.6,
  color: 0x3a9dff, // bleu (livrée bleu & blanc)

  // Silhouette low-poly de baleine (anti-horaire). Grosse tête arrondie à
  // l'avant (+X), corps fuselé, nageoires caudales à l'arrière. ~ x∈[-7.6, 7.2]
  profile: [
    [7.4, 0.15],   // nez
    [7.0, 0.72],
    [6.0, 1.25],   // haut du front
    [4.2, 1.82],
    [2.0, 2.12],   // dos (point haut)
    [-0.5, 2.12],  // dos plat
    [-2.8, 1.82],
    [-4.6, 1.32],
    [-5.6, 1.0],   // base de queue haut
    [-6.4, 1.72],  // nageoire caudale haute
    [-7.6, 1.12],  // extrémité caudale haute
    [-6.9, 0.15],  // creux central de la queue
    [-7.6, -1.02], // extrémité caudale basse
    [-6.4, -1.5],  // nageoire caudale basse
    [-5.6, -0.72], // base de queue bas
    [-4.0, -1.2],
    [-1.5, -1.58], // ventre arrière
    [1.5, -1.68],  // ventre (point bas)
    [4.0, -1.42],
    [5.8, -0.82],  // menton
    [6.9, -0.18],  // sous le nez
  ],

  // Superstructure façon passerelle de commandement (Star Destroyer-like)
  tower: { pos: [-0.6, 2.15, 0], base: [1.4, 0.55, 0.7], bridge: [0.6, 0.4, 0.45] },

  /**
   * SECTIONS DE COQUE — le poste d'INGÉNIEUR.
   *
   * Le cuirassé ennemi se démonte pièce par pièce depuis longtemps ; le joueur,
   * lui, n'avait qu'une barre de PV globale. Il a maintenant quatre sections qui
   * encaissent LOCALEMENT, selon le point d'impact.
   *
   * ⚠ Les sections NE remplacent PAS `structure` : elles courent en parallèle.
   * La létalité du jeu reste donc exactement celle d'avant (aucune régression
   * d'équilibrage), et la couche locale n'ajoute qu'une chose — quand une section
   * tombe, **ses modules sont hors service jusqu'à réparation**. C'est ça le
   * travail de l'ingénieur : décider quoi remettre en marche d'abord.
   *
   * `at` est le centre de la section dans le repère de la coque : c'est lui qui
   * décide où va un impact (la section la plus proche).
   */
  sections: [
    { id: 'bow', name: 'PROUE', hp: 70, at: [5.4, 0] },
    { id: 'core', name: 'CŒUR', hp: 95, at: [1.6, 0.2] },
    { id: 'aft', name: 'POUPE', hp: 80, at: [-2.8, 0.2] },
    { id: 'engines', name: 'PROPULSION', hp: 60, at: [-6.6, 0.4] },
  ],

  slots: [
    // Armes dorsales
    { id: 'dorsal_fwd', name: 'Dorsal avant', type: 'weapon', section: 'bow', pos: [4.2, 1.75, 0.82] },
    { id: 'dorsal_mid', name: 'Dorsal central', type: 'weapon', section: 'core', pos: [1.2, 1.9, 0.82] },
    { id: 'dorsal_aft', name: 'Dorsal arrière', type: 'weapon', section: 'aft', pos: [-3.4, 1.5, 0.82] },
    // Armes ventrales
    { id: 'ventral_fwd', name: 'Ventral avant', type: 'weapon', section: 'bow', pos: [3.9, -1.2, 0.82] },
    { id: 'ventral', name: 'Ventral', type: 'weapon', section: 'core', pos: [1.6, -1.5, 0.82] },
    { id: 'ventral_aft', name: 'Ventral arrière', type: 'weapon', section: 'aft', pos: [-2.2, -1.35, 0.82] },
    // Propulsion (réacteurs) — à la queue
    { id: 'engine', name: 'Propulsion', type: 'engine', section: 'engines', pos: [-6.9, 0.1, 0.0] },
    { id: 'engine2', name: 'Propulsion 2', type: 'engine', section: 'engines', pos: [-6.4, 0.85, 0.0] },
    // Utilitaires (radar, bouclier, armure)
    { id: 'core', name: 'Coeur utilitaire', type: 'utility', section: 'core', pos: [2.4, 1.15, 0.82] },
    { id: 'core_aft', name: 'Soute arrière', type: 'utility', section: 'aft', pos: [-1.8, 1.55, 0.82] },
    { id: 'chin', name: 'Menton', type: 'utility', section: 'bow', pos: [5.4, -0.7, 0.82] },
    { id: 'nose', name: 'Proue', type: 'utility', section: 'bow', pos: [6.5, 0.15, 0.82] },
  ],
};
