import * as THREE from 'three';
import { neonLineMat } from './NeonMaterials.js';

/**
 * Effets visuels transitoires (game feel) : flashs de tir, étincelles
 * d'impact, ondes de choc, explosions. Objets légers, éphémères, auto-nettoyés.
 * Blending additif => se marient bien avec le bloom néon.
 */
export class Fx {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.items = [];
    this._glow = this._makeGlowTex(); // halo rond doux (flashs / traînées)
  }

  _makeGlowTex() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  }

  _add(obj, ttl, update) {
    this.group.add(obj);
    this.items.push({ obj, ttl, life: ttl, update });
    // Garde-fou anti-accumulation : ne jamais laisser exploser le nombre d'effets
    if (this.items.length > 340) {
      const old = this.items.shift();
      this.group.remove(old.obj);
      old.obj.geometry.dispose();
      if (old.obj.material) old.obj.material.dispose();
    }
  }

  /** Flash lumineux qui gonfle et s'estompe (muzzle flash, cœur d'explosion). */
  flash(pos, color, size = 1) {
    const mat = new THREE.MeshBasicMaterial({
      map: this._glow, color, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    m.position.copy(pos);
    this._add(m, 0.13, (it, dt, k) => {
      m.scale.setScalar(1 + (1 - k) * 2.6);
      mat.opacity = k;
    });
  }

  /** Onde de choc : anneau qui s'étend et s'efface. */
  ring(pos, color, maxR = 3) {
    const seg = 48;
    const pts = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
    }
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), neonLineMat(color, 1));
    line.position.copy(pos);
    this._add(line, 0.45, (it, dt, k) => {
      line.scale.setScalar(Math.max(0.001, maxR * (1 - k)));
      line.material.opacity = k;
    });
  }

  /** Gerbe d'étincelles (segments qui fusent puis s'éteignent). */
  sparks(pos, color, n = 8) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.5, 0, 0)]),
        neonLineMat(color, 1)
      );
      s.position.copy(pos);
      const a = Math.random() * Math.PI * 2;
      const sp = 4 + Math.random() * 7;
      const vel = new THREE.Vector3(Math.cos(a), Math.sin(a), (Math.random() - 0.5) * 0.6).multiplyScalar(sp);
      s.rotation.z = a;
      this._add(s, 0.3 + Math.random() * 0.25, (it, dt, k) => {
        s.position.addScaledVector(vel, dt);
        s.material.opacity = k;
      });
    }
  }

  /** Petite marque de traînée (missiles). */
  trailDot(pos, color) {
    const mat = new THREE.MeshBasicMaterial({
      map: this._glow, color, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), mat);
    m.position.copy(pos);
    this._add(m, 0.3, (it, dt, k) => { mat.opacity = 0.8 * k; m.scale.setScalar(k); });
  }

  /** Champ de débris : éclats fil de fer (polylignes) qui fusent et tournent. */
  debris(pos, color, n = 14, scale = 1) {
    for (let i = 0; i < n; i++) {
      const len = (0.8 + Math.random() * 1.3) * scale;
      const pts = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(len * 0.55, (Math.random() - 0.5) * len * 0.4, 0),
        new THREE.Vector3(len, (Math.random() - 0.5) * len * 0.3, 0),
      ];
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), neonLineMat(color, 1));
      line.position.copy(pos);
      line.rotation.z = Math.random() * Math.PI * 2;
      const a = Math.random() * Math.PI * 2;
      const sp = (3 + Math.random() * 7) * scale;
      const vx = Math.cos(a) * sp, vy = Math.sin(a) * sp, spin = (Math.random() - 0.5) * 9;
      this._add(line, 1.9, (it, dt, k) => {
        line.position.x += vx * dt;
        line.position.y += vy * dt;
        line.rotation.z += spin * dt;
        line.material.opacity = k;
      });
    }
  }

  /** Combo explosion : flash + onde + étincelles. */
  explosion(pos, color, scale = 1) {
    this.flash(pos, color, 1.6 * scale);
    this.ring(pos, color, 3.2 * scale);
    this.sparks(pos, color, Math.round(10 * scale));
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      const k = Math.max(0, it.life / it.ttl);
      it.update(it, dt, k);
      if (it.life <= 0) {
        this.group.remove(it.obj);
        it.obj.geometry.dispose();
        if (it.obj.material) it.obj.material.dispose();
        this.items.splice(i, 1);
      }
    }
  }

  clear() {
    for (const it of this.items) {
      this.group.remove(it.obj);
      it.obj.geometry.dispose();
      if (it.obj.material) it.obj.material.dispose();
    }
    this.items = [];
  }
}
