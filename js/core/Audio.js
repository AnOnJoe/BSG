/**
 * Sons synthétisés à la volée via WebAudio — aucun fichier externe (compatible
 * hébergement local / CSP). Le contexte se crée à la première utilisation et se
 * réactive sur geste utilisateur (clic COMBAT / tir).
 */
export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this._lastZap = 0;
  }

  _ensure() {
    if (this.ctx || !this.enabled) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    } catch (e) {
      this.enabled = false;
    }
  }

  resume() {
    this._ensure();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  _envGain(t0, dur, peak) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.connect(this.master);
    return g;
  }

  _tone(type, f0, f1, dur, peak, when = 0) {
    this._ensure();
    if (!this.enabled) return;
    this.resume();
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    const g = this._envGain(t0, dur, peak);
    o.connect(g);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  _noise(dur, cutoff, peak, when = 0) {
    this._ensure();
    if (!this.enabled) return;
    this.resume();
    const t0 = this.ctx.currentTime + when;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    const g = this._envGain(t0, dur, peak);
    src.connect(lp);
    lp.connect(g);
    src.start(t0);
  }

  zap() {
    this._ensure();
    if (!this.enabled) return;
    const now = this.ctx.currentTime;
    if (now - this._lastZap < 0.05) return; // throttle (laser rapide)
    this._lastZap = now;
    this._tone('sawtooth', 900 + Math.random() * 220, 260, 0.09, 0.4);
  }

  launch() { this._tone('square', 240, 90, 0.28, 0.45); }
  hit() { this._tone('triangle', 1300, 620, 0.06, 0.5); }
  enemyZap() { this._tone('sawtooth', 520, 150, 0.12, 0.3); }

  boom(scale = 1) {
    this._noise(0.32 + 0.28 * scale, 900, 0.7 * Math.min(1.3, scale));
    this._tone('sine', 90, 38, 0.32, 0.6 * Math.min(1.3, scale));
  }

  win() {
    [523, 659, 784].forEach((f, i) => this._tone('triangle', f, f, 0.22, 0.4, i * 0.12));
  }

  lose() { this._tone('sawtooth', 300, 70, 0.7, 0.5); }
  shieldBreak() { this._noise(0.35, 1800, 0.5); this._tone('square', 700, 110, 0.3, 0.4); }
  pickup() { this._tone('triangle', 660, 880, 0.1, 0.4); this._tone('triangle', 990, 1240, 0.12, 0.35, 0.09); }
  emp() { this._tone('sawtooth', 1400, 90, 0.45, 0.5); this._noise(0.4, 3500, 0.4); }
  /** Bascule de profil d'énergie : deux clacs de relais de passerelle. */
  relay() { this._tone('square', 420, 300, 0.07, 0.35); this._tone('square', 300, 520, 0.09, 0.3, 0.07); }

  /** Ronronnement de moteur continu ; `level` ∈ [0..1] pilote volume et hauteur. */
  engine(level) {
    this._ensure();
    if (!this.enabled) return;
    if (!this._eng) {
      this.resume();
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 55;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 220;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      o.connect(f); f.connect(g); g.connect(this.master);
      o.start();
      this._eng = { o, g, f };
    }
    const t = this.ctx.currentTime;
    this._eng.g.gain.setTargetAtTime(Math.min(0.45, level * 0.45), t, 0.08);
    this._eng.o.frequency.setTargetAtTime(50 + level * 45, t, 0.1);
  }
}
