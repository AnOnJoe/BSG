import { STATION_DEFS } from '../core/Stations.js';
import { FIRE_MODES } from '../core/WeaponControl.js';
import { HELM_ORDERS, DRONE_ORDERS, FLEET_ORDERS, ENGINEER_ORDERS } from '../data/orders.js';
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

  build(weaponControl, ship, onToggle, onStation, onOrder, onSignalFix, onDesignate, onSection, onJump) {
    this.container.innerHTML = '';
    this._indicators = [];
    this.ship = ship;
    this.onToggle = onToggle;
    this.onStation = onStation;
    this.onOrder = onOrder;
    // Dénouement : relevé payé en charge FTL, et autorisation de tir sur un civil.
    this.onSignalFix = onSignalFix;
    this.onDesignate = onDesignate;
    this.onSection = onSection;
    this.onJump = onJump;
    this._cmdKey = '';
    this._capKey = '';
    this._modKey = '';

    this._buildVital();
    this._buildEnemy();
    this._buildFtl();
    this._buildRunBar();
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
      <div class="pp-credits" title="Matériel récupéré">⛭ <span class="cr-num"></span></div>
    `;
    this.container.appendChild(this.vital);
    this.salvageNum = this.vital.querySelector('.cr-num');
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

  /**
   * Le panneau de la FUITE : charge du saut, état de la flotte, survivants.
   * C'est l'information vitale du jeu — plus que sa propre coque.
   */
  _buildFtl() {
    this.ftlPanel = document.createElement('div');
    this.ftlPanel.id = 'ftl-panel';
    this.ftlPanel.innerHTML = `
      <div class="ftl-head">MOTEUR DE SAUT <span class="ftl-mode"></span></div>
      <div class="ftl-bar"><div class="ftl-fill"></div><span class="ftl-pct"></span></div>
      <div class="ftl-eta"></div>
      <div class="ftl-sep"></div>
      <div class="ftl-head">FLOTTE <span class="ftl-souls"></span></div>
      <div class="fleet-rows"></div>
      <div class="ftl-warn"></div>`;
    this.container.appendChild(this.ftlPanel);
    this.ftlMode = this.ftlPanel.querySelector('.ftl-mode');
    this.ftlFill = this.ftlPanel.querySelector('.ftl-fill');
    this.ftlPct = this.ftlPanel.querySelector('.ftl-pct');
    this.ftlEta = this.ftlPanel.querySelector('.ftl-eta');
    this.ftlSouls = this.ftlPanel.querySelector('.ftl-souls');
    this.fleetRows = this.ftlPanel.querySelector('.fleet-rows');
    this.ftlWarn = this.ftlPanel.querySelector('.ftl-warn');
    this._fleetKey = '';
  }

  /** Charge du saut + santé de chaque transport. */
  setFtl(ftl, convoy, info) {
    if (!this.ftlPanel) return;
    this.ftlFill.style.width = `${ftl.charge}%`;
    this.ftlPct.textContent = `${Math.floor(ftl.charge)}%`;
    // La perturbation du saut précédent : dire POURQUOI le calcul rame, sinon on
    // ne comprend pas qu'il faut avancer.
    const cl = info.clarity ?? 1;
    this.ftlMode.textContent = ftl.starved ? 'FORCÉ — ÉNERGIE INSUFFISANTE'
      : cl < 0.85 ? `${ftl.mode.name} — PERTURBÉ ${Math.round(cl * 100)} %`
        : ftl.mode.name;
    this.ftlMode.className = `ftl-mode ${ftl.starved ? 'starved' : ftl.modeId}`;
    this.ftlFill.className = `ftl-fill ${ftl.ready ? 'ready' : ftl.modeId}`;
    const eta = ftl.eta();
    this.ftlEta = this.ftlEta || this.ftlPanel.querySelector('.ftl-eta');
    // Combien partiront, combien resteront : c'est l'information sur laquelle on
    // décide d'amorcer ou d'attendre.
    if (info.inBubble) {
      const { inside, outside } = info.inBubble;
      const n = convoy.alive.length;
      this.ftlSouls.title = `${inside.length}/${n} dans la bulle`;
      if (info.spool > 0) {
        this.ftlWarn.textContent = `AMORÇAGE ${info.spool.toFixed(1)}s — IMMOBILES`;
        this.ftlWarn.className = 'ftl-warn on';
      } else if (outside.length && ftl.ready) {
        this.ftlWarn.textContent = `⚠ ${outside.length} hors de la bulle`;
        this.ftlWarn.className = 'ftl-warn on';
      }
    }
    this.ftlEta.textContent = ftl.ready
      ? (info.spool > 0 ? `AMORÇAGE — ${info.spool.toFixed(1)}s`
        : info.laggardToGate > 0
          ? `PRÊT — ${info.laggardName || 'un retardataire'} à ${Math.round(info.laggardToGate)} de la bulle`
          : 'PRÊT — J pour amorcer')
      : (eta === Infinity ? 'calcul à l\'arrêt' : `~${Math.ceil(eta)}s`);

    const souls = convoy.souls;
    this.ftlSouls.textContent = `${souls.toLocaleString('fr-FR')} âmes`;
    this.ftlSouls.className = `ftl-souls ${souls < info.soulsStart ? 'bled' : ''}`;

    const key = convoy.transports.map((t) => `${t.id}:${t.alive ? Math.ceil(t.hp) : 'x'}:${t.jumped ? 'j' : ''}:${t.name === info.laggardName ? 'L' : ''}`).join(',');
    if (key !== this._fleetKey) {
      this._fleetKey = key;
      this.fleetRows.innerHTML = convoy.transports.map((t) => {
        const cls = !t.alive ? 'lost' : t.jumped ? 'jumped'
          : (t.name === info.laggardName ? 'laggard' : '');
        return `<div class="fleet-row ${cls}"><span class="fl-name">${t.name}</span>` +
          `<span class="fl-bar"><span class="fl-fill" style="width:${Math.max(0, (t.hp / t.maxHp) * 100)}%"></span></span></div>`;
      }).join('');
    } else {
      const fills = this.fleetRows.querySelectorAll('.fl-fill');
      convoy.transports.forEach((t, i) => {
        if (fills[i]) fills[i].style.width = `${Math.max(0, (t.hp / t.maxHp) * 100)}%`;
      });
    }
    const nextIn = Math.ceil(info.nextAssault);
    this.ftlWarn.textContent = (info.contact && nextIn <= 8) ? `⚠ VAGUE DANS ${nextIn}s` : '';
    this.ftlWarn.className = `ftl-warn ${(info.contact && nextIn <= 8) ? 'on' : ''}`;

    // --- bandeau central ---
    if (this.rbTime) {
      const m = Math.floor(info.dradis);
      const sec = Math.floor((info.dradis - m) * 60);
      this.rbTime.textContent = info.contact
        ? 'EN CONTACT'
        : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
      this.rbLabel.textContent = info.contact ? 'BATAILLE ENGAGÉE' : 'PROCHAIN CONTACT';
      const urgent = !info.contact && info.dradis <= 5;
      this.rbClock.className = `rb-clock${info.contact ? ' contact' : urgent ? ' urgent' : ''}`;

      this.rbFill.style.width = `${ftl.charge}%`;
      this.rbFill.className = `rb-ftl-fill ${ftl.ready ? 'ready' : ftl.modeId}`;
      // Le bouton de saut DIT son état, y compris pourquoi il ne part pas : un
      // bouton inerte sans explication est le pire cas pour la décision centrale.
      if (this.rbJump) {
        const spool = info.spool > 0;
        const inside = info.inBubble ? info.inBubble.inside.length : 0;
        const outside = info.inBubble ? info.inBubble.outside.length : 0;
        let cls = 'wait', txt;
        if (spool) { cls = 'spool'; txt = `AMORÇAGE ${info.spool.toFixed(1)} s`; }
        else if (!ftl.ready) { txt = `calcul ${Math.floor(ftl.charge)} %`; }
        else if (!inside) { cls = 'nope'; txt = 'aucun transport dans la bulle'; }
        else {
          // « 5/6 partent » et non « 5 partent » : sans le total on ne sait pas si
          // l'on abandonne quelqu'un. Demandé en partie test.
          cls = outside ? 'part' : 'ready';
          txt = `${inside}/${inside + outside} partent`
            + (outside ? ` · ${outside} restent` : '');
        }
        this.rjState.textContent = txt;
        this.rbJump.className = `rb-jump ${cls}`;
        this.rbJump.disabled = spool;
      }
      this.rbPct.textContent = `${Math.floor(ftl.charge)}%`;
      this.rbEta.textContent = ftl.ready
        ? (info.laggardToGate > 0 ? `PRÊT · J pour partir sans le traînard` : 'SAUT IMMINENT')
        : (eta === Infinity ? 'calcul à l\'arrêt' : `~${Math.ceil(eta)}s`);
    }
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

  /**
   * BANDEAU CENTRAL — les deux informations qui commandent tout : le décompte
   * des « 33 minutes » avant le prochain contact, et la charge du saut sur une
   * grande barre horizontale. Le reste du HUD est périphérique ; ça, non.
   */
  _buildRunBar() {
    this.runBar = document.createElement('div');
    this.runBar.id = 'run-bar';
    this.runBar.innerHTML = `
      <div class="rb-clock">
        <span class="rb-label">PROCHAIN CONTACT</span>
        <span class="rb-time">33:00</span>
      </div>
      <div class="rb-ftl">
        <div class="rb-ftl-head"><span>CHARGE FTL</span><span class="rb-ftl-eta"></span></div>
        <div class="rb-ftl-track"><div class="rb-ftl-fill"></div><span class="rb-ftl-pct">0%</span></div>
      </div>
      <!-- ORDRE DE SAUT. Signalé en jeu : « je ne vois pas le bouton de FTL ni de
           touche, je me rappelais juste que c'était J ». Il n'y avait effectivement
           AUCUN bouton — seulement un rappel de touche minuscule en bas d'écran. La
           décision la plus importante du jeu n'avait pas d'affordance. Il est ici,
           collé à la jauge de charge : c'est là que va le regard. -->
      <button class="rb-jump" title="Amorcer le saut (J)">
        <span class="rj-lab">SAUT</span>
        <span class="rj-key">J</span>
        <span class="rj-state"></span>
      </button>`;
    this.container.appendChild(this.runBar);
    this.rbTime = this.runBar.querySelector('.rb-time');
    this.rbLabel = this.runBar.querySelector('.rb-label');
    this.rbClock = this.runBar.querySelector('.rb-clock');
    this.rbFill = this.runBar.querySelector('.rb-ftl-fill');
    this.rbPct = this.runBar.querySelector('.rb-ftl-pct');
    this.rbEta = this.runBar.querySelector('.rb-ftl-eta');
    this.rbJump = this.runBar.querySelector('.rb-jump');
    this.rjState = this.runBar.querySelector('.rj-state');
    this.rbJump.addEventListener('click', () => this.onJump?.());

    // Journal de passerelle : ce qui « scénarise » l'attente
    this.logEl = document.createElement('div');
    this.logEl.id = 'bridge-log';
    this.container.appendChild(this.logEl);
    this._log = [];
  }

  /** Ajoute une ligne au journal de passerelle (les 4 dernières restent). */
  pushLog(txt) {
    if (!this.logEl) return;
    this._log.push(txt);
    if (this._log.length > 4) this._log.shift();
    this.logEl.innerHTML = this._log
      .map((t, i) => `<div class="lg-line${i === this._log.length - 1 ? ' fresh' : ''}">${t}</div>`)
      .join('');
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

    // Rappel des touches, en bas de l'écran tactique. ⚠ Son style avait disparu en
    // même temps que l'ancien bloc CSS du hangar : il se retrouvait en haut à gauche
    // par-dessus le logo. Il porte maintenant son propre identifiant.
    this.hint = document.createElement('div');
    this.hint.id = 'hud-hint';
    this.hint.textContent = 'Tab : poste · chiffres : commandes du poste · J : saut · '
      + 'X : cible prioritaire · Clic : tir · Espace : missiles · ↑↓ ←→ : barre · '
      + 'Molette : zoom · V : plein écran';
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
    this._buildEngineerCockpit();
  }

  /**
   * INGÉNIEUR : le plan de coque en sections. C'est l'instrument central du poste —
   * on doit voir d'un coup d'œil laquelle est percée, ce qu'elle a éteint, et où
   * l'atelier travaille en ce moment. Sans ce dernier point, l'insuffisance de
   * l'équipage (il colmate le plus abîmé, pas le plus utile) resterait invisible,
   * et le poste n'aurait aucune raison d'exister.
   */
  _buildEngineerCockpit() {
    this.cockpits.engineer.body.innerHTML =
      `<div class="ck-group ck-sections">
         <div class="ck-label">SECTIONS DE COQUE <span class="ck-sub">chiffres = désigner</span></div>
         <div class="sec-row"></div>
       </div>
       <div class="ck-group">
         <div class="ck-label">ATELIER</div>
         <div class="eng-work">—</div>
         <div class="eng-rate"></div>
       </div>`;
    const b = this.cockpits.engineer.body;
    this.secRow = b.querySelector('.sec-row');
    this.engWork = b.querySelector('.eng-work');
    this.engRate = b.querySelector('.eng-rate');
    this._secKey = '';
  }

  /**
   * État des sections. `onSection` est branché sur le clic ; le refus (hors du
   * poste) est géré par `Range`, pas ici — le HUD ne décide pas des autorisations.
   */
  setSections(ship, engineer, atPost, rate) {
    if (!this.secRow) return;
    const list = ship.sectionList;
    const key = list.map((x) => `${x.def.id}:${Math.ceil(x.hp)}:${x.down ? 'd' : ''}` +
      `:${engineer.target === x ? 't' : ''}:${engineer.section === x ? 'w' : ''}`).join(',');
    if (key !== this._secKey) {
      this._secKey = key;
      this.secRow.innerHTML = list.map((x, i) => {
        const pct = Math.max(0, Math.min(100, (x.hp / x.maxHp) * 100));
        const mods = ship.modulesInSection(x.def.id);
        const hs = mods.filter((m) => ship.isSectionDown(m));
        const cls = x.down ? 'down' : pct < 50 ? 'hurt' : 'ok';
        return `<div class="sec-cell ${cls}${engineer.target === x ? ' pick' : ''}` +
          `${engineer.section === x ? ' work' : ''}" data-i="${i}">
            <div class="sc-head"><span class="sc-key">${i + 1}</span>${x.def.name}</div>
            <div class="sc-bar"><div class="sc-fill" style="width:${pct}%"></div></div>
            <div class="sc-hp">${Math.ceil(x.hp)}/${x.maxHp}</div>
            <div class="sc-mods">${hs.length
              ? `⚠ ${hs.map((m) => m.def.name).join(', ')} HS`
              : mods.length ? `${mods.length} module(s)` : '—'}</div>
          </div>`;
      }).join('');
      for (const el of this.secRow.querySelectorAll('.sec-cell')) {
        el.addEventListener('click', () => this.onSection?.(list[+el.dataset.i]));
      }
    }
    const w = engineer.section;
    this.engWork.textContent = w
      ? `${w.def.name} — ${Math.round((w.hp / w.maxHp) * 100)} %`
      : 'rien à réparer';
    this.engWork.className = `eng-work${w ? ' on' : ''}`;
    // Dire QUI répare et à quel débit : c'est l'argument pour descendre au poste.
    this.engRate.textContent = w
      ? `${rate.toFixed(1)} PV/s · ${atPost ? 'vous' : 'équipage'}`
      : '';
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
         ${this._orderRowHtml('fleet', 'FLOTTE', FLEET_ORDERS)}
         ${this._orderRowHtml('helm', 'PILOTE', HELM_ORDERS)}
         ${this._orderRowHtml('gunnery', 'ARTILLEUR', FIRE_MODES)}
         ${this._orderRowHtml('drones', 'DRONES', DRONE_ORDERS)}
         ${this._orderRowHtml('engineer', 'INGÉNIEUR', ENGINEER_ORDERS)}
       </div>
       <div class="ck-group ck-modules">
         <div class="ck-label">MODULES <span class="ck-sub">clic = activer / couper</span></div>
         <div class="mod-row"></div>
       </div>
       <!-- DÉNOUEMENT : n'apparaît qu'au dernier secteur. Le relevé et
            l'autorisation de tirer sur un civil sont des actes de commandement,
            ils n'ont donc rien à faire ailleurs que sur cette console. -->
       <div class="ck-group ck-signal hidden">
         <div class="ck-label">ÉMISSION <span class="ck-sub">clic = désigner</span></div>
         <div class="sig-row"></div>
         <button class="sig-fix">RELEVÉ</button>
         <div class="sig-note"></div>
       </div>`;

    // Console d'ordres : le commandant pose les consignes des autres postes sans
    // quitter la sienne. Il ne peut pas pour autant barrer ni viser à leur place.
    this.orderBtns = { fleet: [], helm: [], gunnery: [], drones: [], engineer: [] };
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
    this.sigGroup = body.querySelector('.ck-signal');
    this.sigRow = body.querySelector('.sig-row');
    this.sigNote = body.querySelector('.sig-note');
    this.sigFix = body.querySelector('.sig-fix');
    this.sigFix.addEventListener('click', () => this.onSignalFix?.());
    this._buildModuleChips(weaponControl);
  }

  /**
   * DÉNOUEMENT — les suspects, leur état, et le tir autorisé. Tout est explicite :
   * combien de relevés ont été payés, ce qu'un relevé de plus coûtera, et sur qui
   * le feu est ouvert. Une décision de cette gravité ne doit pas reposer sur une
   * icône qu'il faut interpréter.
   */
  setSignal(hunt, transports, fixCost) {
    if (!this.sigGroup) return;
    this.sigGroup.classList.toggle('hidden', !hunt.active);
    if (!hunt.active) return;

    const suspects = hunt.suspects(transports);
    const certain = suspects.length === 1;
    this.sigRow.innerHTML = transports.map((t, i) => {
      const dead = !t.alive;
      const out = hunt.cleared.has(t);
      const mark = hunt.designated === t;
      const cls = dead ? 'dead' : out ? 'out' : mark ? 'mark' : certain ? 'found' : 'susp';
      return `<div class="sig-chip ${cls}" data-i="${i}">
        <span class="sc-name">${t.def.name}</span>
        <span class="sc-state">${dead ? 'détruit' : out ? 'écarté' : mark ? '⌖ FEU' : certain ? 'C\'EST LUI' : 'suspect'}</span>
      </div>`;
    }).join('');
    for (const el of this.sigRow.querySelectorAll('.sig-chip')) {
      el.addEventListener('click', () => this.onDesignate?.(transports[+el.dataset.i]));
    }

    if (hunt.resolved) {
      this.sigNote.textContent = 'L\'émission a cessé. Sautez : la boucle est rompue.';
      this.sigNote.className = 'sig-note done';
      this.sigFix.disabled = true;
      this.sigFix.textContent = 'RELEVÉ — inutile';
      return;
    }
    this.sigFix.disabled = certain;
    this.sigFix.textContent = certain ? 'RELÈVEMENT ÉTABLI' : `RELEVÉ (−${fixCost} % de calcul)`;
    this.sigNote.className = 'sig-note';
    this.sigNote.textContent = certain
      ? 'Le tir sur un civil doit être ordonné : cliquez-le pour ouvrir le feu.'
      : `${suspects.length} suspects · ${hunt.fixes} relevé(s) payé(s)`;
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
       </div>
       <!-- LA VALEUR AJOUTÉE DU PILOTE, RENDUE LISIBLE.
            Objection légitime : si le clic donne le cap, à quoi sert le poste ? À
            router — et le routage se juge sur deux choses que l'équipage IA ignore
            complètement : se mettre à COUVERT (le décor coupe les tirs, elle n'en
            tient aucun compte) et tenir la flotte DANS LA BULLE avant d'amorcer.
            Sans ces deux instruments, cette valeur restait invisible et le poste
            paraissait vide. -->
       <div class="ck-group ck-nav">
         <div class="ck-label">ROUTE <span class="ck-sub">clic = point de route</span></div>
         <div class="nav-cover">—</div>
         <div class="nav-bubble">—</div>
         <div class="nav-wp"></div>
       </div>`;
    const b = this.cockpits.helm.body;
    this.helmNeedle = b.querySelector('.dial-needle');
    this.helmCap = b.querySelector('.dial-val');
    this.helmSpd = b.querySelector('.g-spd .g-val');
    this.helmDist = b.querySelector('.g-dist .g-val');
    this.helmWarn = b.querySelector('.ck-warn');
    this.navCover = b.querySelector('.nav-cover');
    this.navBubble = b.querySelector('.nav-bubble');
    this.navWp = b.querySelector('.nav-wp');
  }

  /** ARTILLEUR : solution de tir, cible, mode, munitions. */
  _buildGunneryCockpit() {
    this.cockpits.gunnery.body.innerHTML =
      `<div class="ck-group">
         <div class="ck-label">SOLUTION DE TIR</div>
         <div class="sol-big">—</div>
       </div>
       <!-- CIBLE PRIORITAIRE : consigne persistante, elle DOIT être affichée.
            Sinon l'équipage continue d'engager un contact qu'on a désigné dix
            secondes plus tôt et le joueur ne comprend pas pourquoi il ignore la
            menace immédiate. -->
       <div class="ck-group">
         <div class="ck-label">CIBLE PRIORITAIRE <span class="ck-sub">X</span></div>
         <div class="prio-name">—</div>
         <div class="prio-locks"></div>
       </div>
       <div class="ck-group ck-gauges">
         ${this._gaugeHtml('tgt', 'CIBLE')}
         ${this._gaugeHtml('ammo', 'MISSILES')}
         ${this._gaugeHtml('nrg', 'ÉNERGIE ARMES')}
       </div>`;
    const b = this.cockpits.gunnery.body;
    this.solBig = b.querySelector('.sol-big');
    this.prioName = b.querySelector('.prio-name');
    this.prioLocks = b.querySelector('.prio-locks');
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
      // HORS SERVICE par section percée : à distinguer d'un module simplement
      // coupé par le commandant, sinon on clique dessus en vain sans comprendre.
      const hs = !!module._sectionDown;
      chip.classList.toggle('offline', hs);
      chip.title = hs ? 'Section percée — réparation nécessaire (poste d\'ingénieur)' : '';
      chip.querySelector('.mod-lv').textContent = hs ? 'HS' : `Nv ${module.level}`;
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
  setCommands(stationId, items, activeId, activeId2) {
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
    if (this._cmdEls) {
      this._cmdEls.forEach((el, i) => el.classList.toggle(
        'on', this._cmdIds[i] === activeId || this._cmdIds[i] === activeId2
      ));
    }
  }

  /**
   * Cible prioritaire + pistes du radar. Le nombre de pistes est ce qui rend le
   * radar intéressant à améliorer : avec une seule, désigner concentre TOUT le feu
   * et plus rien d'autre n'est traité.
   */
  setPriority(name, locks) {
    if (!this.prioName) return;
    this.prioName.textContent = name || '— aucune, le plus proche —';
    this.prioName.className = `prio-name${name ? ' on' : ''}`;
    this.prioLocks.textContent = locks > 1
      ? `radar : ${locks} pistes${name ? ` · ${locks - 1} libre(s) pour le reste` : ''}`
      : `radar : 1 seule piste${name ? ' · tout le feu dessus' : ''}`;
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

    // Ce que l'équipage IA ne saura jamais juger : le couvert et la bulle.
    if (this.navCover) {
      const c = data.cover;
      this.navCover.textContent = c === null ? 'aucune menace'
        : c ? '✔ À COUVERT — ils ne peuvent pas tirer' : '✖ à découvert';
      this.navCover.className = `nav-cover${c ? ' good' : c === null ? '' : ' bad'}`;
      const { inside = 0, total = 0 } = data.bubble || {};
      this.navBubble.textContent = `flotte dans la bulle : ${inside}/${total}`;
      this.navBubble.className = `nav-bubble${total && inside === total ? ' good'
        : inside ? ' warn' : ' bad'}`;
      this.navWp.textContent = data.waypointDist === null || data.waypointDist === undefined
        ? '' : `point de route à ${Math.round(data.waypointDist)}`;
      this.navWp.classList.toggle('on', data.waypointDist != null);
    }
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
    // Les assauts sont INFINIS : pas de dénominateur (il affichait « /undefined »).
    this.waveLine.textContent = `ASSAUT ${wave} · en vue ${enemiesLeft}`;
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

  setSalvage(n) {
    if (this.salvageNum) this.salvageNum.textContent = Math.floor(n);
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
      const { angle, color, label } = list[i];
      const css = hexToCss(color);
      el.style.display = 'block';
      el.style.left = (cx + Math.cos(angle) * rx) + 'px';
      el.style.top = (cy + Math.sin(angle) * ry) + 'px';
      el.style.borderLeftColor = css;
      el.style.filter = `drop-shadow(0 0 5px ${css})`;
      // La DISTANCE des civils hors champ : c'est l'information qui manque pour
      // décider d'amorcer. Le libellé ne tourne pas avec la flèche, sinon il est
      // illisible — seule la pointe s'oriente.
      let tag = el.firstElementChild;
      if (label) {
        if (!tag) { tag = document.createElement('span'); tag.className = 'ei-d'; el.appendChild(tag); }
        tag.textContent = label;
        tag.style.color = css;
        tag.style.transform = `rotate(${-angle}rad)`;
      } else if (tag) { tag.remove(); }
      el.style.transform = `translate(-50%,-50%) rotate(${angle}rad)`;
    }
    for (let i = list.length; i < this._indicators.length; i++) this._indicators[i].style.display = 'none';
  }

  /**
   * ÉTIQUETTES DES CIVILS dans la zone de jeu. « On ne sait pas quel navire est qui »
   * — les six silhouettes sont distinctes mais rien ne les nomme, et surtout rien ne
   * dit CE QU'ELLES PORTENT, alors que perdre la citerne interdit de forcer le calcul.
   * L'étiquette porte donc l'icône de fonction, le nom court et l'état de la coque.
   */
  setFleetTags(list) {
    if (!this._tags) this._tags = [];
    for (let i = 0; i < list.length; i++) {
      let el = this._tags[i];
      if (!el) {
        el = document.createElement('div');
        el.className = 'fleet-tag';
        this.container.appendChild(el);
        this._tags[i] = el;
      }
      const t = list[i];
      el.style.display = 'block';
      el.style.left = `${t.x}px`;
      el.style.top = `${t.y}px`;
      el.className = `fleet-tag${t.hurt ? ' hurt' : ''}${t.laggard ? ' laggard' : ''}`
        + `${t.inBubble ? ' inb' : ''}`;
      const txt = `${t.icon} ${t.tag}`;
      if (el.dataset.k !== txt + t.pct) {
        el.dataset.k = txt + t.pct;
        el.innerHTML = `<span class="ft-n">${txt}</span><span class="ft-b">` +
          `<span class="ft-f" style="width:${t.pct}%"></span></span>`;
      } else {
        el.querySelector('.ft-f').style.width = `${t.pct}%`;
      }
    }
    for (let i = list.length; i < this._tags.length; i++) this._tags[i].style.display = 'none';
  }

  /**
   * Niveau de zoom personnel. Affiché brièvement à chaque cran : sans retour, on ne
   * sait ni où l'on en est ni comment revenir au cadrage d'origine.
   */
  setZoom(z) {
    if (!this._zoomEl) {
      this._zoomEl = document.createElement('div');
      this._zoomEl.id = 'zoom-tag';
      this.container.appendChild(this._zoomEl);
    }
    const pct = Math.round(100 / z);
    this._zoomEl.textContent = `VUE ${pct} %${Math.abs(z - 1) < 0.01 ? '' : ' · molette'}`;
    this._zoomEl.classList.add('show');
    clearTimeout(this._zoomT);
    this._zoomT = setTimeout(() => this._zoomEl.classList.remove('show'), 1400);
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
      // La bulle de rassemblement, centrée sur nous : ce qui est dedans partira
      if (data.bubble) {
        ctx.strokeStyle = 'rgba(143,223,255,0.55)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(cx, cy, data.bubble * scale, 0, 6.2832); ctx.stroke();
        ctx.setLineDash([]);
      }
      // Les CIVILS : on escorte, il faut voir qui se fait mordre à l'autre bout
      for (const c of (data.civils || [])) {
        if (Math.hypot(c.x - data.player.x, c.y - data.player.y) > data.range) continue;
        const dx = (c.x - data.player.x) * scale, dy = -(c.y - data.player.y) * scale;
        ctx.fillStyle = c.hurt ? '#ffb04a' : '#8fe6ff';
        ctx.beginPath();
        ctx.rect(cx + dx - 2.6, cy + dy - 1.6, 5.2, 3.2);
        ctx.fill();
        // Le retardataire est cerclé : c'est lui qui retient tout le monde
        if (c.laggard) {
          ctx.strokeStyle = '#ffaa33';
          ctx.beginPath(); ctx.arc(cx + dx, cy + dy, 5.5, 0, 6.2832); ctx.stroke();
        }
      }
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

  /**
   * Effet de saut FTL : traits qui filent puis flash blanc. En DOM plutôt qu'en
   * 3D — étirer un nuage de `Points` coûterait cher pour un effet d'une seconde,
   * et l'écran tactique est justement l'endroit où un artefact d'affichage se
   * justifie.
   */
  playJumpFx() {
    if (!this.jumpFx) {
      this.jumpFx = document.createElement('div');
      this.jumpFx.id = 'jump-fx';
      // Des traînées HORIZONTALES : on file vers la droite, les étoiles s'étirent
      // dans notre dos. Un dégradé répété donnait des barres verticales — l'effet
      // inverse de celui qu'on cherche.
      const lines = Array.from({ length: 46 }, () => {
        const top = Math.random() * 100;
        const len = 6 + Math.random() * 26;
        const delay = Math.random() * 0.22;
        const from = Math.random() * 70;
        return `<i class="jfx-line" style="top:${top}%;left:${from}%;--len:${len}%;animation-delay:${delay}s"></i>`;
      }).join('');
      this.jumpFx.innerHTML = `<div class="jfx-streaks">${lines}</div><div class="jfx-flash"></div>`;
      this.container.appendChild(this.jumpFx);
    }
    this.jumpFx.classList.remove('run');
    void this.jumpFx.offsetWidth;   // force le reflow, sinon l'animation ne rejoue pas
    this.jumpFx.classList.add('run');
  }

  /** Écran de saut : la respiration entre deux secteurs, et ce qu'on y gagne. */
  showJump(from, to, repair) {
    if (!this.jumpEl) {
      this.jumpEl = document.createElement('div');
      this.jumpEl.id = 'jump-screen';
      this.container.appendChild(this.jumpEl);
    }
    this.jumpEl.className = '';
    const left = (repair.left || []);
    this.jumpEl.innerHTML =
      `<div class="jp-tag">SAUT EFFECTUÉ</div>` +
      `<div class="jp-from">${from.name}</div>` +
      `<div class="jp-arrow">↓</div>` +
      `<div class="jp-to">${to ? to.name : 'LE REFUGE'}</div>` +
      `<div class="jp-sub">${to ? to.subtitle : ''}</div>` +
      `<div class="jp-fleet">${repair.saved} transport(s) emporté(s) · ${repair.souls.toLocaleString('fr-FR')} âmes</div>` +
      (left.length
        ? `<div class="jp-left">✖ resté${left.length > 1 ? 's' : ''} en arrière : ${left.map((t) => t.name).join(', ')}</div>`
        : '') +
      `<div class="jp-repair">+${repair.structure} coque · munitions rechargées · +${repair.salvage} ⛭ matériel</div>`;
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
