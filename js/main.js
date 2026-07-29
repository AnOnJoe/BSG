import * as THREE from 'three';
import { createCamera, resizeCamera, setHangarView, setCombatView } from './core/Camera.js';
import { NeonRenderer } from './core/Renderer.js';
import { SaveManager } from './core/SaveManager.js';
import { Ship } from './game/Ship.js';
import { Hangar } from './game/Hangar.js';
import { Range } from './game/Range.js';
import { Bridge } from './game/Bridge.js';
import { StartMenu } from './game/StartMenu.js';
import { Audio } from './core/Audio.js';
import { TunePanel } from './game/TunePanel.js';
import { loadTune, TUNE } from './core/Tune.js';
import { viewport } from './core/Viewport.js';
import { PALETTE } from './core/NeonMaterials.js';
import { START_SLOTS, START_PLANS, START_SALVAGE, WORKS } from './data/progression.js';

/**
 * Point d'entrée : monte la scène Three.js, le vaisseau, et bascule entre
 * les deux écrans (Hangar ↔ Champ de tir).
 */
class App {
  constructor() {
    loadTune(); // réglages persistés (localStorage) appliqués aux valeurs par défaut
    this.canvas = document.getElementById('scene');
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(PALETTE.bg, 0.004);
    this._addNebulae();
    this._addStarfield();

    this.camera = createCamera();
    this.renderer = new NeonRenderer(this.canvas, this.scene, this.camera);

    // Audio synthétisé (partagé)
    this.audio = new Audio();

    // Sauvegarde : build, matériel, emplacements aménagés, plans acquis.
    const save = SaveManager.load();
    // MATÉRIEL — pas de l'argent : on ne paie personne, c'est notre flotte et nos
    // ingénieurs. Voir `data/progression.js` pour le raisonnement complet.
    this.salvage = save && save.salvage > 0 ? save.salvage : START_SALVAGE;
    this.ship = Ship.create(save ? save.build : null);
    this.scene.add(this.ship.group);
    // Emplacements AMÉNAGÉS. Un slot occupé l'est forcément — sinon une sauvegarde
    // d'avant la progression rendrait inaccessibles des modules déjà montés.
    this.fitted = new Set(save?.fitted || START_SLOTS);
    for (const it of this.ship.serialize()) this.fitted.add(it.slotId);
    // PLANS des modules connus. Idem : ce qui est monté est forcément connu.
    this.plans = new Set(save?.plans || START_PLANS);
    for (const it of this.ship.serialize()) this.plans.add(it.moduleId);
    // CHANTIERS : capacité de l'équipe de pont pour l'escale en cours. Ils ne
    // s'accumulent pas — c'est ce qui force à choisir quoi faire en premier.
    this.works = WORKS.withWorkshop;

    // Écrans. Le HANGAR n'est plus l'accueil : on démarre sur le MENU, et le
    // hangar est devenu une escale (« pont hangar ») entre deux sauts.
    this.menu = new StartMenu(this);
    this.hangar = new Hangar(this);
    this.range = new Range(this);
    this.bridge = new Bridge(this);      // les « 33 minutes », dans le CIC
    this.pendingEffects = [];            // décisions de passerelle à honorer
    this.hangarReturn = 'menu';          // d'où l'on vient, donc où l'on retourne
    this.screen = 'menu';

    // UI commune
    this.menuUI = document.getElementById('menu-ui');
    this.hangarUI = document.getElementById('hangar-ui');
    this.rangeUI = document.getElementById('range-ui');
    this.bridgeUI = document.getElementById('bridge-ui');
    this.screenName = document.getElementById('screen-name');
    this.btnSwitch = document.getElementById('btn-switch');
    this.btnSwitch.addEventListener('click', () => this.toggleScreen());

    // Rendu à la demande : le hangar est statique, on ne redessine que sur
    // changement (le champ de tir, lui, s'anime en continu).
    this.needsRender = true;

    // « Boss key » (Entrée — Espace sert aux missiles), panneau de réglages (T)
    this.workMode = false;
    this.workModeEl = document.getElementById('work-mode');
    this.tunePanel = new TunePanel();
    window.addEventListener('keydown', (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return; // ne pas capter dans le panneau
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); this._toggleWorkMode(); }
      else if (e.code === 'Escape' && this.workMode) { e.preventDefault(); this._toggleWorkMode(); }
      else if (e.code === 'KeyT') { e.preventDefault(); this.tunePanel.toggle(); }
      // V : agrandir la vue. Une touche dédiée plutôt que le clic sur l'écran,
      // qui sert déjà à tirer au poste d'artilleur.
      else if (e.code === 'KeyV') { e.preventDefault(); this.toggleExpand(); }
    });

    this.expanded = false;
    document.getElementById('btn-expand').addEventListener('click', () => this.toggleExpand());
    window.addEventListener('resize', () => this._resize());
    // Les marges du cockpit sont animées (0,25 s) : mesurer la taille au moment du
    // clic donnerait une valeur intermédiaire. On remesure en fin de transition,
    // sinon la visée reste calée sur la géométrie d'avant la bascule.
    this.canvas.addEventListener('transitionend', () => this._resize());
    this._resize(); // fixe la taille de rendu ET le viewport sur le canvas encadré

    // Démarrage sur le menu. On n'entre pas par `_show` (il refuse la transition
    // vers l'écran courant), donc l'état de la barre doit être posé ici aussi :
    // sans ça le bouton contextuel restait visible sur le menu.
    this.ship.fxLayer.visible = false;
    this.menu.enter();
    this.menuUI.classList.remove('hidden');
    this.screenName.textContent = '';
    this.btnSwitch.classList.add('hidden');

    document.getElementById('loading').style.display = 'none';

    // Accessible en console pour debug/tests
    window.app = this;
    window.TUNE = TUNE;

    this.clock = new THREE.Clock();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _addStarfield() {
    // Étoiles multicolores sur 3 couches de profondeur (parallaxe) : défilent
    // quand la caméra suit le vaisseau -> repère de mouvement + couleur.
    const STAR_COLORS = [0xffffff, 0x8fd8ff, 0xff8fd0, 0xb69cff, 0xfff0b0];
    const layer = (n, spanX, spanY, zMin, zMax, size, opacity) => {
      const pos = new Float32Array(n * 3);
      const col = new Float32Array(n * 3);
      const c = new THREE.Color();
      for (let i = 0; i < n; i++) {
        pos[i * 3] = (Math.random() - 0.5) * spanX;
        pos[i * 3 + 1] = (Math.random() - 0.5) * spanY;
        pos[i * 3 + 2] = zMin + Math.random() * (zMax - zMin);
        c.set(STAR_COLORS[(Math.random() * STAR_COLORS.length) | 0]).multiplyScalar(0.6 + Math.random() * 0.4);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const mat = new THREE.PointsMaterial({ size, transparent: true, opacity, sizeAttenuation: true, vertexColors: true });
      this.scene.add(new THREE.Points(geo, mat));
    };
    layer(800, 300, 210, -70, -46, 0.28, 0.7);  // lointaines
    layer(600, 280, 200, -42, -24, 0.42, 0.9);  // moyennes
    layer(360, 260, 190, -20, -6, 0.6, 1.0);    // proches (parallaxe marquée)
  }

  _addNebulae() {
    // Nuages colorés (nébuleuses) : plans additifs avec dégradé radial, très
    // au fond, pour donner de la couleur et de la profondeur à l'espace.
    const makeTex = (hex) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      const ctx = cv.getContext('2d');
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      const c = new THREE.Color(hex);
      const rgb = `${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0}`;
      g.addColorStop(0, `rgba(${rgb},0.55)`);
      g.addColorStop(0.5, `rgba(${rgb},0.16)`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
      const tex = new THREE.CanvasTexture(cv);
      return tex;
    };
    const COLORS = [0x7a34c0, 0x2a63c0, 0xc0357a, 0x2a94c0, 0x4a34b0, 0xc06a2a];
    const texes = COLORS.map(makeTex);
    for (let i = 0; i < 11; i++) {
      const tex = texes[i % texes.length];
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
      const s = new THREE.Sprite(mat);
      s.position.set((Math.random() - 0.5) * 260, (Math.random() - 0.5) * 180, -55 - Math.random() * 35);
      const scale = 70 + Math.random() * 110;
      s.scale.set(scale, scale, 1);
      this.scene.add(s);
    }
    this._addGalaxy();
  }

  _addGalaxy() {
    // Galaxie spirale (dessinée une fois sur un canvas) comme point focal cosmique
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const ctx = cv.getContext('2d');
    // cœur
    const core = ctx.createRadialGradient(128, 128, 0, 128, 128, 46);
    core.addColorStop(0, 'rgba(255,244,214,0.95)');
    core.addColorStop(0.4, 'rgba(255,210,150,0.35)');
    core.addColorStop(1, 'rgba(255,210,150,0)');
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, 256, 256);
    // bras spiraux
    const arms = [0, Math.PI];
    for (const off of arms) {
      for (let i = 6; i < 900; i++) {
        const a = off + i * 0.045;
        const r = i * 0.135;
        if (r > 120) break;
        const jx = (Math.random() - 0.5) * (6 + r * 0.12);
        const jy = (Math.random() - 0.5) * (6 + r * 0.12);
        const x = 128 + Math.cos(a) * r + jx;
        const y = 128 + Math.sin(a) * r + jy;
        const alpha = Math.max(0, 0.5 * (1 - r / 120));
        const blue = 180 + ((Math.random() * 60) | 0);
        ctx.fillStyle = `rgba(${150 + ((Math.random() * 60) | 0)},${180},${blue},${alpha})`;
        ctx.fillRect(x, y, 1.6, 1.6);
      }
    }
    const tex = new THREE.CanvasTexture(cv);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.position.set(-70, 40, -68);
    s.scale.set(150, 110, 1); // légèrement elliptique
    this.scene.add(s);
  }

  save() {
    SaveManager.save({
      build: this.ship.serialize(),
      salvage: this.salvage,
      fitted: [...this.fitted],
      plans: [...this.plans],
    });
  }

  // --- MATÉRIEL (récupération) ---
  addSalvage(n) { this.salvage = Math.max(0, this.salvage + n); }
  spend(n) { if (this.salvage >= n) { this.salvage -= n; return true; } return false; }

  // --- CHANTIERS (capacité de l'équipe de pont, par escale) ---
  /**
   * Renouvelle les chantiers à chaque saut. Sans le remorqueur — l'atelier — on
   * n'en mène plus qu'un : c'est le prix réel de cette coque de 900 âmes.
   */
  refillWorks(hasWorkshop) {
    this.works = hasWorkshop ? WORKS.withWorkshop : WORKS.withoutWorkshop;
  }
  useWork() { if (this.works <= 0) return false; this.works--; return true; }

  /**
   * REPARTIR DE ZÉRO. Nécessaire depuis que la progression existe : une sauvegarde
   * d'avant l'économie de matériel migre ses anciens crédits, donc on démarre riche
   * et on ne voit pas le début sobre du jeu. On recharge la page plutôt que de
   * remonter l'état à la main — c'est le seul moyen sûr de tout réinitialiser
   * (vaisseau, modules montés, sections, hall of fame exclu).
   */
  wipeSave() {
    SaveManager.clear();
    location.reload();
  }

  // --- PROGRESSION ---
  isFitted(slotId) { return this.fitted.has(slotId); }
  fitOut(slotId) { this.fitted.add(slotId); }
  knowsPlan(moduleId) { return this.plans.has(moduleId); }
  /** Acquiert un plan. Renvoie false s'il était déjà connu (pour n'annoncer qu'une fois). */
  learnPlan(moduleId) {
    if (this.plans.has(moduleId)) return false;
    this.plans.add(moduleId);
    return true;
  }

  /** Bascule le faux écran de travail (boss key) : gèle le jeu et coupe le son. */
  _toggleWorkMode() {
    this.workMode = !this.workMode;
    this.workModeEl.classList.toggle('hidden', !this.workMode);
    if (this.workMode) {
      this.audio.engine(0);
      this.audio.ambienceOff();
      if (this.audio.ctx) this.audio.ctx.suspend();
    } else {
      this.clock.getDelta(); // jette le temps écoulé pendant la pause (pas de saut)
      if (this.screen === 'range' && this.audio.ctx) this.audio.ctx.resume();
      if (this.screen === 'range') this.audio.ambience('combat');
      else if (this.screen === 'bridge') this.audio.ambience('cic');
    }
  }

  /** Demande un rendu (utilisé par le hangar, en mode à la demande). */
  requestRender() {
    this.needsRender = true;
  }

  /**
   * VUE PLEIN ÉCRAN (touche V / bouton ⛶) : les marges du cockpit passent à 0 et
   * le décor s'efface. `_resize()` est indispensable derrière — le canvas change
   * de taille, et sans remesurer le viewport la visée resterait calée sur la
   * géométrie d'avant la bascule (on ne plante pas, on rate ses tirs).
   *
   * ⚠ Cette méthode avait DISPARU du fichier (perdue dans le commit 16a4533) alors
   * que ses deux appelants et tout le CSS `body.expanded` étaient restés : la
   * touche V et le bouton levaient donc « toggleExpand is not a function ». Un
   * appelant sans définition ne se voit pas à la lecture, seulement à l'usage.
   */
  toggleExpand() {
    this.expanded = !this.expanded;
    document.body.classList.toggle('expanded', this.expanded);
    this._resize();
  }

  /**
   * Le bouton de la barre est CONTEXTUEL, et surtout il ne permet plus de quitter
   * le combat. C'est par là que passait le pire défaut de la traversée : sortir
   * vers le hangar puis revenir rappelait `Range.enter()`, qui remettait le
   * secteur à zéro. On n'abandonne pas une bataille par un bouton de menu.
   */
  toggleScreen() {
    if (this.screen === 'hangar') this._show(this.hangarReturn);
    else if (this.screen === 'bridge') this.toHangar('bridge');
  }

  /** Nouvelle traversée depuis le menu : on entre par le CIC du premier saut. */
  startCampaign() {
    // La flotte est montée MAINTENANT, avant le premier CIC : la passerelle a
    // besoin d'elle pour afficher le bandeau et savoir si le pont hangar est
    // ouvert. La monter à l'entrée du combat était trop tard.
    this.range.newCampaign();
    this.bridge.reset();               // l'arc du CIC repart du début, lui aussi
    this.pendingEffects = [];
    if (this.screen === 'bridge') { this.bridge.exit(); this.bridge.enter(); return; }
    this._show('bridge');
  }

  /** Retour au menu (fin de partie). */
  toMenu() { this._show('menu'); }

  /**
   * PONT HANGAR. Depuis le menu on arme la baleine avant de partir ; depuis le
   * CIC c'est une escale entre deux sauts — et elle exige que le CARGO soit
   * vivant, puisque c'est lui qui porte les pièces. Le refus est explicite :
   * un bouton muet se lit comme un bug.
   */
  toHangar(from = 'menu') {
    if (from === 'bridge' && !this.range.convoy.hasRole('parts')) {
      this.bridge.notify('Pont hangar fermé — le Cargo lourd est perdu, il n\'y a plus de pièces.');
      return false;
    }
    this.hangarReturn = from;
    this._show('hangar');
    return true;
  }

  /** Fin de la phase passerelle : on passe à l'action. */
  startCombat() { this._show('range'); }

  /** Retour au CIC entre deux sauts. */
  toBridge() { this._show('bridge'); }

  _show(next) {
    if (next === this.screen) return;
    // sortie de l'écran courant
    if (this.screen === 'menu') { this.menu.exit(); this.menuUI.classList.add('hidden'); }
    else if (this.screen === 'hangar') { this.hangar.exit(); this.hangarUI.classList.add('hidden'); }
    else if (this.screen === 'range') { this.range.exit(); this.rangeUI.classList.add('hidden'); }
    else if (this.screen === 'bridge') { this.bridge.exit(); this.bridgeUI.classList.add('hidden'); }

    this.screen = next;
    if (next === 'menu') {
      this.ship.fxLayer.visible = false;
      setHangarView(this.camera);
      this.audio.ambienceOff();     // le menu n'est pas un lieu du vaisseau
      this.menu.enter();
      this.menuUI.classList.remove('hidden');
      this.screenName.textContent = '';
      this.btnSwitch.classList.add('hidden');
      this.needsRender = true;
    } else if (next === 'hangar') {
      this.ship.fxLayer.visible = false;
      setHangarView(this.camera);
      this.hangar.enter();
      this.hangarUI.classList.remove('hidden');
      this.screenName.textContent = 'PONT HANGAR';
      this.btnSwitch.classList.remove('hidden');
      this.btnSwitch.textContent = this.hangarReturn === 'bridge' ? '← CIC' : '← MENU';
      this.needsRender = true;
    } else if (next === 'bridge') {
      // Le CIC couvre l'écran : on ne rend pas la 3D derrière
      this.audio.resume();
      this.audio.ambience('cic');   // fond de salle : on est à l'intérieur
      this.bridge.enter();
      this.bridgeUI.classList.remove('hidden');
      this.screenName.textContent = 'PASSERELLE';
      this.btnSwitch.classList.remove('hidden');
      this.btnSwitch.textContent = 'PONT HANGAR →';
    } else {
      this.audio.resume();
      this.audio.ambience('combat'); // la basse monte, le souffle recule
      this.ship.fxLayer.visible = true;
      setCombatView(this.camera);
      this.range.enter();
      this.rangeUI.classList.remove('hidden');
      this.screenName.textContent = 'CHAMP DE TIR';
      // Pas de sortie de secours pendant la bataille (voir toggleScreen).
      this.btnSwitch.classList.add('hidden');
    }
    this._resize();
  }

  _resize() {
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    resizeCamera(this.camera, w, h);
    this.renderer.setSize(w, h);
    viewport.refresh(this.canvas);
    this.needsRender = true;
  }

  _loop() {
    if (this.workMode) { requestAnimationFrame(this._loop); return; } // jeu gelé
    const dt = Math.min(this.clock.getDelta(), 0.05);
    // Menu et CIC sont du DOM plein écran : rien à rendre en 3D derrière.
    if (this.screen === 'bridge' || this.screen === 'menu') { requestAnimationFrame(this._loop); return; }
    if (this.screen === 'range') {
      // timeScale < 1 quand l'anneau de passerelle est ouvert (le DOM de
      // l'anneau, lui, reste réactif : il ne dépend pas de dt).
      this.range.update(dt * this.range.timeScale);
      this.renderer.render(); // le champ de tir s'anime en continu
    } else if (this.needsRender) {
      this.renderer.render(); // hangar : rendu uniquement sur changement
      this.needsRender = false;
    }
    requestAnimationFrame(this._loop);
  }
}

window.addEventListener('DOMContentLoaded', () => new App());
