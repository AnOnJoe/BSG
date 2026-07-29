import * as THREE from 'three';
import { SLOT_ACCEPTS, MODULE_CONFIG, MODULE_COST, upgradeCost } from '../data/moduleConfig.js';
import { HULL_CONFIG } from '../data/hullConfig.js';
import { SLOT_FITOUT } from '../data/progression.js';
import { viewport } from '../core/Viewport.js';

/** Type de slot en français : « weapon » n'a rien à faire à l'écran. */
const SLOT_TYPE = { weapon: 'ARME', engine: 'PROPULSION', utility: 'UTILITAIRE' };

/**
 * PONT HANGAR — aménager la coque, monter et améliorer les modules.
 *
 * ⚠ REFONDU après une partie test : « je trouve que le hangar fait décalé au niveau
 * design ». Il l'était, et pour des raisons précises — il ne partageait RIEN du
 * vocabulaire visuel construit ailleurs :
 *  - une colonne de douze grosses cartes qui débordait de l'écran par le bas ;
 *  - des boutons de navigateur, là où tout le reste du jeu parle en pastilles et en
 *    consignes (`.ord-btn`, `.sig-chip`, `.sec-cell`) ;
 *  - les types d'emplacement en anglais minuscule (« weapon », « engine ») ;
 *  - aucun lien entre la baleine au centre et la liste à gauche.
 *
 * Il est maintenant organisé par SECTION DE COQUE — les mêmes que le poste
 * d'ingénieur (PROUE / CŒUR / POUPE / PROPULSION). Ce n'est pas cosmétique : on
 * répare et on équipe la même géographie, et savoir qu'une arme est en proue veut
 * enfin dire quelque chose.
 *
 * Il porte aussi l'économie : MATÉRIEL (le stock de pièces) et CHANTIERS (la
 * capacité de l'équipe pendant cette escale). Cf. `data/progression.js`.
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
    this.equipMenu = null;   // menu d'équipement (DOM) — à ne pas confondre avec App.menu
    this.selected = null;    // emplacement mis en avant

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

  /** Sections dans l'ordre du plan de coque, avec leurs emplacements. */
  _bySection() {
    return (HULL_CONFIG.sections || []).map((sec) => ({
      sec,
      slots: HULL_CONFIG.slots.filter((s) => s.section === sec.id),
    })).filter((g) => g.slots.length);
  }

  _buildPanel() {
    const app = this.app;
    const works = app.works;
    this.container.innerHTML = `
      <div id="deck">
        <div class="dk-top">
          <span class="dk-title">PONT HANGAR</span>
          <span class="dk-res">
            <span class="dk-mat" title="Pièces récupérées sur les épaves et les Cylons abattus">
              ⛭ <b>${Math.floor(app.salvage)}</b> matériel</span>
            <span class="dk-works ${works > 0 ? '' : 'none'}"
                  title="Travaux que l'équipe de pont peut mener pendant cette escale">
              ⚒ <b>${works}</b> chantier${works > 1 ? 's' : ''}</span>
          </span>
        </div>
        ${works > 0 ? '' : '<div class="dk-alert">⚒ PLUS DE CHANTIER CE SAUT-CI — '
          + 'l\'équipe de pont a fait ce qu\'elle pouvait. Le matériel reste en soute, on montera '
          + 'au prochain saut. Aménager un emplacement, en revanche, reste possible.</div>'}
        <div class="dk-sections">${this._bySection().map((g) => this._sectionHtml(g)).join('')}</div>
        <div class="dk-hint"></div>
      </div>`;

    this.container.querySelector('.dk-hint').textContent = works > 0
      ? (this.app.hangarReturn === 'bridge'
        ? 'Escale entre deux sauts · clique un emplacement, sur la baleine ou ici'
        : 'Clique un emplacement, sur la baleine ou ici · « ← MENU » pour revenir')
      : 'Plus de chantier disponible — l\'équipe de pont a fait ce qu\'elle pouvait ce saut-ci.';

    for (const cell of this.container.querySelectorAll('.dk-slot')) {
      cell.addEventListener('click', () => {
        const r = cell.getBoundingClientRect();
        this._openEquipMenu(cell.dataset.slot, r.right + 8, r.top);
      });
    }
  }

  _sectionHtml(g) {
    const down = this.ship.sections?.[g.sec.id]?.down;
    return `<div class="dk-sec">
      <div class="dk-sec-head${down ? ' down' : ''}">${g.sec.name}${down ? ' · PERCÉE' : ''}</div>
      <div class="dk-sec-body">${g.slots.map((s) => this._slotHtml(s)).join('')}</div>
    </div>`;
  }

  _slotHtml(slot) {
    const app = this.app;
    const mod = this.ship.slots[slot.id];
    const fitted = app.isFitted(slot.id);
    const cost = SLOT_FITOUT[slot.type] ?? 200;
    if (!fitted) {
      // Emplacement NON AMÉNAGÉ : une coque nue. On dit ce qu'il coûterait, sinon
      // c'est un carré grisé sans explication.
      // ⚠ Aménager ne consomme PAS de chantier. Signalé en jeu : « j'ai aménagé un
      // emplacement arme sans rien mettre puis un utilitaire et je ne peux rien
      // sélectionner » — un chantier par aménagement mangeait toute l'escale, et on
      // repartait avec des emplacements aménagés mais VIDES. Le chantier est ce que
      // l'équipe FABRIQUE ; tirer des câbles se paie en matériel.
      const can = app.salvage >= cost;
      return `<div class="dk-slot bare${can ? ' can' : ''}" data-slot="${slot.id}">
        <div class="dk-name">${slot.name}</div>
        <div class="dk-sub">${SLOT_TYPE[slot.type] || slot.type} · non aménagé</div>
        <div class="dk-cost">⛭ ${cost}</div>
      </div>`;
    }
    if (!mod) {
      return `<div class="dk-slot empty" data-slot="${slot.id}">
        <div class="dk-name">${slot.name}</div>
        <div class="dk-sub">${SLOT_TYPE[slot.type] || slot.type} · libre</div>
        <div class="dk-cost">équiper</div>
      </div>`;
    }
    const hs = this.ship.isSectionDown(mod);
    return `<div class="dk-slot filled${hs ? ' hs' : ''}" data-slot="${slot.id}">
      <div class="dk-name">${mod.def.name}</div>
      <div class="dk-sub">${slot.name} · ${hs ? 'HORS SERVICE' : `Nv ${mod.level}`}</div>
      <div class="dk-lv">${'▮'.repeat(mod.level)}${'▯'.repeat(mod.maxLevel - mod.level)}</div>
    </div>`;
  }

  // ---------- menu d'équipement ----------

  /** Une ligne de menu : libellé, coût, et la raison si c'est refusé. */
  _menuRow(label, cost, works, why, fn) {
    const b = document.createElement('button');
    b.className = 'dk-act';
    b.innerHTML = `<span class="da-lab">${label}</span>` +
      (cost !== null ? `<span class="da-cost">⛭ ${cost}${works ? ' · ⚒ 1' : ''}</span>` : '');
    if (why) {
      b.disabled = true;
      b.classList.add('nope');
      b.title = why;
      b.innerHTML += `<span class="da-why">${why}</span>`;
    } else {
      b.addEventListener('click', fn);
    }
    return b;
  }

  _openEquipMenu(slotId, x, y) {
    this._closeMenu();
    const app = this.app;
    const slot = this.ship.hull.getSlotDef(slotId);
    const current = this.ship.slots[slotId];
    const menu = document.createElement('div');
    menu.className = 'equip-menu';
    this.selected = slotId;

    const title = document.createElement('div');
    title.className = 'menu-title';
    title.textContent = `${slot.name} — ${SLOT_TYPE[slot.type] || slot.type}`;
    menu.appendChild(title);

    if (!app.isFitted(slotId)) {
      // AMÉNAGER d'abord : on ne monte rien sur une coque nue.
      const cost = SLOT_FITOUT[slot.type] ?? 200;
      const why = app.salvage < cost ? 'matériel insuffisant' : null;
      const note = document.createElement('div');
      note.className = 'menu-note';
      note.textContent = 'Coque nue : tirer les câbles et renforcer le bâti. Coûte du matériel, '
        + 'pas un chantier — l\'équipe de pont garde sa capacité pour ce qu\'elle fabrique.';
      menu.appendChild(note);
      menu.appendChild(this._menuRow('Aménager l\'emplacement', cost, false, why,
        () => this._fitOut(slotId, cost)));
    } else {
      for (const moduleId of SLOT_ACCEPTS[slot.type]) {
        const def = MODULE_CONFIG[moduleId];
        const cost = MODULE_COST[moduleId] || 0;
        const isCur = current && current.defId === moduleId;
        if (!app.knowsPlan(moduleId)) {
          // PLAN INCONNU : on ne l'achète pas, on le trouve. Le montrer quand même,
          // grisé, pour qu'on sache ce qui existe et qu'on ait quelque chose à espérer.
          const row = this._menuRow(`${def.name}`, null, false, 'plan non récupéré', null);
          menu.appendChild(row);
          continue;
        }
        const why = isCur ? 'déjà monté'
          : app.works <= 0 ? 'plus de chantier ce saut-ci'
            : app.salvage < cost ? 'matériel insuffisant' : null;
        menu.appendChild(this._menuRow(`${isCur ? '● ' : ''}${def.name}`, cost, true, why,
          () => this._mount(slotId, moduleId, cost)));
      }

      if (current) {
        if (current.canUpgrade()) {
          const up = upgradeCost(current.level);
          const why = app.works <= 0 ? 'plus de chantier ce saut-ci'
            : app.salvage < up ? 'matériel insuffisant' : null;
          menu.appendChild(this._menuRow(`Améliorer → Nv ${current.level + 1}`, up, true, why,
            () => this._upgrade(slotId)));
        }
        // Démonter ne consomme PAS de chantier : on dévisse, on ne fabrique rien.
        const refund = Math.floor((MODULE_COST[current.defId] || 0) * 0.5);
        const rm = document.createElement('button');
        rm.className = 'dk-act back';
        rm.innerHTML = `<span class="da-lab">✕ Démonter</span><span class="da-cost">+⛭ ${refund}</span>`;
        rm.addEventListener('click', () => this._unmount(slotId));
        menu.appendChild(rm);
      }
    }

    menu.style.left = Math.min(x, window.innerWidth - 240) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - 260) + 'px';
    document.body.appendChild(menu);
    this.equipMenu = menu;
    this._refreshMarkers();

    setTimeout(() => {
      this._outside = (e) => { if (!menu.contains(e.target)) this._closeMenu(); };
      window.addEventListener('mousedown', this._outside);
    }, 0);
  }

  _closeMenu() {
    if (this.equipMenu) { this.equipMenu.remove(); this.equipMenu = null; }
    if (this._outside) { window.removeEventListener('mousedown', this._outside); this._outside = null; }
    this.selected = null;
  }

  // ---------- actions ----------

  /** Chaque travail coûte du matériel ET un chantier : c'est le second qui décide. */
  _pay(cost) {
    if (this.app.works <= 0 || this.app.salvage < cost) return false;
    if (!this.app.spend(cost)) return false;
    this.app.useWork();
    return true;
  }

  /** Aménager : du matériel, aucun chantier (voir `_slotHtml`). */
  _fitOut(slotId, cost) {
    if (!this.app.spend(cost)) return;
    this.app.fitOut(slotId);
    this._afterChange();
  }
  _mount(slotId, moduleId, cost) {
    if (!this._pay(cost)) return;
    this.ship.mount(slotId, moduleId, 1);
    this._afterChange();
  }
  _unmount(slotId) {
    const mod = this.ship.slots[slotId];
    if (mod) this.app.addSalvage(Math.floor((MODULE_COST[mod.defId] || 0) * 0.5)); // on récupère la moitié
    this.ship.unmount(slotId);
    this._afterChange();
  }
  _upgrade(slotId) {
    const mod = this.ship.slots[slotId];
    if (!mod || !mod.canUpgrade()) return;
    if (!this._pay(upgradeCost(mod.level))) return;
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

  /**
   * Marqueurs 3D sur la coque. Un emplacement NON AMÉNAGÉ doit se distinguer d'un
   * emplacement libre : sinon on clique dessus en croyant pouvoir équiper.
   */
  _refreshMarkers() {
    for (const slot of HULL_CONFIG.slots) {
      const state = this.selected === slot.id ? 'hover'
        : !this.app.isFitted(slot.id) ? 'locked'
          : this.ship.slots[slot.id] ? 'filled' : 'empty';
      this.ship.hull.setSlotState(slot.id, state);
    }
  }

  // ---------- picking 3D ----------
  _setMouse(e) {
    this.mouse.x = viewport.ndcX(e.clientX);
    this.mouse.y = viewport.ndcY(e.clientY);
  }

  _pick(e) {
    if (this.equipMenu) return; // laisse le handler "outside" gérer la fermeture
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
    this.selected = hoverId || null;
    this._refreshMarkers();
    this.canvas.style.cursor = hoverId ? 'pointer' : 'crosshair';
    this.app.requestRender();
  }
}
