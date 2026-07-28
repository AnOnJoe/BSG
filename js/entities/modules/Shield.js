import * as THREE from 'three';
import { Module } from '../Module.js';
import { makeCircle } from '../../core/NeonMaterials.js';

/**
 * Bouclier (passif) : émetteur plein + halo elliptique néon autour de la coque
 * (fx wireframe qui ondule). Fournit `shieldHp` (affiché au HUD).
 */
export class Shield extends Module {
  _build() {
    this.emitter = this.mkSolid(new THREE.OctahedronGeometry(0.3), this.levelColor, { thresholdAngle: 1 });
    this.group.add(this.emitter);

    // Bulle CIRCULAIRE de rayon = SHIELD_RADIUS (Range) => le visuel colle
    // exactement à la barrière anti-drones.
    this.fx = new THREE.Group();
    this.halo = makeCircle(9, this.levelColor, 80, 0.45);
    this.fx.add(this.halo);
    this._t = 0;
    this._up = false; // piloté par Range (setUp)
    this.fx.visible = false;
  }

  shipExtras() { return [this.fx]; }
  get shieldHp() { return this.stats.shieldHp; }

  _applyActive() {
    super._applyActive();
    this.fx.visible = this.active && this._up;
  }

  /** Piloté par Range : bulle affichée seulement si le bouclier est opérationnel. */
  setUp(up) {
    this._up = up;
    this.fx.visible = this.active && up;
  }

  update(dt) {
    if (!this.active || !this._up) { this.fx.visible = false; return; }
    this.fx.visible = true;
    this._t += dt * 2;
    this.halo.material.opacity = 0.3 + Math.sin(this._t) * 0.15;
    const s = 1 + Math.sin(this._t * 0.5) * 0.02;
    this.halo.scale.set(s, s, 1);
  }
}
