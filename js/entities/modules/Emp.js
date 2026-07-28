import * as THREE from 'three';
import { Module } from '../Module.js';

/**
 * IEM (impulsion électromagnétique) : capacité active à recharge (touche E).
 * Déclenchée, elle DÉTRUIT les drones ennemis proches et PARALYSE les vaisseaux
 * ennemis dans son rayon pendant `stun` secondes. L'effet est appliqué par Range.
 */
export class Emp extends Module {
  _build() {
    const c = this.levelColor;
    this.group.add(this.mkSolid(new THREE.BoxGeometry(0.42, 0.32, 0.5), c));
    // bobine (tore) au sommet
    const coil = this.mkSolid(new THREE.TorusGeometry(0.32, 0.07, 8, 16), c, { thresholdAngle: 40 });
    coil.rotation.x = Math.PI / 2;
    coil.position.y = 0.34;
    this.group.add(coil);
    this.cooldownLeft = 0;
  }

  get radius() { return this.stats.radius; }
  get stun() { return this.stats.stun; }
  get cooldownTime() { return this.stats.cooldown; } // (pas 'cooldown' : réservé par Module)
  ready() { return this.active && this.cooldownLeft <= 0; }
  trigger() { this.cooldownLeft = this.cooldownTime; }
  reload() { this.cooldownLeft = 0; } // prêt à l'entrée en combat

  update(dt) {
    if (this.cooldownLeft > 0) this.cooldownLeft = Math.max(0, this.cooldownLeft - dt);
  }
}
