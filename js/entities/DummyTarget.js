import * as THREE from 'three';
import { makeEdges, neonLineMat, PALETTE } from '../core/NeonMaterials.js';

/**
 * Cible d'entraînement inerte : carcasse fil de fer avec points de vie.
 * Encaisse les dégâts (si détectée par le radar), flashe à l'impact, explose
 * en dispersant ses arêtes à 0 PV, puis réapparaît.
 */
export class DummyTarget {
  constructor(position = new THREE.Vector3(16, 0, 0)) {
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.radius = 2.6;
    this.maxHp = 120;
    this.hp = this.maxHp;
    this.state = 'alive';
    this.flash = 0;
    this.respawnTimer = 0;

    this._buildBody();
    this._buildDebris();
  }

  _buildBody() {
    const geo = new THREE.IcosahedronGeometry(2.2, 0);
    this.body = makeEdges(geo, PALETTE.target, { thresholdAngle: 1 });
    this.group.add(this.body);
  }

  _buildDebris() {
    // Fragments réutilisés pour l'explosion (segments qui fusent vers l'extérieur)
    this.debris = new THREE.Group();
    this.debris.visible = false;
    this._debrisData = [];
    for (let i = 0; i < 26; i++) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.6, 0, 0),
      ]);
      const seg = new THREE.Line(geo, neonLineMat(PALETTE.target, 1));
      this.debris.add(seg);
      this._debrisData.push({ seg, vel: new THREE.Vector3(), spin: 0 });
    }
    this.group.add(this.debris);
  }

  get position() {
    return this.group.getWorldPosition(new THREE.Vector3());
  }

  isAlive() { return this.state === 'alive'; }

  takeDamage(d) {
    if (this.state !== 'alive') return;
    this.hp = Math.max(0, this.hp - d);
    this.flash = 1;
    if (this.hp <= 0) this._explode();
  }

  _explode() {
    this.state = 'exploding';
    this.body.visible = false;
    this.debris.visible = true;
    for (const dd of this._debrisData) {
      dd.seg.position.set(0, 0, 0);
      dd.seg.rotation.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
      dd.seg.material.opacity = 1;
      dd.vel.set(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ).normalize().multiplyScalar(4 + Math.random() * 5);
      dd.spin = (Math.random() - 0.5) * 6;
    }
    this.respawnTimer = 1.6;
  }

  _respawn() {
    this.hp = this.maxHp;
    this.state = 'alive';
    this.body.visible = true;
    this.debris.visible = false;
    this.flash = 0;
  }

  update(dt) {
    if (this.state === 'alive') {
      this.body.rotation.y += dt * 0.4;
      this.body.rotation.x += dt * 0.15;
      if (this.flash > 0) {
        this.flash = Math.max(0, this.flash - dt * 4);
        const c = new THREE.Color(PALETTE.target).lerp(new THREE.Color(0xffffff), this.flash);
        this.body.material.color.copy(c);
      }
    } else if (this.state === 'exploding') {
      for (const dd of this._debrisData) {
        dd.seg.position.addScaledVector(dd.vel, dt);
        dd.seg.rotation.z += dd.spin * dt;
        dd.seg.material.opacity = Math.max(0, dd.seg.material.opacity - dt * 0.6);
      }
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this._respawn();
    }
  }
}
