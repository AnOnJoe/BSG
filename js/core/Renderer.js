import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { PALETTE } from './NeonMaterials.js';

// Le bloom multi-passes est le poste GPU le plus lourd : on plafonne la
// résolution interne (surtout sur écrans Retina où devicePixelRatio = 2 => 4×
// les pixels). 1 suffit largement, le glow masque la perte de netteté.
const MAX_PIXEL_RATIO = 1;

/**
 * Renderer WebGL + chaîne de post-processing avec bloom (glow néon).
 */
export class NeonRenderer {
  constructor(canvas, scene, camera) {
    // antialias inutile ici : le rendu passe par des render targets offscreen
    // (EffectComposer), donc le MSAA du canvas ne s'applique pas — autant l'économiser.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.renderer.setClearColor(PALETTE.bg, 1);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    // Bloom : strength / radius / threshold (plus dense pour un rendu néon marqué)
    this.baseStrength = 0.85;
    this._pulse = 0;
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      this.baseStrength,
      0.6,  // radius
      0.42  // threshold plus haut => les grandes surfaces claires ne "brûlent" plus
    );
    this.composer.addPass(this.bloom);

    this.setSize(window.innerWidth, window.innerHeight);
  }

  /** Coup de projecteur temporaire sur le bloom (explosions, gros impacts). */
  pulse(amount) {
    this._pulse = Math.max(this._pulse, amount);
  }

  /**
   * `updateStyle = false` : la taille d'AFFICHAGE du canvas est pilotée par le CSS
   * (il est encadré par le décor du cockpit, cf. #bay). Laisser Three écrire
   * canvas.style.width/height écraserait ce cadrage.
   */
  setSize(w, h) {
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
  }

  render() {
    this.bloom.strength = this.baseStrength + this._pulse;
    this._pulse *= 0.9;
    if (this._pulse < 0.01) this._pulse = 0;
    this.composer.render();
  }
}
