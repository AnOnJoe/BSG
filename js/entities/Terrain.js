import * as THREE from 'three';
import { TERRAINS, OBSTACLE_KINDS } from '../data/terrainConfig.js';
import { makeSolid, neonLineMat } from '../core/NeonMaterials.js';

/**
 * Décor d'un secteur : astéroïdes, épaves, nuages de poussière.
 *
 * Ce n'est pas de l'habillage. Les obstacles `blocks` **coupent les tirs** — la
 * ligne de vue devient une ressource, se placer devient une décision, et le
 * « on tourne en rond dans un rectangle vide » disparaît.
 *
 * Chaque obstacle est un cercle (`x`, `y`, `r`) : c'est la seule chose dont ont
 * besoin la collision et l'occlusion, et ça reste assez peu coûteux pour tester
 * tous les projectiles contre tous les obstacles à chaque frame.
 */
export class Terrain {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.obstacles = [];   // { x, y, r, blocks, jams }
    this.blockers = [];     // sous-ensemble qui coupe les tirs (boucle chaude)
    this.name = '';
  }

  /** Silhouette irrégulière : un cercle bruité, low-poly comme le reste. */
  _rockShape(r, kind) {
    const pts = [];
    for (let i = 0; i < kind.faces; i++) {
      const a = (i / kind.faces) * Math.PI * 2;
      const rr = r * (1 - kind.jag * Math.random());
      pts.push(new THREE.Vector2(Math.cos(a) * rr, Math.sin(a) * rr));
    }
    return new THREE.Shape(pts);
  }

  /**
   * (Re)génère le décor. `arena` borne le placement ; on laisse un couloir libre
   * au centre (`clearAt`) pour ne pas faire apparaître le joueur dans un rocher.
   */
  build(terrainId, arena, clearAt = { x: 0, y: 0, r: 30 }) {
    this.clear();
    const def = TERRAINS[terrainId] || TERRAINS.void;
    this.id = def.id;
    this.name = def.name;

    for (const cl of def.clusters) {
      const kind = OBSTACLE_KINDS[cl.kind];
      for (let i = 0; i < cl.count; i++) {
        const r = cl.rMin + Math.random() * (cl.rMax - cl.rMin);
        // Placement rejeté s'il empiète sur la zone franche ou sur un obstacle
        // déjà posé : deux rochers imbriqués font une masse illisible.
        let x = 0, y = 0, ok = false;
        for (let tries = 0; tries < 40 && !ok; tries++) {
          x = (Math.random() * 2 - 1) * arena.x * cl.spread;
          y = (Math.random() * 2 - 1) * arena.y * cl.spread;
          if (Math.hypot(x - clearAt.x, y - clearAt.y) < clearAt.r + r) continue;
          ok = this.obstacles.every((o) => Math.hypot(o.x - x, o.y - y) > o.r + r + 6);
        }
        if (!ok) continue;

        const geo = new THREE.ExtrudeGeometry(this._rockShape(r, kind), {
          depth: r * 0.5, bevelEnabled: false, steps: 1,
        });
        geo.translate(0, 0, -r * 0.25);
        const mesh = kind.jams
          // Poussière : pas de volume plein, juste un contour diffus
          ? new THREE.LineLoop(
            new THREE.BufferGeometry().setFromPoints(
              Array.from({ length: 22 }, (_, k) => {
                const a = (k / 22) * Math.PI * 2;
                return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0);
              })
            ),
            neonLineMat(kind.color, 0.25)
          )
          : makeSolid(geo, kind.color, { fill: kind.fill, thresholdAngle: 24 });
        mesh.position.set(x, y, kind.jams ? -2 : 0);
        this.group.add(mesh);

        this.obstacles.push({ x, y, r, blocks: !!kind.blocks, jams: !!kind.jams, mesh });
      }
    }
    this.blockers = this.obstacles.filter((o) => o.blocks);
    return this;
  }

  clear() {
    while (this.group.children.length) {
      const m = this.group.children[0];
      this.group.remove(m);
      m.traverse?.((c) => { c.geometry?.dispose?.(); c.material?.dispose?.(); });
    }
    this.obstacles = [];
    this.blockers = [];
  }

  setVisible(v) { this.group.visible = v; }

  /** Un point est-il dans un obstacle qui coupe les tirs ? */
  blocksPoint(x, y, pad = 0) {
    for (const o of this.blockers) {
      if (Math.hypot(o.x - x, o.y - y) < o.r + pad) return o;
    }
    return null;
  }

  /**
   * Premier obstacle coupé par le segment [O, O + dir·range]. Sert au laser
   * (hitscan) : sans ça on tirerait à travers les rochers.
   * Renvoie { obstacle, t } avec `t` la distance parcourue, ou null.
   */
  rayHit(ox, oy, dx, dy, range) {
    let best = null, bt = range;
    for (const o of this.blockers) {
      const cx = o.x - ox, cy = o.y - oy;
      const tca = cx * dx + cy * dy;
      if (tca < 0) continue;                       // derrière nous
      const d2 = cx * cx + cy * cy - tca * tca;
      const rr = o.r * o.r;
      if (d2 > rr) continue;                       // le rayon passe à côté
      const t = tca - Math.sqrt(rr - d2);
      if (t < 0 || t > bt) continue;
      bt = t;
      best = o;
    }
    return best ? { obstacle: best, t: bt } : null;
  }

  /** La cible est-elle masquée par un obstacle ? (conduite de tir de l'équipage) */
  isHidden(fromX, fromY, toX, toY) {
    const dx = toX - fromX, dy = toY - fromY;
    const d = Math.hypot(dx, dy);
    if (d < 0.001) return false;
    const hit = this.rayHit(fromX, fromY, dx / d, dy / d, d);
    return !!hit;
  }

  /** Le radar est-il brouillé à cette position ? (nuages de poussière) */
  jammedAt(x, y) {
    for (const o of this.obstacles) {
      if (o.jams && Math.hypot(o.x - x, o.y - y) < o.r) return true;
    }
    return false;
  }

  /**
   * Repousse un corps circulaire hors des obstacles. Renvoie true s'il a été
   * déplacé (le vaisseau qui racle une coque prend des dégâts).
   */
  push(pos, radius) {
    let touched = false;
    for (const o of this.blockers) {
      const dx = pos.x - o.x, dy = pos.y - o.y;
      const d = Math.hypot(dx, dy) || 0.0001;
      const min = o.r + radius;
      if (d < min) {
        const k = (min - d) / d;
        pos.x += dx * k;
        pos.y += dy * k;
        touched = true;
      }
    }
    return touched;
  }
}
