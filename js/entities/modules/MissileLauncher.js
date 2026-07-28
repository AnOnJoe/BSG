import * as THREE from 'three';
import { WeaponModule } from '../Module.js';

/**
 * Lance-missiles : socle trapu + RACK de 4 tubes (2×2) orientés vers l'avant.
 * Silhouette « pod de missiles » nettement différente du canon laser.
 */
export class MissileLauncher extends WeaponModule {
  _buildArmament() {
    const c = this.levelColor;

    // Munitions (magasin) — réinitialisées à l'entrée en combat
    if (this.ammo === undefined) this.ammo = this.stats.ammo;

    // Socle
    this.group.add(this.mkSolid(new THREE.BoxGeometry(0.5, 0.48, 0.58), c));

    // Rack 2×2 de tubes
    const tubeL = 0.6;
    this.muzzleLen = tubeL + 0.1;
    for (const oy of [0.14, -0.14]) {
      for (const oz of [0.14, -0.14]) {
        const g = new THREE.CylinderGeometry(0.085, 0.085, tubeL, 8);
        g.rotateZ(Math.PI / 2); // axe le long de X
        g.translate(tubeL / 2, oy, oz);
        this.barrel.add(this.mkSolid(g, c, { thresholdAngle: 1 }));
      }
    }
  }

  fire(ctx, mul = 1) {
    const m = this.getMuzzle();
    ctx.spawnMissile(m.pos, m.dir, {
      damage: this.stats.damage * mul,
      speed: this.stats.speed,
      range: this.stats.range,
      color: this.levelColor,
    });
  }

  // Munitions finies
  get ammoMax() { return this.stats.ammo; }
  canFire() { return this.ammo > 0; }
  onFired() { this.ammo = Math.max(0, this.ammo - 1); }
  reload() { this.ammo = this.stats.ammo; }
}
