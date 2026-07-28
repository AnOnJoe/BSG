import * as THREE from 'three';
import { Module } from '../Module.js';

/**
 * Réacteur (passif) : tuyère pleine (cône ouvert vers l'arrière) qui pulse.
 * Fournit une poussée `thrust` (vitesse de déplacement vertical de la baleine).
 */
export class Reactor extends Module {
  _build() {
    const geo = new THREE.ConeGeometry(0.4, 0.72, 10, 1, true);
    geo.rotateZ(Math.PI / 2); // ouverture vers -X
    this.nozzle = this.mkSolid(geo, this.levelColor, { thresholdAngle: 1 });
    this.group.add(this.nozzle);
    this._t = 0;
  }

  get thrust() { return this.stats.thrust; }
  get power() { return this.stats.power; }       // régén d'énergie / s
  get energyCap() { return this.stats.energyCap; } // capacité d'énergie ajoutée

  update(dt) {
    if (!this.active) return;
    this._t += dt * 6;
    const pulse = 1 + Math.sin(this._t) * 0.16;
    this.nozzle.scale.set(pulse, 1, 1);
    this.nozzle.userData.edgeMat.opacity = 0.7 + Math.sin(this._t) * 0.3;
  }
}
