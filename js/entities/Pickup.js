import * as THREE from 'three';
import { makeSolid } from '../core/NeonMaterials.js';

/**
 * Bonus ramassable qui apparaît dans l'arène :
 *  - 'ammo'   : caisse de munitions (recharge les lance-missiles)
 *  - 'repair' : kit de réparation (restaure la coque)
 * On le récupère en volant dessus. Disparaît après un délai (clignote avant).
 */
export class Pickup {
  constructor(type, pos, ttl = 22) {
    this.type = type;
    this.color = type === 'ammo' ? 0xffaa33 : 0x66ff99;
    this.radius = 2.4;
    this.ttl = ttl;
    this.group = new THREE.Group();
    this.group.position.copy(pos);

    this.group.add(makeSolid(new THREE.BoxGeometry(1.4, 1.4, 1.4), this.color, { fill: 0x10161c, thresholdAngle: 1 }));

    // Icône lumineuse sur la face avant
    const mat = new THREE.MeshBasicMaterial({ color: this.color });
    if (type === 'repair') {
      const v = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.9), mat);
      const h = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.26), mat);
      v.position.z = h.position.z = 0.73;
      this.group.add(v, h);
    } else {
      for (const ox of [-0.32, 0, 0.32]) {
        const b = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.85), mat);
        b.position.set(ox, 0, 0.73);
        this.group.add(b);
      }
    }

    this._t = Math.random() * 6;
    this._baseY = pos.y;
  }

  get position() { return this.group.position; }

  update(dt) {
    this._t += dt;
    this.group.rotation.z += dt * 0.8;
    this.group.position.y = this._baseY + Math.sin(this._t * 2) * 0.4;
    this.ttl -= dt;
    if (this.ttl < 4) this.group.visible = Math.floor(this.ttl * 6) % 2 === 0; // clignote
    return this.ttl > 0;
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
}
