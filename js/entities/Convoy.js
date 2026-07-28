import * as THREE from 'three';
import { TRANSPORT_TYPES, FLEET } from '../data/convoyConfig.js';
import { makeSolid, neonLineMat } from '../core/NeonMaterials.js';

/**
 * Un transport civil. Il expose `position` / `radius` / `takeDamage()` comme
 * toute autre cible, ce qui lui vaut d'être ciblable par les Cylons sans ligne
 * de code spéciale — et c'est bien le problème du joueur.
 *
 * Il ne tire pas, ne manœuvre pas, ne se défend pas. Il avance, c'est tout.
 */
class Transport {
  constructor(typeId, lane) {
    const def = TRANSPORT_TYPES[typeId];
    this.def = def;
    this.id = `${typeId}-${lane}`;
    this.name = def.name;
    this.souls = def.souls;
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.radius = def.radius;
    this.alive = true;
    this.jumped = false;   // a franchi le saut (donc sauvé)
    this.lane = lane;      // décalage latéral dans la formation
    this.group = new THREE.Group();
    this._build();
  }

  _build() {
    const d = this.def;
    const shape = new THREE.Shape(d.profile.map((p) => new THREE.Vector2(p[0], p[1])));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 2.2, bevelEnabled: false, steps: 1 });
    geo.translate(0, 0, -1.1);
    this.body = makeSolid(geo, d.color, { fill: d.fill, thresholdAngle: 24 });
    this.group.add(this.body);

    // Hublots : ce sont des gens à bord, il faut que ça se voie
    const win = new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 7 }, (_, i) => new THREE.Vector3(-5 + i * 1.8, 0.9, 1.2))
    );
    this.group.add(new THREE.Points(win, new THREE.PointsMaterial({ color: 0xffe9b0, size: 0.5 })));
  }

  get position() { return this.group.position; }
  isAlive() { return this.alive; }

  takeDamage(d) {
    if (!this.alive) return;
    this.hp -= d;
    const t = 1 - Math.max(0, this.hp) / this.maxHp;
    this.body.userData.edgeMat.color.set(new THREE.Color(this.def.color).lerp(new THREE.Color(0xff4433), t));
    if (this.hp <= 0) { this.alive = false; this.group.visible = false; }
  }
}

/**
 * LA FLOTTE. Elle progresse vers le point de saut à la vitesse de son élément le
 * plus lent — donc protéger le traînard est une contrainte, pas une option.
 *
 * `souls` compte les survivants encore en vie ; un transport détruit les emporte
 * définitivement. C'est la véritable barre de vie de la partie.
 */
export class Convoy {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.transports = [];
    this.lostSouls = 0;
  }

  /** Place la flotte à l'entrée du couloir, en formation lâche. */
  build(fleet, startX, spanY) {
    this.clear();
    fleet.forEach((typeId, i) => {
      const t = new Transport(typeId, i);
      const rows = Math.ceil(fleet.length / 2);
      const col = i % 2, row = Math.floor(i / 2);
      t.group.position.set(
        startX - col * 26 - row * 4,
        (row - (rows - 1) / 2) * (spanY / Math.max(1, rows)) * 1.1,
        0
      );
      this.transports.push(t);
      this.group.add(t.group);
    });
    return this;
  }

  clear() {
    while (this.group.children.length) {
      const c = this.group.children[0];
      this.group.remove(c);
      c.traverse?.((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    }
    this.transports = [];
  }

  setVisible(v) { this.group.visible = v; }

  get alive() { return this.transports.filter((t) => t.alive && !t.jumped); }
  get lost() { return this.transports.filter((t) => !t.alive); }
  get saved() { return this.transports.filter((t) => t.jumped); }

  /** Survivants encore embarqués (les sautés comptent : ils sont sauvés). */
  get souls() {
    return this.transports.filter((t) => t.alive).reduce((s, t) => s + t.souls, 0);
  }

  /** Vitesse du convoi = celle du plus lent encore en route. */
  get speed() {
    const list = this.alive;
    if (!list.length) return 0;
    return Math.min(...list.map((t) => t.def.speed));
  }

  /** Le transport le plus en retard : celui qu'il faut couvrir. */
  get laggard() {
    const list = this.alive;
    if (!list.length) return null;
    return list.reduce((a, b) => (b.position.x < a.position.x ? b : a));
  }

  /** Le plus proche d'un point (les Cylons prennent le plus accessible). */
  nearestTo(x, y) {
    let best = null, bd = Infinity;
    for (const t of this.alive) {
      const d = (t.position.x - x) ** 2 + (t.position.y - y) ** 2;
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  /**
   * Avance vers le point de saut, tout le monde à la vitesse du plus lent, et
   * s'arrête à la porte : la flotte attend là que le calcul aboutisse.
   */
  update(dt, jumpX) {
    const v = this.speed;
    for (const t of this.alive) {
      if (t.position.x < jumpX) t.position.x += v * dt;
    }
  }

  /** Marque comme sauvés les transports arrivés dans le rayon du saut. */
  jump(jumpX, radius) {
    const out = { saved: [], left: [] };
    for (const t of this.alive) {
      if (t.position.x >= jumpX - radius) {
        t.jumped = true;
        t.group.visible = false;
        out.saved.push(t);
      } else {
        // Resté en arrière : le saut part sans lui, il est perdu corps et biens
        t.alive = false;
        t.group.visible = false;
        this.lostSouls += t.souls;
        out.left.push(t);
      }
    }
    return out;
  }

  /** Réengage les transports sauvés dans le secteur suivant. */
  redeploy(startX, spanY) {
    const keep = this.saved;
    for (const t of keep) {
      t.jumped = false;
      t.group.visible = true;
    }
    const rows = Math.ceil(Math.max(1, keep.length) / 2);
    keep.forEach((t, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      t.position.set(
        startX - col * 26 - row * 4,
        (row - (rows - 1) / 2) * (spanY / Math.max(1, rows)) * 1.1,
        0
      );
    });
    return keep.length;
  }
}
