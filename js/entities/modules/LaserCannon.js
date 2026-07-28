import * as THREE from 'three';
import { WeaponModule } from '../Module.js';
import { TUNE } from '../../core/Tune.js';

/**
 * Canon laser : socle compact + DEUX longs canons fins jumelés + pointe
 * lumineuse. Tir hitscan (faisceau néon éphémère).
 */
export class LaserCannon extends WeaponModule {
  _buildArmament() {
    const c = this.levelColor;

    // Socle
    this.group.add(this.mkSolid(new THREE.BoxGeometry(0.42, 0.42, 0.5), c));

    // Canons jumelés
    const bl = 0.85 + this.level * 0.07;
    this.muzzleLen = bl + 0.14;
    for (const oy of [0.12, -0.12]) {
      const g = new THREE.BoxGeometry(bl, 0.09, 0.09);
      g.translate(bl / 2, oy, 0);
      this.barrel.add(this.mkSolid(g, c, { thresholdAngle: 1 }));
    }
    // Pointe émettrice
    const tip = new THREE.BoxGeometry(0.16, 0.2, 0.2);
    tip.translate(bl + 0.07, 0, 0);
    this.barrel.add(this.mkSolid(tip, c, { fill: c, fillOpacity: 0.9 }));
  }

  // `mul` : bonus de dégâts quand un joueur tient la tourelle (tir ajusté).
  fire(ctx, mul = 1) {
    const m = this.getMuzzle();
    ctx.fireLaser(m.pos, m.dir, this.stats.damage * mul, this.stats.range, this.levelColor);
  }

  // Consomme de l'énergie à chaque tir (coût ajustable via TUNE). Le MODE DE TIR
  // renchérit ou allège le coup (`ship.energyCostMul`) : arroser en AUTO dévore
  // la réserve, tirer en SEMI l'économise.
  get energyCost() { return this.stats.energyCost * TUNE.laserCostMul; }
  energyCostFor(ship) { return this.energyCost * (ship?.energyCostMul ?? 1); }
  canFire(ship) { return ship.energy >= this.energyCostFor(ship); }
  onFired(ship) { ship.consume(this.energyCostFor(ship)); }
}
