import * as THREE from 'three';
import { Module } from '../Module.js';

/**
 * Armure (passif) : plaque de blindage pleine sur la coque. Active aussi (via le
 * Ship) la seconde coque fil de fer légèrement agrandie. Fournit `armorHp`.
 */
export class Armor extends Module {
  _build() {
    this.plate = this.mkSolid(new THREE.BoxGeometry(0.9, 0.42, 0.18), this.levelColor, { thresholdAngle: 1 });
    this.group.add(this.plate);
  }

  get armorHp() { return this.stats.armorHp; }
}
