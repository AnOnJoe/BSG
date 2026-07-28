import { POWER_PRESETS } from './PowerBus.js';

/**
 * Anneau de passerelle : menu radial des profils d'énergie.
 *
 * Clic droit MAINTENU → l'anneau s'ouvre là où est le curseur ; on choisit le
 * secteur à l'angle de la souris ; le relâchement applique. Ramener le curseur
 * au centre (zone morte) annule.
 *
 * Le coût de l'ouverture est géré par Range : le temps ralentit et les armes se
 * taisent. On ne micro-gère donc pas en continu, on choisit des moments.
 *
 * Le DOM vit dans `document.body` (et non dans #range-ui) pour survivre aux
 * `Hud.build()` / `Hud.clear()` qui vident leur conteneur.
 */
const RADIUS = 132;    // distance des pastilles au centre (px)
const DEAD_ZONE = 36;  // en dessous de ce rayon : annulation

// Placement : haut = agressif, bas = défensif, droite = vitesse, gauche = neutre.
const SECTORS = [
  { id: 'attack', angle: -Math.PI / 2 },
  { id: 'burn', angle: 0 },
  { id: 'defense', angle: Math.PI / 2 },
  { id: 'balanced', angle: Math.PI },
];

function angleDelta(a, b) {
  let d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
}

export class CommandRing {
  /**
   * @param onSelect  appelé avec l'id du profil choisi
   * @param canOpen   prédicat : l'anneau n'est ouvrable qu'à la console du
   *                  commandant, sinon le ralenti serait un cadeau gratuit
   *                  offert depuis n'importe quel poste.
   */
  constructor(onSelect, canOpen) {
    this.onSelect = onSelect;
    this.canOpen = canOpen;
    this.open = false;
    this.enabled = false;
    this.selected = null;
    this.cx = 0;
    this.cy = 0;

    this.el = document.createElement('div');
    this.el.id = 'command-ring';
    this.el.className = 'hidden';
    document.body.appendChild(this.el);

    // Liseré cyan : signale visuellement que le temps est suspendu
    this.tint = document.createElement('div');
    this.tint.id = 'slowmo-tint';
    document.body.appendChild(this.tint);

    // Une pastille par secteur : nom du profil + répartition arm/bou/mot
    this.items = SECTORS.map((sec) => {
      const preset = POWER_PRESETS.find((p) => p.id === sec.id);
      const el = document.createElement('div');
      el.className = 'cr-item';
      el.style.setProperty('--cr-color', preset.css);
      el.style.left = `${Math.cos(sec.angle) * RADIUS}px`;
      el.style.top = `${Math.sin(sec.angle) * RADIUS}px`;
      el.innerHTML =
        `<div class="cr-name">${preset.name}</div>` +
        `<div class="cr-mix">${Math.round(preset.w * 100)}·${Math.round(preset.s * 100)}·${Math.round(preset.m * 100)}</div>`;
      this.el.appendChild(el);
      return { ...sec, preset, el };
    });

    this.hubEl = document.createElement('div');
    this.hubEl.className = 'cr-hub';
    this.hubEl.textContent = 'ANNULER';
    this.el.appendChild(this.hubEl);

    this._onDown = (e) => {
      if (e.button !== 2 || !this.enabled) return;
      e.preventDefault();
      if (this.canOpen && !this.canOpen()) return;
      this._open(e.clientX, e.clientY);
    };
    this._onMove = (e) => { if (this.open) this._move(e.clientX, e.clientY); };
    this._onUp = (e) => { if (e.button === 2 && this.open) { e.preventDefault(); this._close(true); } };
    this._onContext = (e) => { if (this.enabled) e.preventDefault(); };
  }

  enable(dom) {
    if (this.enabled) return;
    this.enabled = true;
    this.dom = dom;
    dom.addEventListener('mousedown', this._onDown);
    dom.addEventListener('contextmenu', this._onContext);
    window.addEventListener('mousemove', this._onMove);
    window.addEventListener('mouseup', this._onUp);
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    this._close(false);
    this.dom.removeEventListener('mousedown', this._onDown);
    this.dom.removeEventListener('contextmenu', this._onContext);
    window.removeEventListener('mousemove', this._onMove);
    window.removeEventListener('mouseup', this._onUp);
  }

  get isOpen() { return this.open; }

  /** Referme sans rien appliquer (défaite, sortie du champ de tir…). */
  cancel() { this._close(false); }

  _open(x, y) {
    this.open = true;
    this.cx = x;
    this.cy = y;
    this.selected = null;
    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;
    this.el.classList.remove('hidden');
    this.tint.classList.add('on');
    this._paint();
  }

  _move(x, y) {
    const dx = x - this.cx;
    const dy = y - this.cy;
    if (Math.hypot(dx, dy) < DEAD_ZONE) {
      this.selected = null;
    } else {
      const a = Math.atan2(dy, dx);
      let best = null, bd = Infinity;
      for (const it of this.items) {
        const d = angleDelta(a, it.angle);
        if (d < bd) { bd = d; best = it; }
      }
      this.selected = best ? best.id : null;
    }
    this._paint();
  }

  _paint() {
    for (const it of this.items) it.el.classList.toggle('sel', it.id === this.selected);
    this.hubEl.classList.toggle('sel', this.selected === null);
  }

  _close(apply) {
    if (!this.open) return;
    this.open = false;
    this.el.classList.add('hidden');
    this.tint.classList.remove('on');
    const picked = this.selected;
    this.selected = null;
    if (apply && picked) this.onSelect?.(picked);
  }

  dispose() {
    this.disable();
    this.el.remove();
    this.tint.remove();
  }
}
