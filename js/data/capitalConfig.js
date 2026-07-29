/**
 * Vaisseau CAPITAL ennemi — l'adversaire qui donne l'échelle.
 *
 * ~46 unités de long contre 15 pour la baleine : il remplit les deux tiers de
 * l'écran. On ne l'esquive pas, on le DÉMONTE.
 *
 * Il n'a pas de « PV de coque » : il est mort quand toutes ses `parts` le sont.
 * L'objectif est donc lisible en permanence — on voit ce qu'il reste à faire —
 * et chaque pièce détruite change la situation tactique :
 *  - une BATTERIE détruite ouvre un angle mort où l'on peut s'installer ;
 *  - les MOTEURS détruits l'immobilisent ;
 *  - le PONT détruit dégrade la cadence de toutes ses batteries.
 *
 * Chaque part expose la même interface que les autres cibles
 * (`position` / `radius` / `takeDamage`), donc le système de tir existant la
 * traite sans aucune modification.
 */
export const CAPITAL_CONFIG = {
  id: 'dreadnought',
  name: 'CUIRASSÉ',
  color: 0xff6a5a,      // rouge ennemi
  fill: 0x3d1c2a,       // remplissage sombre opaque, mais assez clair pour lire le volume
  depth: 3.4,

  // Silhouette : proue effilée, corps trapézoïdal massif, poupe à moteurs.
  // Parcourue dans le même sens que la baleine (nez vers +X, puis le dos).
  profile: [
    [22.0, 0.5],
    [19.5, 2.0],
    [10.0, 3.3],
    [-2.0, 4.2],
    [-12.0, 4.6],
    [-20.0, 4.3],
    [-23.5, 3.1],
    [-23.5, -2.9],
    [-20.0, -4.1],
    [-10.0, -4.5],
    [2.0, -3.9],
    [12.0, -2.7],
    [19.5, -1.5],
  ],

  // Superstructure (îlot de commandement) : posée sur le dos, très visible.
  tower: { pos: [-7.0, 4.6, 0], base: [4.0, 1.4, 1.8], bridge: [2.0, 1.0, 1.1] },

  /**
   * Pièces destructibles. `dir` = orientation locale du secteur de tir en degrés
   * (0 = proue, 90 = dos, 180 = poupe, 270 = ventre) et `arc` son ouverture
   * totale : c'est ce qui fait exister les angles morts, et donc le travail du
   * pilote.
   */
  parts: [
    // Batteries dorsales
    { id: 'd1', kind: 'battery', name: 'Batterie dorsale avant', pos: [11, 3.4], hp: 55, radius: 2.2, dir: 90, arc: 170, range: 52, fireInterval: 2.2, damage: 9 },
    { id: 'd2', kind: 'battery', name: 'Batterie dorsale centre', pos: [-1, 4.3], hp: 55, radius: 2.2, dir: 90, arc: 170, range: 52, fireInterval: 2.2, damage: 9 },
    { id: 'd3', kind: 'battery', name: 'Batterie dorsale arrière', pos: [-14, 4.4], hp: 55, radius: 2.2, dir: 90, arc: 170, range: 52, fireInterval: 2.2, damage: 9 },
    // Batteries ventrales
    { id: 'v1', kind: 'battery', name: 'Batterie ventrale avant', pos: [11, -2.7], hp: 55, radius: 2.2, dir: 270, arc: 170, range: 52, fireInterval: 2.2, damage: 9 },
    { id: 'v2', kind: 'battery', name: 'Batterie ventrale centre', pos: [-1, -4.0], hp: 55, radius: 2.2, dir: 270, arc: 170, range: 52, fireInterval: 2.2, damage: 9 },
    { id: 'v3', kind: 'battery', name: 'Batterie ventrale arrière', pos: [-14, -4.2], hp: 55, radius: 2.2, dir: 270, arc: 170, range: 52, fireInterval: 2.2, damage: 9 },
    // Pièce de chasse (proue) : longue portée, arc étroit — elle punit l'approche frontale
    { id: 'p1', kind: 'battery', name: 'Pièce de proue', pos: [19, 0.2], hp: 70, radius: 2.4, dir: 0, arc: 90, range: 68, fireInterval: 3.0, damage: 16 },
    // Îlot de commandement : le détruire dérègle toute la conduite de tir
    { id: 'br', kind: 'bridge', name: 'Îlot de commandement', pos: [-7, 5.6], hp: 80, radius: 2.6 },
    // Moteurs : les détruire l'immobilise
    { id: 'e1', kind: 'engine', name: 'Moteur bâbord', pos: [-22.5, 1.8], hp: 95, radius: 2.4 },
    { id: 'e2', kind: 'engine', name: 'Moteur tribord', pos: [-22.5, -1.8], hp: 95, radius: 2.4 },
  ],

  // Cercles de collision le long de l'axe (une seule sphère collerait mal à une
  // coque de 46 de long).
  collision: [
    { pos: [16, 0], r: 4.0 },
    { pos: [6, 0], r: 6.0 },
    { pos: [-6, 0], r: 6.5 },
    { pos: [-17, 0], r: 6.0 },
  ],

  speed: 6.72,          // très lent : on a le temps de le voir venir
  standoff: 71.4,        // distance de bombardement qu'il cherche à tenir
  bridgeFirePenalty: 0.5, // cadence des batteries (×) quand le pont est détruit
  reward: 900,         // crédits pour l'avoir démonté
};
