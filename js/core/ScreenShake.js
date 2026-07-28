import * as THREE from 'three';

/**
 * Secousse d'écran par « trauma » : on accumule du trauma sur les events
 * (tir, impact, explosion) et la caméra tremble proportionnellement à trauma²,
 * puis se calme. La caméra étant fixe, on restaure sa position de base à chaque
 * frame avant la visée, puis on applique l'offset juste avant le rendu.
 */
export class ScreenShake {
  constructor(camera) {
    this.camera = camera;
    this.base = camera.position.clone();
    this.trauma = 0;
    this.maxOffset = 1.3;
    this._off = new THREE.Vector3();
  }

  add(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Recapture la position de base (après un changement de cadrage caméra). */
  setBase() {
    this.base.copy(this.camera.position);
  }

  /** Remet la caméra à sa position stable (avant la visée). */
  restore() {
    this.camera.position.copy(this.base);
  }

  /** Applique l'offset de tremblement (juste avant le rendu). */
  applyShake(dt) {
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
    const s = this.trauma * this.trauma;
    if (s <= 0) return;
    const m = this.maxOffset * s;
    this._off.set(
      (Math.random() * 2 - 1) * m,
      (Math.random() * 2 - 1) * m,
      (Math.random() * 2 - 1) * m * 0.4
    );
    this.camera.position.copy(this.base).add(this._off);
  }

  reset() {
    this.trauma = 0;
    this.camera.position.copy(this.base);
  }
}
