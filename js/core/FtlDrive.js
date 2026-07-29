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
   * @param seconds durée nominale du calcul pour CE secteur (`sector.ftlTime`).
   * Elle était définie dans data/campaign.js mais jamais lue : le rythme venait
   * d'un TUNE global, donc la difficulté par secteur ne s'appliquait pas.
   */
  reset(seconds) {
    this.seconds = seconds || 110;
    this.charge = 0;        // 0 → 100
    this.modeId = 'normal';
    this.ready = false;
    this.jumping = false;
    this.starved = false;   // forcé mais plus d'énergie : le calcul patine
  }

  get mode() { return FTL_MODES.find((m) => m.id === this.modeId) || FTL_MODES[1]; }

  setMode(id) {
    if (!FTL_MODES.some((m) => m.id === id)) return false;
    this.modeId = id;
    return true;
  }

  /** %/s de base : 100 % sur la durée nominale du secteur. */
  get baseRate() { return 100 / Math.max(1, this.seconds); }

  /** Secondes restantes au rythme courant (pour le HUD). */
  eta() {
    const r = this.mode.rate * this.baseRate * TUNE.ftlChargeRate;
    if (r <= 0) return Infinity;
    return Math.max(0, (100 - this.charge) / r);
  }

  /**
   * Fait avancer le calcul. En mode FORCÉ, ponctionne la réserve d'énergie du
   * vaisseau : s'il n'y en a plus, le calcul retombe au rythme normal (`starved`)
   * plutôt que de se bloquer — un blocage silencieux serait incompréhensible.
   */
  update(dt, ship) {
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
    this.charge = Math.min(100, this.charge + rate * this.baseRate * TUNE.ftlChargeRate * dt);
    this.ready = this.charge >= 100;
  }
}
