import * as THREE from 'three';
import { makeSolid, neonLineMat, darken } from '../core/NeonMaterials.js';
import { TUNE } from '../core/Tune.js';

const _v = new THREE.Vector3();

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// Silhouette « raider » (nez vers -X en local)
const PROFILE = [
  [-3.6, 0.0], [-1.2, 0.75], [1.4, 1.05], [2.2, 0.45], [2.9, 1.7], [1.2, 0.35],
  [3.0, 0.0], [1.2, -0.35], [2.9, -1.7], [2.2, -0.45], [1.4, -1.05], [-1.2, -0.75],
];

/**
 * Types d'ennemis — chacun a un profil de jeu distinct :
 *  - fighter  : rapide, fragile, colle au joueur (harcèlement)
 *  - raider   : polyvalent (l'ennemi de base)
 *  - gunship  : lourd, lent, gros PV et dégâts, garde ses distances
 *  - carrier  : porte-drones (déploie plus d'intercepteurs)
 */
export const ENEMY_TYPES = {
  fighter: { label: 'Chasseur',  hpMul: 0.55, dmgMul: 0.8, range: 12, tang: 9, max: 15, scale: 0.8, color: 0xff9944, fireCd: 1.2, bonusDrones: 0, react: 0.18 },
  raider:  { label: 'Raider',    hpMul: 1.0,  dmgMul: 1.0, range: 18, tang: 6, max: 10, scale: 1.0, color: 0xff5544, fireCd: 1.6, bonusDrones: 0, react: 0.35 },
  gunship: { label: 'Cuirassé',  hpMul: 2.2,  dmgMul: 1.7, range: 24, tang: 3, max: 6,  scale: 1.45, color: 0xff3322, fireCd: 1.9, bonusDrones: 0, react: 0.7 },
  carrier: { label: 'Porte-drones', hpMul: 1.4, dmgMul: 0.7, range: 22, tang: 5, max: 8, scale: 1.15, color: 0xff4488, fireCd: 2.2, bonusDrones: 2, react: 0.45 },
};

/**
 * Vaisseau ennemi CPU. IA d'encerclement (maintient sa distance + orbite),
 * le nez suit sa trajectoire, tire vers le joueur. Stats/visuel selon le type.
 */
export class EnemyShip {
  constructor() {
    this.group = new THREE.Group();
    this.radius = 2.6;
    this.collisionRadius = 2.6;
    this.state = 'dead';
    this.color = ENEMY_TYPES.raider.color;
    this.type = 'raider';
    this._buildBody();
    this.maxHp = 70; this.hp = 70; this.damage = 6; this.droneCount = 0;
    this.preferredRange = 18; this.tangSpeed = 6; this.maxSpeed = 10;
    this.orbitDir = 1; this.fireCd = 1.6; this.fireInterval = 1.6; this._flipT = 3;
    this.stunTimer = 0;
  }

  /** Paralysie (IEM) : fige déplacement et tir pendant `dur` secondes. */
  stun(dur) { this.stunTimer = Math.max(this.stunTimer, dur); }

  _buildBody() {
    const shape = new THREE.Shape();
    shape.moveTo(PROFILE[0][0], PROFILE[0][1]);
    for (let i = 1; i < PROFILE.length; i++) shape.lineTo(PROFILE[i][0], PROFILE[i][1]);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.1, bevelEnabled: false, steps: 1 });
    geo.translate(0, 0, -0.55);
    this.body = makeSolid(geo, this.color, { fill: 0x2a0f12, thresholdAngle: 22 });
    this.group.add(this.body);
    const eye = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.14), new THREE.MeshBasicMaterial({ color: 0xffdd66 }));
    eye.position.set(-1.6, 0, 0.56);
    this.group.add(eye);
  }

  get position() { return this.group.position.clone(); }
  isAlive() { return this.state === 'alive'; }

  /** opts = { type, hp, damage, droneCount } */
  spawn(pos, opts) {
    const t = ENEMY_TYPES[opts.type] || ENEMY_TYPES.raider;
    this.type = opts.type || 'raider';
    this.color = t.color;
    this.scale = t.scale;
    this.group.scale.setScalar(t.scale);
    this.radius = 2.6 * t.scale;
    this.collisionRadius = this.radius;
    this.preferredRange = t.range;
    this.tangSpeed = t.tang;
    this.maxSpeed = t.max;
    this.fireInterval = t.fireCd;
    this.reactionTau = t.react;   // temps de réaction (retard de perception du joueur)
    this.perceived = null;         // position perçue du joueur (rattrape la vraie avec du retard)

    this.body.userData.edgeMat.color.set(this.color);
    this.body.userData.fillMat.color.set(darken(this.color, 0.2));

    this.group.position.copy(pos);
    this.group.rotation.z = 0;
    this.maxHp = opts.hp; this.hp = opts.hp;
    this.damage = opts.damage; this.droneCount = opts.droneCount || 0;
    this.orbitDir = Math.random() < 0.5 ? 1 : -1;
    this.fireCd = 0.8 + Math.random();
    this._flipT = 2 + Math.random() * 3;
    this._dronesDeployed = false; // escadron initial pas encore lancé
    this._droneCd = 6;            // délai de reconstruction d'un drone abattu
    this.state = 'alive';
    this.flash = 0;
    this.stunTimer = 0;
    this.body.visible = true;
    this.group.visible = true;
  }

  takeDamage(d) {
    if (this.state !== 'alive') return;
    this.hp = Math.max(0, this.hp - d);
    this.flash = 1;
    if (this.hp <= 0) this._explode();
  }

  _explode() {
    // Le vaisseau disparaît net ; c'est Range qui projette le champ de débris
    // (fx.debris) à la transition vivant -> détruit.
    this.state = 'exploding';
    this.group.visible = false;
    this._explodeT = 1.0;
  }

  /** ctx = { playerPos, bounds:{x,y}, spawnBolt(pos,dir,dmg,faction,color) } */
  update(dt, ctx) {
    if (this.state === 'exploding') {
      this._explodeT -= dt;
      if (this._explodeT <= 0) this.state = 'dead';
      return;
    }
    if (this.state !== 'alive') return;

    // Paralysé par une IEM : clignote, ne bouge pas, ne tire pas
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      const f = 0.4 + Math.random() * 0.5;
      this.body.userData.edgeMat.color.set(new THREE.Color(this.color).lerp(new THREE.Color(0x9fe8ff), f));
      if (this.stunTimer <= 0) this.body.userData.edgeMat.color.set(this.color);
      return;
    }

    // Perception retardée du joueur : l'ennemi met un temps à réagir quand le
    // joueur change de cap (la position perçue rattrape la vraie avec du retard).
    if (!this.perceived) this.perceived = ctx.playerPos.clone();
    else this.perceived.lerp(ctx.playerPos, Math.min(1, dt / this.reactionTau));
    const pp = this.perceived;

    const pos = this.group.position;
    _v.copy(pos).sub(pp); _v.z = 0;
    const dist = _v.length() || 0.0001;
    const rx = _v.x / dist, ry = _v.y / dist;
    const tx = -ry * this.orbitDir, ty = rx * this.orbitDir;
    const rangeErr = dist - this.preferredRange;
    const spdMul = TUNE.enemySpeedMul;
    let vx = (rx * (-rangeErr * 1.4) + tx * this.tangSpeed) * spdMul;
    let vy = (ry * (-rangeErr * 1.4) + ty * this.tangSpeed) * spdMul;
    const sp = Math.hypot(vx, vy);
    const cap = this.maxSpeed * spdMul;
    if (sp > cap) { vx = vx / sp * cap; vy = vy / sp * cap; }
    pos.x = THREE.MathUtils.clamp(pos.x + vx * dt, -ctx.bounds.x, ctx.bounds.x);
    pos.y = THREE.MathUtils.clamp(pos.y + vy * dt, -ctx.bounds.y, ctx.bounds.y);

    this._flipT -= dt;
    if (this._flipT <= 0) { this.orbitDir *= -1; this._flipT = 3 + Math.random() * 3; }

    // Le nez (local -X) suit le CAP (direction de déplacement)
    if (sp > 0.5) {
      const angV = Math.atan2(vy, vx);
      this.group.rotation.z = lerpAngle(this.group.rotation.z, angV + Math.PI, Math.min(1, dt * 4));
    }

    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 4);
      this.body.userData.edgeMat.color.set(new THREE.Color(this.color).lerp(new THREE.Color(0xffffff), this.flash));
    }

    this.fireCd -= dt;
    if (this.fireCd <= 0) {
      this.fireCd = this.fireInterval * TUNE.enemyFireMul;
      // vise la position PERÇUE => tire là où tu étais (esquivable si tu jukes)
      const dir = _v.set(pp.x - pos.x, pp.y - pos.y, 0).normalize();
      const muzzle = new THREE.Vector3(pos.x + dir.x * this.radius, pos.y + dir.y * this.radius, 0);
      ctx.spawnBolt(muzzle, dir, this.damage, 'enemy', this.color);
    }
  }
}
