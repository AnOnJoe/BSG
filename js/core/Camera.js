import * as THREE from 'three';

/**
 * Caméra 2.5D. Deux cadrages :
 *  - Hangar : rapprochée, léger 3/4, pour détailler le vaisseau.
 *  - Combat : dézoomée, pour laisser de la place aux manœuvres et à l'encerclement.
 * Le plan de jeu reste z = 0 (visée souris, vaisseaux, projectiles).
 */
export function createCamera() {
  const cam = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 500);
  setHangarView(cam);
  return cam;
}

export function setHangarView(cam) {
  cam.fov = 42;
  cam.position.set(3.5, 6.5, 34);
  cam.lookAt(4, 0, 0);
  cam.updateProjectionMatrix();
}

// Décalage caméra en combat (la caméra suit le joueur, cf. Range._followCamera)
export const COMBAT_OFFSET = { y: 8, z: 48 };

export function setCombatView(cam) {
  cam.fov = 46;
  cam.position.set(0, COMBAT_OFFSET.y, COMBAT_OFFSET.z);
  cam.lookAt(0, 0, 0);
  cam.updateProjectionMatrix();
}

export function resizeCamera(cam, w, h) {
  cam.aspect = w / h;
  cam.updateProjectionMatrix();
}
