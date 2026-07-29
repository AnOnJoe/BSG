import * as THREE from 'three';
import { neonLineMat } from '../core/NeonMaterials.js';

const _v = new THREE.Vector3();

/**
 * Intercepteur autonome (petit triangle fil de fer, centre transparent).
 * Utilisé par les deux camps. Comportement :
 *  - une cible ennemie existe => fonce dessus, l'orbite de près et tire ;
 *  - sinon => orbite son porteur (owner).
 * Destructible (petits PV).
 */
export class Drone {
  constructor(faction, color, spawnPos) {
    this.faction = faction;      // 'player' | 'enemy'
    this.color = color;
    this.hp = 6;
    this.alive = true;
    this.fireCd = 0.3 + Math.random() * 0.6;
    this.orbitDir = Math.random() < 0.5 ? 1 : -1;
    this.orbitRadius = 3.6 + Math.random() * 1.5;
    this.speed = 36;   // à l'échelle du monde agrandi (×2,1) : sinon ils traînent
    this.fireRange = 25; // idem — voir aussi le plancher lié à la barrière dans update()
    this.radius = 1.3; // hitbox généreuse pour pouvoir les abattre

    const s = 0.5;
    const pts = [
      new THREE.Vector3(s, 0, 0),
      new THREE.Vector3(-s * 0.7, s * 0.6, 0),
      new THREE.Vector3(-s * 0.7, -s * 0.6, 0),
    ];
    this.group = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), neonLineMat(color, 1));
    this.group.position.copy(spawnPos);
    this._angle = Math.random() * Math.PI * 2;
    this._vel = new THREE.Vector3();
  }

  get position() { return this.group.position; }
  isAlive() { return this.alive && this.hp > 0; }
  takeDamage(d) { this.hp -= d; if (this.hp <= 0) this.alive = false; }

  /**
   * ctx = { targetPos: Vector3|null, targetAlive: bool, ownerPos: Vector3,
   *         spawnBolt(pos, dir, dmg, faction, color) }
   */
  update(dt, ctx) {
    if (!this.isAlive()) return;
    const focus = (ctx.targetPos && ctx.targetAlive) ? ctx.targetPos : ctx.ownerPos;
    this._angle += this.orbitDir * dt * 1.7;

    // Barrière (bouclier de la cible) : le drone ne peut pas la franchir, il
    // orbite à sa lisière tant qu'elle tient.
    const barrier = ctx.barrier || 0;
    const orbitR = Math.max(this.orbitRadius, barrier + 1.5);

    // Point d'orbite désiré autour du focus
    const dx = Math.cos(this._angle) * orbitR;
    const dy = Math.sin(this._angle) * orbitR;
    _v.set(focus.x + dx, focus.y + dy, 0).sub(this.group.position);
    const d = _v.length();
    if (d > 0.001) {
      _v.multiplyScalar(Math.min(this.speed * dt, d) / d);
      this.group.position.add(_v);
      this.group.rotation.z = Math.atan2(_v.y, _v.x);
    }
    // Empêche toute pénétration résiduelle dans la bulle
    if (barrier > 0) {
      const bx = this.group.position.x - focus.x, by = this.group.position.y - focus.y;
      const bd = Math.hypot(bx, by);
      if (bd < barrier && bd > 0.001) {
        this.group.position.x = focus.x + (bx / bd) * barrier;
        this.group.position.y = focus.y + (by / bd) * barrier;
      }
    }

    // Tir sur la cible si à portée.
    //
    // ⚠ LA BARRIÈRE NE DOIT PAS DÉSARMER LE DRONE. Bug rencontré au rescale : le rayon
    // du bouclier est passé de 9 à 19, donc l'orbite forcée à 20,5, très au-delà d'une
    // portée de 12 — les drones ennemis devenaient **totalement inoffensifs** contre
    // une baleine bouclier levé, sans un seul message, et le canon anti-drone perdait
    // sa raison d'être. La portée est donc plancher-née sur la distance d'orbite : si
    // le bouclier les repousse, ils tirent d'aussi loin qu'il les repousse. C'est le
    // rôle du bouclier d'ARRÊTER LES TIRS, pas d'empêcher qu'ils partent.
    if (ctx.targetPos && ctx.targetAlive) {
      const dist = this.group.position.distanceTo(ctx.targetPos);
      const reach = Math.max(this.fireRange, orbitR + 3);
      this.fireCd -= dt;
      if (dist < reach && this.fireCd <= 0) {
        this.fireCd = 0.6;
        const dir = _v.copy(ctx.targetPos).sub(this.group.position).setZ(0).normalize();
        ctx.spawnBolt(this.group.position.clone(), dir, 3, this.faction, this.color);
      }
    }
  }

  dispose() {
    this.group.geometry.dispose();
    this.group.material.dispose();
  }
}
