import { TUNE, TUNE_SPECS, saveTune, resetTune } from '../core/Tune.js';

/**
 * Panneau de réglages in-game (touche T) : une jauge par valeur d'équilibrage.
 * Les modifications s'appliquent en direct et sont persistées en JSON
 * (localStorage). Bouton « Copier JSON » pour figer ensuite les chiffres.
 */
export class TunePanel {
  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'tune-panel';
    this.el.className = 'hidden';
    document.body.appendChild(this.el);
    this.rows = [];
    this._build();
  }

  _build() {
    this.el.innerHTML = '<div class="tp-title">RÉGLAGES <span class="tp-hint">T pour fermer</span></div>';
    for (const [key, label, min, max, step] of TUNE_SPECS) {
      const row = document.createElement('div');
      row.className = 'tp-row';
      row.innerHTML =
        `<label>${label}</label>` +
        `<div class="tp-ctl"><input type="range" min="${min}" max="${max}" step="${step}"><span class="tp-val"></span></div>`;
      const input = row.querySelector('input');
      const val = row.querySelector('.tp-val');
      input.value = TUNE[key];
      val.textContent = TUNE[key];
      input.addEventListener('input', () => {
        TUNE[key] = parseFloat(input.value);
        val.textContent = TUNE[key];
        saveTune();
        this._updateJson();
      });
      this.el.appendChild(row);
      this.rows.push({ key, input, val });
    }

    const actions = document.createElement('div');
    actions.className = 'tp-actions';
    const copy = document.createElement('button');
    copy.className = 'btn-ghost';
    copy.textContent = 'Copier JSON';
    copy.addEventListener('click', () => this._copy(copy));
    const reset = document.createElement('button');
    reset.className = 'btn-ghost';
    reset.textContent = 'Réinitialiser';
    reset.addEventListener('click', () => { resetTune(); this.refresh(); });
    actions.append(copy, reset);
    this.el.appendChild(actions);

    this.out = document.createElement('textarea');
    this.out.className = 'tp-json';
    this.out.readOnly = true;
    this.el.appendChild(this.out);
    this._updateJson();
  }

  refresh() {
    for (const r of this.rows) { r.input.value = TUNE[r.key]; r.val.textContent = TUNE[r.key]; }
    this._updateJson();
  }

  _updateJson() { this.out.value = JSON.stringify(TUNE, null, 2); }

  _copy(btn) {
    this._updateJson();
    this.out.select();
    try { navigator.clipboard.writeText(this.out.value); } catch (e) { /* ignore */ }
    const prev = btn.textContent;
    btn.textContent = 'Copié ✓';
    setTimeout(() => { btn.textContent = prev; }, 1200);
  }

  toggle() {
    this.el.classList.toggle('hidden');
    if (!this.el.classList.contains('hidden')) this.refresh();
  }
}
