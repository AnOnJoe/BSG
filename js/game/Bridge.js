import { scenesFor, crewFor, sceneNeeds } from '../data/scenes.js';
import { FLEET_ROLES } from '../data/convoyConfig.js';

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

  /** Nouvelle traversée : l'arc du prochain CIC doit repartir du début. */
  reset() { this._lastSector = null; this.index = 0; this.effects = []; }

  enter() {
    const sectorId = this.app.range.sector.id;
    const loop = this.app.range.loopCount || 0;
    // La clé inclut le tour de boucle : chaque passage refusé à la Porte doit
    // rejouer l'arc du refus, pas reprendre là où l'on s'était arrêté.
    const key = `${sectorId}#${loop}`;
    // ⚠ Une ESCALE au pont hangar repasse par `exit()`/`enter()`. Sans ce test, y
    // descendre puis remonter rejouait l'arc depuis la première réplique et
    // ANNULAIT les choix déjà faits — on pouvait même les repayer en boucle.
    // On ne repart de zéro que si l'on entre dans un NOUVEAU secteur.
    if (key !== this._lastSector) {
      this.index = 0;
      this.effects = [];
      this._lastSector = key;
    }
    // ⚠ On ÉCARTE les scènes qui parlent d'un transport détruit. Sans ce filtre, le
    // CIC proposait « +180 de coque au Navire-hôpital » alors qu'il n'en restait
    // qu'une épave : coût réel, bénéfice nul, et un dialogue absurde.
    const dead = new Set(this.app.range.convoy.transports
      .filter((t) => !t.alive).map((t) => t.def.id));
    const all = scenesFor(sectorId, loop);
    this._scenes = dead.size
      ? all.filter((sc) => ![...sceneNeeds(sc)].some((id) => dead.has(id)))
      : all;
    // Garde-fou : on ne vide jamais l'arc (il faut au moins l'ouverture et le contact).
    if (this._scenes.length < 2) this._scenes = [all[0], all[all.length - 1]];
    this.index = Math.min(this.index, this._scenes.length - 1);
    this._crew = crewFor(sectorId, loop);
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
          <!-- ÉTAT DE LA FLOTTE : c'est l'économie de la partie, elle doit être
               sous les yeux au moment où l'on prend les décisions. -->
          <div class="cic-fleet"></div>
          <div class="cic-notice"></div>
          <div class="cic-dialogue">
            <div class="dlg-who"><span class="dlg-name"></span><span class="dlg-role"></span></div>
            <div class="dlg-text"></div>
            <div class="dlg-choices"></div>
            <div class="dlg-keys">
              <span class="k"><b>Espace</b> continuer</span>
              <span class="k"><b>1-3</b> choisir</span>
              <span class="k"><b>H</b> pont hangar</span>
              <span class="k skip"><b>N</b> <span class="skip-lab">passer les dialogues</span></span>
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
      fleet: this.ui.querySelector('.cic-fleet'),
      notice: this.ui.querySelector('.cic-notice'),
      skipLab: this.ui.querySelector('.skip-lab'),
      name: this.ui.querySelector('.dlg-name'),
      role: this.ui.querySelector('.dlg-role'),
      text: this.ui.querySelector('.dlg-text'),
      choices: this.ui.querySelector('.dlg-choices'),
    };
    this._renderFleet();
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

  /**
   * Les six coques et leur fonction, barrées quand elles sont perdues. C'est
   * l'inventaire de ce qui reste, donc de ce qu'on peut encore faire — le pont
   * hangar est fermé sans le cargo, le calcul n'est plus forçable sans la citerne.
   * On lit `transports` en direct plutôt que `FLEET` : un transport peut avoir été
   * abandonné à un saut précédent.
   */
  _renderFleet() {
    const convoy = this.app.range.convoy;
    const list = convoy.transports.length ? convoy.transports : null;
    if (!list) { this.el.fleet.innerHTML = ''; return; }
    const cells = list.map((t) => {
      const role = FLEET_ROLES[t.def.role];
      const dead = !t.alive;
      const hurt = t.alive && t.hp / t.maxHp < 0.5;
      return `<div class="cf-cell${dead ? ' dead' : ''}${hurt ? ' hurt' : ''}"
                   title="${role.gives}">
        <span class="cf-icon">${role.icon}</span>
        <span class="cf-name">${t.def.name}</span>
        <span class="cf-role">${dead ? 'PERDU' : role.name}</span>
      </div>`;
    }).join('');
    this.el.fleet.innerHTML =
      `<span class="cf-label">FLOTTE · ${convoy.souls.toLocaleString('fr-FR')} âmes</span>${cells}`;
  }

  // ---------- déroulé ----------

  _render() {
    const s = this.scene;
    const sector = this.app.range.sector;
    const loop = this.app.range.loopCount || 0;
    // Un tour de boucle refusé doit se lire dans le bandeau : sinon le joueur voit
    // « dernier saut avant le refuge » alors qu'il tourne en rond depuis trois sauts.
    this.el.sector.textContent = loop > 0
      ? `${sector.name} · ↻ MÊME POINT, TOUR ${loop}`
      : `${sector.name} · ${sector.subtitle}`;

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

    // Dire ce que « N » fait vraiment, et combien de décisions restent : sans ça on
    // croit encore pouvoir expédier la phase entière.
    if (this.el.skipLab) {
      const n = this.pendingChoices;
      this.el.skipLab.textContent = n
        ? `passer les dialogues (${n} décision${n > 1 ? 's' : ''} à prendre)`
        : 'passer à l\'action';
    }
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

  /** Message éphémère dans le bandeau du CIC (refus, information). */
  notify(text) {
    if (!this.el?.notice) return;
    this.el.notice.textContent = text;
    this.el.notice.classList.add('show');
    clearTimeout(this._noticeT);
    this._noticeT = setTimeout(() => this.el.notice.classList.remove('show'), 3800);
  }

  /**
   * ⚠ « N » NE SAUTE PLUS LES DÉCISIONS.
   *
   * Signalé en partie test : « ce n'est pas logique de pouvoir passer toute la
   * partie RPG, car dans ce cas no décision no impact ». C'était exact — la touche
   * expédiait l'arc entier, donc on entrait au combat sans qu'aucun choix n'ait été
   * fait, et la phase ne servait plus à rien.
   *
   * Mais la supprimer serait revenir au grief d'origine (« fade et juste très
   * long »). Elle saute donc les RÉPLIQUES et s'arrête à chaque choix : on peut
   * expédier la prose, jamais un arbitrage. Quand il ne reste plus de choix, elle
   * mène au combat.
   */
  _skipTalk() {
    // ⚠ La scène COURANTE d'abord. Une première version ne regardait que devant
    // (`index + 1`) : si l'on était déjà sur un choix, « N » sautait par-dessus, et
    // marteler la touche menait au combat avec ZÉRO décision prise. Le trou qu'on
    // voulait fermer était donc toujours ouvert. Sur un choix, la touche refuse et
    // le dit — un refus muet se lit comme une touche cassée.
    if (this.scene.choices) {
      this.notify('Cette décision vous revient — choisissez (1-3) avant de passer.');
      this.app.audio.relay?.();
      return;
    }
    for (let i = this.index + 1; i < this._scenes.length; i++) {
      if (this._scenes[i].choices) { this.index = i; this._render(); return; }
    }
    this._toAction();
  }

  /** Combien de décisions restent à prendre (affiché : « N » doit être compris). */
  get pendingChoices() {
    return this._scenes.slice(this.index).filter((s) => s.choices).length;
  }

  _key(e) {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    // H : descendre au pont hangar. L'escale ne consomme pas de temps de fiction
    // (le décompte avance par scène), donc elle ne punit pas la curiosité.
    if (e.code === 'KeyH') { e.preventDefault(); this.app.toHangar('bridge'); return; }
    if (e.code === 'KeyN') { e.preventDefault(); this._skipTalk(); return; }
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
