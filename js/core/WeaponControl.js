import * as THREE from 'three';
import { TUNE } from './Tune.js';

const _aim = new THREE.Vector3();

/**
 * MODES DE TIR (consigne du poste d'artilleur, valable aussi pour l'équipage :
 * quand tu quittes le poste, ils continuent d'appliquer ta consigne).
 *
 * Chaque mode est un vrai compromis — sinon on prendrait toujours le même :
 *  - SEMI   : un coup par pression, précision parfaite, économe. Le seul viable
 *             à longue portée, mais lent.
 *  - RAFALE : salves de 3 puis pause. Le milieu.
 *  - AUTO   : cadence pleine, mais ça disperse et ça dévore la réserve d'énergie.
 */
export const FIRE_MODES = [
  // Cadences effectives mesurées, cible à 20 : SEMI ~2/s · RAFALE ~3,4/s · AUTO 7/s.
  // Le classement doit être strict, sinon le « mode posé » tirerait plus que la
  // rafale et le compromis n'existerait plus.
  { id: 'semi', name: 'SEMI', rate: 0.3, spread: 0, cost: 0.75 },
  { id: 'burst', name: 'RAFALE', rate: 1.0, spread: 0.02, cost: 1.0, burst: 3, pause: 0.45 },
  { id: 'auto', name: 'AUTO', rate: 1.0, spread: 0.06, cost: 1.15 },
];

function modeById(id) {
  return FIRE_MODES.find((m) => m.id === id) || FIRE_MODES[1];
}

/** Fait tourner de `bias` la direction (from → target) et renvoie le point visé. */
function jitterPoint(out, fromX, fromY, target, bias) {
  const dx = target.x - fromX, dy = target.y - fromY;
  const d = Math.hypot(dx, dy) || 0.0001;
  const a = Math.atan2(dy, dx) + bias;
  return out.set(fromX + Math.cos(a) * d, fromY + Math.sin(a) * d, 0);
}

/**
 * Poste d'ARTILLEUR.
 *
 * Quand l'ÉQUIPAGE tient le poste, chaque tourelle prend l'hostile le plus proche
 * à SA portée et tire seule — mais l'équipage n'est pas une machine (voir
 * `_fireControl`) : il suit avec du retard, disperse d'autant plus que la cible
 * est loin, voit mal sans radar, et renonce quand la solution est mauvaise.
 * Mesuré : ~30 % de touches sur une cible qui manœuvre, contre 100 % pour un
 * joueur au poste. C'est ce qui donne sa valeur à la prise de poste.
 *
 * Les MISSILES restent sur ordre (Espace) depuis n'importe quel poste :
 * munitions finies = décision du capitaine, pas routine. Idem IEM (touche E).
 */
export class WeaponControl {
  constructor(ship) {
    this.ship = ship;
    this.modeId = 'burst';
    this.solution = { quality: 0, label: '—' };
    this._prevFiring = false;
    this.refresh();
  }

  get mode() { return modeById(this.modeId); }

  setFireMode(id) {
    if (!FIRE_MODES.some((m) => m.id === id)) return false;
    this.modeId = id;
    return true;
  }

  /** (Re)construit la liste ordonnée module ↔ touche. */
  refresh() {
    this.ordered = this.ship.orderedModules();
    this.ordered.forEach((m) => { if (m.cooldown === undefined) m.cooldown = 0; });
    return this.ordered;
  }

  /** Renvoie la description pour le HUD : [{ key, module }]. */
  layout() {
    return this.ordered.map((m, i) => ({ key: i + 1, module: m }));
  }

  toggle(n) {
    const m = this.ordered[n - 1];
    if (m) m.setActive(!m.active);
    return m;
  }

  /**
   * Solution de tir d'une tourelle sur sa cible, façon équipage humain.
   * Renvoie { point, canFire, quality }.
   *
   * Trois sources d'erreur, chacune motivée :
   *  - PERCEPTION RETARDÉE : on vise là où la cible ÉTAIT (même modèle que
   *    `EnemyShip.perceived`) ⇒ une cible qui manœuvre est ratée, une cible qui
   *    file droit est touchée.
   *  - DISPERSION croissante avec la distance relative, fortement aggravée hors
   *    portée radar (cible mal pistée), plus celle du mode de tir. Le biais tient
   *    `crewBiasTime` secondes : les rafales passent à côté de façon cohérente,
   *    la tourelle ne tremble pas.
   *  - VERROUILLAGE : un délai après acquisition avant le premier tir.
   * Et un garde-fou : au-delà de `crewHoldFactor` fois la taille angulaire de la
   * cible, l'équipage RENONCE plutôt que de vider ta réserve d'énergie pour rien.
   */
  _fireControl(m, target, wx, wy, dt, radarRange, modeSpread, isHidden) {
    let fc = m._fc;
    if (!fc) fc = m._fc = { target: null, perceived: new THREE.Vector3(), bias: 0, biasT: 0, lock: 0 };

    // Acquisition d'une nouvelle cible : on repart de sa position réelle, mais il
    // faut le temps du verrouillage avant d'ouvrir le feu.
    if (fc.target !== target) {
      fc.target = target;
      fc.perceived.copy(target.position);
      fc.lock = TUNE.crewAcquireTime;
      fc.biasT = 0;
    } else {
      const tau = Math.max(0.01, TUNE.crewReactionTau);
      fc.perceived.lerp(target.position, Math.min(1, dt / tau));
      fc.lock = Math.max(0, fc.lock - dt);
    }

    const dx = fc.perceived.x - wx, dy = fc.perceived.y - wy;
    const dist = Math.hypot(dx, dy) || 0.0001;

    // Dispersion : nulle à bout portant, maximale en limite de portée, et
    // multipliée si la cible n'est pas dans la bulle radar.
    const reach = m.stats.range || 1;
    const blind = radarRange > 0 && dist <= radarRange ? 1 : TUNE.crewNoRadarMul;
    const spread = TUNE.crewSpread * Math.min(1, dist / reach) * blind + modeSpread;

    fc.biasT -= dt;
    if (fc.biasT <= 0) {
      fc.bias = (Math.random() * 2 - 1) * spread;
      fc.biasT = TUNE.crewBiasTime;
    }

    // Erreur totale de visée = retard de suivi + biais de dispersion. Il faut
    // les deux : sur une cible qui manœuvre, c'est le RETARD qui fait rater, et
    // une qualité qui l'ignorerait annoncerait « bonne solution » à 40 % de touches.
    const trackAng = Math.atan2(fc.perceived.distanceTo(target.position), dist);
    const totalErr = Math.abs(fc.bias) + trackAng;

    // Taille angulaire de la cible : au-delà d'un multiple, tirer est du gâchis.
    const subtend = Math.atan2(target.radius || 1, dist);
    const budget = subtend * TUNE.crewHoldFactor;

    // MASQUÉE par le décor : l'équipage ne tire pas dans un rocher. C'est ce qui
    // donne sa valeur au couvert — pour le joueur comme pour l'ennemi.
    const hidden = isHidden ? isHidden(wx, wy, target.position.x, target.position.y) : false;

    jitterPoint(_aim, wx, wy, fc.perceived, fc.bias);

    return {
      point: _aim,
      hidden,
      canFire: fc.lock <= 0 && totalErr <= budget && !hidden,
      // 1 = l'erreur est bien plus petite que la cible, 0 = solution perdue.
      // Masquée ⇒ 0 : il n'y a pas de « bonne solution » sur une cible qu'on ne
      // voit pas, et le HUD annoncerait BONNE alors que rien ne peut partir.
      quality: hidden ? 0 : Math.max(0, Math.min(1, 1 - totalErr / budget)),
    };
  }

  update(dt, ctx) {
    const manual = !!ctx.manualAim;   // le joueur tient le poste d'artilleur
    const mode = this.mode;
    const dmgMul = manual ? TUNE.manualAimBonus : 1;
    const radarRange = ctx.radarRange || 0;
    // Le mode de tir change le coût énergie de chaque coup (lu par LaserCannon)
    this.ship.energyCostMul = mode.cost;
    const pressed = !!ctx.firing && !this._prevFiring; // front montant du clic
    let best = -1;
    let masked = false;

    for (const m of this.ordered) {
      if (m.kind !== 'weapon') continue;
      m.cooldown -= dt;

      let aimAt = ctx.aimPoint;
      let trigger = false;

      if (m.def.targets === 'small') {
        // DÉFENSE RAPPROCHÉE : système automatique. Il ne se sert pas au poste
        // d'artilleur — il crépite seul quel que soit le poste où tu te trouves,
        // et sa conduite de tir n'a pas les faiblesses humaines (les drones sont
        // trop vifs pour un pointeur, c'est justement sa raison d'être).
        const wp = m.worldPos();
        const wx = wp.x, wy = wp.y;
        const t = ctx.nearestDroneTo ? ctx.nearestDroneTo(wp) : null;
        const reach = t && Math.hypot(t.position.x - wx, t.position.y - wy) <= (m.stats.range || 0);
        if (reach && !(ctx.isHidden && ctx.isHidden(wx, wy, t.position.x, t.position.y))) {
          if (m._shotBias === undefined) m._shotBias = 0;
          aimAt = jitterPoint(_aim, wx, wy, t.position, m._shotBias);
          trigger = !!ctx.systemsOnline;
        }
      } else if (manual) {
        const wp = m.worldPos();
        const wx = wp.x, wy = wp.y;
        // Biais de tir re-tiré après chaque coup : le canon dévie légèrement
        // selon le mode (sensation de recul) au lieu de trembler chaque frame.
        if (m._shotBias === undefined) m._shotBias = 0;
        aimAt = jitterPoint(_aim, wx, wy, ctx.aimPoint, m._shotBias);
        // SEMI = un coup par pression ; les autres tirent au maintien.
        const wants = mode.id === 'semi' ? pressed : !!ctx.firing;
        trigger = m.defId === 'missile' ? ctx.firingMissiles : wants;
        m._fc = null; // l'équipage devra re-verrouiller quand il reprendra le poste
      } else {
        const wp = m.worldPos();
        const wx = wp.x, wy = wp.y; // wp est un scratch : on copie avant tout aim()
        const t = ctx.nearestHostileTo ? ctx.nearestHostileTo(wp) : null;
        const inReach = t && Math.hypot(t.position.x - wx, t.position.y - wy) <= (m.stats.range || 0);

        if (m.defId === 'missile') {
          // L'ordre du capitaine part même si la solution est douteuse (le
          // missile est autoguidé, il corrigera en vol).
          if (t) aimAt = this._fireControl(m, t, wx, wy, dt, radarRange, mode.spread, ctx.isHidden).point;
          trigger = ctx.firingMissiles;
        } else if (ctx.autoFire && inReach) {
          const sol = this._fireControl(m, t, wx, wy, dt, radarRange, mode.spread, ctx.isHidden);
          aimAt = sol.point;
          trigger = sol.canFire;
          if (sol.hidden) masked = true;
          if (sol.quality > best) best = sol.quality;
        } else {
          m._fc = null; // plus de cible : le verrou est perdu
        }
      }

      // Les tourelles suivent toujours leur point de visée (vivant même inactif)
      if (m.aim) m.aim(aimAt);

      if (m.active && trigger && m.cooldown <= 0 && m.canFire(this.ship)) {
        m.fire(ctx, dmgMul);
        m.onFired(this.ship);
        // Le mode de tir est une consigne d'artillerie : il ne s'applique pas à
        // la défense rapprochée, qui a sa propre logique.
        const isPd = m.def.targets === 'small';
        m.cooldown = 1 / (m.stats.fireRate * (isPd ? 1 : mode.rate));
        if (isPd) m._shotBias = (Math.random() * 2 - 1) * 0.03; // léger éparpillement du rideau de feu
        else if (manual) m._shotBias = (Math.random() * 2 - 1) * mode.spread;
        // Rafale : après `burst` coups, l'arme marque une pause.
        if (mode.burst && !isPd) {
          m._burstN = (m._burstN || 0) + 1;
          if (m._burstN >= mode.burst) { m._burstN = 0; m.cooldown += mode.pause; }
        }
      }
    }

    this._prevFiring = !!ctx.firing;
    this._updateSolution(dt, manual, best, masked);
  }

  /**
   * Qualité de la conduite de tir, lissée : la valeur instantanée oscille au
   * rythme des manœuvres de la cible, et un libellé qui clignoterait entre BONNE
   * et MAUVAISE serait illisible.
   */
  _updateSolution(dt, manual, best, masked) {
    if (manual) {
      this._q = 1;
      this.solution = { quality: 1, label: 'MANUELLE' };
      return;
    }
    const target = Math.max(0, best);
    this._q = this._q === undefined ? target : this._q + (target - this._q) * Math.min(1, dt / 0.4);
    const q = this._q;
    if (masked && best <= 0) this.solution = { quality: 0, label: 'CIBLE MASQUÉE' };
    else if (best < 0) this.solution = { quality: 0, label: 'PAS DE CIBLE' };
    else if (q < 0.08) this.solution = { quality: q, label: 'SANS SOLUTION' };
    else if (q > 0.6) this.solution = { quality: q, label: 'BONNE' };
    else if (q > 0.3) this.solution = { quality: q, label: 'DÉGRADÉE' };
    else this.solution = { quality: q, label: 'MAUVAISE' };
  }
}
