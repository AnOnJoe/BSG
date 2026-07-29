import { TUNE, TUNE_DEFAULTS, TUNE_SPECS, saveTune, resetTune } from '../core/Tune.js';

/**
 * Panneau de réglages in-game (touche T) : une jauge par valeur d'équilibrage.
 * Les modifications s'appliquent en direct et sont persistées (localStorage).
 *
 * ⚠ IL Y A 69 RÉGLAGES. Une liste à plat de 69 jauges n'est pas « complète », elle
 * est inutilisable — donc on ne règle rien, et le panneau ne sert plus à sa raison
 * d'être. Trois choses le rendent praticable :
 *  - des GROUPES repliables, dans l'ordre où l'on doute (fuite, flotte, dénouement
 *    en tête : ce sont les mécaniques les plus jeunes, donc les moins calibrées) ;
 *  - un FILTRE au clavier, parce que chercher « relevé » dans dix groupes repliés
 *    est plus lent que taper trois lettres ;
 *  - le marquage des valeurs MODIFIÉES, avec le défaut rappelé et un clic pour y
 *    revenir. Sans ça, après vingt minutes de réglages, on ne sait plus ce qu'on a
 *    touché ni d'où l'on part — et un mauvais réglage oublié se prend pour un bug.
 */
export class TunePanel {
  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'tune-panel';
    this.el.className = 'hidden';
    document.body.appendChild(this.el);
    this.rows = [];
    this.groups = new Map();
    this._build();
  }

  _build() {
    this.el.innerHTML = `
      <div class="tp-title">RÉGLAGES <span class="tp-count"></span>
        <span class="tp-hint">T pour fermer</span></div>
      <input class="tp-filter" type="text" placeholder="filtrer (ex. relevé, coque, ennemi)" />
      <div class="tp-groups"></div>
      <div class="tp-actions"></div>
      <textarea class="tp-json" readonly></textarea>`;

    this.countEl = this.el.querySelector('.tp-count');
    this.filterEl = this.el.querySelector('.tp-filter');
    const host = this.el.querySelector('.tp-groups');

    // Regroupement en conservant l'ordre de déclaration des specs
    const order = [];
    const byGroup = new Map();
    for (const spec of TUNE_SPECS) {
      const g = spec[5] || 'Divers';
      if (!byGroup.has(g)) { byGroup.set(g, []); order.push(g); }
      byGroup.get(g).push(spec);
    }

    for (const name of order) {
      const box = document.createElement('div');
      box.className = 'tp-group';
      // Les trois premiers groupes ouverts : c'est là qu'on doute le plus.
      const open = order.indexOf(name) < 3;
      box.innerHTML = `<div class="tp-ghead${open ? ' open' : ''}">
          <span class="tp-gcaret">▾</span><span class="tp-gname">${name}</span>
          <span class="tp-gtouched"></span>
          <span class="tp-gn">${byGroup.get(name).length}</span>
        </div><div class="tp-gbody${open ? '' : ' collapsed'}"></div>`;
      const head = box.querySelector('.tp-ghead');
      const body = box.querySelector('.tp-gbody');
      head.addEventListener('click', () => {
        head.classList.toggle('open');
        body.classList.toggle('collapsed');
      });

      for (const [key, label, min, max, step, , help] of byGroup.get(name)) {
        const row = document.createElement('div');
        row.className = 'tp-row';
        // L'aide est TOUJOURS visible, pas en infobulle : cachée, elle n'aide pas.
        row.innerHTML =
          `<div class="tp-lab">` +
          `<label title="${key}">${label}</label>` +
          `<div class="tp-help">${help || ''}</div>` +
          `</div>` +
          `<div class="tp-ctl">` +
          `<input type="range" min="${min}" max="${max}" step="${step}">` +
          `<span class="tp-val"></span>` +
          `<button class="tp-undo" title="revenir au défaut">↺</button>` +
          `</div>`;
        const input = row.querySelector('input');
        const val = row.querySelector('.tp-val');
        const undo = row.querySelector('.tp-undo');
        const entry = { key, label, help: help || '', row, input, val, undo, group: name, body, head };

        input.addEventListener('input', () => {
          TUNE[key] = parseFloat(input.value);
          saveTune();
          this._syncRow(entry);
          this._afterChange();
        });
        undo.addEventListener('click', (e) => {
          e.stopPropagation();
          TUNE[key] = TUNE_DEFAULTS[key];
          saveTune();
          this._syncRow(entry);
          this._afterChange();
        });

        body.appendChild(row);
        this.rows.push(entry);
        this._syncRow(entry);
      }
      this.groups.set(name, { box, head, body });
      host.appendChild(box);
    }

    const actions = this.el.querySelector('.tp-actions');
    const mk = (txt, fn, cls = 'btn-ghost') => {
      const b = document.createElement('button');
      b.className = cls;
      b.textContent = txt;
      b.addEventListener('click', () => fn(b));
      actions.appendChild(b);
      return b;
    };
    mk('Copier JSON', (b) => this._copy(b));
    mk('Tout replier', () => this._collapseAll(true));
    mk('Tout déplier', () => this._collapseAll(false));
    mk('Réinitialiser', () => { resetTune(); this.refresh(); });

    this.out = this.el.querySelector('.tp-json');
    this.filterEl.addEventListener('input', () => this._applyFilter());
    // Le panneau capte ses propres touches : sinon taper « v » dans le filtre
    // basculerait la vue plein écran et « t » fermerait le panneau. Les handlers
    // globaux ignorent déjà INPUT/TEXTAREA, on empêche juste la propagation.
    this.filterEl.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') { this.filterEl.value = ''; this._applyFilter(); }
      e.stopPropagation();
    });
    this._afterChange();
  }

  /** Une ligne : valeur affichée, état « modifié », défaut rappelé. */
  _syncRow(r) {
    const v = TUNE[r.key];
    const d = TUNE_DEFAULTS[r.key];
    r.input.value = v;
    // Arrondi d'affichage : sans lui, 0.30000000000000004 s'affiche tel quel.
    r.val.textContent = Math.abs(v) >= 100 ? Math.round(v) : +v.toFixed(3);
    const touched = Math.abs(v - d) > 1e-9;
    r.row.classList.toggle('touched', touched);
    r.undo.style.visibility = touched ? 'visible' : 'hidden';
    r.undo.title = `défaut : ${d}`;
  }

  /** Compteur global + pastille « n modifié(s) » par groupe. */
  _afterChange() {
    let n = 0;
    const perGroup = new Map();
    for (const r of this.rows) {
      const t = Math.abs(TUNE[r.key] - TUNE_DEFAULTS[r.key]) > 1e-9;
      if (t) { n++; perGroup.set(r.group, (perGroup.get(r.group) || 0) + 1); }
    }
    this.countEl.textContent = n ? `· ${n} modifié${n > 1 ? 's' : ''}` : `· ${this.rows.length} réglages`;
    this.countEl.classList.toggle('on', n > 0);
    for (const [name, g] of this.groups) {
      const c = perGroup.get(name) || 0;
      const badge = g.head.querySelector('.tp-gtouched');
      badge.textContent = c ? `${c} ●` : '';
    }
    this._updateJson();
  }

  /**
   * Filtre sur le libellé, la clé, le groupe ET le texte d'aide — c'est ce qui
   * permet de retrouver un réglage dont on ne connaît pas le nom, en tapant l'effet
   * qu'on cherche (« traînard », « rafale », « pont hangar »). Un groupe sans résultat est masqué ; un groupe avec des
   * résultats est déplié d'office, sinon on chercherait à l'aveugle.
   */
  _applyFilter() {
    const q = this.filterEl.value.trim().toLowerCase();
    const norm = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const nq = norm(q);
    const hits = new Map();
    for (const r of this.rows) {
      const hit = !nq || norm(r.label).includes(nq) || norm(r.key).includes(nq)
        || norm(r.group).includes(nq) || norm(r.help).includes(nq);
      r.row.classList.toggle('hidden', !hit);
      if (hit) hits.set(r.group, (hits.get(r.group) || 0) + 1);
    }
    for (const [name, g] of this.groups) {
      const n = hits.get(name) || 0;
      g.box.classList.toggle('hidden', n === 0);
      if (nq) {
        g.head.classList.add('open');
        g.body.classList.remove('collapsed');
      }
    }
  }

  _collapseAll(collapsed) {
    for (const g of this.groups.values()) {
      g.head.classList.toggle('open', !collapsed);
      g.body.classList.toggle('collapsed', collapsed);
    }
  }

  refresh() {
    for (const r of this.rows) this._syncRow(r);
    this._afterChange();
  }

  /** On n'exporte QUE ce qui a bougé : un JSON de 69 lignes ne se relit pas. */
  _updateJson() {
    const diff = {};
    for (const k of Object.keys(TUNE)) {
      if (Math.abs(TUNE[k] - TUNE_DEFAULTS[k]) > 1e-9) diff[k] = TUNE[k];
    }
    this.out.value = Object.keys(diff).length
      ? JSON.stringify(diff, null, 2)
      : '// aucun réglage modifié';
  }

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
    if (!this.el.classList.contains('hidden')) {
      this.refresh();
      this.filterEl.focus();
      this.filterEl.select();
    }
  }
}
