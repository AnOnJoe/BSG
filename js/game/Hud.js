import { STATION_DEFS } from '../core/Stations.js';
import { FIRE_MODES } from '../core/WeaponControl.js';
import { HELM_ORDERS, DRONE_ORDERS } from '../data/orders.js';
import { viewport } from '../core/Viewport.js';

/**
 * HUD de combat, organisé comme une PASSERELLE : chaque poste a son COCKPIT, et
 * on n'affiche que les instruments du poste où l'on se trouve.
 *
 * Avant, les panneaux des quatre métiers étaient empilés en permanence — d'où
 * l'impression de fouillis. Désormais :
 *  - un TRONC COMMUN minimal, toujours visible parce que vital quel que soit le
 *    poste : coque/bouclier, vague et cible, état du cuirassé, radar, et la
 *    colonne des postes ;
 *  - un COCKPIT unique en bas au centre, qui change avec le poste, avec ses
 *    instruments et ses commandes 1/2/3.
 */
function hexToCss(hex) {
  return '#' + (hex & 0xffffff).toString(16).padStart(6, '0');
}

const BUS_DEFS = [
  { key: 'weapons', label: 'ARM', prop: 'w' },
  { key: 'shields', label: 'BOU', prop: 's' },
  { key: 'engines', label: 'MOT', prop: 'm' },
];

export class Hud {
  constructor(container) {
    this.container = container;
  }

  build(weaponControl, ship, onToggle, onStation, onOrder) {
    this.container.innerHTML = '';
    this._indicators = [];
    this.ship = ship;
    this.onToggle = onToggle;
    this.onStation = onStation;
    this.onOrder = onOrder;
    this._cmdKey = '';
    this._capKey = '';
    this._modKey = '';

    this._buildVital();
    this._buildEnemy();
    this._buildCapital();
    this._buildStationBar();
    this._buildCockpits(weaponControl);
    this._buildOverlays();
    this.refreshStates();
  }

  // ---------- tronc commun ----------

  /** Constantes vitales : lisibles depuis n'importe quel poste. */
  _buildVital() {
    this.vital = document.createElement('div');
    this.vital.id = 'vital-panel';
    this.vital.innerHTML = `
      <div class="pp-title">BALEINE</div>
      ${this._barHtml('structure', 'COQUE')}
      ${this._barHtml('shield', 'BOUCLIER')}
      <div class="pp-credits">◈ <span class="cr-num"></span></div>
    `;
    this.container.appendChild(this.vital);
    this.creditsNum = this.vital.querySelector('.cr-num');
    this.structFill = this.vital.querySelector('.bar-structure .hp-fill');
    this.structNum = this.vital.querySelector('.bar-structure .hp-num');
    this.shieldBlock = this.vital.querySelector('.bar-shield');
    this.shieldFill = this.vital.querySelector('.bar-shield .hp-fill');
    this.shieldNum = this.vital.querySelector('.bar-shield .hp-num');
  }

  _buildEnemy() {
    this.enemyPanel = document.createElement('div');
    this.enemyPanel.id = 'enemy-panel';
    this.enemyPanel.innerHTML = `
      <div class="sector-line"></div>
      <div class="sector-sub"></div>
      <div class="sector-dots"></div>
      <div class="wave-line"></div>
      <div class="incoming"></div>
      <div class="hp-block">
        <div class="hp-label"><span>CIBLE</span><span class="hp-num"></span></div>
        <div class="hp-bar"><div class="hp-fill enemy"></div></div>
      </div>
    `;
    this.container.appendChild(this.enemyPanel);
    this.waveLine = this.enemyPanel.querySelector('.wave-line');
    this.sectorLine = this.enemyPanel.querySelector('.sector-line');
    this.sectorSub = this.enemyPanel.querySelector('.sector-sub');
    this.sectorDots = this.enemyPanel.querySelector('.sector-dots');
    this.incoming = this.enemyPanel.querySelector('.incoming');
    this.enemyFill = this.enemyPanel.querySelector('.hp-fill');
    this.enemyNum = this.enemyPanel.querySelector('.hp-num');
  }

  _buildCapital() {
    this.capPanel = document.createElement('div');
    this.capPanel.id = 'capital-panel';
    this.capPanel.className = 'hidden';
    this.container.appendChild(this.capPanel);
  }

  _buildStationBar() {
    this.stationBar = document.createElement('div');
    this.stationBar.id = 'station-bar';
    this.stationTiles = STATION_DEFS.map((s) => {
      const tile = document.createElement('div');
      tile.className = 'st-tile';
      tile.innerHTML =
        `<div class="st-icon">${s.icon}</div>` +
        `<div class="st-tname">${s.name}</div>` +
        `<div class="st-hold"></div>` +
        `<div class="st-bar"><div class="st-fill"></div></div>`;
      tile.addEventListener('click', () => this.onStation?.(s.id));
      this.stationBar.appendChild(tile);
      return { id: s.id, tile, hold: tile.querySelector('.st-hold'), fill: tile.querySelector('.st-fill') };
    });
    this.container.appendChild(this.stationBar);
  }

  _buildOverlays() {
    // Mini-radar : instrument du vaisseau, utile à tous les postes
    this.mm = document.createElement('canvas');
    this.mm.id = 'minimap';
    this.mm.width = 156; this.mm.height = 156;
    this.container.appendChild(this.mm);
    this.mmCtx = this.mm.getContext('2d');
    this._sweep = 0;

    this.reticle = document.createElement('div');
    this.reticle.id = 'reticle';
    this.container.appendChild(this.reticle);

    this.damageFlash = document.createElement('div');
    this.damageFlash.id = 'damage-flash';
    this.container.appendChild(this.damageFlash);

    this.banner = document.createElement('div');
    this.banner.id = 'wave-banner';
    this.container.appendChild(this.banner);

    this.outcome = document.createElement('div');
    this.outcome.id = 'outcome';
    this.outcome.className = 'hidden';
    this.container.appendChild(this.outcome);

    this.hint = document.createElement('div');
    this.hint.className = 'hint';
    this.hint.textContent =
      'Tab / clic : changer de poste · chiffres : commandes du poste · Clic gauche : tir · Espace : missiles · ↑↓/←→ : barre';
    this.container.appendChild(this.hint);
  }

  _barHtml(kind, label) {
    return `<div class="hp-block bar-${kind}">
      <div class="hp-label"><span>${label}</span><span class="hp-num"></span></div>
      <div class="hp-bar"><div class="hp-fill ${kind}"></div></div>
    </div>`;
  }

  // ---------- cockpits ----------

  _buildCockpits(weaponControl) {
    this.cockpitWrap = document.createElement('div');
    this.cockpitWrap.id = 'cockpit';
    this.container.appendChild(this.cockpitWrap);

    this.cockpits = {};
    for (const s of STATION_DEFS) {
      const el = document.createElement('div');
      el.className = 'cockpit-panel hidden';
      el.dataset.station = s.id;
      el.innerHTML = `<div class="ck-head"><span class="ck-icon">${s.icon}</span>${s.name}<span class="ck-role">${s.role}</span></div>` +
        `<div class="ck-body"></div><div class="ck-cmds"></div>`;
      this.cockpitWrap.appendChild(el);
      this.cockpits[s.id] = { el, body: el.querySelector('.ck-body'), cmds: el.querySelector('.ck-cmds') };
    }

    this._buildCommandCockpit(weaponControl);
    this._buildHelmCockpit();
    this._buildGunneryCockpit();
    this._buildDroneCockpit();
  }

  /** COMMANDANT : répartition d'énergie, modules, IEM. */
  _buildCommandCockpit(weaponControl) {
    const body = this.cockpits.command.body;
    body.innerHTML =
      `<div class="ck-group ck-power">
         <div class="ck-label">RÉPARTITION <span class="prof-name"></span></div>
         <div class="bus-row">${BUS_DEFS.map((b) =>
           `<div class="bus bus-${b.key}">
              <div class="bus-track"><div class="bus-fill"></div></div>
              <div>${b.label}</div><div class="bus-pct"></div>
            </div>`).join('')}</div>
         <div class="ck-hint">clic droit : anneau</div>
       </div>
       <div class="ck-group ck-orders">
         <div class="ck-label">ORDRES À L'ÉQUIPAGE <span class="ck-sub">clic</span></div>
         ${this._orderRowHtml('helm', 'PILOTE', HELM_ORDERS)}
         ${this._orderRowHtml('gunnery', 'ARTILLEUR', FIRE_MODES)}
         ${this._orderRowHtml('drones', 'DRONES', DRONE_ORDERS)}
       </div>
       <div class="ck-group ck-modules">
         <div class="ck-label">MODULES <span class="ck-sub">clic = activer / couper</span></div>
         <div class="mod-row"></div>
       </div>`;

    // Console d'ordres : le commandant pose les consignes des autres postes sans
    // quitter la sienne. Il ne peut pas pour autant barrer ni viser à leur place.
    this.orderBtns = { helm: [], gunnery: [], drones: [] };
    for (const kind of Object.keys(this.orderBtns)) {
      for (const btn of body.querySelectorAll(`.ord-btn[data-kind="${kind}"]`)) {
        btn.addEventListener('click', () => this.onOrder?.(kind, btn.dataset.id));
        this.orderBtns[kind].push(btn);
      }
    }
    this.profName = body.querySelector('.prof-name');
    this.buses = BUS_DEFS.map((b) => ({
      key: b.key, prop: b.prop,
      fill: body.querySelector(`.bus-${b.key} .bus-fill`),
      pct: body.querySelector(`.bus-${b.key} .bus-pct`),
    }));
    this.modRow = body.querySelector('.mod-row');
    this._buildModuleChips(weaponControl);
  }

  /**
   * Pastilles de modules : c'est ici que vit l'activation/coupure, à la place de
   * l'ancien toggle par les chiffres — devenus les commandes du poste courant.
   */
  _buildModuleChips(weaponControl) {
    this.modRow.innerHTML = '';
    this.chips = [];
    for (const { key, module } of weaponControl.layout()) {
      const chip = document.createElement('div');
      chip.className = 'mod-chip';
      chip.style.setProperty('--chip-color', hexToCss(module.levelColor));
      chip.innerHTML =
        `<div class="mod-fill"></div>` +
        `<div class="mod-body">` +
        `<div class="mod-name">${module.def.name}</div>` +
        `<div class="mod-lv">Nv ${module.level}</div>` +
        `<div class="mod-ammo"></div>` +
        `</div>`;
      chip.addEventListener('click', () => this.onToggle(key));
      this.modRow.appendChild(chip);
      this.chips.push({ chip, module, ammoEl: chip.querySelector('.mod-ammo'), fillEl: chip.querySelector('.mod-fill') });
    }
  }

  /** PILOTE : cap, vitesse, distance, alerte de bordure. */
  _buildHelmCockpit() {
    this.cockpits.helm.body.innerHTML =
      `<div class="ck-group">
         <div class="dial"><div class="dial-needle"></div><div class="dial-val"></div></div>
         <div class="ck-label ck-center">CAP</div>
       </div>
       <div class="ck-group ck-gauges">
         ${this._gaugeHtml('spd', 'VITESSE')}
         ${this._gaugeHtml('dist', 'MENACE À')}
         <div class="ck-warn"></div>
       </div>`;
    const b = this.cockpits.helm.body;
    this.helmNeedle = b.querySelector('.dial-needle');
    this.helmCap = b.querySelector('.dial-val');
    this.helmSpd = b.querySelector('.g-spd .g-val');
    this.helmDist = b.querySelector('.g-dist .g-val');
    this.helmWarn = b.querySelector('.ck-warn');
  }

  /** ARTILLEUR : solution de tir, cible, mode, munitions. */
  _buildGunneryCockpit() {
    this.cockpits.gunnery.body.innerHTML =
      `<div class="ck-group">
         <div class="ck-label">SOLUTION DE TIR</div>
         <div class="sol-big">—</div>
       </div>
       <div class="ck-group ck-gauges">
         ${this._gaugeHtml('tgt', 'CIBLE')}
         ${this._gaugeHtml('ammo', 'MISSILES')}
         ${this._gaugeHtml('nrg', 'ÉNERGIE ARMES')}
       </div>`;
    const b = this.cockpits.gunnery.body;
    this.solBig = b.querySelector('.sol-big');
    this.gunTgt = b.querySelector('.g-tgt .g-val');
    this.gunAmmo = b.querySelector('.g-ammo .g-val');
    this.gunNrg = b.querySelector('.g-nrg .g-val');
  }

  /** DRONES : effectif et santé de l'escadron. */
  _buildDroneCockpit() {
    this.cockpits.drones.body.innerHTML =
      `<div class="ck-group">
         <div class="ck-label">ESCADRON</div>
         <div class="squad-row"></div>
       </div>
       <div class="ck-group">
         <div class="ck-label">CIBLE DÉSIGNÉE <span class="ck-sub">souris</span></div>
         <div class="desig">—</div>
       </div>
       <div class="ck-group ck-gauges">
         ${this._gaugeHtml('sq', 'EFFECTIF')}
         ${this._gaugeHtml('foe', 'DRONES ENNEMIS')}
       </div>`;
    const b = this.cockpits.drones.body;
    this.squadRow = b.querySelector('.squad-row');
    this.squadN = b.querySelector('.g-sq .g-val');
    this.squadFoe = b.querySelector('.g-foe .g-val');
    this.desig = b.querySelector('.desig');
  }

  _orderRowHtml(kind, label, items) {
    return `<div class="ord-row"><span class="ord-lab">${label}</span>` +
      items.map((it) => `<span class="ord-btn" data-kind="${kind}" data-id="${it.id}">${it.name}</span>`).join('') +
      `</div>`;
  }

  /** Marque la consigne en cours de chaque poste sur la console d'ordres. */
  setOrders(state) {
    if (!this.orderBtns) return;
    for (const kind of Object.keys(this.orderBtns)) {
      for (const btn of this.orderBtns[kind]) btn.classList.toggle('on', btn.dataset.id === state[kind]);
    }
  }

  _gaugeHtml(id, label) {
    return `<div class="gauge g-${id}"><div class="g-label">${label}</div><div class="g-val">—</div></div>`;
  }

  // ---------- mises à jour ----------

  refreshStates() {
    if (!this.chips) return;
    for (const { chip, module, ammoEl } of this.chips) {
      chip.classList.toggle('active', module.active);
      chip.querySelector('.mod-lv').textContent = `Nv ${module.level}`;
      chip.style.setProperty('--chip-color', hexToCss(module.levelColor));
      ammoEl.textContent = module.defId === 'missile' ? `${module.ammo}/${module.ammoMax}` : '';
    }
  }

  setPlayer(ship) {
    const setBar = (fill, num, cur, max) => {
      fill.style.width = (max > 0 ? (cur / max) * 100 : 0) + '%';
      num.textContent = `${Math.ceil(cur)}/${Math.round(max)}`;
    };
    setBar(this.structFill, this.structNum, ship.structure, ship.structureMax);
    if (ship.shieldMax > 0) {
      this.shieldBlock.style.display = '';
      setBar(this.shieldFill, this.shieldNum, ship.shield, ship.shieldMax);
    } else {
      this.shieldBlock.style.display = 'none';
    }

    // Cockpit commandant : bus d'énergie + état des modules
    if (this.profName && ship.power) {
      const p = ship.power.preset;
      const cur = ship.power.cur;
      this.profName.textContent = p.name;
      this.profName.style.setProperty('--profile-color', p.css);
      this.profName.classList.toggle('shifting', ship.power.shifting);
      for (const b of this.buses) {
        b.fill.style.height = (cur[b.prop] * 100) + '%';
        b.pct.textContent = Math.round(cur[b.prop] * 100) + '%';
      }
    }
    for (const { chip, module, ammoEl, fillEl } of this.chips || []) {
      if (module.defId === 'missile') {
        ammoEl.textContent = `${module.ammo}/${module.ammoMax}`;
        chip.classList.toggle('depleted', module.active && module.ammo <= 0);
        fillEl.style.height = '0';
      } else if (module.defId === 'laser' || module.defId === 'ciws') {
        chip.classList.toggle('depleted', module.active && ship.energy < module.energyCost);
        fillEl.style.height = '0';
      } else if (module.defId === 'emp') {
        const t = module.cooldownTime || 1;
        fillEl.style.height = (Math.max(0, Math.min(1, 1 - module.cooldownLeft / t)) * 100) + '%';
        ammoEl.textContent = module.cooldownLeft > 0 ? `${Math.ceil(module.cooldownLeft)}s` : 'PRÊT ⚡';
        chip.classList.toggle('depleted', module.cooldownLeft > 0);
      } else {
        fillEl.style.height = '0';
      }
    }
    // Cockpit artilleur : énergie disponible pour les armes
    if (this.gunNrg) this.gunNrg.textContent = `${Math.ceil(ship.energy)}/${Math.round(ship.energyMax)}`;
  }

  /**
   * Postes : colonne de gauche + affichage du seul cockpit courant.
   * Pendant un transit, le poste rejoint n'est tenu par PERSONNE — la tuile le
   * dit, sinon on ne comprendrait pas pourquoi plus rien ne répond.
   */
  setStations(stations) {
    if (!this.stationTiles) return;
    for (const t of this.stationTiles) {
      const manned = stations.manned(t.id);
      const installing = stations.isInstalling(t.id);
      t.tile.classList.toggle('manned', manned);
      t.tile.classList.toggle('installing', installing);
      t.hold.textContent = manned ? 'VOUS' : installing ? 'VACANT' : 'ÉQUIPAGE';
      t.fill.style.width = installing ? `${stations.installProgress * 100}%` : '0%';
    }
    const cur = stations.current;
    if (cur !== this._shownStation) {
      this._shownStation = cur;
      for (const id of Object.keys(this.cockpits)) {
        this.cockpits[id].el.classList.toggle('hidden', id !== cur);
      }
      // Le décor de la passerelle prend la couleur du poste occupé, et le
      // montant supérieur en porte le nom : on doit savoir où l'on est assis.
      const def = STATION_DEFS.find((s) => s.id === cur);
      document.body.dataset.station = cur;
      const tag = document.querySelector('.shell-tag');
      if (tag && def) tag.textContent = `${def.icon}  POSTE ${def.name}`;
    }
    this.cockpitWrap.classList.toggle('installing', stations.installing > 0);
  }

  /** Commandes 1/2/3 du poste courant, rendues dans son cockpit. */
  setCommands(stationId, items, activeId) {
    const ck = this.cockpits?.[stationId];
    if (!ck) return;
    const key = `${stationId}|${items.map((i) => i.id).join(',')}`;
    if (key !== this._cmdKey) {
      this._cmdKey = key;
      ck.cmds.innerHTML = items
        .map((it, i) => `<div class="cmd"><span class="cmd-key">${i + 1}</span>${it.name}</div>`)
        .join('');
      this._cmdEls = Array.from(ck.cmds.querySelectorAll('.cmd'));
      this._cmdIds = items.map((i) => i.id);
    }
    if (this._cmdEls) this._cmdEls.forEach((el, i) => el.classList.toggle('on', this._cmdIds[i] === activeId));
  }

  /** Instruments du poste de pilote. */
  setHelm(data) {
    if (!this.helmCap) return;
    const deg = ((data.heading * 180) / Math.PI + 360) % 360;
    this.helmCap.textContent = `${Math.round(deg)}°`;
    this.helmNeedle.style.transform = `rotate(${deg - 90}deg)`;
    this.helmSpd.textContent = data.speed.toFixed(1);
    this.helmDist.textContent = data.threat === null ? '—' : Math.round(data.threat);
    this.helmWarn.textContent = data.nearEdge ? '⚠ LIMITE DE ZONE' : '';
    this.helmWarn.classList.toggle('on', !!data.nearEdge);
  }

  /** Instruments du poste de drones. */
  setSquadron(data) {
    if (!this.squadN) return;
    this.squadN.textContent = `${data.count}`;
    this.squadFoe.textContent = `${data.enemyCount}`;
    if (this.desig) {
      this.desig.textContent = data.designated || 'aucune — ils prennent le plus proche';
      this.desig.classList.toggle('on', !!data.designated);
    }
    const key = data.hp.map((h) => Math.ceil(h)).join(',');
    if (key !== this._squadKey) {
      this._squadKey = key;
      this.squadRow.innerHTML = data.hp.length
        ? data.hp.map((h) => `<span class="sq-pip" style="--pip:${Math.max(0, Math.min(1, h / 6)) * 100}%"></span>`).join('')
        : '<span class="sq-empty">aucun drone déployé</span>';
    }
  }

  /**
   * Progression de la TRAVERSÉE : sans ça « vague 3 » ne dit pas où l'on va.
   * Les pastilles montrent les secteurs franchis, le secteur courant et ce qui
   * reste — c'est ce qui donne une direction au jeu.
   */
  setWave(wave, enemiesLeft, run) {
    this.waveLine.textContent = `VAGUE ${wave}${run ? `/${run.waves}` : ''} · ennemis ${enemiesLeft}`;
    if (!run || !this.sectorLine) return;
    const label = `${run.index}/${run.total} — ${run.sector.name}`;
    if (label !== this._sectorLabel) {
      this._sectorLabel = label;
      this.sectorLine.textContent = label;
      this.sectorSub.textContent = run.terrain || run.sector.subtitle || '';
      this.sectorDots.innerHTML = Array.from({ length: run.total }, (_, i) =>
        `<span class="dot ${i < run.index - 1 ? 'done' : i === run.index - 1 ? 'here' : ''}"></span>`).join('');
    }
    // Annonce du contact : c'est ce qui rend la respiration ACTIVE — on sait ce
    // qui arrive, donc on prépare l'énergie et l'escadron avant le choc.
    if (this.incoming) {
      if (run.incoming) {
        this.incoming.textContent = `⚠ CONTACT ${Math.ceil(run.eta)}s — ${run.incoming.name}`;
        this.incoming.className = 'incoming on';
      } else {
        this.incoming.textContent = '';
        this.incoming.className = 'incoming';
      }
    }
    const th = run.theme ? run.theme.name : '';
    if (th !== this._themeLabel) {
      this._themeLabel = th;
      this.sectorSub.textContent = `${run.terrain} · ${th}`;
    }
  }

  setCredits(n) {
    if (this.creditsNum) this.creditsNum.textContent = Math.floor(n);
  }

  /**
   * Qualité de la conduite de tir de l'équipage. Sans ce retour, ses ratés
   * passeraient pour un bug au lieu d'être un signal : « prends la tourelle ».
   */
  setSolution(sol) {
    if (!this.solBig) return;
    this.solBig.textContent = sol.label;
    const cls = sol.label === 'MANUELLE' ? 'manual'
      : sol.quality > 0.6 ? 'good'
        : sol.quality > 0.3 ? 'fair' : 'bad';
    this.solBig.className = `sol-big sol-${cls}`;
  }

  /** Flèches en bord d'écran pointant vers les ennemis hors du cadre. */
  setIndicators(list) {
    if (!this._indicators) this._indicators = [];
    // Les flèches se placent sur le bord de l'ÉCRAN TACTIQUE, pas de la fenêtre
    const cx = viewport.cx, cy = viewport.cy;
    const rx = viewport.w / 2 - 26, ry = viewport.h / 2 - 26;
    for (let i = 0; i < list.length; i++) {
      let el = this._indicators[i];
      if (!el) {
        el = document.createElement('div');
        el.className = 'enemy-indicator';
        this.container.appendChild(el);
        this._indicators[i] = el;
      }
      const { angle, color } = list[i];
      const css = hexToCss(color);
      el.style.display = 'block';
      el.style.left = (cx + Math.cos(angle) * rx) + 'px';
      el.style.top = (cy + Math.sin(angle) * ry) + 'px';
      el.style.transform = `translate(-50%,-50%) rotate(${angle}rad)`;
      el.style.borderLeftColor = css;
      el.style.filter = `drop-shadow(0 0 5px ${css})`;
    }
    for (let i = list.length; i < this._indicators.length; i++) this._indicators[i].style.display = 'none';
  }

  setEnemy(present, hp, max) {
    if (!present) {
      this.enemyFill.style.width = '0%';
      this.enemyNum.textContent = '—';
      if (this.gunTgt) this.gunTgt.textContent = '—';
      return;
    }
    this.enemyFill.style.width = Math.max(0, (hp / max) * 100) + '%';
    this.enemyNum.textContent = `${Math.ceil(hp)} / ${max}`;
    if (this.gunTgt) this.gunTgt.textContent = `${Math.ceil(hp)}`;
  }

  /**
   * État du cuirassé : une ligne par pièce. C'est le tableau de bord de
   * l'opération — on doit voir en un coup d'œil ce qu'il reste à démonter.
   */
  setCapital(capital) {
    if (!this.capPanel) return;
    if (!capital || !capital.alive) {
      if (!this.capPanel.classList.contains('hidden')) {
        this.capPanel.classList.add('hidden');
        this.capPanel.innerHTML = '';
        this._capKey = '';
      }
      return;
    }
    this.capPanel.classList.remove('hidden');
    const key = capital.parts.map((p) => `${p.id}:${p.alive ? 1 : 0}`).join(',');
    if (key !== this._capKey) {
      this._capKey = key;
      const rows = capital.parts.map((p) => {
        const cls = p.alive ? `cap-row cap-${p.kind}` : 'cap-row dead';
        return `<div class="${cls}" data-id="${p.id}">
          <span class="cap-name">${p.alive ? p.name : '— ' + p.name}</span>
          <span class="cap-bar"><span class="cap-fill"></span></span>
        </div>`;
      }).join('');
      this.capPanel.innerHTML =
        `<div class="cap-title">⚠ ${capital.config.name}</div>` +
        `<div class="cap-sub">batteries actives ${capital.liveBatteries.length}/${capital.batteries.length}` +
        `${capital.enginesAlive ? '' : ' · IMMOBILISÉ'}` +
        `${capital.bridgeAlive ? '' : ' · TIR DÉRÉGLÉ'}</div>` + rows;
      this._capFills = new Map();
      for (const p of capital.parts) {
        const el = this.capPanel.querySelector(`.cap-row[data-id="${p.id}"] .cap-fill`);
        if (el) this._capFills.set(p.id, el);
      }
    }
    if (this._capFills) {
      for (const p of capital.parts) {
        const el = this._capFills.get(p.id);
        if (el) el.style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
      }
    }
  }

  /**
   * Mini-radar. data = { range, player:{x,y}, heading, enemies:[{x,y}], pickups:[{x,y,type}] }.
   * La portée dépend du module radar (0 = pas de radar => scope vide).
   */
  updateMinimap(dt, data) {
    const ctx = this.mmCtx, W = this.mm.width, H = this.mm.height;
    const cx = W / 2, cy = H / 2, R = W / 2 - 4;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(2,12,7,0.9)';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = 'rgba(60,255,140,0.45)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.5, 0, 6.2832); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();

    this._sweep += dt * 1.8;
    const sa = this._sweep;
    ctx.save(); ctx.translate(cx, cy);
    for (let k = 0; k < 12; k++) {
      const a = sa - k * 0.05;
      ctx.strokeStyle = `rgba(60,255,140,${0.16 * (1 - k / 12)})`;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(130,255,180,0.9)';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(sa) * R, Math.sin(sa) * R); ctx.stroke();
    ctx.restore();

    if (!data.range) {
      ctx.fillStyle = 'rgba(120,160,140,0.7)';
      ctx.font = '10px monospace'; ctx.textAlign = 'center';
      ctx.fillText('NO RADAR', cx, cy + 3);
    } else {
      const scale = (R - 3) / data.range;
      const plot = (wx, wy, color, size) => {
        const dx = (wx - data.player.x) * scale;
        const dy = -(wy - data.player.y) * scale;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(cx + dx, cy + dy, size, 0, 6.2832); ctx.fill();
      };
      for (const e of data.enemies) {
        if (Math.hypot(e.x - data.player.x, e.y - data.player.y) <= data.range) plot(e.x, e.y, '#ff6a5a', 2.6);
      }
      for (const p of data.pickups) {
        if (Math.hypot(p.x - data.player.x, p.y - data.player.y) <= data.range) plot(p.x, p.y, p.type === 'ammo' ? '#ffb04a' : '#66ff99', 2.2);
      }
    }
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-data.heading);
    ctx.fillStyle = '#7fe8ff';
    ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-3.5, 3); ctx.lineTo(-3.5, -3); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /** Écran de saut : la respiration entre deux secteurs, et ce qu'on y gagne. */
  showJump(from, to, repair) {
    if (!this.jumpEl) {
      this.jumpEl = document.createElement('div');
      this.jumpEl.id = 'jump-screen';
      this.container.appendChild(this.jumpEl);
    }
    this.jumpEl.className = '';
    this.jumpEl.innerHTML =
      `<div class="jp-tag">SECTEUR FRANCHI</div>` +
      `<div class="jp-from">${from.name}</div>` +
      `<div class="jp-arrow">↓ saut en cours ↓</div>` +
      `<div class="jp-to">${to.name}</div>` +
      `<div class="jp-sub">${to.subtitle}</div>` +
      `<div class="jp-repair">+${repair.structure} coque · munitions rechargées · +${repair.credits} ◈</div>`;
  }

  hideJump() {
    if (this.jumpEl) this.jumpEl.className = 'hidden';
  }

  /** Annonce d'entrée dans un secteur. */
  showSector(sector, index, total) {
    this.showWaveBanner(0, `${index}/${total} — ${sector.name}`);
  }

  showWaveBanner(n, sub) {
    this.banner.textContent = sub || `VAGUE ${n}`;
    this.banner.style.transition = 'none';
    this.banner.style.opacity = '1';
    void this.banner.offsetWidth;
    this.banner.style.transition = 'opacity 1.6s ease-out';
    this.banner.style.opacity = '0';
  }

  /** Flash rouge bref quand la baleine encaisse. */
  flashDamage(intensity = 0.6) {
    if (!this.damageFlash) return;
    this.damageFlash.style.transition = 'none';
    this.damageFlash.style.opacity = String(Math.min(1, intensity));
    void this.damageFlash.offsetWidth;
    this.damageFlash.style.transition = 'opacity 0.45s ease-out';
    this.damageFlash.style.opacity = '0';
  }

  setReticle(screenPos) {
    if (!screenPos) { this.reticle.style.display = 'none'; return; }
    this.reticle.style.display = 'block';
    this.reticle.style.left = screenPos.x + 'px';
    this.reticle.style.top = screenPos.y + 'px';
  }

  showOutcome(type, sub, onReplay, onHangar, hof) {
    const win = type === 'victory';
    this.outcome.className = win ? 'win' : 'lose';
    let hofHtml = '';
    if (hof && hof.top && hof.top.length) {
      const rows = hof.top.map((e, i) =>
        `<li class="${e.id === hof.id ? 'me' : ''}"><span>#${i + 1}</span><span>Vague ${e.wave}</span><span>${e.date}</span></li>`
      ).join('');
      hofHtml = `<div class="hof"><div class="hof-title">🏆 HALL OF FAME</div><ol>${rows}</ol></div>`;
    }
    this.outcome.innerHTML = `
      <div class="outcome-title">${win ? 'VICTOIRE' : 'DÉFAITE'}</div>
      <div class="outcome-sub">${sub || ''}</div>
      ${hofHtml}
      <div class="outcome-actions">
        <button class="btn-primary act-replay">Rejouer</button>
        <button class="btn-ghost act-hangar">← Hangar</button>
      </div>`;
    this.outcome.querySelector('.act-replay').addEventListener('click', onReplay);
    this.outcome.querySelector('.act-hangar').addEventListener('click', onHangar);
    this.setReticle(null);
  }

  hideOutcome() {
    this.outcome.className = 'hidden';
    this.outcome.innerHTML = '';
  }

  clear() {
    this.container.innerHTML = '';
  }
}
