import * as THREE from 'three';
import { Module } from '../Module.js';
import { makeCircle } from '../../core/NeonMaterials.js';

/**
 * Radar : mât + dôme plein. Détecte les cibles à portée (alimente le mini-radar
 * du HUD et le verrouillage). Visuel : cercle de portée au sol. `range` et
 * `maxTargets` montent par niveau.
 */
export class Radar extends Module {
  _build() {
    const c = this.levelColor;

    // Mât
    const post = this.mkSolid(new THREE.BoxGeometry(0.16, 0.32, 0.16), c);
    post.position.y = 0.14;
    this.group.add(post);

    // Dôme (demi-sphère)
    const domeGeo = new THREE.SphereGeometry(0.3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    this.dome = this.mkSolid(domeGeo, c, { thresholdAngle: 40 });
    this.dome.position.y = 0.3;
    this.group.add(this.dome);

    // FX au niveau du vaisseau : seulement le cercle de portée.
    // (Plus de trait de balayage tournant autour du vaisseau — c'est le
    // mini-radar en bas à droite qui assure le balayage.)
    this.fx = new THREE.Group();
    this.circle = makeCircle(this.stats.range, c, 72, 0.3);
    this.fx.add(this.circle);
  }

  shipExtras() { return [this.fx]; }
  get range() { return this.stats.range; }
  get maxTargets() { return this.stats.maxTargets; }

  _applyActive() {
    super._applyActive();
    this.fx.visible = this.active;
  }
}
