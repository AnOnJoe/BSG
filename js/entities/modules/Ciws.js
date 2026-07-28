import * as THREE from 'three';
import { WeaponModule } from '../Module.js';
import { TUNE } from '../../core/Tune.js';

/**
 * Canon anti-drone (défense rapprochée) : socle bas et large + BARILLET de 4
 * canons courts, silhouette trapue qui tranche avec le laser élancé.
 *
 * Système AUTOMATIQUE : il ne se sert pas au poste d'artilleur, il crépite tout
 * seul dès qu'un drone entre dans sa (courte) portée. C'est la réponse au trou de
 * défense que laisse le laser : les drones sont trop petits et trop vifs pour la
 * conduite de tir humaine, qui renonce systématiquement.
 *
 * En échange il DÉVORE l'énergie : sous un essaim, tes lasers se taisent faute de
 * réserve. Défendre ses arrières se paie.
 */
export class Ciws extends WeaponModule {
  _buildArmament() {
    const c = this.levelColor;

    // Socle bas et large
    this.group.add(this.mkSolid(new THREE.BoxGeometry(0.5, 0.3, 0.6), c));

    // Barillet : 4 tubes très courts en carré, façon Phalanx
    const tubeL = 0.42;
    this.muzzleLen = tubeL + 0.12;
    for (const oy of [0.1, -0.1]) {
      for (const oz of [0.1, -0.1]) {
        const g = new THREE.CylinderGeometry(0.06, 0.06, tubeL, 6);
        g.rotateZ(Math.PI / 2);
        g.translate(tubeL / 2, oy, oz);
        this.barrel.add(this.mkSolid(g, c, { thresholdAngle: 1 }));
      }
    }
    // Collier du barillet (repère visuel de la rotation)
    const ring = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 8);
    ring.rotateZ(Math.PI / 2);
    ring.translate(0.14, 0, 0);
    this.barrel.add(this.mkSolid(ring, c, { thresholdAngle: 1 }));
    this._spin = 0;
    this._hot = 0;
  }

  /** Le barillet tourne tant que l'arme crache (retour visuel de la cadence). */
  update(dt) {
    if (this._hot <= 0) return;
    this._hot -= dt;
    this._spin += dt * 16;
    this.barrel.rotation.x = this._spin;
  }

  fire(ctx, mul = 1) {
    this._hot = 0.25;
    const m = this.getMuzzle();
    // Traçantes courtes plutôt qu'un faisceau : on doit VOIR le rideau de feu.
    ctx.spawnBolt(m.pos, m.dir, this.stats.damage * mul, 'player', this.levelColor, {
      speed: 60,
      range: this.stats.range,
    });
    ctx.flak?.(m.pos, this.levelColor);
  }

  get energyCost() { return this.stats.energyCost * TUNE.laserCostMul; }
  energyCostFor(ship) { return this.energyCost * (ship?.energyCostMul ?? 1); }
  canFire(ship) { return ship.energy >= this.energyCostFor(ship); }
  onFired(ship) { ship.consume(this.energyCostFor(ship)); }
}
