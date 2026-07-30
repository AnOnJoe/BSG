import * as THREE from 'three';
import { makeSolid, neonLineMat, darken } from '../core/NeonMaterials.js';
import { TUNE } from '../core/Tune.js';

const _v = new THREE.Vector3();

// (`lerpAngle` a été retiré : l'orientation passe maintenant par une vitesse angulaire
// plafonnée, cf. `update` — un lissage `min(1, dt * taux)` sature sur une frame longue et
// fait pivoter la coque d'un bloc.)

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
// ⚠ `range` = DISTANCE D'ENGAGEMENT mise à l'échelle du rescale (×2,1), comme les
// portées d'armes et la distance de combat du barreur. Sans ça, tout s'était agrandi
// sauf eux : ils venaient se coller à la coque au lieu de tenir un cercle lisible, et
// « approche longue et lisible » — la raison d'être du rythme lent — ne tenait plus.
// Le multiplicateur `TUNE.enemyRangeMul` permet de rejuger ça manette en main.
// `range` = DISTANCE D'ENGAGEMENT, à l'échelle du rescale (×2,1) comme les portées
// d'armes : sans ça ils venaient se coller à la coque et « l'approche longue et
// lisible » — la raison d'être du rythme lent — ne tenait plus. Multiplicateur de
// réglage : `TUNE.enemyRangeMul`.
//
// ⚠ `max` / `tang` / `turn` : LA MASSE COMMANDE. Le grief était « les gros vaisseaux
// tournent trop vite et avancent trop vite », et il ne visait pas les chasseurs
// (« les intercepteurs ça va »). On CREUSE donc l'écart au lieu de tout ralentir :
//  - chasseur et raider = chasse embarquée, inchangés, ils doivent rester vifs ;
//  - gunship et porte-drones = bâtiments, divisés par ~1,5 en vitesse et surtout
//    beaucoup plus lents à s'orienter.
// `turn` est le taux de lissage du cap (fort = pivote sec). Il était **fixé à 4 pour
// tout le monde**, donc un bâtiment lourd virait aussi sec qu'un chasseur : c'est de
// là que venait l'essentiel de la nervosité côté ennemi.
export const ENEMY_TYPES = {
  fighter: { label: 'Chasseur',  hpMul: 0.55, dmgMul: 0.8, range: 25, tang: 9, max: 15, turn: 4.0, scale: 0.8, color: 0xff9944, fireCd: 1.2, bonusDrones: 0, react: 0.18 },
  raider:  { label: 'Raider',    hpMul: 1.0,  dmgMul: 1.0, range: 38, tang: 6, max: 10, turn: 2.6, scale: 1.0, color: 0xff5544, fireCd: 1.6, bonusDrones: 0, react: 0.35 },
  gunship: { label: 'Cuirassé',  hpMul: 2.2,  dmgMul: 1.7, range: 50, tang: 1.5, max: 4, turn: 0.7, scale: 1.45, color: 0xff3322, fireCd: 1.9, bonusDrones: 0, react: 0.7 },
  carrier: { label: 'Porte-drones', hpMul: 1.4, dmgMul: 0.7, range: 46, tang: 3, max: 5.5, turn: 0.9, scale: 1.15, color: 0xff4488, fireCd: 2.2, bonusDrones: 2, react: 0.45 },
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

  /**
   * Silhouette de RAIDER CYLON : aile en croissant, corps mince, et surtout
   * l'ŒIL ROUGE UNIQUE qui balaye d'un bord à l'autre. C'est ce balayage qui
   * rend la chose vivante et reconnaissable d'un coup d'œil — bien plus que la
   * forme elle-même.
   */
  _buildBody() {
    const shape = new THREE.Shape();
    shape.moveTo(PROFILE[0][0], PROFILE[0][1]);
    for (let i = 1; i < PROFILE.length; i++) shape.lineTo(PROFILE[i][0], PROFILE[i][1]);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.1, bevelEnabled: false, steps: 1 });
    geo.translate(0, 0, -0.55);
    this.body = makeSolid(geo, this.color, { fill: 0x2a0f12, thresholdAngle: 22 });
    this.group.add(this.body);

    // Ailes en croissant, recourbées vers l'avant
    for (const sy of [1, -1]) {
      const w = new THREE.Shape();
      w.moveTo(-0.2, 0.5 * sy);
      w.lineTo(-2.4, 1.9 * sy);
      w.lineTo(-3.4, 1.5 * sy);
      w.lineTo(-2.9, 0.85 * sy);
      w.lineTo(-1.0, 0.35 * sy);
      w.closePath();
      const wg = new THREE.ExtrudeGeometry(w, { depth: 0.5, bevelEnabled: false, steps: 1 });
      wg.translate(0, 0, -0.25);
      this.group.add(makeSolid(wg, this.color, { fill: 0x2a0f12, thresholdAngle: 30 }));
    }

    // Fente du capteur + œil qui coulisse dedans
    const slot = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.16),
      new THREE.MeshBasicMaterial({ color: 0x2b0a0c })
    );
    slot.position.set(-1.4, 0, 0.57);
    this.group.add(slot);
    this.eye = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.2),
      new THREE.MeshBasicMaterial({ color: 0xff2d2d })
    );
    this.eye.position.set(-1.4, 0, 0.6);
    this.group.add(this.eye);
    this._eyeT = Math.random() * 6;
  }

  /** Balayage de l'œil : va-et-vient continu, indépendant du reste. */
  _updateEye(dt) {
    if (!this.eye) return;
    this._eyeT += dt * 2.6;
    // Triangle plutôt que sinus : le balayage a une vitesse constante puis
    // s'inverse net, comme le Cylon de la série.
    const p = (this._eyeT % 2);
    const k = p < 1 ? p : 2 - p;
    this.eye.position.x = -2.0 + k * 1.2;
    this.eye.material.color.setHex(0xff2d2d);
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
    // Lu à chaque apparition, donc réglable en direct au panneau T d'une vague à l'autre.
    this.preferredRange = t.range * TUNE.enemyRangeMul;
    this.tangSpeed = t.tang;
    this.maxSpeed = t.max;
    this.turnRate = t.turn ?? 4;   // vivacité d'orientation : la masse commande
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
    this._updateEye(dt);

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

    // Le nez (local -X) suit le CAP (direction de déplacement), d'autant plus
    // paresseusement que le bâtiment est lourd (`turn`). Le taux était fixé à 4 pour
    // tous : un cuirassé léger pivotait aussi sec qu'un chasseur, ce qui est
    // exactement le « trop nerveux » relevé en partie test.
    // ⚠ Vitesse angulaire PLAFONNÉE, pour la même raison que côté convoi : un lissage
    // `min(1, dt * taux)` sature sur une frame longue et fait pivoter la coque d'un
    // bloc. Sur un bâtiment lourd, ce saut ruine à lui seul l'impression de masse.
    // ⚠ IL PIVOTE MÊME À L'ARRÊT. La rotation était conditionnée à `sp > 0.5` : un
    // bâtiment stabilisé à sa distance d'engagement gardait donc son cap indéfiniment,
    // et ne pouvait pas se retourner sans d'abord se remettre en mouvement. Le cap visé
    // se lit sur la vitesse VOULUE (`vx`, `vy`), qui existe même quand le déplacement
    // effectif est nul — c'est ce qui permet de tourner sur place.
    // (`sp` est la norme de la vitesse VOULUE, pas du déplacement réel : le seuil ne sert
    // donc qu'à écarter le cas dégénéré où `atan2(0, 0)` renverrait un cap arbitraire.)
    if (sp > 0.05) {
      const angV = Math.atan2(vy, vx) + Math.PI;
      const rate = this.turnRate || 4;
      let dr = ((angV - this.group.rotation.z + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (dr < -Math.PI) dr += Math.PI * 2;
      // Gain d'approche : cf. `TURN_GAIN` dans Convoy.js — sans lui l'amorti commence à
      // 69° du but et mange la moitié du virage, ce qui rend les vitesses de rotation
      // incomparables d'une famille de vaisseaux à l'autre.
      const omega = Math.max(-rate * 1.2, Math.min(rate * 1.2, dr * rate * 3));
      const step = omega * dt;
      this.group.rotation.z += Math.abs(step) > Math.abs(dr) ? dr : step;
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
