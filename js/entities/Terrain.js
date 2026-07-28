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

  /**
   * VOLUME irrégulier. Avant, les rochers étaient des `ExtrudeGeometry` : des
   * prismes dont on voyait la face plate de face — d'où l'impression de disques.
   *
   * On part d'un icosaèdre et on déforme selon un bruit CONTINU de la direction
   * (et non `Math.random()` par sommet, qui trouerait la maille puisque la
   * géométrie n'est pas indexée). Léger aplatissement en Z pour rester lisible
   * dans une vue 2.5D sans redevenir plat.
   */
  _rockGeo(r, kind, seed) {
    const geo = new THREE.IcosahedronGeometry(r, kind.detail ?? 1);
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      const d = v.clone().normalize();
      const n = Math.sin(d.x * 3.1 + seed) * Math.cos(d.y * 2.7 + seed * 1.7)
        + 0.6 * Math.sin(d.z * 4.3 + seed * 0.9);
      const f = 1 + n * kind.jag * 0.5;
      pos.setXYZ(i, v.x * f, v.y * f, v.z * f * (kind.flat ?? 0.72));
    }
    geo.computeVertexNormals();
    return geo;
  }

  /** Carcasse de vaisseau : une épave brisée, allongée et tordue. */
  _wreckGeo(r, seed) {
    const g = new THREE.Group();
    const segs = 3 + Math.floor(Math.abs(Math.sin(seed)) * 3);
    for (let i = 0; i < segs; i++) {
      const l = r * (0.5 + Math.abs(Math.sin(seed + i)) * 0.7);
      const h = r * (0.22 + Math.abs(Math.cos(seed + i * 1.3)) * 0.3);
      const box = new THREE.BoxGeometry(l, h, h * 0.8);
      box.translate((i - segs / 2) * r * 0.55, Math.sin(seed + i * 2) * r * 0.18, 0);
      const part = makeSolid(box, OBSTACLE_KINDS.hulk.color, { fill: OBSTACLE_KINDS.hulk.fill, thresholdAngle: 24 });
      part.rotation.z = Math.sin(seed + i) * 0.35;
      g.add(part);
    }
    return g;
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
          // Les menus débris peuvent se serrer : seuls les obstacles qui bloquent
          // ont besoin d'être bien séparés pour rester lisibles.
          const gap = kind.blocks ? 6 : -r;
          ok = this.obstacles.every((o) => !o.blocks || Math.hypot(o.x - x, o.y - y) > o.r + r + gap);
        }
        if (!ok) continue;

        const seed = i * 7.3 + r;
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
          : kind.wreck
            ? this._wreckGeo(r, seed)
            : makeSolid(this._rockGeo(r, kind, seed), kind.color, { fill: kind.fill, thresholdAngle: 24 });
        // Plusieurs plans de profondeur : sans ça tout est plaqué sur z=0 et le
        // décor n'a aucun relief.
        mesh.position.set(x, y, kind.jams ? -2 : (Math.random() - 0.5) * (kind.zSpread ?? 4));
        mesh.rotation.z = Math.random() * Math.PI * 2;
        this.group.add(mesh);

        this.obstacles.push({
          x, y, r, blocks: !!kind.blocks, jams: !!kind.jams, mesh,
          // Dérive lente : un champ d'astéroïdes figé est mort
          spin: (Math.random() - 0.5) * (kind.spin ?? 0.25),
        });
      }
    }
    this.blockers = this.obstacles.filter((o) => o.blocks);
    return this;
  }

  /** Dérive du décor : lente, juste assez pour que ce ne soit pas un décor peint. */
  update(dt) {
    for (const o of this.obstacles) {
      if (o.spin) o.mesh.rotation.z += o.spin * dt;
    }
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
