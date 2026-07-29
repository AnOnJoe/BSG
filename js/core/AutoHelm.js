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
 *  - ENGAGER   : tient `TUNE.helmStandoff` face au plus proche hostile, et à défaut
 *                MÈNE vers la sortie du secteur ;
 *  - TENIR     : moteurs coupés, on ne bouge plus (mais on esquive si l'on dérive
 *                vers un rocher) ;
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
    this._side = 0;
    this._holdT = 0;
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
    // TENIR : le barreur coupe les moteurs et ne touche plus à la barre. Demandé en
    // partie test — il n'existait aucun moyen de dire « reste là », alors que c'est
    // la consigne qu'on veut pour couvrir un point ou attendre un traînard.
    // Il continue d'esquiver un obstacle vers lequel il DÉRIVE : tenir la position
    // ne veut pas dire se laisser écraser contre un rocher.
    if (order === 'hold') {
      this.turn = 0;
      const drift = ctx.terrain
        ? ctx.terrain.rayHit(pos.x, pos.y, Math.cos(rot), Math.sin(rot),
          10 + (ctx.radius || 4.2), (ctx.radius || 4.2) + 1)
        : null;
      // Un peu de marche arrière si on va toucher, sinon rien du tout.
      this.thrust = drift ? -0.5 : 0;
      return;
    }
    // RÉCUPÉRER : la caisse devient l'objectif, on ignore l'ennemi.
    const goal = order === 'salvage' && ctx.pickup ? ctx.pickup : null;
    // ESCORTE PAR DÉFAUT : sans ennemi en vue, il rejoignait... rien, et la
    // baleine restait immobile pendant tout le répit. Un barreur d'escorte se
    // porte sur le transport en retard : c'est son travail, et c'est là qu'on
    // aura besoin de lui.
    // ⚠ BOUCLE DE RÉTROACTION CORRIGÉE. Le barreur escortait systématiquement le
    // traînard, or le traînard est le transport le PLUS ÉLOIGNÉ de la baleine —
    // donc, la flotte suivant derrière, il est toujours EN ARRIÈRE. Le barreur
    // faisait demi-tour pour aller le chercher ; en consigne RALLIEMENT la flotte
    // suit la baleine, donc elle reculait avec lui, ce qui éloignait encore le
    // traînard. Mesuré : la baleine reculait de 45 unités en 25 s, cap en rotation
    // continue, 28 PV perdus dans les rochers, sans un seul ennemi.
    //
    // Règle : **si la flotte suit, la baleine MÈNE.** C'est le sens de l'ordre
    // RALLIEMENT, et c'est aussi ce qui fait progresser le calcul de saut (la
    // clarté dépend de l'avancée dans le couloir). On n'escorte un traînard que si
    // la flotte avance par elle-même (DISPERSER / FORCER) et qu'il a réellement
    // décroché.
    const leading = !!ctx.fleetFollows;
    const escortTo = (!leading && ctx.escort) ? ctx.escort : null;
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

    // MENER : sans ennemi ni caisse, on met le cap sur la sortie du secteur. Sans
    // ça la baleine restait immobile tout le répit (et la flotte avec, en
    // RALLIEMENT), le calcul restait au minimum de clarté, et il ne se passait
    // littéralement rien tant que le joueur ne prenait pas la barre.
    if (!target && !wantX && !wantY) { wantX = 1; }

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

    // ESQUIVE. Le barreur ignorait le décor et allait droit dans les rochers.
    // Il sonde devant lui et, s'il voit un obstacle, il infléchit son cap du côté
    // qui dégage — le contournement prime sur l'objectif, on y reviendra après.
    // ESQUIVE PAR MOUSTACHES. Trois versions ont été nécessaires, les deux
    // premières étaient fausses et c'est de là que venait le « fouillis » :
    //
    // 1. `desired = rot + away * 1.15` était RELATIF au cap courant et réappliqué
    //    à chaque frame : un intégrateur. Le cap faisait plus d'un tour complet.
    // 2. Version tangentielle : cap absolu, côté tenu — mieux, mais en champ dense
    //    elle REMPLAÇAIT l'objectif et la baleine partait de travers (mesuré :
    //    dérive de 57 unités en Y, cap bloqué à 2 rad, jamais arrivée).
    //
    // Version retenue, la plus simple et la plus robuste : on SONDE plusieurs caps
    // autour du cap voulu, du plus direct au plus détourné, et on prend le PREMIER
    // qui est dégagé. Le détour est donc toujours minimal et toujours orienté vers
    // l'objectif — contourner reste un détour, pas un changement de but.
    // Le signe du premier essai est mémorisé (`_side`) et tenu pendant `HOLD` :
    // sans cette hystérésis, dans un champ dense on re-choisit à chaque caillou
    // acquis et le cap papillonne (mesuré : 21 inversions en 25 s).
    if (ctx.terrain) {
      const pad = (ctx.radius || 4.2) + 1.5;   // on sonde à la LARGEUR de la coque
      const look = 24 + Math.abs(this.thrust) * 18;
      const clearAt = (a) => !ctx.terrain.rayHit(pos.x, pos.y, Math.cos(a), Math.sin(a), look, pad);
      this._holdT = Math.max(0, (this._holdT || 0) - dt);
      if (!clearAt(desired)) {
        const HOLD = 0.8;
        // Côté préféré : celui de la dernière esquive tant qu'elle est « chaude ».
        const first = this._holdT > 0 && this._side ? this._side : 1;
        let found = null;
        for (const step of [0.35, 0.7, 1.05, 1.4, 1.9, 2.5]) {
          for (const side of [first, -first]) {
            const a = desired + side * step;
            if (clearAt(a)) { found = { a, side }; break; }
          }
          if (found) break;
        }
        if (found) {
          desired = found.a;
          if (found.side !== this._side) this._holdT = HOLD;
          this._side = found.side;
        } else {
          // Complètement bouclé : on s'arrête plutôt que de foncer dans la masse.
          desired = rot;
          closing = 0;
        }
        // On lève le pied tant qu'on n'a pas dégagé : racler coûte de la coque.
        closing = Math.min(closing, 0.45);
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

    // ⚠ UNE ESCORTE RÈGLE SON ALLURE SUR CE QU'ELLE ESCORTE.
    // Signalé en partie test : « la baleine arrive très loin en avant de la flotte ».
    // Mesuré : en menant vers la sortie, l'écart passait à 101 unités en 8 s et la
    // bulle de saut se VIDAIT (0 transport sur 6) — donc ordonner le saut aurait
    // abandonné toute la flotte. Corriger en accélérant les transports serait faux
    // (« le plus lent commande le départ » est la contrainte du jeu) : c'est la
    // baleine qui doit lever le pied. Elle ne le fait QUE si la flotte la suit,
    // sinon on l'empêcherait de rompre ou d'aller intercepter.
    if (leading && ctx.fleetX !== undefined) {
      const lead = pos.x - ctx.fleetX;
      const slack = ctx.fleetLead ?? 45;
      // ⚠ ON RÈGLE L'ALLURE, ON NE COUPE PAS LES GAZ. Deux versions fausses avant
      // celle-ci :
      //  - ralentir proportionnellement : l'écart se stabilisait à 87 unités, donc
      //    au-delà du rayon de la bulle (78) — elle restait vide, et ordonner le
      //    saut aurait abandonné toute la flotte ;
      //  - couper franchement au-delà de `slack` : blocage mutuel, la baleine
      //    attendait la flotte qui attendait la baleine (en RALLIEMENT sa station
      //    est calée sur la baleine). Tout avançait à 1,3/s au lieu de 4.
      // Le bon modèle est un asservissement de VITESSE : au-delà de la marge, la
      // baleine se cale sur l'allure du convoi. Elle avance donc toujours — à leur
      // rythme, ce qui est exactement le métier d'une escorte.
      if (lead > slack * 1.7) {
        this.thrust = Math.min(this.thrust, -0.3);       // très loin devant : on revient
      } else if (lead > slack * 0.7) {
        const pace = ctx.fleetPace || 0;
        const own = ctx.speed || 0;
        // Tout ou rien sur la poussée : la traînée fait le reste et l'allure
        // s'établit d'elle-même autour de celle du convoi.
        this.thrust = own > pace ? 0 : Math.min(this.thrust, 0.7);
      }
    }
  }
}
