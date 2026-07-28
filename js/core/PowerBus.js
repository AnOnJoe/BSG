import { TUNE } from './Tune.js';

/**
 * Répartition de l'énergie du vaisseau entre TROIS BUS RIVAUX (somme = 100 %).
 * C'est le cœur du jeu de capitaine : on ne peut pas être bon partout.
 *
 *  - ARMES     (w) : remplit la réserve `ship.energy` que le laser consomme
 *  - BOUCLIERS (s) : vitesse de régénération du bouclier
 *  - MOTEURS   (m) : multiplie l'accélération et le virage
 *
 * Le joueur choisit un PROFIL via l'anneau de passerelle (clic droit). La
 * bascule n'est pas instantanée : `cur` glisse vers `target` en
 * `TUNE.powerShiftTime` secondes (on sent l'équipage rebrancher les circuits).
 */
export const POWER_PRESETS = [
  { id: 'attack',   name: 'ATTAQUE',   w: 0.60, s: 0.20, m: 0.20, css: 'var(--neon-magenta)' },
  { id: 'defense',  name: 'DÉFENSE',   w: 0.20, s: 0.60, m: 0.20, css: 'var(--neon-violet)' },
  { id: 'burn',     name: 'COURSE',    w: 0.20, s: 0.20, m: 0.60, css: 'var(--neon-amber)' },
  // Tiers exacts : engineMul vaut alors précisément 1.0 (pilotage de référence)
  { id: 'balanced', name: 'ÉQUILIBRE', w: 1 / 3, s: 1 / 3, m: 1 / 3, css: 'var(--neon-cyan)' },
];

export const DEFAULT_PRESET = 'balanced';

function presetById(id) {
  return POWER_PRESETS.find((p) => p.id === id) || POWER_PRESETS[POWER_PRESETS.length - 1];
}

export class PowerBus {
  constructor() {
    this.presetId = DEFAULT_PRESET;
    const p = presetById(DEFAULT_PRESET);
    this.cur = { w: p.w, s: p.s, m: p.m };
    this.target = { w: p.w, s: p.s, m: p.m };
    this.from = { w: p.w, s: p.s, m: p.m };
    this.t = 1; // progression de la bascule en cours (1 = établie)
    this.output = 0; // débit total courant (énergie/s), recalculé par update()
  }

  get preset() { return presetById(this.presetId); }

  setPreset(id) {
    const p = POWER_PRESETS.find((x) => x.id === id);
    if (!p) return false;
    this.presetId = p.id;
    this.target.w = p.w;
    this.target.s = p.s;
    this.target.m = p.m;
    // Nouveau segment de bascule : on repart de la répartition actuelle
    this.from.w = this.cur.w;
    this.from.s = this.cur.s;
    this.from.m = this.cur.m;
    this.t = 0;
    return true;
  }

  /** Retour au profil équilibré, sans transition (entrée en combat). */
  reset() {
    this.setPreset(DEFAULT_PRESET);
    this.cur.w = this.from.w = this.target.w;
    this.cur.s = this.from.s = this.target.s;
    this.cur.m = this.from.m = this.target.m;
    this.t = 1;
    this.output = 0;
  }

  /** Bascule encore en cours (le HUD l'affiche en demi-teinte). */
  get shifting() { return this.t < 1; }

  /** Débit total fourni par les réacteurs actifs (+ base), en énergie/s. */
  totalOutput(ship) {
    return ship.energyRegen * TUNE.powerOutputMul;
  }

  update(dt, ship) {
    // Bascule paramétrique from -> target : `t` avance à vitesse constante, donc
    // la cible est ATTEINTE en powerShiftTime (un lissage exponentiel, lui,
    // s'en approche sans jamais y arriver). Interpoler entre deux répartitions
    // de somme 1 préserve la somme : pas de renormalisation.
    if (this.t < 1) {
      this.t = TUNE.powerShiftTime > 0 ? Math.min(1, this.t + dt / TUNE.powerShiftTime) : 1;
      const e = this.t * this.t * (3 - 2 * this.t); // smoothstep : départ/arrivée en douceur
      this.cur.w = this.from.w + (this.target.w - this.from.w) * e;
      this.cur.s = this.from.s + (this.target.s - this.from.s) * e;
      this.cur.m = this.from.m + (this.target.m - this.from.m) * e;
    }
    this.output = this.totalOutput(ship);
  }

  /** Énergie/s versée dans la réserve d'armes. */
  get weaponRate() { return this.output * this.cur.w; }

  /** PV de bouclier régénérés/s (ne ponctionne pas la réserve d'armes). */
  get shieldRate() { return this.output * this.cur.s * TUNE.shieldRegenPerPower; }

  /**
   * Multiplicateur d'accélération / de virage. Calibré pour valoir EXACTEMENT
   * 1.0 au tiers (profil équilibré) : le pilotage de référence est conservé et
   * on ne juge que l'écart. À 0 % on tombe à `TUNE.engineMinMul` (dérive).
   */
  get engineMul() {
    const min = TUNE.engineMinMul;
    return min + (1 - min) * 3 * this.cur.m;
  }
}
