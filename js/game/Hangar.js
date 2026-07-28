import * as THREE from 'three';
import { SLOT_ACCEPTS, MODULE_CONFIG, MODULE_COST, upgradeCost } from '../data/moduleConfig.js';
import { HULL_CONFIG } from '../data/hullConfig.js';
import { viewport } from '../core/Viewport.js';

/**
 * Hangar : construction / amélioration du vaisseau. On clique un slot (marqueur
 * 3D sur la coque OU rangée du panneau) pour ouvrir le menu des modules
 * compatibles, monter/retirer, ou améliorer (Nv 1→2→3).
 */
export class Hangar {
  constructor(app) {
    this.app = app;
    this.scene = app.scene;
    this.camera = app.camera;
    this.ship = app.ship;
    this.canvas = app.canvas;
    this.container = document.getElementById('hangar-ui');

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.menu = null;

    this._onClick = (e) => this._pick(e);
    this._onMove = (e) => this._hover(e);
  }

  enter() {
    this.ship.hull.setSlotsVisible(true);
    this._refreshMarkers();
    this._buildPanel();
    this.canvas.addEventListener('click', this._onClick);
    this.canvas.addEventListener('mousemove', this._onMove);
    this.app.requestRender();
  }

  exit() {
    this.ship.hull.setSlotsVisible(false);
    this._closeMenu();
    this.container.innerHTML = '';
    this.canvas.removeEventListener('click', this._onClick);
    this.canvas.removeEventListener('mousemove', this._onMove);
    this.app.save();
  }

  // ---------- panneau ----------
  _buildPanel() {
    this.container.innerHTML = '';
    const panel = document.createElement('div');
    panel.id = 'slot-panel';
    panel.innerHTML = `<h2>Emplacements</h2><div class="credits-line">◈ ${Math.floor(this.app.credits)} crédits</div>`;

    for (const slot of HULL_CONFIG.slots) {
      const mod = this.ship.slots[slot.id];
      const row = document.createElement('div');
      row.className = 'slot-row';
      row.dataset.slot = slot.id;
      const label = mod
        ? `${mod.def.name} <span class="lv">Nv ${mod.level}</span>`
        : '— vide —';
      row.innerHTML =
        `<div class="slot-name">${slot.name} · ${slot.type}</div>` +
        `<div class="slot-module ${mod ? '' : 'empty'}">${label}</div>` +
        `<div class="slot-actions"></div>`;
      const actions = row.querySelector('.slot-actions');

      const btnEquip = document.createElement('button');
      btnEquip.textContent = mod ? 'Changer' : 'Équiper';
      btnEquip.addEventListener('click', (e) => {
        const r = row.getBoundingClientRect();
        this._openEquipMenu(slot.id, r.right + 8, r.top);
      });
      actions.appendChild(btnEquip);

      if (mod) {
        const upCost = upgradeCost(mod.level);
        const btnUp = document.createElement('button');
        btnUp.textContent = mod.canUpgrade() ? `Améliorer → Nv ${mod.level + 1} (◈${upCost})` : 'Niveau max';
        btnUp.disabled = !mod.canUpgrade() || this.app.credits < upCost;
        btnUp.addEventListener('click', () => this._upgrade(slot.id));
        actions.appendChild(btnUp);

        const refund = Math.floor((MODULE_COST[mod.defId] || 0) * 0.5);
        const btnRm = document.createElement('button');
        btnRm.textContent = `Retirer (+◈${refund})`;
        btnRm.addEventListener('click', () => this._unmount(slot.id));
        actions.appendChild(btnRm);
      }

      panel.appendChild(row);
    }
    this.container.appendChild(panel);

    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = 'Clique un emplacement sur la baleine ou dans la liste · puis “COMBAT →” pour tester';
    this.container.appendChild(hint);
  }

  // ---------- menu d'équipement ----------
  _openEquipMenu(slotId, x, y) {
    this._closeMenu();
    const slot = this.ship.hull.getSlotDef(slotId);
    const current = this.ship.slots[slotId];
    const menu = document.createElement('div');
    menu.className = 'equip-menu';

    const title = document.createElement('div');
    title.className = 'menu-title';
    title.textContent = `${slot.name} — ${slot.type}`;
    menu.appendChild(title);

    for (const moduleId of SLOT_ACCEPTS[slot.type]) {
      const def = MODULE_CONFIG[moduleId];
      const cost = MODULE_COST[moduleId] || 0;
      const b = document.createElement('button');
      const isCur = current && current.defId === moduleId;
      b.textContent = `${isCur ? '● ' : ''}${def.name} (◈${cost})`;
      b.disabled = this.app.credits < cost;
      b.addEventListener('click', () => this._mount(slotId, moduleId, cost));
      menu.appendChild(b);
    }

    if (current) {
      const rm = document.createElement('button');
      rm.textContent = '✕ Retirer le module';
      rm.addEventListener('click', () => this._unmount(slotId));
      menu.appendChild(rm);
    }

    // position + clamp
    menu.style.left = Math.min(x, window.innerWidth - 200) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - 220) + 'px';
    document.body.appendChild(menu);
    this.menu = menu;

    setTimeout(() => {
      this._outside = (e) => { if (!menu.contains(e.target)) this._closeMenu(); };
      window.addEventListener('mousedown', this._outside);
    }, 0);
  }

  _closeMenu() {
    if (this.menu) { this.menu.remove(); this.menu = null; }
    if (this._outside) { window.removeEventListener('mousedown', this._outside); this._outside = null; }
  }

  // ---------- actions ----------
  _mount(slotId, moduleId, cost) {
    if (!this.app.spend(cost)) return; // crédits insuffisants
    this.ship.mount(slotId, moduleId, 1);
    this._afterChange();
  }
  _unmount(slotId) {
    const mod = this.ship.slots[slotId];
    if (mod) this.app.addCredits(Math.floor((MODULE_COST[mod.defId] || 0) * 0.5)); // remboursement 50%
    this.ship.unmount(slotId);
    this._afterChange();
  }
  _upgrade(slotId) {
    const mod = this.ship.slots[slotId];
    if (!mod || !mod.canUpgrade()) return;
    if (!this.app.spend(upgradeCost(mod.level))) return;
    this.ship.upgrade(slotId);
    this._afterChange();
  }
  _afterChange() {
    this._closeMenu();
    this._refreshMarkers();
    this._buildPanel();
    this.app.save();
    this.app.requestRender();
  }

  _refreshMarkers() {
    for (const slot of HULL_CONFIG.slots) {
      this.ship.hull.setSlotState(slot.id, this.ship.slots[slot.id] ? 'filled' : 'empty');
    }
  }

  // ---------- picking 3D ----------
  _setMouse(e) {
    this.mouse.x = viewport.ndcX(e.clientX);
    this.mouse.y = viewport.ndcY(e.clientY);
  }

  _pick(e) {
    if (this.menu) return; // laisse le handler "outside" gérer la fermeture
    this._setMouse(e);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.ship.hull.pickables, false);
    if (hits.length) {
      const slotId = hits[0].object.userData.slotId;
      this._openEquipMenu(slotId, e.clientX + 6, e.clientY + 6);
    }
  }

  _hover(e) {
    this._setMouse(e);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.ship.hull.pickables, false);
    const hoverId = hits.length ? hits[0].object.userData.slotId : null;
    if (hoverId === this._lastHover) return; // rien n'a changé → pas de re-rendu
    this._lastHover = hoverId;
    for (const slot of HULL_CONFIG.slots) {
      if (slot.id === hoverId) this.ship.hull.setSlotState(slot.id, 'hover');
      else this.ship.hull.setSlotState(slot.id, this.ship.slots[slot.id] ? 'filled' : 'empty');
    }
    this.canvas.style.cursor = hoverId ? 'pointer' : 'crosshair';
    this.app.requestRender();
  }
}
