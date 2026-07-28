import * as THREE from 'three';
import { HULL_CONFIG } from '../data/hullConfig.js';
import { makeEdges, makeSolid, makeCircle, neonLineMat, darken, PALETTE } from '../core/NeonMaterials.js';

const WINDOW_COLOR = 0xffd36b; // hublots « allumés »
const WHITE = 0xaebfd0;        // « blanc » désaturé (pâle, pas flashy)

/**
 * Coque baleine : corps plein (surface sombre + arêtes cyan) avec du détail
 * façon vaisseau capital SW — passerelle de commandement, rangées de hublots,
 * lignes de panneaux, mâchoire. + marqueurs de slots (visibles au hangar).
 */
export class Hull {
  constructor() {
    this.group = new THREE.Group();
    this.config = HULL_CONFIG;
    this._buildBody();
    this._buildTower();
    this._buildDetails();
    this._buildSlots();
  }

  _extrude() {
    const shape = new THREE.Shape();
    const p = this.config.profile;
    shape.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) shape.lineTo(p[i][0], p[i][1]);
    shape.closePath();
    const depth = this.config.depth;
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 });
    geo.translate(0, 0, -depth / 2);
    return geo;
  }

  _buildBody() {
    const geo = this._extrude();
    // Coque : remplissage teal opaque (clairement pas noir) + arêtes néon.
    // Pas de lueur additive => look net, sans effet "blob".
    this.body = makeSolid(geo, this.config.color, { fill: 0x0e2540, thresholdAngle: 22 });
    this.group.add(this.body);

    // Halo d'armure (coque agrandie, activée par le module Armure)
    this.armorShell = makeEdges(geo, PALETTE.armor, { thresholdAngle: 22, opacity: 0.0 });
    this.armorShell.scale.setScalar(1.06);
    this.group.add(this.armorShell);
  }

  setArmorVisible(on) {
    this.armorShell.material.opacity = on ? 0.5 : 0.0;
  }

  /** Petite polyligne néon posée sur la face avant. */
  _poly(pts, color, opacity, z) {
    const geo = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p[0], p[1], z)));
    return new THREE.Line(geo, neonLineMat(color, opacity));
  }

  _buildTower() {
    const t = this.config.tower;
    if (!t) return;
    const c = WHITE; // superstructure blanche (contraste avec la coque bleue)
    const g = new THREE.Group();
    g.position.set(t.pos[0], t.pos[1], t.pos[2]);

    // Base trapézoïdale + passerelle + sommet (superstructure à étages)
    const base = makeSolid(new THREE.BoxGeometry(...t.base), c, { fill: 0x2a3f55 });
    g.add(base);
    const bh = t.base[1] / 2 + t.bridge[1] / 2;
    const bridge = makeSolid(new THREE.BoxGeometry(...t.bridge), c, { fill: 0x33506e });
    bridge.position.y = bh;
    g.add(bridge);
    const top = makeSolid(new THREE.BoxGeometry(t.bridge[0] * 0.5, 0.22, t.bridge[2] * 0.7), c, { fill: 0x33506e });
    top.position.y = bh + t.bridge[1] / 2 + 0.11;
    g.add(top);

    // Rangée de hublots du pont
    for (const ox of [-0.18, 0, 0.18]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.1), new THREE.MeshBasicMaterial({ color: 0xdcefff }));
      w.position.set(ox, bh, t.bridge[2] / 2 + 0.02);
      g.add(w);
    }

    // Dôme capteur au sommet
    const dish = makeEdges(new THREE.SphereGeometry(0.15, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), c, { thresholdAngle: 40 });
    dish.position.set(-0.22, bh + t.bridge[1] / 2 + 0.22, 0);
    g.add(dish);

    // Mât + feu de position (rouge)
    const mastTop = bh + t.bridge[1] / 2 + 0.75;
    g.add(this._poly([[0.22, bh], [0.22, mastTop]], c, 0.9, 0));
    const light = new THREE.Mesh(new THREE.CircleGeometry(0.06, 10), new THREE.MeshBasicMaterial({ color: 0x9fd8ff }));
    light.position.set(0.22, mastTop, 0.02);
    g.add(light);

    this.group.add(g);
  }

  _buildDetails() {
    const zf = this.config.depth / 2 + 0.02;
    const c = this.config.color;              // bleu (arêtes)
    const seam = darken(c, 0.7);              // bleu moyen (coutures sur le blanc)
    const deep = darken(c, 0.45);             // bleu foncé (dos)
    const divY = 0.25;                        // séparation dos bleu (haut) / ventre blanc (bas)

    // ---- VENTRE BLANC (opaque), dos bleu => façon baleine ----
    const band = new THREE.Shape();
    const botEdge = [[6.4, -0.42], [5.6, -0.85], [4.0, -1.4], [1.5, -1.62], [-1.5, -1.52], [-4.0, -1.15]];
    band.moveTo(botEdge[0][0], botEdge[0][1]);
    for (let i = 1; i < botEdge.length; i++) band.lineTo(botEdge[i][0], botEdge[i][1]);
    band.lineTo(-4.0, divY);
    band.lineTo(6.4, divY);
    band.closePath();
    const bandMesh = new THREE.Mesh(
      new THREE.ShapeGeometry(band),
      new THREE.MeshBasicMaterial({ color: 0x9fb2c6, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
    );
    bandMesh.position.z = this.config.depth / 2 + 0.006;
    this.group.add(bandMesh);

    // Ligne de séparation (bleue, nette)
    this.group.add(this._poly([[6.4, divY], [1.0, divY], [-4.4, divY]], c, 0.9, zf));

    // Coutures transversales : bleues sur le ventre blanc (bas) + dos
    for (const x of [-3.6, -1.6, 0.4, 2.4, 4.2]) {
      const bot = -1.3 + Math.abs(x) * 0.05;
      this.group.add(this._poly([[x, divY], [x, bot]], seam, 0.55, zf));                 // sur le blanc
      this.group.add(this._poly([[x, 1.5 - Math.abs(x) * 0.06], [x, divY + 0.1]], deep, 0.4, zf)); // dos
    }

    // Crête dorsale (le long du dos, blanche pour ressortir sur le bleu)
    this.group.add(this._poly([[5.6, 1.15], [4.0, 1.6], [2.0, 1.82], [-0.5, 1.82], [-2.8, 1.55], [-4.6, 1.05]], WHITE, 0.8, zf));

    // Nageoires blanches
    this.group.add(this._poly([[-3.4, 1.75], [-4.6, 2.7], [-5.0, 1.35]], WHITE, 0.9, zf));
    this.group.add(this._poly([[-3.0, -1.35], [-4.0, -2.2], [-4.6, -1.15]], WHITE, 0.8, zf));

    // Hublots : rangée haute = lucarnes pâles (sur le dos bleu) ; rangée basse = portholes bleus (sur le ventre blanc)
    const rows = [
      { y: 0.85, x0: -2.6, x1: 4.0, col: 0xbfe0ff },
      { y: -0.55, x0: -2.8, x1: 4.2, col: 0x2a5f92 },
    ];
    for (const row of rows) {
      const geo = new THREE.PlaneGeometry(0.14, 0.1);
      const mat = new THREE.MeshBasicMaterial({ color: row.col });
      for (let x = row.x0; x <= row.x1; x += 0.82) {
        if (x > -1.5 && x < 0.3 && row.y > 0.5) continue; // place pour la tour
        const win = new THREE.Mesh(geo, mat);
        win.position.set(x, row.y, zf);
        this.group.add(win);
      }
    }

    // Tuyères décoratives à l'arrière
    for (const oy of [0.5, -0.5]) {
      const ring = makeCircle(0.3, 0x8fd8ff, 20, 0.75);
      ring.position.set(-5.7, oy, zf);
      this.group.add(ring);
    }

    // Mâchoire (ligne bleue foncée sur le ventre blanc)
    this.group.add(this._poly([[7.0, -0.12], [5.6, -0.42], [4.4, -0.32]], deep, 0.7, zf));

    // Œil (sombre + reflet) pour ressortir sur le ventre blanc
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.17, 18), new THREE.MeshBasicMaterial({ color: 0x0a1e33 }));
    eye.position.set(5.7, 0.05, zf); // sur le ventre blanc => bien visible
    this.group.add(eye);
    const glint = new THREE.Mesh(new THREE.CircleGeometry(0.055, 10), new THREE.MeshBasicMaterial({ color: 0xdff0ff }));
    glint.position.set(5.76, 0.11, zf + 0.001);
    this.group.add(glint);
  }

  _buildSlots() {
    this.slotGroup = new THREE.Group();
    this.slotGroup.visible = false;
    this.group.add(this.slotGroup);
    this.markers = {};
    this.pickables = [];

    for (const slot of this.config.slots) {
      const holder = new THREE.Group();
      holder.position.set(slot.pos[0], slot.pos[1], slot.pos[2]);
      const ring = makeCircle(0.5, PALETTE.slot, 32, 0.9);
      holder.add(ring);
      const pick = new THREE.Mesh(
        new THREE.SphereGeometry(0.65, 8, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      pick.userData.slotId = slot.id;
      holder.add(pick);
      this.slotGroup.add(holder);
      this.markers[slot.id] = { ring, holder };
      this.pickables.push(pick);
    }
  }

  setSlotsVisible(v) { this.slotGroup.visible = v; }

  setSlotState(slotId, state) {
    const m = this.markers[slotId];
    if (!m) return;
    const col = state === 'hover' ? PALETTE.slotHover
      : state === 'filled' ? PALETTE.hull
      : PALETTE.slot;
    m.ring.material.color.set(col);
    m.ring.material.opacity = state === 'empty' ? 0.55 : 0.95;
  }

  getSlotDef(id) { return this.config.slots.find((s) => s.id === id); }
}
