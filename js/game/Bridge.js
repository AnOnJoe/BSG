import { scenesFor, crewFor } from '../data/scenes.js';

/**
 * PHASE PASSERELLE — les « 33 minutes » avant le contact, vécues dans le CIC.
 *
 * Même contrat que `Hangar` et `Range` : `enter()` / `exit()` / `update(dt)`,
 * branché par `App`. Tout est en DOM (c'est de l'interface, pas du monde 3D) et
 * réutilise la palette de `css/style.css`.
 *
 * Le décompte descend PAR SCÈNE, pas en temps réel : on lit à son rythme. La
 * tension vient de ce que dit l'équipage et du compteur qui tombe, pas d'un
 * chronomètre qui punirait un joueur lent.
 *
 * Contrôles : Espace / clic = suivant · 1..3 = choisir · N = passer à l'action.
 */
export class Bridge {
  constructor(app) {
    this.app = app;
    this.ui = document.getElementById('bridge-ui');
    this.index = 0;
    this.effects = [];
    this._onKey = (e) => this._key(e);
  }

  /**
   * Les scènes du secteur COURANT. Elles sont figées à l'entrée (`enter`) : si
   * on les relisait depuis `range.sector` à chaque accès, un saut survenu entre
   * deux répliques changerait l'arc en cours de lecture.
   */
  get scenes() { return this._scenes; }
  get scene() { return this._scenes[Math.min(this.index, this._scenes.length - 1)]; }

  enter() {
    this.index = 0;
    this.effects = [];
    const sectorId = this.app.range.sector.id;
    this._scenes = scenesFor(sectorId);
    this._crew = crewFor(sectorId);
    this._build();
    this._render();
    window.addEventListener('keydown', this._onKey);
  }

  exit() {
    window.removeEventListener('keydown', this._onKey);
    this.ui.innerHTML = '';
  }

  update() { /* rien d'animé : le décompte avance par scène */ }

  // ---------- construction ----------

  /** Le CIC : deux consoles latérales, l'écran DRADIS central, l'équipage. */
  _build() {
    this.ui.innerHTML = `
      <div id="cic">
        <div class="cic-frame">
          <div class="cic-top">
            <span class="cic-ship">GALACTICA · CIC</span>
            <span class="cic-sector"></span>
          </div>
          <div class="cic-stage">
            <div class="cic-console left">${this._consoleSvg()}</div>
            <div class="cic-center">
              <div class="cic-dradis">
                <div class="dr-sweep"></div>
                <div class="dr-label">AVANT LE PROCHAIN CONTACT</div>
                <div class="dr-time">33:00</div>
                <div class="dr-sub">DRADIS — aucun contact</div>
              </div>
              <!-- SECONDE horloge, et c'est tout le sujet : le calcul tourne
                   pendant le répit mais n'aboutira pas avant qu'ils arrivent. -->
              <div class="cic-calc">
                <div class="cc-head"><span>CALCUL DE SAUT</span><span class="cc-pct">0 %</span></div>
                <div class="cc-track"><div class="cc-fill"></div><div class="cc-mark"></div></div>
                <div class="cc-note"></div>
              </div>
              <div class="cic-crew"></div>
            </div>
            <div class="cic-console right">${this._consoleSvg()}</div>
          </div>
          <div class="cic-dialogue">
            <div class="dlg-who"><span class="dlg-name"></span><span class="dlg-role"></span></div>
            <div class="dlg-text"></div>
            <div class="dlg-choices"></div>
            <div class="dlg-keys">
              <span class="k"><b>Espace</b> continuer</span>
              <span class="k"><b>1-3</b> choisir</span>
              <span class="k skip"><b>N</b> passer à l'action</span>
            </div>
          </div>
        </div>
      </div>`;
    this.el = {
      sector: this.ui.querySelector('.cic-sector'),
      time: this.ui.querySelector('.dr-time'),
      sub: this.ui.querySelector('.dr-sub'),
      crew: this.ui.querySelector('.cic-crew'),
      calcPct: this.ui.querySelector('.cc-pct'),
      calcFill: this.ui.querySelector('.cc-fill'),
      calcNote: this.ui.querySelector('.cc-note'),
      name: this.ui.querySelector('.dlg-name'),
      role: this.ui.querySelector('.dlg-role'),
      text: this.ui.querySelector('.dlg-text'),
      choices: this.ui.querySelector('.dlg-choices'),
    };
    this.ui.querySelector('#cic').addEventListener('click', (e) => {
      if (e.target.closest('.dlg-choice')) return; // les choix ont leur propre clic
      this._next();
    });

    // Les silhouettes de l'équipage : celle qui parle s'allume. On n'affiche que
    // les officiers qui prennent la parole DANS CE SECTEUR — la distribution
    // change donc d'un saut à l'autre, ce qui se voit avant même de lire.
    this.el.crew.innerHTML = this._crew.map((c) =>
      `<div class="crew-member" data-id="${c.id}">
         <div class="cm-body">${this._officerSvg()}</div>
         <div class="cm-name">${c.id}</div>
         <div class="cm-role">${c.role}</div>
       </div>`).join('');
  }

  /** Console de CIC : rangées de voyants et une courbe, en fil de fer. */
  _consoleSvg() {
    const rows = Array.from({ length: 5 }, (_, r) =>
      Array.from({ length: 6 }, (_, c) =>
        `<rect x="${8 + c * 13}" y="${14 + r * 11}" width="9" height="6" rx="1"
               opacity="${0.25 + ((r * 6 + c) % 4) * 0.2}"/>`).join('')).join('');
    return `<svg viewBox="0 0 96 84" preserveAspectRatio="none">
      <path d="M2 6 H94 V78 H2 Z" fill="none" stroke-width="1.2"/>
      <path d="M6 70 L26 58 L44 64 L62 46 L82 52" fill="none" stroke-width="1"/>
      <g class="cs-leds">${rows}</g></svg>`;
  }

  /** Silhouette d'officier, de dos, penchée sur sa console. */
  _officerSvg() {
    return `<svg viewBox="0 0 40 56">
      <circle cx="20" cy="12" r="7" fill="none" stroke-width="1.4"/>
      <path d="M8 54 C8 34 14 24 20 24 C26 24 32 34 32 54" fill="none" stroke-width="1.4"/>
      <path d="M10 38 H30" fill="none" stroke-width="1"/></svg>`;
  }

  // ---------- déroulé ----------

  _render() {
    const s = this.scene;
    const sector = this.app.range.sector;
    this.el.sector.textContent = `${sector.name} · ${sector.subtitle}`;

    const m = Math.floor(s.at);
    this.el.time.textContent = `${String(m).padStart(2, '0')}:00`;
    this.el.time.className = `dr-time${s.at <= 4 ? ' urgent' : ''}`;
    this.el.sub.textContent = s.last ? 'DRADIS — CONTACTS MULTIPLES' : 'DRADIS — aucun contact';
    this.el.sub.className = `dr-sub${s.last ? ' alert' : ''}`;

    // Le calcul avance avec le temps écoulé : 0 % au saut précédent (33:00),
    // `ftlPreCharge` à l'instant du contact. Le joueur VOIT donc que les deux
    // horloges courent en parallèle et que celle du calcul est en retard.
    const pre = sector.ftlPreCharge ?? 70;
    const done = pre * Math.max(0, Math.min(1, (33 - s.at) / 32));
    this.el.calcPct.textContent = `${Math.round(done)} %`;
    this.el.calcFill.style.width = `${done}%`;
    this.el.calcNote.textContent = s.last
      ? `Il manque ${Math.round(100 - pre)} % — il faudra les tenir sous le feu.`
      : `Coordonnées en cours · ${Math.round(pre)} % seront acquis à leur arrivée`;

    this.el.name.textContent = s.speaker;
    this.el.role.textContent = s.role;
    this.el.text.textContent = `« ${s.text} »`;
    for (const el of this.el.crew.querySelectorAll('.crew-member')) {
      el.classList.toggle('speaking', el.dataset.id === s.speaker);
    }

    if (s.choices) {
      this.el.choices.innerHTML = s.choices.map((c, i) =>
        `<div class="dlg-choice" data-i="${i}">
           <span class="ch-key">${i + 1}</span>
           <span class="ch-text">${c.text}</span>
           <span class="ch-note">${c.note || ''}</span>
         </div>`).join('');
      for (const el of this.el.choices.querySelectorAll('.dlg-choice')) {
        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this._choose(+el.dataset.i);
        });
      }
    } else {
      this.el.choices.innerHTML = '';
    }
  }

  _key(e) {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.code === 'KeyN') { e.preventDefault(); this._toAction(); return; }
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); this._next(); return; }
    const digit = /^Digit([1-9])$/.exec(e.code);
    if (digit) { e.preventDefault(); this._choose(+digit[1] - 1); }
  }

  _choose(i) {
    const s = this.scene;
    if (!s.choices || !s.choices[i]) return;
    const c = s.choices[i];
    this.effects.push({ label: `${s.speaker} — ${c.note || c.text}`, effect: c.effect || {} });
    this.app.audio.relay?.();
    this._advance();
  }

  /** Une scène sans choix passe au suivant ; une scène à choix attend le choix. */
  _next() {
    if (this.scene.choices) return;
    this.app.audio.ping?.();
    this._advance();
  }

  _advance() {
    if (this.index >= this._scenes.length - 1) { this._toAction(); return; }
    this.index++;
    this._render();
  }

  /** Bascule vers le combat, en emportant les décisions prises. */
  _toAction() {
    this.app.pendingEffects = this.effects;
    this.app.startCombat();
  }
}
