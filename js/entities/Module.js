import * as THREE from 'three';
import { MODULE_CONFIG } from '../data/moduleConfig.js';
import { makeSolid, colorForLevel, darken } from '../core/NeonMaterials.js';

const _euler = new THREE.Euler();

/**
 * Classe de base d'un module. Les modules sont des VOLUMES PLEINS (surface
 * opaque sombre + arêtes néon). `mkSolid()` enregistre chaque partie pour gérer
 * l'état actif/inactif (arêtes vives quand actif, atténuées sinon).
 */
export class Module {
  constructor(defId, level = 1) {
    this.defId = defId;
    this.def = MODULE_CONFIG[defId];
    if (!this.def) throw new Error(`Module inconnu: ${defId}`);
    this.level = Math.min(Math.max(level, 1), this.def.levels.length);
    this.kind = this.def.kind;
    this.group = new THREE.Group();
    this.active = false;
    this.cooldown = 0;
    this.neonParts = [];
    this._build();
  }

  get stats() { return this.def.levels[this.level - 1]; }
  get maxLevel() { return this.def.levels.length; }
  get levelColor() { return colorForLevel(this.def.color, this.level, this.maxLevel); }
  canUpgrade() { return this.level < this.maxLevel; }

  /** Construit un volume plein néon et l'enregistre pour l'état actif. */
  mkSolid(geometry, color, opts = {}) {
    const g = makeSolid(geometry, color, opts);
    this.neonParts.push({ edgeMat: g.userData.edgeMat, fillMat: g.userData.fillMat, base: color });
    return g;
  }

  upgrade() {
    if (!this.canUpgrade()) return false;
    this.level++;
    this.rebuild();
    return true;
  }

  rebuild() {
    while (this.group.children.length) this.group.remove(this.group.children[0]);
    this.neonParts = [];
    this._build();
    this.setActive(this.active);
  }

  setActive(a) {
    this.active = a;
    this._applyActive();
  }

  _applyActive() {
    for (const p of this.neonParts) {
      p.edgeMat.color.set(this.active ? p.base : darken(p.base, 0.4));
      p.edgeMat.opacity = this.active ? 1 : 0.55;
    }
  }

  // --- hooks à surcharger ---
  _build() {}
  update(/* dt, ctx */) {}
  fire(/* ctx */) {}
  dispose() {}
}

/**
 * Base des armes visées à la souris (laser, missiles) : socle fixe + canon
 * pivotant. Les sous-classes remplissent l'armement via `_buildArmament()` et
 * fixent `this.muzzleLen`.
 */
export class WeaponModule extends Module {
  _build() {
    this.barrel = new THREE.Group();
    this.muzzleLen = 0.9;
    this._buildArmament();
    this.group.add(this.barrel);
    this._dir = new THREE.Vector3(1, 0, 0);
    this._worldPos = new THREE.Vector3();
  }

  /** Oriente le canon vers un point du monde (plan XY). */
  aim(worldPoint) {
    this.group.getWorldPosition(this._worldPos);
    const ang = Math.atan2(worldPoint.y - this._worldPos.y, worldPoint.x - this._worldPos.x);
    // Compense la rotation du vaisseau parent (qui pivote vers l'ennemi) pour
    // que le canon pointe bien vers le point visé en coordonnées monde.
    this.group.updateWorldMatrix(true, false);
    _euler.setFromRotationMatrix(this.group.matrixWorld);
    this.barrel.rotation.z = ang - _euler.z;
    this._dir.set(Math.cos(ang), Math.sin(ang), 0);
  }

  getMuzzle() {
    this.group.getWorldPosition(this._worldPos);
    return {
      pos: this._worldPos.clone().addScaledVector(this._dir, this.muzzleLen),
      dir: this._dir.clone(),
    };
  }

  /**
   * Position monde de la tourelle. Sert à l'artillerie autonome : chaque tourelle
   * juge la portée depuis SA position, pas depuis le centre du vaisseau.
   * Le vecteur retourné est un scratch réutilisé — le consommer immédiatement.
   */
  worldPos() {
    this.group.getWorldPosition(this._worldPos);
    return this._worldPos;
  }

  // Ressources : par défaut une arme peut toujours tirer et ne consomme rien.
  // Surchargé par le laser (énergie) et les missiles (munitions).
  canFire(/* ship */) { return true; }
  onFired(/* ship */) {}
}

export { darken };
