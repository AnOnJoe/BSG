import * as THREE from 'three';
import { AimController } from '../core/AimController.js';
import { InputController } from '../core/InputController.js';
import { WeaponControl } from '../core/WeaponControl.js';
import { CommandRing } from '../core/CommandRing.js';
import { Stations } from '../core/Stations.js';
import { AutoHelm } from '../core/AutoHelm.js';
import { FIRE_MODES } from '../core/WeaponControl.js';
import { POWER_PRESETS } from '../core/PowerBus.js';
import { HELM_ORDERS, DRONE_ORDERS } from '../data/orders.js';
import { WAVE_THEMES, CAPITAL_THEME, pickTheme } from '../data/waves.js';
import { SECTORS, sectorAt, SECTOR_COUNT, JUMP_REPAIR } from '../data/campaign.js';
import { viewport } from '../core/Viewport.js';
import { EnemyShip, ENEMY_TYPES } from '../entities/EnemyShip.js';
import { CapitalShip } from '../entities/CapitalShip.js';
import { Terrain } from '../entities/Terrain.js';
import { Convoy } from '../entities/Convoy.js';
import { FtlDrive, FTL_MODES } from '../core/FtlDrive.js';
import { FLEET, totalSouls } from '../data/convoyConfig.js';
import { COMBAT_OFFSET } from '../core/Camera.js';
import { Drone } from '../entities/Drone.js';
import { Pickup } from '../entities/Pickup.js';
import { Hud } from './Hud.js';
import { Fx } from '../core/Fx.js';
import { ScreenShake } from '../core/ScreenShake.js';
import { neonLineMat } from '../core/NeonMaterials.js';
import { TUNE } from '../core/Tune.js';
import { HallOfFame } from '../core/HallOfFame.js';

// COULOIR et non arène : on entre par la gauche, le point de saut est à droite.
// C'est ce qui donne une direction au niveau — sans quoi on tourne en rond.
const ARENA = { x: 430, y: 108 };
const ENTRY_X = -ARENA.x + 60;      // là où la flotte débouche
const JUMP_X = ARENA.x - 70;        // la porte de saut
const JUMP_RADIUS = 62;             // rayon emporté par le saut
// Dimensionné pour le plus gros thème (NUÉE : 7 chasseurs). Le pool est
// pré-alloué une fois pour toutes et réutilisé de vague en vague.
const MAX_ENEMIES = 8;
const SHIELD_COLOR = 0xa97bff;
const REWARD = { fighter: 20, raider: 30, gunship: 70, carrier: 50 };

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/**
 * Arène de combat naval spatial : manœuvre 2D libre, vaisseaux qui s'orientent,
 * ennemis qui encerclent par vagues, intercepteurs autonomes des deux camps.
 */
export class Range {
  constructor(app) {
    this.app = app;
    this.scene = app.scene;
    this.camera = app.camera;
    this.ship = app.ship;
    this.audio = app.audio;

    this.aim = new AimController(this.camera, app.canvas);
    this.input = new InputController(
      (n) => this._onNumberKey(n),
      () => this._fireEmp(),
      () => { if (!this.over && this.stations.cycle()) this.audio.pickup(); },
      () => this._requestJump()
    );
    this.weapons = new WeaponControl(this.ship);
    // Anneau de passerelle (clic droit) : bascule de profil d'énergie
    this.ring = new CommandRing(
      (presetId) => this._setPowerPreset(presetId),
      () => this.stations.manned('command')
    );
    // Qui tient quel poste (le joueur en tient UN, l'équipage tient les autres)
    this.stations = new Stations();
    this.autoHelm = new AutoHelm();
    this.droneOrder = 'attack'; // consigne d'escadron : attack | escort | recall
    this.helmOrder = 'engage';  // consigne de conduite : engage | salvage | break
    this.hud = new Hud(document.getElementById('range-ui'));
    this.fx = new Fx(this.scene);
    this.shake = new ScreenShake(this.camera);

    // Pool d'ennemis (réutilisés d'une vague à l'autre)
    this.enemies = [];
    for (let i = 0; i < MAX_ENEMIES; i++) {
      const e = new EnemyShip();
      e.group.visible = false;
      this.scene.add(e.group);
      this.enemies.push(e);
    }

    // Décor du secteur : astéroïdes, épaves. Il COUPE les tirs, donc se placer
    // devient une décision (cf. Terrain).
    this.terrain = new Terrain(this.scene);

    // La flotte civile qu'on escorte : le véritable enjeu de la partie
    this.convoy = new Convoy(this.scene);
    this.ftl = new FtlDrive();
    this._buildJumpGate();
    this.soulsAtStart = totalSouls(FLEET);
    this.assaultTimer = 0;

    // Cuirassé : l'adversaire d'échelle, présent aux vagues « boss »
    this.capital = new CapitalShip();
    this.scene.add(this.capital.group);
    this._capCircles = [];
    this.camZoom = 1;      // recul de caméra courant
    this._camZoomWant = 1;

    this.playerDrones = [];
    this.enemyDrones = [];
    this.bolts = [];
    this.beams = [];
    this.pickups = [];
    this._pickupTimer = 8;

    this.wave = 0;          // vague dans le SECTEUR courant (1..sector.waves)
    this.sectorIndex = 0;   // avancement de la traversée
    this.waveTheme = null;
    this.jumping = false;   // saut inter-secteurs en cours
    this.jumpTimer = 0;
    this.assaultNo = 0;     // numéro d'assaut dans le secteur courant
    this._dramaT = 0;       // ralenti dramatique restant (s)
    this._dramaScale = 1;
    this.nextTheme = null;  // vague annoncée par le radar pendant la respiration
    this.betweenWaves = false;
    this.waveTimer = 0;
    this.over = false;
    this._playerTarget = { position: new THREE.Vector3(), radius: this.ship.collisionRadius, isPlayer: true };
    this._tmp = new THREE.Vector3();

    // Inertie (le vaisseau est lourd) : vitesse linéaire + vitesse angulaire
    this.shipVel = new THREE.Vector3();
    this.shipAngVel = 0;
    this._prevShield = 0;
    this._buildFlames();
    this._buildBoundary();
  }

  _buildBoundary() {
    this.boundary = new THREE.Group();
    const { x, y } = ARENA;
    const rect = [[-x, -y], [x, -y], [x, y], [-x, y]].map((p) => new THREE.Vector3(p[0], p[1], -1));
    this.boundary.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(rect), neonLineMat(0x2b6f86, 0.6)));
    // Accents de coin (plus lumineux) pour bien lire les limites
    const cl = 10;
    const corners = [[-x, -y, 1, 1], [x, -y, -1, 1], [x, y, -1, -1], [-x, y, 1, -1]];
    for (const [cx, cy, sx, sy] of corners) {
      const pts = [
        new THREE.Vector3(cx + sx * cl, cy, -1),
        new THREE.Vector3(cx, cy, -1),
        new THREE.Vector3(cx, cy + sy * cl, -1),
      ];
      this.boundary.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), neonLineMat(0x33ffff, 1)));
    }
    this.boundary.visible = false;
    this.terrain.setVisible(false);
    this.convoy.setVisible(false);
    this.jumpGate.visible = false;
    this.scene.add(this.boundary);
  }

  /** Porte de saut : le but du couloir, visible de loin. */
  _buildJumpGate() {
    this.jumpGate = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const r = JUMP_RADIUS - i * 16;
      const pts = [];
      for (let k = 0; k <= 48; k++) {
        const a = (k / 48) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * r * 0.35, Math.sin(a) * r, -2));
      }
      this.jumpGate.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        neonLineMat(0x8fdfff, 0.5 - i * 0.12)
      ));
    }
    this.jumpGate.position.x = JUMP_X;
    this.jumpGate.visible = false;
    this.scene.add(this.jumpGate);
  }

  _buildFlames() {
    const mk = (pts, color) => {
      const m = new THREE.Mesh(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
      );
      m.visible = false;
      return m;
    };
    // Flamme arrière (poussée avant) à la queue, pointant vers -X
    this.flameRear = mk([new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(-2.2, 0, 0)], 0xffaa44);
    this.flameRear.position.set(-7.2, 0, 0.05);
    // Petite flamme avant (rétro / marche arrière) à la proue, pointant vers +X
    this.flameFront = mk([new THREE.Vector3(0, 0.3, 0), new THREE.Vector3(0, -0.3, 0), new THREE.Vector3(1.4, 0, 0)], 0x66ccff);
    this.flameFront.position.set(7.1, 0, 0.05);
  }

  enter() {
    this.shake.setBase();
    this.ship.hull.setSlotsVisible(false);
    this.boundary.visible = true;
    this.terrain.setVisible(true);
    this.convoy.setVisible(true);
    this.jumpGate.visible = true;
    this.ship.group.add(this.flameRear);
    this.ship.group.add(this.flameFront);
    this.weapons.refresh();
    // Attention : le clic sur un module a son PROPRE callback. Le brancher sur
    // _onNumberKey ferait qu'un clic sur la pastille n°1 déclencherait la
    // commande n°1 du poste courant (bug : cliquer un module changeait le profil
    // d'énergie). Les chiffres appartiennent aux postes depuis la refonte.
    this.hud.build(
      this.weapons,
      this.ship,
      (n) => this._toggleModule(n),
      (id) => this.goToStation(id),
      (kind, id) => this.setOrder(kind, id)
    );
    this.aim.enable();
    this.input.enable();
    this.ring.enable(this.app.canvas);
    this._startGame();
  }

  exit() {
    this.aim.disable();
    this.input.disable();
    this.ring.disable();
    this.hud.clear();
    this._clearEntities();
    this.shake.reset();
    this.boundary.visible = false;
    this.terrain.setVisible(false);
    this.convoy.setVisible(false);
    this.jumpGate.visible = false;
    this.ship.group.remove(this.flameRear);
    this.ship.group.remove(this.flameFront);
    this.audio.engine(0);
    this.ship.group.visible = true;
    this.ship.group.position.set(0, 0, 0);
    this.ship.group.rotation.z = 0;
    this.app.save(); // persiste les crédits gagnés
  }

  _startGame() {
    this.over = false;
    this.aim.firing = false;
    this.wave = 0;
    this.assaultNo = 0;
    this.sectorIndex = 0;
    this.convoy.build(FLEET, ENTRY_X, ARENA.y * 1.2);
    this.convoy.lostSouls = 0;
    this.ftl.reset();
    this.jumping = false;
    this.jumpTimer = 0;
    this.waveTheme = null;
    this.ship.group.visible = true;
    // On escorte : on démarre AVEC la flotte, à l'entrée du couloir
    this.ship.group.position.set(ENTRY_X + 26, 0, 0);
    this.ship.group.rotation.z = 0;
    this.shipVel.set(0, 0, 0);
    this.shipAngVel = 0;
    this.ship.resetDefense();
    this.stations.reset();
    this.autoHelm.reset();
    this.weapons.setFireMode('burst');
    this._setDroneOrder('attack'); // escadron déployé d'emblée : la baie est payée
    this.terrain.build(this.sector.terrain, ARENA, { x: ENTRY_X, y: 0, r: 60 });
    this.helmOrder = 'engage';
    this.camZoom = 1;
    this._camZoomWant = 1;
    this._prevShield = this.ship.shield;
    this._clearEntities();
    this.hud.hideOutcome();
    this.hud.refreshStates();
    this._spawnWave(1);
  }

  _clearEntities() {
    for (const e of this.enemies) { e.state = 'dead'; e.group.visible = false; }
    this.capital.kill();
    for (const d of [...this.playerDrones, ...this.enemyDrones]) { this.scene.remove(d.group); d.dispose(); }
    this.playerDrones = [];
    this.enemyDrones = [];
    for (const p of this.pickups) { this.scene.remove(p.group); p.dispose(); }
    this.pickups = [];
    this._pickupTimer = 8;
    for (const arr of [this.bolts, this.beams]) for (const p of arr) { this.scene.remove(p.mesh); p.mesh.geometry.dispose(); }
    this.bolts = [];
    this.beams = [];
    this.fx.clear();
  }

  get sector() { return sectorAt(this.sectorIndex); }

  /** Thèmes autorisés : le caractère du secteur restreint l'opposition. */
  get _allowedThemes() {
    return this.sector.themes || Object.keys(WAVE_THEMES);
  }

  /** Progression sur la TRAVERSÉE entière (0 → 1) : débloque les thèmes lourds. */
  _progress() {
    return Math.min(1, (this.sectorIndex + Math.min(1, this.assaultNo / 4)) / Math.max(1, SECTOR_COUNT));
  }

  /** Plus de « vague boss » : le basestar arrive pendant un assaut (cf. _launchAssault). */
  _isCapitalWave() { return false; }

  /**
   * Choisit à l'avance le thème de la prochaine vague pour que le radar puisse
   * l'annoncer. `_composeWave` réutilisera ce choix.
   */
  _announceNextWave() {
    this.nextTheme = pickTheme(this._allowedThemes, this._progress(), this.waveTheme?.id);
    this.audio.ping?.();
  }

  /**
   * Compose la vague par THÈME et non par « n ennemis + PV en plus ». C'est ce
   * qui fait qu'une vague tardive ne ressemble pas à une vague précoce gonflée.
   */
  _composeWave(n) {
    if (this._isCapitalWave(n)) {
      this.waveTheme = CAPITAL_THEME;
      return CAPITAL_THEME.comp.slice(0, MAX_ENEMIES);
    }
    const theme = this.nextTheme || pickTheme(this._allowedThemes, this._progress(), this.waveTheme?.id);
    this.nextTheme = null;
    this.waveTheme = theme;
    return theme.comp.slice(0, MAX_ENEMIES);
  }

  /**
   * Un assaut cylon. Ils apparaissent DEVANT et AUTOUR de la flotte (pas autour
   * du joueur) : c'est elle qu'ils viennent chercher, et ça oblige à se
   * déployer au lieu de rester collé au convoi.
   */
  _launchAssault() {
    this.assaultNo++;
    this.wave = this.assaultNo;          // conservé pour le HUD et le Hall of Fame
    const types = this._composeWave(this.assaultNo);
    const scale = 1 + this.sectorIndex * 0.35;
    const baseHp = Math.round((42 + this.assaultNo * 6) * scale);
    const baseDmg = +((3.4 + this.assaultNo * 0.5) * scale).toFixed(1);
    const drones = Math.min(this.sectorIndex, 2);

    // Point de référence : la tête de la flotte
    const head = this.convoy.alive.reduce((a, t) => (t.position.x > a.position.x ? t : a), this.convoy.alive[0]);
    const hx = head ? head.position.x : this.ship.group.position.x;
    const hy = head ? head.position.y : 0;

    let slot = 0;
    for (const type of types) {
      const e = this.enemies[slot++];
      if (!e) break;
      const t = ENEMY_TYPES[type];
      // Ils arrivent surtout par l'avant et les flancs : la flotte va vers eux.
      const ahead = Math.random() < 0.7;
      const pos = new THREE.Vector3(
        THREE.MathUtils.clamp(hx + (ahead ? 1 : -1) * (70 + Math.random() * 40), -ARENA.x + 8, ARENA.x - 8),
        THREE.MathUtils.clamp(hy + (Math.random() * 2 - 1) * ARENA.y * 0.9, -ARENA.y + 6, ARENA.y - 6),
        0
      );
      e.group.visible = true;
      e.spawn(pos, {
        type,
        hp: Math.round(baseHp * t.hpMul),
        damage: +(baseDmg * t.dmgMul).toFixed(1),
        droneCount: type === 'carrier' ? drones + t.bonusDrones : (type === 'raider' ? drones : 0),
      });
    }

    if (this.sector.capital && this.assaultNo === 2 && !this.capital.alive) {
      const pos = new THREE.Vector3(
        THREE.MathUtils.clamp(hx + 150, -ARENA.x + 30, ARENA.x - 30),
        THREE.MathUtils.clamp(hy + (Math.random() * 2 - 1) * 40, -ARENA.y + 14, ARENA.y - 14), 0
      );
      this.capital.spawn(pos, 1 + this.sectorIndex * 0.3);
      this.hud.showWaveBanner(0, `⚠ BASESTAR — ${this.capital.batteries.length} batteries`);
      this.audio.lose();
      this.shake.add(0.5);
      this.app.renderer.pulse(1);
    } else {
      this.hud.showWaveBanner(0, `ASSAUT ${this.assaultNo} · ${this.waveTheme.name}`);
      this.audio.ping?.();
    }
    this.nextTheme = null;
  }

  _spawnWave(n) {
    this.wave = n;
    this.betweenWaves = false;
    const baseHp = 45 + n * 12;
    const baseDmg = 4 + n;
    const baseDrones = Math.min(Math.max(n - 1, 0), 2);
    const types = this._composeWave(n);
    const px = this.ship.group.position.x, py = this.ship.group.position.y;
    types.forEach((type, i) => {
      const t = ENEMY_TYPES[type];
      // apparition HORS-CHAMP : loin autour du joueur (au-delà du bord visible)
      const a = (i / types.length) * Math.PI * 2 + Math.random() * 0.8;
      const dist = TUNE.spawnDist + Math.random() * 18;
      const pos = new THREE.Vector3(
        THREE.MathUtils.clamp(px + Math.cos(a) * dist, -ARENA.x + 4, ARENA.x - 4),
        THREE.MathUtils.clamp(py + Math.sin(a) * dist, -ARENA.y + 4, ARENA.y - 4),
        0
      );
      let drones = 0;
      if (type === 'raider') drones = baseDrones;
      else if (type === 'carrier') drones = baseDrones + t.bonusDrones;
      const e = this.enemies[i];
      e.group.visible = true;
      e.spawn(pos, { type, hp: Math.round(baseHp * t.hpMul), damage: +(baseDmg * t.dmgMul).toFixed(1), droneCount: drones });
    });

    if (this._isCapitalWave(n)) {
      // Il arrive de loin, par le flanc : on le voit venir, c'est le but.
      const a = Math.random() * Math.PI * 2;
      const d = 120;
      const pos = new THREE.Vector3(
        THREE.MathUtils.clamp(px + Math.cos(a) * d, -ARENA.x + 30, ARENA.x - 30),
        THREE.MathUtils.clamp(py + Math.sin(a) * d, -ARENA.y + 14, ARENA.y - 14),
        0
      );
      this.capital.spawn(pos, 1 + (n / 5 - 1) * 0.45); // plus coriace à chaque fois
      this.hud.showWaveBanner(n, `⚠ CUIRASSÉ — ${this.capital.batteries.length} batteries`);
      this.audio.lose(); // grondement grave : le contact est annoncé
      this.app.renderer.pulse(1.0);
      this.shake.add(0.5);
    } else {
      this.hud.showWaveBanner(n, `${this.sector.name} · ${this.waveTheme.name}`);
    }
  }

  /**
   * Touches 1/2/3 : commandes du POSTE COURANT (chaque poste a les siennes).
   * Les modules se togglent au clic sur leur chip.
   */
  _onNumberKey(n) {
    if (this.over) return;
    const st = this.stations.current;
    if (st === 'command') {
      const p = POWER_PRESETS[n - 1];
      if (p) { this._setPowerPreset(p.id); return; }
      // Au-delà des profils : le calcul de saut. Le forcer va 2,4× plus vite mais
      // ponctionne l'énergie des armes et des boucliers — c'est l'arbitrage
      // central du jeu : gagner du temps contre la capacité à encaisser.
      const m = FTL_MODES[n - 1 - POWER_PRESETS.length];
      if (m && this.ftl.setMode(m.id)) this.audio.relay();
    } else if (st === 'gunnery') {
      const mode = FIRE_MODES[n - 1];
      if (mode) this.setOrder('gunnery', mode.id);
    } else if (st === 'drones') {
      const order = DRONE_ORDERS[n - 1];
      if (order) this.setOrder('drones', order.id);
    } else if (st === 'helm') {
      const order = HELM_ORDERS[n - 1];
      if (order) this.setOrder('helm', order.id);
    }
    this.hud.refreshStates();
  }

  /**
   * Pose une CONSIGNE. Recevable depuis le poste concerné (aux chiffres) OU
   * depuis la console du commandant (au clic) : donner des directives à son
   * équipage est précisément le métier du commandant — sinon il devrait descendre
   * à la barre pour dire au barreur quoi faire, ce qui n'a aucun sens.
   * Ce que le commandant ne peut PAS faire à distance, c'est exécuter : barrer,
   * viser, désigner une cible.
   */
  setOrder(kind, id) {
    if (this.over) return false;
    const post = kind === 'helm' ? 'helm' : kind === 'gunnery' ? 'gunnery' : 'drones';
    if (!this.stations.manned('command') && !this.stations.manned(post)) {
      this.hud.showWaveBanner(this.wave, 'ORDRE — console du commandant');
      return false;
    }
    let ok = false;
    if (kind === 'helm' && HELM_ORDERS.some((o) => o.id === id)) { this.helmOrder = id; ok = true; }
    else if (kind === 'gunnery') ok = this.weapons.setFireMode(id);
    else if (kind === 'drones' && DRONE_ORDERS.some((o) => o.id === id)) { this._setDroneOrder(id); ok = true; }
    if (ok) this.audio.relay();
    return ok;
  }

  /**
   * Consigne d'escadron. Elle pilote aussi le DÉPLOIEMENT : sans ça, donner un
   * ordre à des drones restés au hangar n'aurait aucun effet visible (les baies
   * sont rangées par défaut, cf. `Ship.mount`).
   */
  _setDroneOrder(id) {
    this.droneOrder = id;
    const deploy = id !== 'recall'; // REPLI = ils rentrent à la baie
    for (const m of this.ship.modules) if (m.defId === 'interceptor') m.setActive(deploy);
    this.hud.refreshStates();
  }

  /**
   * Activation / coupure d'un module (clic sur sa pastille). Comme l'énergie,
   * c'est une prérogative du commandant : le garde-fou sert aussi pendant un
   * transit, où le cockpit reste affiché mais où le poste est VACANT.
   */
  _toggleModule(n) {
    if (this.over) return;
    if (!this.stations.manned('command')) {
      this.hud.showWaveBanner(this.wave, 'MODULES — console du commandant');
      return;
    }
    this.weapons.toggle(n);
    this.hud.refreshStates();
  }

  /**
   * ORDRE DE SAUT (touche J). Quand le calcul est prêt, la flotte part — et
   * n'emporte que ce qui est dans le rayon. Sauter tôt, c'est abandonner les
   * traînards : c'est la décision de la série, et elle doit être explicitement
   * prise par le joueur, pas subie.
   */
  _requestJump() {
    if (this.over || this.jumping) return;
    if (!this.stations.manned('command')) {
      this.hud.showWaveBanner(0, 'SAUT — console du commandant');
      return;
    }
    if (!this.ftl.ready) {
      this.hud.showWaveBanner(0, `CALCUL INCOMPLET — ${Math.floor(this.ftl.charge)}%`);
      return;
    }
    const laggard = this.convoy.laggard;
    const behind = laggard && laggard.position.x < JUMP_X - JUMP_RADIUS;
    if (behind) this.hud.showWaveBanner(0, `⚠ SAUT SANS ${laggard.name.toUpperCase()}`);
    this._beginJump();
  }

  /** Rejoindre un poste (clic sur l'icône, ou Tab pour cycler). */
  goToStation(id) {
    if (this.over) return;
    if (this.stations.goTo(id)) this.audio.pickup();
  }

  /**
   * Vitesse du temps : ralenti tant que l'anneau de passerelle est ouvert.
   * Lu par App._loop, qui met le dt à l'échelle avant d'appeler update().
   */
  get timeScale() {
    // Ralenti dramatique (destruction d'un cuirassé, mort) : l'épique est un
    // CONTRASTE, il faut suspendre le temps sur les moments qui comptent.
    if (this._dramaT > 0) return this._dramaScale;
    return this.ring.isOpen && !this.over ? TUNE.slowMoScale : 1;
  }

  /** Suspend le temps quelques instants pour laisser voir ce qui vient de se passer. */
  drama(scale, duration) {
    this._dramaScale = scale;
    this._dramaT = duration;
  }

  /**
   * Bascule de profil d'énergie. Prérogative du COMMANDANT : c'est ce qui fait
   * de sa console un poste et non un menu accessible de partout.
   */
  _setPowerPreset(id) {
    if (this.over) return;
    if (!this.stations.manned('command')) {
      this.hud.showWaveBanner(this.wave, 'ÉNERGIE — console du commandant');
      return;
    }
    if (!this.ship.power.setPreset(id)) return;
    this.audio.relay();
    this.app.renderer.pulse(0.35);
  }

  // IEM : détruit les drones ennemis proches + paralyse les vaisseaux dans le rayon.
  // C'est un système du vaisseau, donc une prérogative du COMMANDANT : il faut
  // être à sa console pour le déclencher.
  _fireEmp() {
    if (this.over) return;
    if (!this.stations.manned('command')) {
      this.hud.showWaveBanner(this.wave, 'IEM — console du commandant');
      return;
    }
    const emp = this.ship.modules.find((m) => m.defId === 'emp' && m.ready());
    if (!emp) return;
    emp.trigger();
    const pos = this.ship.group.position;
    const R = emp.radius * TUNE.empRangeMul; // portée réglable via T
    this.fx.ring(pos, 0x8fdfff, R);
    this.fx.ring(pos, 0xffffff, R * 0.6);
    this.fx.flash(pos, 0x8fdfff, 4);
    this.audio.emp();
    this.shake.add(0.35);
    this.app.renderer.pulse(0.9);
    // drones ennemis détruits
    for (const d of this.enemyDrones) {
      if (d.isAlive() && d.position.distanceTo(pos) <= R) d.takeDamage(999);
    }
    // vaisseaux ennemis paralysés
    for (const e of this.aliveEnemies) {
      if (e.group.position.distanceTo(pos) <= R) e.stun(emp.stun);
    }
  }

  get aliveEnemies() { return this.enemies.filter((e) => e.state === 'alive'); }

  _nearestEnemy() {
    let best = null, bd = Infinity;
    for (const e of this.aliveEnemies) {
      const d = e.group.position.distanceToSquared(this.ship.group.position);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // ---------- projectiles ----------
  spawnBolt(pos, dir, damage, faction, color, opts = {}) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.6, 0, 0), new THREE.Vector3(0.6, 0, 0)]);
    const mesh = new THREE.Line(geo, neonLineMat(color, 1));
    mesh.position.copy(pos);
    mesh.rotation.z = Math.atan2(dir.y, dir.x);
    this.scene.add(mesh);
    this.bolts.push({
      mesh, dir: dir.clone(), speed: opts.speed || 26, traveled: 0,
      range: opts.range || 55, damage, faction, color, kind: opts.kind || 'bolt',
    });
  }

  spawnMissile(pos, dir, stats) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.5, 0, 0), new THREE.Vector3(0.5, 0, 0),
      new THREE.Vector3(0.15, 0.18, 0), new THREE.Vector3(0.15, -0.18, 0),
    ]);
    const mesh = new THREE.LineSegments(geo, neonLineMat(stats.color, 1));
    mesh.position.copy(pos);
    mesh.rotation.z = Math.atan2(dir.y, dir.x);
    this.scene.add(mesh);
    this.bolts.push({
      mesh, dir: dir.clone(), speed: stats.speed, traveled: 0, range: stats.range,
      damage: stats.damage, faction: 'player', color: stats.color, kind: 'missile', trailT: 0,
    });
    this.fx.flash(pos, stats.color, 0.9);
    this.audio.launch();
    this.shake.add(0.03);
  }

  fireLaser(pos, dir, damage, range, color) {
    const hit = this._nearestHostileHit(pos, dir, range);
    // Un rocher sur le trajet arrête le faisceau AVANT la cible : sans ça on
    // tirerait à travers le décor et se mettre à couvert ne servirait à rien.
    const rock = this.terrain.rayHit(pos.x, pos.y, dir.x, dir.y, hit ? pos.distanceTo(hit.point) : range);
    if (rock) {
      const end = pos.clone().addScaledVector(dir, rock.t);
      const beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([pos.clone(), end]), neonLineMat(color, 1));
      this.scene.add(beam);
      this.beams.push({ mesh: beam, ttl: 0.06 });
      this.fx.sparks(end, 0xbba98f, 4);
      this.audio.hit();
      return;
    }
    const end = hit ? hit.point : pos.clone().addScaledVector(dir, range);
    const geo = new THREE.BufferGeometry().setFromPoints([pos.clone(), end]);
    const beam = new THREE.Line(geo, neonLineMat(color, 1));
    this.scene.add(beam);
    this.beams.push({ mesh: beam, ttl: 0.06 });
    this.fx.flash(pos, color, 0.7);
    this.audio.zap();
    this.shake.add(0.012);
    if (hit) {
      hit.entity.takeDamage(damage);
      this.fx.sparks(hit.point, color, 5);
      this.audio.hit();
      this.shake.add(0.03);
    }
  }

  _hostilesForPlayer() {
    const list = [];
    for (const e of this.enemies) if (e.state === 'alive') list.push(e);
    for (const d of this.enemyDrones) if (d.isAlive()) list.push(d);
    // Chaque pièce du cuirassé est une cible à part entière : c'est ce qui permet
    // de le démonter batterie par batterie plutôt que de « vider un sac de PV ».
    if (this.capital.alive) for (const p of this.capital.parts) if (p.alive) list.push(p);
    return list;
  }

  _nearestHostileTo(pos) {
    let best = null, bd = Infinity;
    for (const t of this._hostilesForPlayer()) {
      const d = pos.distanceToSquared(t.position);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  /**
   * Drone ennemi vivant le plus proche (dans `maxDist` s'il est fourni).
   * Cible exclusive de la défense rapprochée et des intercepteurs : le laser,
   * lui, renonce toujours sur des cibles aussi petites et vives.
   */
  _nearestEnemyDroneTo(pos, maxDist = Infinity) {
    let best = null, bd = maxDist * maxDist;
    for (const d of this.enemyDrones) {
      if (!d.isAlive()) continue;
      const dd = pos.distanceToSquared(d.position);
      if (dd < bd) { bd = dd; best = d; }
    }
    return best;
  }

  _nearestHostileHit(O, D, range) {
    let best = null, bt = Infinity;
    for (const t of this._hostilesForPlayer()) {
      const C = t.position;
      const R = t.radius;
      this._tmp.copy(C).sub(O);
      const tca = this._tmp.dot(D);
      if (tca < 0) continue;
      const d2 = this._tmp.lengthSq() - tca * tca;
      if (d2 > R * R) continue;
      const t0 = tca - Math.sqrt(R * R - d2);
      if (t0 > range || t0 > bt) continue;
      bt = t0;
      best = { point: O.clone().addScaledVector(D, t0), entity: t };
    }
    return best;
  }

  _updateBolts(dt) {
    // Garde-fou : plafonne le nombre de projectiles (anti-emballement)
    while (this.bolts.length > 180) {
      const o = this.bolts.shift();
      this.scene.remove(o.mesh); o.mesh.geometry.dispose();
    }
    // faisceaux laser (éphémères)
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.ttl -= dt;
      b.mesh.material.opacity = Math.max(0, b.ttl / 0.06);
      if (b.ttl <= 0) { this.scene.remove(b.mesh); b.mesh.geometry.dispose(); this.beams.splice(i, 1); }
    }

    this._playerTarget.position.copy(this.ship.group.position);
    // Bouclier actif => les tirs sont interceptés au bord de la bulle
    this._playerTarget.radius = this.ship.shieldUp ? TUNE.shieldRadius : this.ship.collisionRadius;

    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      // Missiles joueur : TÊTE CHERCHEUSE (oriente vers l'ennemi le plus proche)
      if (b.kind === 'missile' && b.faction === 'player') {
        const tgt = this._nearestHostileTo(b.mesh.position);
        if (tgt) {
          this._tmp.copy(tgt.position).sub(b.mesh.position); this._tmp.z = 0;
          if (this._tmp.lengthSq() > 0.0001) {
            const des = Math.atan2(this._tmp.y, this._tmp.x);
            const cur = Math.atan2(b.dir.y, b.dir.x);
            const na = lerpAngle(cur, des, Math.min(1, dt * 3.5)); // agilité du virage
            b.dir.set(Math.cos(na), Math.sin(na), 0);
            b.mesh.rotation.z = na;
          }
        }
      }
      const step = b.speed * dt;
      b.mesh.position.addScaledVector(b.dir, step);
      b.traveled += step;
      if (b.kind === 'missile') {
        b.trailT -= dt;
        if (b.trailT <= 0) { this.fx.trailDot(b.mesh.position, b.color); b.trailT = 0.05; }
      }

      // Impact sur le décor : le projectile meurt là, quelle que soit sa faction
      const rock = this.terrain.blocksPoint(b.mesh.position.x, b.mesh.position.y);
      if (rock) {
        if (b.kind === 'missile') { this.fx.explosion(b.mesh.position, b.color, 0.8); this.audio.boom(0.5); }
        else this.fx.sparks(b.mesh.position, 0xbba98f, 3);
        this.scene.remove(b.mesh); b.mesh.geometry.dispose(); this.bolts.splice(i, 1);
        continue;
      }

      let hitEntity = null;
      const targets = b.faction === 'player'
        ? this._hostilesForPlayer()
        : [this._playerTarget, ...this.playerDrones.filter((d) => d.isAlive())];
      for (const t of targets) {
        if (b.mesh.position.distanceTo(t.position) < (t.radius || 0.8)) { hitEntity = t; break; }
      }

      let done = false;
      if (hitEntity && !this.over) {
        let impactColor = b.color;
        if (hitEntity.isPlayer) {
          const wasShield = this.ship.shieldUp;
          this.ship.takeDamage(b.damage);
          if (wasShield) { impactColor = SHIELD_COLOR; this.shake.add(0.06); } // absorbé par le bouclier
          else { this.hud.flashDamage(0.45); this.shake.add(0.16); }           // touche la coque
        } else {
          hitEntity.takeDamage(b.damage);
        }
        if (b.kind === 'missile') {
          this.fx.explosion(b.mesh.position, impactColor, 1);
          this.audio.boom(0.7); this.shake.add(0.2); this.app.renderer.pulse(0.5);
        } else {
          this.fx.sparks(b.mesh.position, impactColor, 5);
          this.audio.hit();
        }
        done = true;
      }
      if (b.traveled > b.range) done = true;
      if (done) { this.scene.remove(b.mesh); b.mesh.geometry.dispose(); this.bolts.splice(i, 1); }
    }
  }

  // ---------- drones ----------
  _updateDrones(dt) {
    const nearest = this._nearestEnemy();
    const spawnBolt = (p, d, dm, f, c) => this.spawnBolt(p, d, dm, f, c, { speed: 32, range: 26 });

    // drones joueur : nombre = baies actives ; ciblent le plus proche ennemi
    const want = this.ship.activeInterceptorCount;
    for (let i = this.playerDrones.length - 1; i >= 0; i--) {
      if (!this.playerDrones[i].isAlive()) {
        const d = this.playerDrones[i];
        this.fx.explosion(d.position, d.color, 0.6);
        this.scene.remove(d.group); d.dispose();
        this.playerDrones.splice(i, 1);
      }
    }
    while (this.playerDrones.length < want) {
      const d = new Drone('player', 0x66ff99, this._jitter(this.ship.group.position));
      this.scene.add(d.group);
      this.playerDrones.push(d);
    }
    while (this.playerDrones.length > want) {
      const d = this.playerDrones.pop();
      this.scene.remove(d.group); d.dispose();
    }
    // Consigne d'escadron. Elle PERSISTE quand le joueur quitte le poste :
    // l'équipage l'applique sans jamais l'adapter, ce qui est exactement le coût
    // de ne pas être là (laisse ESCORTE en place et personne ne réagira).
    let dTargetPos = null, dTargetAlive = false;
    // EXÉCUTION du poste DRONES : au poste, tu DÉSIGNES la cible de l'escadron
    // (le curseur choisit), y compris une batterie précise du cuirassé. La
    // consigne seule les envoie sur le plus proche — c'est là toute la différence
    // entre commander l'escadron et le conduire.
    this.designated = null;
    if (this.stations.manned('drones') && this.droneOrder !== 'recall') {
      const t = this._nearestHostileTo(this.aim.point);
      if (t) {
        this.designated = t;
        dTargetPos = t.position;
        dTargetAlive = true;
      }
    }
    if (!dTargetAlive && this.droneOrder !== 'recall') {
      // PRIORITÉ ABSOLUE aux drones ennemis : ce sont des INTERCEPTEURS, c'est
      // littéralement leur rôle — et le laser ne peut pas s'en charger (une cible
      // de rayon 1.3 filant à 17 met la conduite de tir humaine en échec).
      // Le périmètre est plus serré en ESCORTE : ils ne partent pas à la chasse.
      const reach = this.droneOrder === 'escort' ? 30 : 55;
      const threat = this._nearestEnemyDroneTo(this.ship.group.position, reach);
      if (threat) {
        dTargetPos = threat.position;
        dTargetAlive = true;
      } else if (this.droneOrder === 'attack' && nearest) {
        dTargetPos = nearest.group.position;
        dTargetAlive = true;
      } else if (this.droneOrder === 'escort' && nearest
                 && nearest.group.position.distanceTo(this.ship.group.position) < 30) {
        // Défense de périmètre : n'engage un vaisseau que s'il s'approche.
        dTargetPos = nearest.group.position;
        dTargetAlive = true;
      }
    }
    // REPLI : aucune cible => les drones rentrent au bercail et ne tirent pas.
    for (const d of this.playerDrones) {
      d.update(dt, {
        targetPos: dTargetPos,
        targetAlive: dTargetAlive,
        ownerPos: this.ship.group.position,
        spawnBolt,
      });
    }

    // drones ennemis : par ennemi vivant, ciblent le joueur
    for (let i = this.enemyDrones.length - 1; i >= 0; i--) {
      const d = this.enemyDrones[i];
      if (!d.isAlive() || !d.owner || d.owner.state !== 'alive') {
        if (!d.isAlive()) this.fx.explosion(d.position, d.color, 0.6);
        this.scene.remove(d.group); d.dispose();
        this.enemyDrones.splice(i, 1);
      }
    }
    const spawnEnemyDrone = (e) => {
      const d = new Drone('enemy', e.color, this._jitter(e.group.position));
      d.owner = e;
      this.scene.add(d.group);
      this.enemyDrones.push(d);
    };
    for (const e of this.aliveEnemies) {
      if (!e.droneCount) continue;
      const have = this.enemyDrones.filter((d) => d.owner === e).length;
      if (!e._dronesDeployed) {
        // Déploiement initial complet de l'escadron
        for (let k = have; k < e.droneCount; k++) spawnEnemyDrone(e);
        e._dronesDeployed = true;
        e._droneCd = 6;
      } else if (have < e.droneCount) {
        // Reconstruction LENTE des drones abattus (1 toutes les 6 s)
        e._droneCd -= dt;
        if (e._droneCd <= 0) { spawnEnemyDrone(e); e._droneCd = 6; }
      }
    }
    const barrier = this.ship.shieldUp ? TUNE.shieldRadius : 0; // bulle infranchissable
    for (const d of this.enemyDrones) {
      d.update(dt, {
        targetPos: this.ship.group.position,
        targetAlive: !this.over,
        ownerPos: d.owner.group.position,
        spawnBolt,
        barrier,
      });
    }
  }

  // ---------- bonus (caisses munitions / kits réparation) ----------
  _updatePickups(dt) {
    this._pickupTimer -= dt;
    if (this._pickupTimer <= 0 && this.pickups.length < 4) {
      this._spawnPickup();
      this._pickupTimer = TUNE.pickupEvery + (Math.random() * 6 - 3);
    }
    const p0 = this.ship.group.position;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      const alive = p.update(dt);
      const dist = Math.hypot(p.position.x - p0.x, p.position.y - p0.y);
      if (dist < this.ship.collisionRadius + p.radius) {
        this._collectPickup(p);
        this.scene.remove(p.group); p.dispose(); this.pickups.splice(i, 1);
      } else if (!alive) {
        this.scene.remove(p.group); p.dispose(); this.pickups.splice(i, 1);
      }
    }
  }

  _spawnPickup() {
    const type = Math.random() < 0.5 ? 'ammo' : 'repair';
    const a = Math.random() * Math.PI * 2;
    const d = 22 + Math.random() * 20;
    const p0 = this.ship.group.position;
    const pos = new THREE.Vector3(
      THREE.MathUtils.clamp(p0.x + Math.cos(a) * d, -ARENA.x + 3, ARENA.x - 3),
      THREE.MathUtils.clamp(p0.y + Math.sin(a) * d, -ARENA.y + 3, ARENA.y - 3),
      0
    );
    const p = new Pickup(type, pos, TUNE.pickupLife);
    this.scene.add(p.group);
    this.pickups.push(p);
  }

  _collectPickup(p) {
    if (p.type === 'ammo') {
      for (const m of this.ship.modules) if (m.reload) m.reload(); // recharge les missiles
    } else {
      this.ship.structure = Math.min(this.ship.structureMax, this.ship.structure + TUNE.repairAmount); // répare la coque
    }
    this.fx.ring(p.position, p.color, 4);
    this.fx.sparks(p.position, p.color, 10);
    this.audio.pickup();
    this.shake.add(0.08);
  }

  /** Caisse la plus proche (consigne RÉCUPÉRER du barreur). */
  _nearestPickup() {
    let best = null, bd = Infinity;
    const p = this.ship.group.position;
    for (const pk of this.pickups) {
      const d = pk.position.distanceToSquared(p);
      if (d < bd) { bd = d; best = pk; }
    }
    return best;
  }

  _jitter(pos) {
    return new THREE.Vector3(pos.x + (Math.random() - 0.5) * 3, pos.y + (Math.random() - 0.5) * 3, 0);
  }

  // ---------- collision vaisseaux ----------
  _resolveCollisions(dt) {
    const a = this.ship.group.position;
    for (const e of this.aliveEnemies) {
      const b = e.group.position;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      const min = this.ship.collisionRadius + e.collisionRadius;
      if (dist < min) {
        const push = min - dist, nx = dx / dist, ny = dy / dist;
        b.x += nx * push; b.y += ny * push;
        this.ship.takeDamage(14 * dt);
        e.takeDamage(14 * dt);
        this.shake.add(0.06);
      }
    }
    // Décor : le joueur est repoussé et racle sa coque ; les ennemis contournent.
    if (this.terrain.push(a, this.ship.collisionRadius)) {
      this.ship.takeDamage(10 * dt);
      this.shake.add(0.05);
    }
    for (const e of this.aliveEnemies) this.terrain.push(e.group.position, e.collisionRadius);

    // Coque du cuirassé : plusieurs cercles le long de l'axe (46 unités de long,
    // une seule sphère collerait très mal). Elle ne bouge pas : c'est le joueur
    // qui est repoussé.
    if (this.capital.alive) {
      const circles = this.capital.collisionCircles(this._capCircles);
      for (const c of circles) {
        const dx = a.x - c.x, dy = a.y - c.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const min = this.ship.collisionRadius + c.r;
        if (dist < min) {
          const push = min - dist;
          a.x += (dx / dist) * push;
          a.y += (dy / dist) * push;
          this.ship.takeDamage(18 * dt);
          this.shake.add(0.1);
        }
      }
    }
  }

  /**
   * Fin de secteur : on saute. C'est la respiration de la traversée — l'équipage
   * répare, on encaisse la prime, et le secteur suivant a son propre caractère.
   */
  _beginJump() {
    this.betweenWaves = false;
    this.ftl.jumping = true;
    // Le saut n'emporte que ce qui est dans son rayon : les traînards restent.
    // C'est la décision de la série — partir maintenant, ou attendre sous le feu.
    const out = this.convoy.jump(JUMP_X, JUMP_RADIUS);
    this.jumping = true;
    this.jumpTimer = 4.6;
    this._clearEntities();
    this.ship.structure = Math.min(this.ship.structureMax, this.ship.structure + JUMP_REPAIR.structure);
    if (JUMP_REPAIR.ammo) for (const m of this.ship.modules) if (m.reload) m.reload();
    this.app.addCredits(JUMP_REPAIR.credits);
    this.audio.pickup();
    this.app.renderer.pulse(1);
    this.shake.add(0.6);
    this.drama(0.4, 1.2);

    const last = this.sectorIndex + 1 >= SECTOR_COUNT;
    this.hud.showJump(this.sector, last ? null : sectorAt(this.sectorIndex + 1), {
      ...JUMP_REPAIR,
      saved: out.saved.length,
      left: out.left,
      souls: this.convoy.souls,
      lost: this.convoy.lostSouls,
    });
  }

  /** Arrivée : nouveau couloir, la flotte ressort à l'entrée, le calcul repart. */
  _arriveSector() {
    this.jumping = false;
    this.ftl.jumping = false;
    if (this.sectorIndex + 1 >= SECTOR_COUNT) { this._win(); return; }
    this.sectorIndex++;
    this.wave = 0;
    this.assaultNo = 0;
    this.waveTheme = null;
    this.nextTheme = null;
    this.ftl.reset();
    // Le calcul du saut suivant est plus long : la pression monte sans qu'on
    // ait besoin de gonfler les PV.
    this.convoy.redeploy(ENTRY_X, ARENA.y * 1.2);
    this.ship.group.position.set(ENTRY_X + 26, 0, 0);
    this.shipVel.set(0, 0, 0);
    this.shipAngVel = 0;
    this.terrain.build(this.sector.terrain, ARENA, { x: ENTRY_X, y: 0, r: 60 });
    this.assaultTimer = Math.min(10, this.sector.assaultEvery * 0.5);
    this.hud.hideJump();
    this.hud.showSector(this.sector, this.sectorIndex + 1, SECTOR_COUNT);
  }

  /** Traversée achevée : la victoire que `_end(type)` n'a jamais reçue. */
  _win() {
    this.over = true;
    this.aim.firing = false;
    this.ring.cancel();
    this.stations.reset();
    this.audio.win();
    this.app.renderer.pulse(1);
    const hof = HallOfFame.add(SECTOR_COUNT, this.app.credits);
    const souls = this.convoy.souls;
    this.hud.showOutcome('victory',
      `Refuge atteint — ${souls.toLocaleString('fr-FR')} survivants sur ${this.soulsAtStart.toLocaleString('fr-FR')}`,
      () => this._startGame(), () => this.app.toggleScreen(), hof);
  }

  /** Le cuirassé n'a plus une seule pièce : il part en morceaux, longuement. */
  _destroyCapital() {
    const cfg = this.capital.config;
    const rot = this.capital.group.rotation.z;
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const p0 = this.capital.group.position;
    // Chapelet d'explosions le long de la coque : l'échelle doit se sentir aussi
    // dans la destruction (une seule boule pour 46 unités serait ridicule).
    for (let i = 0; i < 9; i++) {
      const lx = -22 + i * 5.5;
      const pos = new THREE.Vector3(p0.x + lx * cos, p0.y + lx * sin, 0);
      this.fx.explosion(pos, cfg.color, 2.2);
      this.fx.debris(pos, cfg.color, 16, 1.6);
    }
    this.audio.boom(1.4);
    this.audio.win();
    this.drama(0.32, 1.8); // on regarde le colosse se démonter
    this.shake.add(1.0);
    this.app.renderer.pulse(1.0);
    this.app.addCredits(cfg.reward);
    this.hud.showWaveBanner(this.wave, `${cfg.name} DÉTRUIT · +${cfg.reward} ◈`);
    this.capital.kill();
  }

  _end(type) {
    this.over = true;
    this.aim.firing = false;
    this.ring.cancel();
    this.stations.reset();
    // La baleine éclate en débris (elle ne reste pas entière)
    this.ship.group.visible = false;
    this.fx.explosion(this.ship.group.position, 0x3df0ff, 2.6);
    this.fx.debris(this.ship.group.position, 0x3df0ff, 22, 1.4);
    this.audio.lose();
    this.audio.boom(1.3);
    this.drama(0.28, 2.2); // sa propre fin mérite d'être vue
    this.hud.flashDamage(0.9);
    this.shake.add(0.85);
    this.app.renderer.pulse(1.0);
    const hof = HallOfFame.add(this.sectorIndex + 1, this.app.credits);
    const sub = type === 'lost-fleet'
      ? 'La flotte a été anéantie — il n\'y a plus personne à sauver'
      : `Perdu au secteur ${this.sectorIndex + 1} — ${this.convoy.souls.toLocaleString('fr-FR')} survivants abandonnés`;
    this.hud.showOutcome('defeat', sub, () => this._startGame(), () => this.app.toggleScreen(), hof);
  }

  _updateHud(dt = 0) {
    const radar = this.ship.getActiveRadar();
    const nearest = this._nearestEnemy();
    this.hud.setPlayer(this.ship);
    this.hud.setStations(this.stations);
    this.hud.setSolution(this.weapons.solution);
    this.hud.setCapital(this.capital);
    // Commandes du poste courant (1/2/3)
    const st = this.stations.current;
    if (st === 'command') {
      this.hud.setCommands(st, [...POWER_PRESETS, ...FTL_MODES],
        this.ship.power.presetId, this.ftl.modeId);
    }
    else if (st === 'gunnery') this.hud.setCommands(st, FIRE_MODES, this.weapons.modeId);
    else if (st === 'drones') this.hud.setCommands(st, DRONE_ORDERS, this.droneOrder);
    else this.hud.setCommands(st, HELM_ORDERS, this.helmOrder);

    // Instruments propres aux postes de pilote et de drones
    const v = this.shipVel;
    this.hud.setHelm({
      heading: this.ship.group.rotation.z,
      speed: Math.hypot(v.x, v.y),
      threat: nearest ? nearest.position.distanceTo(this.ship.group.position) : null,
      nearEdge: Math.abs(this.ship.group.position.x) > ARENA.x - 25
        || Math.abs(this.ship.group.position.y) > ARENA.y - 25,
    });
    const dg = this.designated;
    this.hud.setSquadron({
      count: this.playerDrones.length,
      hp: this.playerDrones.map((d) => d.hp),
      enemyCount: this.enemyDrones.filter((d) => d.isAlive()).length,
      // Une pièce de cuirassé porte un nom ; un chasseur ou un drone, un type
      designated: dg ? (dg.name || (dg.faction === 'enemy' ? 'drone ennemi' : dg.type) || 'contact') : null,
    });
    this.hud.setOrders({
      helm: this.helmOrder,
      gunnery: this.weapons.modeId,
      drones: this.droneOrder,
    });
    this.hud.setCredits(this.app.credits);
    this.hud.setFtl(this.ftl, this.convoy, {
      soulsStart: this.soulsAtStart,
      nextAssault: Math.max(0, this.assaultTimer),
      // Distance qui reste au traînard : c'est lui qui commande le départ
      laggardToGate: this.convoy.laggard
        ? Math.max(0, (JUMP_X - JUMP_RADIUS) - this.convoy.laggard.position.x) : 0,
    });
    this.hud.setWave(this.assaultNo, this.aliveEnemies.length, {
      sector: this.sector, index: this.sectorIndex + 1, total: SECTOR_COUNT,
      theme: this.waveTheme, terrain: this.terrain.name,
      incoming: this.nextTheme,
      eta: Math.max(0, this.assaultTimer),
    });
    if (nearest) this.hud.setEnemy(true, nearest.hp, nearest.maxHp);
    else this.hud.setEnemy(false);
    if (radar && nearest) {
      // .project() mute le Vector3 => on clone (piège déjà rencontré ici)
      const v = nearest.position.clone().project(this.camera);
      this.hud.setReticle({ x: viewport.pageX(v.x), y: viewport.pageY(v.y) });
    } else {
      this.hud.setReticle(null);
    }
    // Mini-radar : portée = celle du module radar (0 => scope vide)
    const p = this.ship.group.position;
    this.hud.updateMinimap(dt, {
      range: radar ? radar.range * TUNE.radarRangeMul : 0, // portée de détection réglable
      player: { x: p.x, y: p.y },
      heading: this.ship.group.rotation.z,
      enemies: this.aliveEnemies.map((e) => ({ x: e.group.position.x, y: e.group.position.y })),
      pickups: this.pickups.map((pk) => ({ x: pk.position.x, y: pk.position.y, type: pk.type })),
    });
    this._updateIndicators();
  }

  _updateIndicators() {
    const list = [];
    for (const e of this.aliveEnemies) {
      const v = e.position.project(this.camera);
      const onScreen = v.z < 1 && v.x >= -1 && v.x <= 1 && v.y >= -1 && v.y <= 1;
      if (!onScreen) {
        let dx = v.x, dy = v.y;
        if (v.z > 1) { dx = -dx; dy = -dy; } // cible derrière la caméra
        list.push({ angle: Math.atan2(-dy, dx), color: e.color });
      }
    }
    this.hud.setIndicators(list);
  }

  _followCamera(dt = 0) {
    // Recul de caméra, produit de trois facteurs :
    //  - `viewZoom` : vue générale plus large ;
    //  - compensation de la TAILLE D'ÉCRAN : cadré dans le cockpit, l'écran est
    //    plus petit (544 px contre 800) à FOV constant, donc tout paraît plus
    //    petit sans qu'on voie plus large. On recule d'autant ;
    //  - `capitalCamZoom` quand un cuirassé est en vue, sinon il déborde du cadre
    //    et on perd précisément ce qu'on cherche : la sensation d'échelle.
    const screenComp = THREE.MathUtils.clamp(TUNE.screenRefH / Math.max(1, viewport.h), 1, 2);
    this._camZoomWant = TUNE.viewZoom * screenComp * (this.capital.alive ? TUNE.capitalCamZoom : 1);
    // Convergence en ~1 s : plus lent, la vue restait visiblement en transit
    // plusieurs secondes après une bascule de cadrage.
    if (dt > 0) this.camZoom += (this._camZoomWant - this.camZoom) * Math.min(1, dt * 3.5);

    // La caméra suit le point de PROUE (pivot) : il reste centré, la poupe balaie.
    const rot = this.ship.group.rotation.z;
    const bx = this.ship.group.position.x + Math.cos(rot) * TUNE.shipPivot;
    const by = this.ship.group.position.y + Math.sin(rot) * TUNE.shipPivot;
    const camY = COMBAT_OFFSET.y * this.camZoom;
    const camZ = COMBAT_OFFSET.z * this.camZoom;
    const dist = Math.hypot(camY, camZ);
    const halfH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * dist;
    const halfW = halfH * this.camera.aspect;
    const cx = THREE.MathUtils.clamp(bx, -(ARENA.x - halfW), ARENA.x - halfW);
    const cy = THREE.MathUtils.clamp(by, -(ARENA.y - halfH), ARENA.y - halfH);
    this.shake.base.set(cx, cy + camY, camZ);
    this.shake.restore();
    this.camera.lookAt(cx, cy, 0);
    this.camera.updateMatrixWorld();
  }

  update(dt) {
    // Le dt reçu est déjà mis à l'échelle : on divise pour retomber en temps réel,
    // sinon un ralenti à 0,3 durerait plus de trois fois la durée demandée.
    if (this._dramaT > 0) this._dramaT -= dt / Math.max(0.05, this._dramaScale);

    if (this.over) {
      this._followCamera(dt);
      this.fx.update(dt);
      this._updateHud(dt);
      this.shake.applyShake(dt);
      return;
    }

    // Pilotage type navire LOURD (inertie) : ←/→ amorcent un virage qui monte
    // et retombe progressivement ; ↑ avance et ↓ recule dans l'axe du nez, avec
    // de l'élan (le vaisseau continue sur sa lancée quand on relâche).
    // Le bus MOTEURS module accélération et virage (1.0 au profil équilibré,
    // TUNE.engineMinMul si on a tout donné aux armes/boucliers => on dérive).
    const engineMul = this.ship.power.engineMul;

    // Postes : le joueur en tient un, l'équipage tient les autres.
    this.stations.update(dt);
    // Pendant un saut : plus d'ennemis, on laisse le vaisseau sur son erre.
    if (this.jumping) {
      this.jumpTimer -= dt;
      if (this.jumpTimer <= 0) this._arriveSector();
      this._followCamera(dt);
      this.ship.updateDefense(dt);
      this.fx.update(dt);
      this._updateHud(dt);
      this.shake.applyShake(dt);
      return;
    }
    const atHelm = this.stations.manned('helm');
    if (!atHelm) {
      // Le barreur IA produit les MÊMES commandes que le joueur (thrust/turn),
      // donc la physique ci-dessous est strictement identique dans les deux cas.
      const atPost = this.stations.crewed('helm'); // en transit : personne à la barre
      this.autoHelm.update(dt, {
        pos: this.ship.group.position,
        rot: this.ship.group.rotation.z,
        target: atPost ? this._nearestEnemy() : null,
        pickup: atPost ? this._nearestPickup() : null,
        order: this.helmOrder,
        bounds: ARENA,
      });
    }
    const helm = atHelm ? this.input : this.autoHelm;

    const rotBefore = this.ship.group.rotation.z;
    this.shipAngVel += helm.turn * TUNE.angAccel * engineMul * dt;
    this.shipAngVel *= Math.max(0, 1 - TUNE.angDrag * dt);
    const rot = rotBefore + this.shipAngVel * dt;
    this.ship.group.rotation.z = rot;
    // Pivot vers la proue : on garde le point de proue fixe pendant le virage
    // (la poupe balaie) => sensation de gouvernail. Réglable via TUNE.shipPivot.
    const pivot = TUNE.shipPivot;
    this.ship.group.position.x += (Math.cos(rotBefore) - Math.cos(rot)) * pivot;
    this.ship.group.position.y += (Math.sin(rotBefore) - Math.sin(rot)) * pivot;

    const thrust = helm.thrust;
    const accel = (TUNE.shipAccel + this.ship.thrustBonus * 0.4) * engineMul * (thrust >= 0 ? 1 : 0.5); // marche arrière molle
    this.shipVel.x += Math.cos(rot) * thrust * accel * dt;
    this.shipVel.y += Math.sin(rot) * thrust * accel * dt;
    const damp = Math.max(0, 1 - TUNE.shipDrag * dt); // traînée => élan puis arrêt progressif
    this.shipVel.x *= damp; this.shipVel.y *= damp;

    const pos = this.ship.group.position;
    let nx = pos.x + this.shipVel.x * dt;
    let ny = pos.y + this.shipVel.y * dt;
    if (nx > ARENA.x || nx < -ARENA.x) { nx = THREE.MathUtils.clamp(nx, -ARENA.x, ARENA.x); this.shipVel.x = 0; }
    if (ny > ARENA.y || ny < -ARENA.y) { ny = THREE.MathUtils.clamp(ny, -ARENA.y, ARENA.y); this.shipVel.y = 0; }
    pos.x = nx; pos.y = ny;

    // Flammes de réacteur + son moteur (vendent le poids/l'inertie)
    const spd = Math.hypot(this.shipVel.x, this.shipVel.y);
    this.flameRear.visible = thrust > 0;
    if (thrust > 0) this.flameRear.scale.set(0.6 + thrust * 0.5 + spd * 0.04 * (0.8 + Math.random() * 0.4), 1, 1);
    this.flameFront.visible = thrust < 0;
    if (thrust < 0) this.flameFront.scale.set(0.7 + Math.random() * 0.3, 1, 1);
    this.audio.engine(thrust !== 0 ? 0.4 + Math.abs(thrust) * 0.6 : 0);

    const nearest = this._nearestEnemy();

    this._followCamera(dt);
    this.aim.update();

    // Anneau ouvert : les circuits de conduite de tir sont en cours de
    // rebranchement, plus rien ne tire — auto comme manuel. C'est le coût de
    // l'ouverture (sinon le ralenti serait un pur cadeau).
    const reconfiguring = this.ring.isOpen;
    // Artillerie : le joueur au poste vise à la souris et tire au clic ; sinon
    // l'équipage sert les tourelles. Pendant un transit, personne ne tient le
    // poste — c'est le coût du déplacement.
    const manualAim = this.stations.manned('gunnery');
    const crewGunnery = this.stations.crewed('gunnery');

    const ctx = {
      aimPoint: this.aim.point,
      manualAim,                                       // le joueur tient la tourelle
      firing: this.aim.firing && !reconfiguring,       // clic gauche => tir
      autoFire: crewGunnery && !reconfiguring,         // l'équipage sert les lasers
      firingMissiles: this.input.missileFiring && !reconfiguring, // Espace => missiles
      scene: this.scene,
      target: nearest,
      detected: !!nearest,
      nearestHostileTo: (p) => this._nearestHostileTo(p), // conduite de tir autonome
      nearestDroneTo: (p) => this._nearestEnemyDroneTo(p), // défense rapprochée (CIWS)
      // Ligne de vue coupée par le décor : ni l'équipage ni le CIWS ne tirent dedans
      isHidden: (fx, fy, tx, ty) => this.terrain.isHidden(fx, fy, tx, ty),
      systemsOnline: !reconfiguring,     // circuits coupés pendant une bascule d'énergie
      flak: (p, c) => { this.fx.flash(p, c, 0.35); },
      // Portée radar : au-delà, l'équipage piste mal et sa dispersion explose
      radarRange: (() => {
        const r = this.ship.getActiveRadar();
        if (!r) return 0;
        // Nuage de poussière : le pistage se dégrade, donc la dispersion de
        // l'équipage explose (cf. crewNoRadarMul). Se cacher dedans a un prix.
        const jam = this.terrain.jammedAt(this.ship.group.position.x, this.ship.group.position.y) ? 0.35 : 1;
        return r.range * TUNE.radarRangeMul * jam;
      })(),
      fireLaser: (p, d, dm, r, c) => this.fireLaser(p, d, dm, r, c),
      spawnMissile: (p, d, s) => this.spawnMissile(p, d, s),
      spawnBolt: (p, d, dm, f, c, o) => this.spawnBolt(p, d, dm, f, c, o), // traçantes du CIWS
    };

    this.weapons.update(dt, ctx);
    this.ship.update(dt, ctx);
    this.ship.updateDefense(dt);

    // Bouclier : bulle visible tant qu'il tient ; détection de la casse
    const shieldUp = this.ship.shieldUp;
    for (const m of this.ship.modules) if (m.defId === 'shield') { m.setUp(shieldUp); m.fx.scale.setScalar(TUNE.shieldRadius / 9); }
    if (this._prevShield > 0 && this.ship.shield <= 0 && this.ship.shieldMax > 0) {
      this.fx.ring(this.ship.group.position, SHIELD_COLOR, TUNE.shieldRadius);
      this.audio.shieldBreak(); this.shake.add(0.3); this.hud.flashDamage(0.4);
    }
    this._prevShield = this.ship.shield;

    const enemyCtx = {
      playerPos: this.ship.group.position,
      bounds: ARENA,
      spawnBolt: (p, d, dm, f, c) => this.spawnBolt(p, d, dm, f, c, { speed: 24, range: 60 }),
    };
    const prevAlive = this.aliveEnemies.length;
    const wasAlive = this.enemies.map((e) => e.state === 'alive');
    for (const e of this.enemies) if (e.state === 'alive' || e.state === 'exploding') e.update(dt, enemyCtx);

    // Détecte les explosions (transition vivant -> détruit) : juice + crédits
    this.enemies.forEach((e, i) => {
      if (wasAlive[i] && e.state !== 'alive') {
        this.fx.explosion(e.group.position, e.color, 1.4 + e.scale);
        this.fx.debris(e.group.position, e.color, Math.round(12 * e.scale), e.scale);
        this.audio.boom(1.2); this.shake.add(0.6); this.app.renderer.pulse(1.0);
        this.app.addCredits(REWARD[e.type] || 30);
      }
    });

    // --- Cuirassé : on le démonte pièce par pièce ---
    if (this.capital.alive) {
      const wasAlive = this.capital.parts.map((p) => p.alive);
      this.capital.update(dt, {
        playerPos: this.ship.group.position,
        bounds: ARENA,
        spawnBolt: enemyCtx.spawnBolt,
      });
      this.capital.parts.forEach((p, i) => {
        if (!wasAlive[i] || p.alive) return;
        this.fx.explosion(p.position, this.capital.config.color, 1.7);
        this.fx.debris(p.position, this.capital.config.color, 14, 1.2);
        this.audio.boom(1.1);
        this.shake.add(0.45);
        this.app.renderer.pulse(0.8);
        this.app.addCredits(60);
        // On nomme la pièce : sinon le joueur ne comprend pas ce qu'il vient de gagner
        this.hud.showWaveBanner(this.wave, `${p.name} — HORS SERVICE`);
      });
      if (!this.capital.livingParts.length) this._destroyCapital();
    }

    this._updateDrones(dt);
    this._updateBolts(dt);
    this._updatePickups(dt);
    this._resolveCollisions(dt);
    this.fx.update(dt);

    // Défaite ?
    if (this.ship.isDefeated()) { this._end(); this._updateHud(dt); this.shake.applyShake(dt); return; }

    // --- ESCORTE : la flotte avance, le calcul de saut tourne, les Cylons
    // reviennent. On ne « finit » pas une vague : on tient une échéance. ---
    this.convoy.update(dt, JUMP_X);
    this.ftl.update(dt, this.ship);

    // La flotte anéantie, il n'y a plus rien à sauver.
    if (!this.convoy.alive.length) { this._end('lost-fleet'); this._updateHud(dt); this.shake.applyShake(dt); return; }

    // Assauts en continu : le compteur ne s'arrête jamais, même si le précédent
    // n'est pas nettoyé. C'est la pression, et elle ne dépend pas de nos kills.
    this.assaultTimer -= dt;
    if (this.assaultTimer <= 0) {
      this._launchAssault();
      this.assaultTimer = this.sector.assaultEvery;
    } else if (this.assaultTimer < 5 && !this.nextTheme) {
      this._announceNextWave();
    }

    // Prêt à sauter : il faut aussi que la flotte soit arrivée à la porte.
    // Saut automatique dès que TOUTE la flotte est à la porte. Si un traînard
    // manque, on attend — et c'est au commandant de décider de partir sans lui
    // (touche J), sous le feu qui continue.
    if (this.ftl.ready && !this.ftl.jumping) {
      const laggard = this.convoy.laggard;
      if (laggard && laggard.position.x >= JUMP_X - JUMP_RADIUS) this._beginJump();
    }


    this._updateHud(dt);
    this.shake.applyShake(dt);
  }
}
