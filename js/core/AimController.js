import * as THREE from 'three';
import { viewport } from './Viewport.js';

/**
 * Visée manuelle à la souris. Projette le curseur sur le plan de jeu (z = 0)
 * pour obtenir le point de visée dans le monde, et suit l'état du clic (tir).
 * Utilisé uniquement dans le champ de tir (activer/désactiver via enable()).
 */
export class AimController {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.ndc = new THREE.Vector2(0, 0);
    this.screen = new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2);
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // z = 0
    this.point = new THREE.Vector3(20, 0, 0);
    this.firing = false;
    this.enabled = false;

    this._onMove = (e) => this._move(e);
    this._onDown = (e) => { if (e.button === 0) this.firing = true; };
    this._onUp = (e) => { if (e.button === 0) this.firing = false; };
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.dom.addEventListener('mousemove', this._onMove);
    this.dom.addEventListener('mousedown', this._onDown);
    window.addEventListener('mouseup', this._onUp);
  }

  disable() {
    this.enabled = false;
    this.firing = false;
    this.dom.removeEventListener('mousemove', this._onMove);
    this.dom.removeEventListener('mousedown', this._onDown);
    window.removeEventListener('mouseup', this._onUp);
  }

  _move(e) {
    this.screen.set(e.clientX, e.clientY);
    // NDC relatifs à l'ÉCRAN TACTIQUE, pas à la fenêtre : en mode cockpit le
    // canvas est encadré par le décor du vaisseau.
    this.ndc.x = viewport.ndcX(e.clientX);
    this.ndc.y = viewport.ndcY(e.clientY);
  }

  update() {
    this.raycaster.setFromCamera(this.ndc, this.camera);
    this.raycaster.ray.intersectPlane(this.plane, this.point);
  }
}
