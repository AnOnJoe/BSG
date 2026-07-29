import { TUNE } from './Tune.js';

/**
 * MOTEUR DE SAUT — l'horloge du niveau.
 *
 * C'est le renversement d'objectif : on ne nettoie plus des vagues (un stock à
 * épuiser, donc une fin garantie), on TIENT jusqu'à ce que le calcul aboutisse.
 * Les assauts, eux, ne s'arrêtent jamais.
 *
 * Et surtout, le calcul est un ARBITRAGE. Le commandant peut le forcer pour
 * partir plus tôt, mais l'énergie qu'il y met est prise sur les armes et les
 * boucliers — exactement la décision qui fait le sel de la série : gagner du
 * temps contre la capacité à encaisser.
 */
export const FTL_MODES = [
  { id: 'idle', name: 'ARRÊT', rate: 0, drain: 0 },
  { id: 'normal', name: 'CALCUL', rate: 1, drain: 0 },
  { id: 'forced', name: 'FORCÉ', rate: 2.4, drain: 14 },
];

export class FtlDrive {
  constructor() {
    this.reset();
  }

  /**
   * DEUX HORLOGES, et il faut bien les distinguer :
   *  - les **33 minutes** sont le délai avant que les Cylons ne retrouvent la
   *    flotte. Rien d'autre.
   *  - le **calcul de saut** est indépendant, et il tourne DÈS le saut précédent
   *    — l'équipage calcule pendant tout le répit, il ne l'attend pas.
   *
   * D'où `preCharge` : le calcul acquis pendant les 33 minutes (visible au CIC).
   * Il n'aboutit jamais à temps, et c'est tout le sujet : les Cylons débarquent
   * alors qu'il manque encore quelques pourcents.
   *
   * @param seconds   secondes de calcul restant APRÈS le contact
   * @param preCharge % déjà acquis pendant le répit
   */
  reset(seconds, preCharge = 0) {
    this.seconds = seconds || 110;
    this.preCharge = Math.max(0, Math.min(95, preCharge));
    this.charge = this.preCharge;
    this.modeId = 'normal';
    this.ready = false;
    this.jumping = false;
    this.starved = false;   // forcé mais plus d'énergie : le calcul patine
    this.clarity = 1;       // qualité du calcul selon l'éloignement du point d'arrivée
  }

  get mode() { return FTL_MODES.find((m) => m.id === this.modeId) || FTL_MODES[1]; }

  setMode(id) {
    if (!FTL_MODES.some((m) => m.id === id)) return false;
    this.modeId = id;
    return true;
  }

  /** %/s de base : le RESTE à faire, étalé sur la durée d'après-contact. */
  get baseRate() { return (100 - this.preCharge) / Math.max(1, this.seconds); }

  /** Secondes restantes au rythme courant (pour le HUD). */
  eta() {
    const r = this.mode.rate * this.baseRate * TUNE.ftlChargeRate * (this.clarity ?? 1);
    if (r <= 0) return Infinity;
    return Math.max(0, (100 - this.charge) / r);
  }

  /**
   * Fait avancer le calcul. En mode FORCÉ, ponctionne la réserve d'énergie du
   * vaisseau : s'il n'y en a plus, le calcul retombe au rythme normal (`starved`)
   * plutôt que de se bloquer — un blocage silencieux serait incompréhensible.
   */
  /**
   * Qualité du calcul selon la position dans le couloir. Le saut précédent laisse
   * une PERTURBATION derrière soi : on débarque dans une zone où les coordonnées
   * ne se stabilisent pas. S'en éloigner accélère le calcul — et c'est ce qui
   * donne enfin une raison mécanique d'avancer de gauche à droite, maintenant que
   * le saut se fait sur place et qu'aucune porte n'est à atteindre.
   * @param t 0 = à l'entrée du couloir, 1 = à l'autre bout
   */
  static clarity(t) {
    return TUNE.ftlMinClarity + (1 - TUNE.ftlMinClarity) * Math.max(0, Math.min(1, t));
  }

  update(dt, ship, clarity = 1) {
    if (this.jumping || this.charge >= 100) {
      this.charge = Math.min(100, this.charge);
      this.ready = this.charge >= 100;
      return;
    }
    const mode = this.mode;
    let rate = mode.rate;
    this.starved = false;
    if (mode.drain > 0) {
      const need = mode.drain * dt;
      if (ship.energy >= need) ship.energy -= need;
      else { rate = FTL_MODES[1].rate; this.starved = true; }
    }
    this.clarity = clarity;
    this.charge = Math.min(100, this.charge + rate * this.baseRate * TUNE.ftlChargeRate * clarity * dt);
    this.ready = this.charge >= 100;
  }
}
