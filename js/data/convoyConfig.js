/**
 * LA FLOTTE CIVILE. C'est le renversement d'enjeu : on ne se bat plus pour sa
 * propre survie mais pour celle de gens qui ne peuvent pas se défendre.
 *
 * Trois règles reprises de la série, et chacune produit du jeu :
 *  - les transports ne tirent pas et ne manœuvrent pas ⇒ il faut les COUVRIR ;
 *  - ils sont lents, et **le plus lent commande le départ** ⇒ on attend les
 *    traînards sous le feu ;
 *  - un transport perdu, ce sont des survivants perdus **définitivement** ⇒
 *    l'échec est partiel et cumulatif, pas un simple game over.
 */
export const TRANSPORT_TYPES = {
  liner: {
    id: 'liner', name: 'Paquebot', souls: 12400,
    hp: 260, radius: 5.6, speed: 3.0, color: 0xbfe9ff, fill: 0x152a3a,
    // Silhouette longue et pataude, très différente des vaisseaux de guerre
    profile: [[9, 0.4], [7.5, 2.0], [1, 2.6], [-8, 2.2], [-10, 0.9], [-10, -0.9], [-8, -2.2], [1, -2.6], [7.5, -2.0]],
  },
  tanker: {
    id: 'tanker', name: 'Citerne', souls: 3100,
    hp: 340, radius: 5.2, speed: 2.6, color: 0xffd08a, fill: 0x2e2214,
    profile: [[7, 0.5], [6, 2.4], [-6, 2.8], [-8.5, 1.6], [-8.5, -1.6], [-6, -2.8], [6, -2.4]],
  },
  freighter: {
    id: 'freighter', name: 'Cargo', souls: 5200,
    hp: 300, radius: 5.0, speed: 3.4, color: 0x9fd6b0, fill: 0x16281d,
    profile: [[8, 0.6], [6.5, 1.8], [-7, 2.4], [-9, 1.0], [-9, -1.0], [-7, -2.4], [6.5, -1.8]],
  },
  hospital: {
    id: 'hospital', name: 'Navire-hôpital', souls: 8700,
    hp: 220, radius: 5.4, speed: 2.9, color: 0xff9fb5, fill: 0x2c1520,
    profile: [[8.5, 0.5], [7, 2.2], [0, 2.8], [-8, 2.4], [-10, 1.1], [-10, -1.1], [-8, -2.4], [0, -2.8], [7, -2.2]],
  },
};

/** Composition de la flotte au départ (l'ordre n'a pas d'importance). */
export const FLEET = ['liner', 'hospital', 'freighter', 'tanker', 'freighter'];

export function totalSouls(ids = FLEET) {
  return ids.reduce((s, id) => s + (TRANSPORT_TYPES[id]?.souls || 0), 0);
}
