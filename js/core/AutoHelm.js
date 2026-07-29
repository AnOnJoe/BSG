import * as THREE from 'three';
import { TUNE } from './Tune.js';

const _v = new THREE.Vector3();

/**
 * BARREUR IA : tient la barre quand le joueur est à un autre poste.
 *
 * Il n'a accès à rien de plus que le joueur : il produit un `thrust` et un `turn`
 * dans [-1, 1], exactement comme l'InputController, et c'est la physique normale
 * de Range qui s'applique. Aucune duplication, et donc aucun risque qu'il « triche ».
 *
 * Il est VOLONTAIREMENT MÉDIOCRE, et de façon lisible :
 *  - il réagit avec du retard (`helmReactionTau`), donc il barre mollement ;
 *  - il ne DÉCIDE jamais rien : il applique la consigne de conduite en cours
 *    (`HELM_ORDERS`) sans jamais juger qu'il faudrait en changer. Il ne partira
 *    pas de lui-même chercher une caisse et ne rompra pas de lui-même un
 *    encerclement — c'est au capitaine d'en décider, depuis n'importe quel poste.
 *
 * Consignes :
 *  - ENGAGER   : tient `TUNE.helmStandoff` face au plus proche hostile ;
 *  - RÉCUPÉRER : met le cap sur la caisse la plus proche (et rien d'autre) ;
 *  - ROMPRE    : s'écarte de la menace.
 */
export class AutoHelm {
  constructor() {
    this.thrust = 0;
    this.turn = 0;
    this.perceived = null; // position perçue de la cible (retard de réaction)
  }

  reset() {
    this.thrust = 0;
    this.turn = 0;
    this.perceived = null;
    this._lastTarget = null;
  }

  /**
   * ctx = { pos, rot, target, pickup, order, bounds }
   *  - pos    : position du vaisseau (Vector3)
   *  - rot    : cap courant (rad)
   *  - target : hostile le plus proche (ou null)
   *  - pickup : caisse la plus proche (ou null) — utilisée par RÉCUPÉRER
   *  - order  : consigne de conduite ('engage' | 'salvage' | 'break')
   *  - bounds : { x, y } limites de l'arène
   */
  update(dt, ctx) {
    const { pos, rot, bounds } = ctx;
    const order = ctx.order || 'engage';
    // RÉCUPÉRER : la caisse devient l'objectif, on ignore l'ennemi.
    const goal = order === 'salvage' && ctx.pickup ? ctx.pickup : null;
    // ESCORTE PAR DÉFAUT : sans ennemi en vue, il rejoignait... rien, et la
    // baleine restait immobile pendant tout le répit. Un barreur d'escorte se
    // porte sur le transport en retard : c'est son travail, et c'est là qu'on
    // aura besoin de lui.
    const escortTo = ctx.escort || null;
    const target = goal || ctx.target || escortTo;
    // On colle de plus près un civil qu'un ennemi (on le couvre, on ne l'affronte pas)
    const standoff = (!goal && !ctx.target && escortTo) ? TUNE.helmEscortDist : TUNE.helmStandoff;

    // Écarter des bords : priorité absolue, sinon il s'y colle bêtement.
    const margin = 22;
    let wantX = 0, wantY = 0;
    if (pos.x > bounds.x - margin) wantX = -1;
    else if (pos.x < -bounds.x + margin) wantX = 1;
    if (pos.y > bounds.y - margin) wantY = -1;
    else if (pos.y < -bounds.y + margin) wantY = 1;

    if (!target && !wantX && !wantY) {
      // Rien à faire : on laisse le vaisseau sur son erre.
      this.thrust = 0;
      this.turn = 0;
      return;
    }

    let desired; // cap souhaité (rad)
    let closing = 0; // +1 approcher / -1 s'écarter

    if (wantX || wantY) {
      desired = Math.atan2(wantY, wantX);
      closing = 1;
    } else {
      // Perception retardée : il met du temps à intégrer que la cible a bougé.
      // Sur changement d'objectif (consigne, nouvelle caisse), on repart net —
      // sinon il barrerait un moment vers l'objectif précédent.
      if (!this.perceived || this._lastTarget !== target) {
        this.perceived = target.position.clone();
        this._lastTarget = target;
      } else {
        this.perceived.lerp(target.position, Math.min(1, dt / Math.max(0.05, TUNE.helmReactionTau)));
      }

      _v.copy(this.perceived).sub(pos);
      _v.z = 0;
      const dist = _v.length() || 0.0001;
      desired = Math.atan2(_v.y, _v.x); // présente le nez à l'objectif
      if (goal) {
        // Une caisse se ramasse en la SURVOLANT : on va dessus, sans zone morte.
        closing = 1;
      } else if (order === 'break') {
        // ROMPRE : demi-tour, on s'écarte de la menace.
        desired += Math.PI;
        closing = 1;
      } else {
        const err = dist - standoff;
        // Zone morte : il ne fait pas l'accordéon autour de sa distance de consigne
        closing = Math.abs(err) < 4 ? 0 : (err > 0 ? 1 : -1);
      }
    }

    // Virage : on tourne vers le cap souhaité, proportionnellement à l'écart.
    let d = ((desired - rot + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (d < -Math.PI) d += Math.PI * 2;
    this.turn = THREE.MathUtils.clamp(d * 1.6, -1, 1);

    // On ne pousse franchement que si le nez pointe à peu près dans la bonne
    // direction (sinon on s'éloignerait de la consigne en accélérant).
    const aligned = Math.abs(d) < 0.7 ? 1 : Math.abs(d) < 1.4 ? 0.4 : 0;
    this.thrust = closing >= 0 ? closing * aligned : -0.6;
  }
}
