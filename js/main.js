import * as THREE from 'three';
import { createCamera, resizeCamera, setHangarView, setCombatView } from './core/Camera.js';
import { NeonRenderer } from './core/Renderer.js';
import { SaveManager } from './core/SaveManager.js';
import { Ship } from './game/Ship.js';
import { Hangar } from './game/Hangar.js';
import { Range } from './game/Range.js';
import { Audio } from './core/Audio.js';
import { TunePanel } from './game/TunePanel.js';
import { loadTune, TUNE } from './core/Tune.js';
import { viewport } from './core/Viewport.js';
import { PALETTE } from './core/NeonMaterials.js';

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

    // Sauvegarde : build + crédits
    const save = SaveManager.load();
    this.credits = save && save.credits > 0 ? save.credits : 800;
    this.ship = Ship.create(save ? save.build : null);
    this.scene.add(this.ship.group);

    // Écrans
    this.hangar = new Hangar(this);
    this.range = new Range(this);
    this.screen = 'hangar';

    // UI commune
    this.hangarUI = document.getElementById('hangar-ui');
    this.rangeUI = document.getElementById('range-ui');
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

    // Démarrage sur le hangar
    this.ship.fxLayer.visible = false;
    this.hangar.enter();

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
    SaveManager.save({ build: this.ship.serialize(), credits: this.credits });
  }

  addCredits(n) { this.credits = Math.max(0, this.credits + n); }
  spend(n) { if (this.credits >= n) { this.credits -= n; return true; } return false; }

  /** Bascule le faux écran de travail (boss key) : gèle le jeu et coupe le son. */
  _toggleWorkMode() {
    this.workMode = !this.workMode;
    this.workModeEl.classList.toggle('hidden', !this.workMode);
    if (this.workMode) {
      this.audio.engine(0);
      if (this.audio.ctx) this.audio.ctx.suspend();
    } else {
      this.clock.getDelta(); // jette le temps écoulé pendant la pause (pas de saut)
      if (this.screen === 'range' && this.audio.ctx) this.audio.ctx.resume();
    }
  }

  /** Demande un rendu (utilisé par le hangar, en mode à la demande). */
  requestRender() {
    this.needsRender = true;
  }

  toggleScreen() {
    if (this.screen === 'hangar') {
      this.audio.resume(); // geste utilisateur => (ré)active l'audio
      this.hangar.exit();
      this.hangarUI.classList.add('hidden');
      this.ship.fxLayer.visible = true;
      setCombatView(this.camera);
      this.range.enter();
      this.rangeUI.classList.remove('hidden');
      this.screen = 'range';
      this.screenName.textContent = 'CHAMP DE TIR';
      this.btnSwitch.textContent = '← HANGAR';
    } else {
      this.range.exit();
      this.rangeUI.classList.add('hidden');
      this.ship.fxLayer.visible = false;
      setHangarView(this.camera);
      this.hangar.enter();
      this.hangarUI.classList.remove('hidden');
      this.screen = 'hangar';
      this.screenName.textContent = 'HANGAR';
      this.btnSwitch.textContent = 'COMBAT →';
      this.needsRender = true;
    }
  }

  /**
   * Bascule l'écran tactique en plein écran (et retour). Le décor du cockpit
   * s'efface, la vue reprend toute la fenêtre.
   */
  toggleExpand() {
    this.expanded = !this.expanded;
    document.body.classList.toggle('expanded', this.expanded);
    this._resize();
  }

  /**
   * Le canvas ne fait plus la taille de la fenêtre : on part de SA taille réelle.
   * `viewport.refresh()` doit suivre, sinon la visée se décale silencieusement du
   * rendu (on ne plante pas, on rate simplement ses tirs).
   */
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
