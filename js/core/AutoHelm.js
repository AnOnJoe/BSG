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
 *  - ENGAGER   : tient la PORTÉE DE SES ARMES face au plus proche hostile (bornée
 *                par la portée radar), et à défaut
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
    // POINT DE ROUTE DU JOUEUR — il PRIME sur tout le reste.
    //
    // Le contrôle direct aux flèches donnait un pilotage de kart, alors que le jeu
    // dit depuis le début que le plaisir vient du triage sous pression et pas de
    // l'adresse au pilotage : on ne barre pas un vaisseau capital comme une voiture,
    // on lui ORDONNE un point. Le clic pose donc une destination, et c'est ce même
    // barreur qui l'atteint — donc avec exactement la même inertie et la même esquive
    // que lorsqu'il conduit seul. Aucune duplication, aucun risque de divergence.
    //
    // Le waypoint est consommé à l'arrivée par `Range` (qui l'efface), pas ici : le
    // barreur ne décide de rien, il exécute — c'est le contrat de toutes ses consignes.
    const wp = ctx.waypoint || null;
    // RÉCUPÉRER : la caisse devient l'objectif, on ignore l'ennemi.
    const goal = wp || (order === 'salvage' && ctx.pickup ? ctx.pickup : null);
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
    // DISTANCE TENUE. ⚠ Elle était fixe (`helmStandoff`, 24) alors que le laser porte
    // à 40 : le barreur allait donc au contact sans raison. Signalé en partie test :
    // « notre vaisseau en mode attaque doit rester le plus loin possible tout en
    // permettant d'attaquer ». Elle est maintenant DÉRIVÉE de la portée réelle des
    // armes, et bornée par la portée RADAR — au-delà, l'équipage piste mal et sa
    // dispersion explose (cf. `crewNoRadarMul`), donc tenir plus loin serait tirer
    // pour rien. Corollaire : améliorer le radar permet de combattre de plus loin.
    let standoff;
    if (!goal && !ctx.target && escortTo) {
      // On colle de plus près un civil qu'un ennemi : on le couvre, on ne l'affronte pas.
      standoff = TUNE.helmEscortDist;
    } else {
      const reach = ctx.weaponReach || 0;
      const radar = ctx.radarRange || 0;
      let d = reach > 0 ? reach * TUNE.helmStandoffRatio : TUNE.helmStandoff;
      if (radar > 0) d = Math.min(d, radar);
      standoff = Math.max(TUNE.helmStandoff, d);
    }

    // Écarter des bords : priorité absolue, sinon il s'y colle bêtement.
    const margin = 46;   // à l'échelle du couloir agrandi (×2,1)
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
      } else if (wp) {
        // Un POINT DE ROUTE est un ordre précis du joueur, pas une cible à pister :
        // pas de retard de perception. Le barreur sait où on lui a dit d'aller.
        this.perceived.copy(target.position);
      } else {
        this.perceived.lerp(target.position, Math.min(1, dt / Math.max(0.05, TUNE.helmReactionTau)));
      }

      _v.copy(this.perceived).sub(pos);
      _v.z = 0;
      const dist = _v.length() || 0.0001;
      desired = Math.atan2(_v.y, _v.x); // présente le nez à l'objectif
      if (wp) {
        // On RALENTIT à l'approche et on s'arrête sur le point. Sans ce freinage la
        // baleine dépasse largement — elle est lourde, et « aller là » voudrait dire
        // « passer par là à pleine vitesse », ce qui est exactement le pilotage de
        // kart qu'on veut supprimer.
        closing = dist > TUNE.helmBrakeDist ? 1
          : dist > TUNE.helmArriveDist ? dist / TUNE.helmBrakeDist : 0;
      } else if (goal) {
        // Une caisse se ramasse en la SURVOLANT — mais une masse qui fonce la RATE, et
        // pour toujours. ⚠ Vu en partie test : « le pilote auto tourne autour de la
        // caisse ». C'est de la géométrie, pas du réglage : à pleine vitesse le rayon de
        // giration de la baleine vaut v/ω ≈ 16,9 / 0,33 ≈ **51 unités**, or le ramassage
        // se fait à 6,6 (coque 4,2 + caisse 2,4). Une fois la caisse décalée du nez, la
        // baleine ne peut physiquement plus resserrer son cercle dessus : elle s'installe
        // en orbite stable à ~20 unités, cible à 60° du nez, indéfiniment.
        // On freine donc à l'approche comme pour un point de route — en vitesse réduite
        // le cercle de giration devient plus petit que la caisse — mais avec un PLANCHER,
        // jamais l'arrêt : le point de route se pose À CÔTÉ, une caisse se traverse.
        closing = dist > TUNE.helmBrakeDist ? 1
          : Math.max(0.25, dist / TUNE.helmBrakeDist);
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
    // ⚠ UN POINT DE ROUTE EST EXCLU DE CET ASSERVISSEMENT. Mesuré : la baleine
    // approchait le point à 20 unités puis s'y bloquait indéfiniment (vitesse 1,1,
    // distance qui remontait à 22) — parce que la flotte était loin derrière, donc
    // `lead > slack × 1,7` et la poussée était forcée à −0,3. Or le cas NORMAL du
    // clic est justement de désigner un point DEVANT la flotte pour la mener : sans
    // cette exclusion, l'ordre du joueur est silencieusement annulé par une consigne
    // d'escorte. Le point de route prime sur tout, y compris sur le confort du convoi
    // — garder la flotte groupée redevient la responsabilité du joueur, ce qui est
    // exactement le sens de prendre la main.
    if (!wp && leading && ctx.fleetX !== undefined) {
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
