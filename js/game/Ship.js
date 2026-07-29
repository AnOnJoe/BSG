import * as THREE from 'three';
import { Hull } from '../entities/Hull.js';
import { HULL_CONFIG } from '../data/hullConfig.js';
import { SLOT_ACCEPTS, DEFAULT_BUILD } from '../data/moduleConfig.js';
import { TUNE } from '../core/Tune.js';
import { PowerBus } from '../core/PowerBus.js';
import { LaserCannon } from '../entities/modules/LaserCannon.js';
import { MissileLauncher } from '../entities/modules/MissileLauncher.js';
import { Ciws } from '../entities/modules/Ciws.js';
import { InterceptorBay } from '../entities/modules/InterceptorBay.js';
import { Emp } from '../entities/modules/Emp.js';
import { Reactor } from '../entities/modules/Reactor.js';
import { Shield } from '../entities/modules/Shield.js';
import { Armor } from '../entities/modules/Armor.js';
import { Radar } from '../entities/modules/Radar.js';

/** Réutilisé pour ramener un point d'impact dans le repère de la coque. */
const _hit = new THREE.Vector3();

const MODULE_CLASSES = {
  laser: LaserCannon,
  missile: MissileLauncher,
  ciws: Ciws,
  interceptor: InterceptorBay,
  emp: Emp,
  reactor: Reactor,
  shield: Shield,
  armor: Armor,
  radar: Radar,
};

/**
 * Vaisseau = coque + modules montés par slot. Gère montage/démontage/upgrade,
 * sérialisation pour la sauvegarde, et l'update de tous les modules.
 */
export class Ship {
  /** Part de la section à retrouver pour qu'elle reparte (cf. `repairSection`). */
  static SECTION_BACK = 0.25;

  constructor() {
    this.group = new THREE.Group();
    this.hull = new Hull();
    this.group.add(this.hull.group);
    // Couche des FX au niveau vaisseau (cercle radar, halo bouclier, essaim) :
    // masquée dans le hangar, visible au champ de tir.
    this.fxLayer = new THREE.Group();
    this.group.add(this.fxLayer);
    this.slots = {};                 // slotId -> Module | null
    this._extras = {};               // slotId -> Object3D[] (fx au niveau vaisseau)
    for (const s of HULL_CONFIG.slots) this.slots[s.id] = null;

    // Combat : défense + énergie (réinitialisés à l'entrée du champ de tir)
    this.baseStructure = 100;
    this.baseEnergyCap = 50;
    this.structure = this.baseStructure;
    this.shield = 0;
    this.shieldBroken = false;
    this.energy = this.baseEnergyCap;
    this._sinceHit = 99;
    this.collisionRadius = 4.2;
    // Répartition de l'énergie entre armes / boucliers / moteurs (anneau de passerelle)
    this.power = new PowerBus();
    this.energyCostMul = 1; // fixé par le mode de tir (WeaponControl)
    // SECTIONS DE COQUE (poste d'ingénieur). Elles courent EN PARALLÈLE de
    // `structure` : la létalité du jeu ne change pas, mais une section tombée met
    // ses modules hors service jusqu'à réparation.
    this.sections = {};
    this.resetSections();
  }

  // --- sections de coque (ingénieur) ---

  resetSections() {
    for (const s of HULL_CONFIG.sections || []) {
      this.sections[s.id] = { def: s, hp: s.hp, maxHp: s.hp, down: false };
    }
  }

  get sectionList() { return (HULL_CONFIG.sections || []).map((s) => this.sections[s.id]); }

  /** Modules montés dans une section. */
  modulesInSection(id) {
    return HULL_CONFIG.slots
      .filter((s) => s.section === id)
      .map((s) => this.slots[s.id])
      .filter(Boolean);
  }

  /**
   * Section la plus proche d'un point d'impact, exprimé dans le repère de la
   * COQUE (donc déjà ramené du monde par l'appelant : la baleine tourne).
   */
  sectionAt(lx, ly) {
    let best = null, bd = Infinity;
    for (const s of this.sectionList) {
      const d = (s.def.at[0] - lx) ** 2 + (s.def.at[1] - ly) ** 2;
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  /**
   * Encaisse localement. Une section à 0 tombe et **coupe ses modules** : on
   * mémorise `_sectionDown` pour pouvoir les rallumer à la réparation sans
   * ressusciter ceux que le commandant avait volontairement éteints.
   * @returns la section tombée à cet instant, ou null.
   */
  damageSection(s, amount) {
    if (!s || s.down) return null;
    s.hp = Math.max(0, s.hp - amount);
    if (s.hp > 0) return null;
    s.down = true;
    for (const m of this.modulesInSection(s.def.id)) {
      if (!m.active) continue;
      m._sectionDown = true;
      m.setActive(false);
    }
    return s;
  }

  /**
   * Réparation. Une section remonte au-dessus de `SECTION_BACK` (25 %) redevient
   * opérationnelle : exiger 100 % rendrait l'ingénieur inutile en combat, où l'on
   * n'a jamais le temps de finir un chantier.
   * @returns true si la section vient de repasser en service.
   */
  repairSection(s, amount) {
    if (!s || s.hp >= s.maxHp) return false;
    s.hp = Math.min(s.maxHp, s.hp + amount);
    if (!s.down || s.hp < s.maxHp * Ship.SECTION_BACK) return false;
    s.down = false;
    for (const m of this.modulesInSection(s.def.id)) {
      if (!m._sectionDown) continue;
      m._sectionDown = false;
      m.setActive(true);
    }
    return true;
  }

  /** Un module est-il coupé parce que sa section est tombée ? */
  isSectionDown(mod) { return !!mod?._sectionDown; }

  // --- construction ---
  mount(slotId, moduleId, level = 1) {
    const def = this.hull.getSlotDef(slotId);
    if (!def) return null;
    if (!SLOT_ACCEPTS[def.type]?.includes(moduleId)) return null;

    this.unmount(slotId);

    const Cls = MODULE_CLASSES[moduleId];
    const mod = new Cls(moduleId, level);
    mod.group.position.set(def.pos[0], def.pos[1], def.pos[2]);
    this.group.add(mod.group);

    // fx rattachés au vaisseau (essaim, halo, cercle radar…)
    const extras = mod.shipExtras ? mod.shipExtras() : [];
    for (const e of extras) this.fxLayer.add(e);
    this._extras[slotId] = extras;

    // Actif par défaut sauf les intercepteurs (rangés au départ)
    mod.setActive(mod.kind !== 'interceptor');

    this.slots[slotId] = mod;
    return mod;
  }

  unmount(slotId) {
    const mod = this.slots[slotId];
    if (!mod) return;
    mod.dispose();
    this.group.remove(mod.group);
    for (const e of this._extras[slotId] || []) this.fxLayer.remove(e);
    this._extras[slotId] = [];
    this.slots[slotId] = null;
  }

  upgrade(slotId) {
    const mod = this.slots[slotId];
    return mod ? mod.upgrade() : false;
  }

  // --- accès ---
  get modules() { return Object.values(this.slots).filter(Boolean); }

  /** Modules dans l'ordre des slots (pour l'assignation stable des touches). */
  orderedModules() {
    return HULL_CONFIG.slots.map((s) => this.slots[s.id]).filter(Boolean);
  }

  get weaponModules() { return this.modules.filter((m) => m.kind === 'weapon'); }

  /** Nombre total de drones à déployer (baies d'intercepteurs actives). */
  get activeInterceptorCount() {
    return this.modules
      .filter((m) => m.defId === 'interceptor' && m.active)
      .reduce((s, m) => s + m.droneCount, 0);
  }

  getActiveRadar() {
    const radars = this.modules.filter((m) => m.kind === 'radar' && m.active);
    if (!radars.length) return null;
    return radars.reduce((a, b) => (b.range > a.range ? b : a));
  }

  /** Bonus de vitesse verticale apporté par les réacteurs actifs. */
  get thrustBonus() {
    return this.modules
      .filter((m) => m.defId === 'reactor' && m.active)
      .reduce((s, m) => s + m.thrust, 0);
  }

  // --- défense & énergie (combat) ---
  _sumActive(defId, prop) {
    return this.modules
      .filter((m) => m.defId === defId && m.active)
      .reduce((s, m) => s + m[prop], 0);
  }
  get structureMax() { return this.baseStructure + this._sumActive('armor', 'armorHp'); }
  get shieldMax() { return this._sumActive('shield', 'shieldHp'); }
  get energyMax() { return this.baseEnergyCap + this._sumActive('reactor', 'energyCap'); }
  /** Débit BRUT des réacteurs actifs (+ base) : c'est ce que les 3 bus se partagent. */
  get energyRegen() { return TUNE.energyRegen + this._sumActive('reactor', 'power'); }

  resetDefense() {
    this.structure = this.structureMax;
    this.shield = this.shieldMax;
    this.shieldBroken = false;
    this.energy = this.energyMax;
    this._sinceHit = 99;
    this.power.reset(); // on repart toujours en profil équilibré
    this.resetSections();
    for (const m of this.modules) { m._sectionDown = false; if (m.reload) m.reload(); }
  }

  consume(amount) {
    if (this.energy >= amount) { this.energy -= amount; return true; }
    return false;
  }

  /** Bouclier opérationnel : dès qu'il a de la charge (il protège de nouveau). */
  get shieldUp() { return this.shieldMax > 0 && this.shield > 0; }

  /**
   * @param d dégâts
   * @param at point d'impact EN COORDONNÉES MONDE (optionnel). S'il est fourni et
   *   que le bouclier est tombé, la section correspondante encaisse aussi — la
   *   bulle protège donc la coque locale autant que la structure, ce qui garde
   *   cohérent le rôle du bouclier.
   * @returns la section tombée à cet instant, ou null (pour l'annonce au HUD).
   */
  takeDamage(d, at = null) {
    this._sinceHit = 0;
    let r = d;
    if (this.shield > 0) {
      const a = Math.min(this.shield, r);
      this.shield -= a;
      r -= a;
      if (this.shield <= 0) this.shieldBroken = true; // le bouclier se brise
    }
    this.structure = Math.max(0, this.structure - r);
    if (r <= 0 || !at) return null;
    // Le point d'impact est dans le repère du monde : la baleine tourne, il faut
    // le ramener dans son repère avant de chercher la section la plus proche.
    _hit.set(at.x, at.y, at.z ?? 0);
    this.group.worldToLocal(_hit);
    return this.damageSection(this.sectionAt(_hit.x, _hit.y), r);
  }

  isDefeated() { return this.structure <= 0; }

  updateDefense(dt) {
    // Le débit des réacteurs est réparti entre les 3 bus : la réserve d'énergie
    // n'est plus alimentée qu'à hauteur du bus ARMES (le laser puise dedans).
    this.power.update(dt, this);
    this.energy = Math.min(this.energyMax, this.energy + this.power.weaponRate * dt);
    this._sinceHit += dt;
    // Régén du bouclier : alimentée par le bus BOUCLIERS (flux dédié, elle ne
    // ponctionne plus la réserve d'armes). S'il vient de casser, délai plus long
    // avant de repartir ; mais dès qu'il a de la charge, il reprotège.
    const delay = this.shieldBroken ? 5 : 2;
    if (this._sinceHit > delay && this.shield < this.shieldMax) {
      const amt = Math.min(this.power.shieldRate * dt, this.shieldMax - this.shield);
      this.shield += amt;
      if (this.shield > 0) this.shieldBroken = false;
    }
    this.structure = Math.min(this.structure, this.structureMax);
    this.shield = Math.min(this.shield, this.shieldMax);
  }

  get position() { return this.group.position; }

  // --- sauvegarde ---
  serialize() {
    return this.modules.map((m) => {
      const slotId = Object.keys(this.slots).find((id) => this.slots[id] === m);
      return { slotId, moduleId: m.defId, level: m.level };
    });
  }

  loadBuild(build) {
    for (const id of Object.keys(this.slots)) this.unmount(id);
    for (const item of build) this.mount(item.slotId, item.moduleId, item.level);
  }

  static create(build) {
    const ship = new Ship();
    ship.loadBuild(build && build.length ? build : DEFAULT_BUILD);
    return ship;
  }

  // --- boucle ---
  update(dt, ctx) {
    for (const m of this.modules) m.update(dt, ctx);
    // Halo d'armure si une armure est active
    const armored = this.modules.some((m) => m.defId === 'armor' && m.active);
    this.hull.setArmorVisible(armored);
  }
}
