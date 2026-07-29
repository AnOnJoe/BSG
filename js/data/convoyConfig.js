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
  // PAQUEBOT — le plus grand : très long, effilé, superstructure à étages sur le
  // dos et longues rangées de hublots. C'est le vaisseau à 20 000 âmes, il doit
  // se lire comme une ville qui flotte.
  liner: {
    id: 'liner', name: 'Paquebot Cloud 9', souls: 20400, kind: 'liner',
    hp: 300, radius: 7.2, speed: 4.6, color: 0xbfe9ff, fill: 0x152a3a, depth: 2.6,
    profile: [[15, 0.5], [13, 1.9], [4, 2.7], [-9, 2.5], [-13, 1.6], [-14, 0.6],
              [-14, -0.6], [-13, -1.6], [-9, -2.5], [4, -2.7], [13, -1.9]],
    decks: 3, windows: 14,
  },
  // CITERNE — trapue et bombée : deux gros réservoirs cylindriques accolés, une
  // passerelle minuscule à l'arrière. Silhouette large et courte.
  tanker: {
    id: 'tanker', name: 'Citerne à tylium', souls: 2600, kind: 'tanker',
    hp: 420, radius: 6.4, speed: 4.0, color: 0xffd08a, fill: 0x2e2214, depth: 4.4,
    profile: [[6, 1.0], [5, 4.2], [-5, 4.6], [-8, 3.0], [-8, -3.0], [-5, -4.6], [5, -4.2], [6, -1.0]],
    tanks: 2, windows: 3,
  },
  // CARGO — plate-forme nue avec des CONTENEURS empilés dessus, très anguleux.
  freighter: {
    id: 'freighter', name: 'Cargo lourd', souls: 4800, kind: 'freighter',
    hp: 340, radius: 6.0, speed: 5.2, color: 0x9fd6b0, fill: 0x16281d, depth: 2.0,
    profile: [[11, 0.8], [9, 1.6], [-9, 1.8], [-11, 0.8], [-11, -0.8], [-9, -1.8], [9, -1.6]],
    crates: 7, windows: 2,
  },
  // NAVIRE-HÔPITAL — large, pâle, avec une CROIX lumineuse sur le flanc.
  hospital: {
    id: 'hospital', name: 'Navire-hôpital', souls: 9200, kind: 'hospital',
    hp: 240, radius: 6.6, speed: 4.4, color: 0xffe8ee, fill: 0x2c1520, depth: 3.0,
    profile: [[10, 0.6], [8.5, 3.2], [0, 3.8], [-8, 3.4], [-11, 1.8], [-11, -1.8],
              [-8, -3.4], [0, -3.8], [8.5, -3.2]],
    cross: true, windows: 9,
  },
  // REMORQUEUR — petit, râblé, tout en moteurs. Le plus rapide, le plus fragile.
  tug: {
    id: 'tug', name: 'Remorqueur', souls: 900, kind: 'tug',
    hp: 180, radius: 4.2, speed: 5.6, color: 0xc9b6ff, fill: 0x1d1830, depth: 2.2,
    profile: [[6, 0.6], [4.5, 2.0], [-3, 2.2], [-5.5, 1.2], [-5.5, -1.2], [-3, -2.2], [4.5, -2.0]],
    windows: 2, nozzles: 3,
  },
  // TRANSPORT DE PASSAGERS — moyen, allongé, deux nacelles latérales.
  ferry: {
    id: 'ferry', name: 'Transport Gemenon', souls: 12100, kind: 'ferry',
    hp: 280, radius: 6.2, speed: 4.8, color: 0x9fc4ff, fill: 0x141f33, depth: 2.4,
    profile: [[12, 0.5], [10, 1.7], [-8, 2.0], [-11, 1.0], [-11, -1.0], [-8, -2.0], [10, -1.7]],
    pods: true, windows: 11,
  },
};

/**
 * Flotte au départ : 50 000 âmes réparties sur six coques de gabarits différents.
 * Le total doit être lisible d'un coup d'œil — c'est le vrai score de la partie.
 */
export const FLEET = ['liner', 'ferry', 'hospital', 'freighter', 'tanker', 'tug'];

export function totalSouls(ids = FLEET) {
  return ids.reduce((s, id) => s + (TRANSPORT_TYPES[id]?.souls || 0), 0);
}
