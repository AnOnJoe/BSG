import * as THREE from 'three';
import { Module } from '../Module.js';

/**
 * Baie d'intercepteurs : boîtier plein plat avec ouverture avant (hangar).
 * La touche est un TOGGLE de déploiement (`active`). Quand elle est déployée,
 * c'est le champ de bataille (Range) qui fait apparaître et pilote les drones
 * autonomes correspondants (ils foncent sur l'ennemi et tirent).
 */
export class InterceptorBay extends Module {
  _build() {
    const c = this.levelColor;
    this.bay = this.mkSolid(new THREE.BoxGeometry(0.75, 0.42, 0.7), c);
    this.group.add(this.bay);
    for (const oy of [0.16, -0.16]) {
      const g = new THREE.BoxGeometry(0.18, 0.1, 0.72);
      g.translate(0.42, oy, 0);
      this.group.add(this.mkSolid(g, c));
    }
  }

  /** Nombre de drones à déployer quand la baie est active. */
  get droneCount() { return this.stats.count; }
}
