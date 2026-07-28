import * as THREE from 'three';
import { CAPITAL_CONFIG } from '../data/capitalConfig.js';
import { makeSolid, makeEdges, makeCircle, neonLineMat, darken } from '../core/NeonMaterials.js';
import { TUNE } from '../core/Tune.js';

const _v = new THREE.Vector3();

function angleDiff(a, b) {
  let d = ((a - b + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

/**
 * Une pièce du cuirassé : batterie, pont ou moteur.
 * Expose `position` / `radius` / `takeDamage()` — la MÊME interface que
 * `EnemyShip` et `Drone` — pour que tout le système de tir (raycast laser,
 * têtes chercheuses, conduite de tir de l'équipage) la traite sans savoir ce
 * qu'elle est.
 */
class CapitalPart {
  constructor(def, parent) {
    this.def = def;
    this.parent = parent;
    this.id = def.id;
    this.kind = def.kind;
    this.name = def.name;
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.radius = def.radius;
    this.alive = true;
    this.position = new THREE.Vector3(); // monde, rafraîchie chaque frame
    this.fireCd = 1 + Math.random() * 2;
    this.group = new THREE.Group();
    this.group.position.set(def.pos[0], def.pos[1], 0);
    this._build();
  }

  _build() {
    const c = CAPITAL_CONFIG.color;
    const d = this.def;
    if (d.kind === 'engine') {
      const geo = new THREE.ConeGeometry(1.5, 2.6, 10, 1, true);
      geo.rotateZ(Math.PI / 2);
      this.mesh = makeSolid(geo, c, { thresholdAngle: 1, fill: CAPITAL_CONFIG.fill });
      this.glow = makeCircle(1.2, 0xffb060, 16, 0.85);
      this.glow.position.set(-1.4, 0, 0);
      this.group.add(this.glow);
    } else if (d.kind === 'bridge') {
      this.mesh = makeSolid(new THREE.BoxGeometry(3.0, 1.6, 1.4), c, { fill: CAPITAL_CONFIG.fill });
    } else {
      // Batterie : socle + deux tubes pointant dans son secteur. Généreusement
      // dimensionnée : sur une coque de 46 unités, une tourelle discrète serait
      // invisible — or c'est LA cible que le joueur doit identifier et choisir.
      this.mesh = makeSolid(new THREE.BoxGeometry(3.0, 1.8, 2.0), c, { fill: CAPITAL_CONFIG.fill });
      this.barrel = new THREE.Group();
      const ang = (d.dir * Math.PI) / 180;
      this.barrel.rotation.z = ang;
      for (const oy of [0.45, -0.45]) {
        const g = new THREE.BoxGeometry(3.2, 0.3, 0.3);
        g.translate(1.6, oy, 0);
        this.barrel.add(makeSolid(g, c, { thresholdAngle: 1, fill: CAPITAL_CONFIG.fill }));
      }
      this.group.add(this.barrel);
    }
    this.group.add(this.mesh);

    // Cercle de désignation : marque la pièce comme CIBLE. Sans lui on ne sait
    // pas où tirer sur une masse de 46 unités.
    this.marker = makeCircle(d.radius * 1.25, 0xffd0a0, 24, 0.5);
    this.marker.position.z = CAPITAL_CONFIG.depth / 2 + 0.3;
    this.group.add(this.marker);
  }

  isAlive() { return this.alive; }

  takeDamage(d) {
    if (!this.alive) return;
    this.hp -= d;
    // Rougeoiement à l'impact : on doit VOIR qu'on abîme la bonne pièce
    const t = 1 - Math.max(0, this.hp) / this.maxHp;
    this.mesh.userData.edgeMat.color.set(darken(0xffffff, 0.35 + t * 0.65));
    if (this.hp <= 0) {
      this.alive = false;
      this.group.visible = false;
    }
  }

  /** Le joueur est-il dans le secteur de tir de cette batterie ? */
  bearsOn(worldAngleToTarget, parentRot) {
    if (this.kind !== 'battery') return false;
    const dir = parentRot + (this.def.dir * Math.PI) / 180;
    return angleDiff(worldAngleToTarget, dir) <= (this.def.arc * Math.PI) / 360;
  }
}

/**
 * Cuirassé : lent, massif, hérissé de batteries. On ne l'esquive pas, on le
 * démonte pièce par pièce — et chaque pièce détruite change la donne (angle mort
 * ouvert, immobilisation, conduite de tir déréglée).
 */
export class CapitalShip {
  constructor() {
    this.config = CAPITAL_CONFIG;
    this.group = new THREE.Group();
    this.state = 'dead';
    this.parts = [];
    this._build();
    this.group.visible = false;
  }

  _build() {
    const cfg = this.config;
    const shape = new THREE.Shape();
    const p = cfg.profile;
    shape.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) shape.lineTo(p[i][0], p[i][1]);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: cfg.depth, bevelEnabled: false, steps: 1 });
    geo.translate(0, 0, -cfg.depth / 2);
    this.body = makeSolid(geo, cfg.color, { fill: cfg.fill, thresholdAngle: 22 });
    this.group.add(this.body);

    // Îlot de commandement (décor ; la pièce destructible est ajoutée plus bas)
    const t = cfg.tower;
    const tower = new THREE.Group();
    tower.position.set(t.pos[0], t.pos[1], t.pos[2]);
    tower.add(makeSolid(new THREE.BoxGeometry(...t.base), cfg.color, { fill: cfg.fill }));
    const br = makeSolid(new THREE.BoxGeometry(...t.bridge), cfg.color, { fill: cfg.fill });
    br.position.y = t.base[1] / 2 + t.bridge[1] / 2;
    tower.add(br);
    this.group.add(tower);

    // Lignes de coque : donnent l'échelle (des panneaux, donc c'est grand)
    const zf = cfg.depth / 2 + 0.02;
    const seam = darken(cfg.color, 0.55);
    for (let x = -20; x <= 16; x += 4) {
      const top = 3.2 + Math.min(1.3, (20 - Math.abs(x)) * 0.06);
      const bot = -2.6 - Math.min(1.6, (20 - Math.abs(x)) * 0.07);
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, top, zf), new THREE.Vector3(x, bot, zf),
      ]);
      this.group.add(new THREE.Line(g, neonLineMat(seam, 0.4)));
    }

    // Pièces destructibles
    for (const def of cfg.parts) {
      const part = new CapitalPart(def, this);
      this.parts.push(part);
      this.group.add(part.group);
    }

    // Halo de silhouette : lisibilité sur fond de nébuleuse
    this.outline = makeEdges(geo, 0xffd0c0, { thresholdAngle: 22, opacity: 0.25 });
    this.outline.scale.setScalar(1.01);
    this.group.add(this.outline);
  }

  get alive() { return this.state === 'alive'; }
  get livingParts() { return this.parts.filter((p) => p.alive); }
  get batteries() { return this.parts.filter((p) => p.kind === 'battery'); }
  get liveBatteries() { return this.batteries.filter((p) => p.alive); }
  get enginesAlive() { return this.parts.some((p) => p.kind === 'engine' && p.alive); }
  get bridgeAlive() { return this.parts.some((p) => p.kind === 'bridge' && p.alive); }
  get position() { return this.group.position; }

  spawn(pos, scale = 1) {
    this.state = 'alive';
    this.group.visible = true;
    this.group.position.copy(pos);
    this.group.rotation.z = Math.PI; // proue tournée vers l'origine de l'arène
    for (const p of this.parts) {
      p.alive = true;
      p.hp = Math.round(p.maxHp * scale);
      p.group.visible = true;
      p.mesh.userData.edgeMat.color.set(this.config.color);
      p.fireCd = 1 + Math.random() * 3;
    }
    this._refreshPartPositions();
  }

  kill() {
    this.state = 'dead';
    this.group.visible = false;
  }

  _refreshPartPositions() {
    this.group.updateMatrixWorld(true);
    for (const p of this.parts) p.group.getWorldPosition(p.position);
  }

  /** Cercles de collision en coordonnées monde (la coque est très allongée). */
  collisionCircles(out = []) {
    out.length = 0;
    const rot = this.group.rotation.z;
    const cos = Math.cos(rot), sin = Math.sin(rot);
    for (const c of this.config.collision) {
      out.push({
        x: this.group.position.x + c.pos[0] * cos - c.pos[1] * sin,
        y: this.group.position.y + c.pos[0] * sin + c.pos[1] * cos,
        r: c.r,
      });
    }
    return out;
  }

  /**
   * ctx = { playerPos, bounds, spawnBolt(pos, dir, dmg, faction, color), onPartDestroyed }
   * Renvoie la liste des pièces détruites durant cette frame (pour les effets).
   */
  update(dt, ctx) {
    if (!this.alive) return null;

    // Déplacement : il avance vers sa distance de bombardement, très lentement,
    // et s'arrête net si on lui a arraché ses moteurs.
    if (this.enginesAlive) {
      _v.copy(ctx.playerPos).sub(this.group.position);
      _v.z = 0;
      const dist = _v.length() || 0.0001;
      const err = dist - this.config.standoff;
      if (Math.abs(err) > 3) {
        const sp = this.config.speed * TUNE.enemySpeedMul * Math.sign(err);
        const step = (sp * dt) / dist;
        this.group.position.x += _v.x * step;
        this.group.position.y += _v.y * step;
      }
      // Il présente le flanc (il ne pointe pas sa proue : ses bordées sont latérales)
      const want = Math.atan2(_v.y, _v.x) + Math.PI / 2;
      let d = ((want - this.group.rotation.z + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (d < -Math.PI) d += Math.PI * 2;
      this.group.rotation.z += d * Math.min(1, dt * 0.25); // manœuvre pesante
    }

    this.group.position.x = THREE.MathUtils.clamp(this.group.position.x, -ctx.bounds.x + 26, ctx.bounds.x - 26);
    this.group.position.y = THREE.MathUtils.clamp(this.group.position.y, -ctx.bounds.y + 12, ctx.bounds.y - 12);
    this._refreshPartPositions();

    // Tir : chaque batterie vivante tire si le joueur est dans SON secteur.
    const firePenalty = this.bridgeAlive ? 1 : 1 / this.config.bridgeFirePenalty;
    const rot = this.group.rotation.z;
    for (const p of this.parts) {
      if (!p.alive || p.kind !== 'battery') continue;
      _v.copy(ctx.playerPos).sub(p.position);
      _v.z = 0;
      const dist = _v.length() || 0.0001;
      const ang = Math.atan2(_v.y, _v.x);
      // Le canon suit la cible dans les limites de son secteur (retour visuel)
      if (p.barrel && p.bearsOn(ang, rot)) p.barrel.rotation.z = ang - rot;
      p.fireCd -= dt;
      if (p.fireCd > 0) continue;
      if (dist > p.def.range || !p.bearsOn(ang, rot)) continue;
      p.fireCd = p.def.fireInterval * TUNE.enemyFireMul * firePenalty;
      _v.multiplyScalar(1 / dist);
      const muzzle = new THREE.Vector3(
        p.position.x + _v.x * (p.radius + 0.5),
        p.position.y + _v.y * (p.radius + 0.5),
        0
      );
      ctx.spawnBolt(muzzle, _v.clone(), p.def.damage, 'enemy', this.config.color);
    }
    return null;
  }
}
