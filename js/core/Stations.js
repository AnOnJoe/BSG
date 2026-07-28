import { TUNE } from './Tune.js';

/**
 * POSTES du vaisseau. Le joueur n'en tient QU'UN à la fois ; les autres sont
 * tenus par l'équipage (IA). Tout le jeu est là : « où ai-je le plus de valeur
 * ajoutée, maintenant ? »
 *
 * Pour que ce choix compte, chaque IA doit être COMPÉTENTE MAIS MÉDIOCRE, et son
 * insuffisance doit être VISIBLE ET SITUÉE (cf. « SOLUTION DE TIR : MAUVAISE »
 * pour l'artillerie). Une IA parfaite rendrait les postes décoratifs ; une IA
 * nulle rendrait le jeu punitif.
 *
 * Le COMMANDEMENT (répartition d'énergie, anneau de passerelle) n'est pas un
 * poste : tu es le capitaine en permanence, quel que soit le poste où tu te
 * trouves.
 *
 * Changer de poste COÛTE : `TUNE.stationSwitchTime` d'installation, pendant
 * laquelle personne ne tient le poste que tu rejoins. Sans ce coût, tu serais
 * partout à la fois et l'équipage ne servirait à rien.
 */
export const STATION_DEFS = [
  { id: 'command', name: 'COMMANDANT', icon: '✦', role: 'énergie · modules · IEM' },
  { id: 'helm', name: 'PILOTE', icon: '⛭', role: 'cap · allure · manœuvres' },
  { id: 'gunnery', name: 'ARTILLEUR', icon: '⌖', role: 'ciblage · mode de tir' },
  { id: 'drones', name: 'DRONES', icon: '◈', role: 'ordres d\'escadron' },
];

export function stationDef(id) {
  return STATION_DEFS.find((s) => s.id === id) || STATION_DEFS[0];
}

export class Stations {
  constructor() {
    this.current = 'helm';   // poste tenu par le joueur
    this.pending = null;     // poste en cours de prise en main
    this.installing = 0;     // temps restant avant d'être opérationnel (s)
  }

  get defs() { return STATION_DEFS; }
  get def() { return stationDef(this.current); }

  /**
   * Le joueur tient effectivement ce poste (installé, pas en transit).
   * Pendant l'installation, PERSONNE ne le tient : ni l'équipage (il a lâché),
   * ni le joueur (il s'installe).
   */
  manned(id) { return this.current === id && this.installing <= 0; }

  /**
   * L'équipage tient ce poste. Pendant un transit, l'équipage REPREND le poste
   * que tu quittes (`current`), mais a déjà évacué celui que tu rejoins
   * (`pending`) — qui reste donc vide le temps que tu t'installes.
   */
  crewed(id) {
    if (this.pending === id) return false;               // trou pendant le transit
    if (this.current === id) return this.installing > 0; // repris pendant ton transit
    return true;
  }

  /** Poste en cours de prise en main (pour le retour visuel). */
  isInstalling(id) { return this.pending === id || (this.current === id && this.installing > 0); }

  /** Progression de l'installation, 0 → 1. */
  get installProgress() {
    const t = TUNE.stationSwitchTime;
    if (!t || this.installing <= 0) return 1;
    return Math.max(0, Math.min(1, 1 - this.installing / t));
  }

  /** Rejoindre un poste. Sans effet si on y est déjà ou si on y va déjà. */
  goTo(id) {
    if (!stationDef(id) || id === this.current || id === this.pending) return false;
    if (!STATION_DEFS.some((s) => s.id === id)) return false;
    this.pending = id;
    this.installing = TUNE.stationSwitchTime;
    return true;
  }

  /** Poste suivant dans l'ordre (touche Tab). */
  cycle() {
    const from = this.pending || this.current;
    const i = STATION_DEFS.findIndex((s) => s.id === from);
    return this.goTo(STATION_DEFS[(i + 1) % STATION_DEFS.length].id);
  }

  update(dt) {
    if (this.installing > 0) {
      this.installing -= dt;
      if (this.installing <= 0) {
        this.installing = 0;
        if (this.pending) { this.current = this.pending; this.pending = null; }
      }
    }
  }

  reset() {
    this.current = 'helm';
    this.pending = null;
    this.installing = 0;
  }
}
