import * as THREE from 'three';
import { TRANSPORT_TYPES, FLEET } from '../data/convoyConfig.js';
import { FLEET_ORDERS } from '../data/orders.js';
import { TUNE } from '../core/Tune.js';

/**
 * Stations en RALLIEMENT, en X relatif à la baleine. Dimensionnées sur le CHAMP
 * VISIBLE (~81 × 56 unités, donc ±41 en X) et non sur l'arène : deux devant, quatre
 * autour et derrière. Une escorte encadre ce qu'elle protège — et surtout, on doit
 * VOIR ce qu'on escorte, sinon la consigne ne veut rien dire.
 */
/**
 * Stations en RALLIEMENT, en PART DE LA DEMI-LARGEUR VISIBLE (et non en unités
 * absolues, sinon changer le zoom sort la flotte du champ). Deux devant, quatre
 * autour et derrière : une escorte encadre ce qu'elle protège — et surtout, on doit
 * VOIR ce qu'on escorte.
 */
const FOLLOW_X = [-0.63, -0.20, 0.29, -0.44, 0.05, -0.73];

/**
 * PLAN DE PROFONDEUR DE LA FLOTTE CIVILE.
 *
 * ⚠ Signalé en partie test : « si je passe sur un navire civil il faut que tout le
 * vaisseau soit sur le même axe z ; là on a des parties qui se retrouvent cachées
 * par moi et d'autres devant moi ». Exact, et c'était mécanique : tout le monde était
 * à z = 0, et les volumes sont extrudés de part et d'autre. La baleine occupe
 * z ∈ [−0,8 ; +0,8] (coque de 1,6 d'épaisseur) tandis qu'une citerne occupe
 * [−2,2 ; +2,2], plus ses réservoirs à +2,25. Une moitié du transport passait donc
 * DEVANT la baleine et l'autre DERRIÈRE, ce qui est incohérent à l'œil.
 *
 * Les civils sont donc entièrement sur un plan en RETRAIT, choisi pour que le point
 * le plus avancé du plus épais d'entre eux (+2,25) reste derrière le point le plus
 * reculé de la baleine (−0,8). Les collisions et la bulle de saut ne travaillent
 * qu'en X/Y : ce décalage ne change rien au jeu, seulement à la lecture.
 */
export const CONVOY_Z = -6;
import { makeSolid, neonLineMat } from '../core/NeonMaterials.js';

/**
 * Un transport civil. Il expose `position` / `radius` / `takeDamage()` comme
 * toute autre cible, ce qui lui vaut d'être ciblable par les Cylons sans ligne
 * de code spéciale — et c'est bien le problème du joueur.
 *
 * Il ne tire pas, ne manœuvre pas, ne se défend pas. Il avance, c'est tout.
 */
class Transport {
  constructor(typeId, lane) {
    const def = TRANSPORT_TYPES[typeId];
    this.def = def;
    this.id = `${typeId}-${lane}`;
    this.name = def.name;
    this.souls = def.souls;
    // Multiplicateur global de PV (panneau T). Appliqué au MONTAGE : changer le
    // réglage en pleine bataille ne doit pas soigner ni tuer la flotte d'un coup.
    this.maxHp = def.hp * TUNE.convoyHpMul;
    this.hp = this.maxHp;
    this.radius = def.radius;
    this.alive = true;
    this.jumped = false;   // a franchi le saut (donc sauvé)
    this.lane = lane;      // décalage latéral dans la formation
    this.group = new THREE.Group();
    this._build();
  }

  /**
   * Chaque type a sa PROPRE construction. Auparavant tous partaient du même
   * profil extrudé avec les mêmes hublots : à l'écran, ils se ressemblaient tous.
   * Ce sont les superstructures, conteneurs, réservoirs et nacelles qui font
   * qu'on les distingue d'un coup d'œil — et qu'on sait lequel on est en train
   * de perdre.
   */
  _build() {
    const d = this.def;
    const shape = new THREE.Shape(d.profile.map((p) => new THREE.Vector2(p[0], p[1])));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: d.depth || 2.2, bevelEnabled: false, steps: 1 });
    geo.translate(0, 0, -(d.depth || 2.2) / 2);
    this.body = makeSolid(geo, d.color, { fill: d.fill, thresholdAngle: 24 });
    this.group.add(this.body);

    const zf = (d.depth || 2.2) / 2 + 0.05;
    const add = (g) => this.group.add(g);
    const box = (w, h, dp, color, fill) => makeSolid(new THREE.BoxGeometry(w, h, dp), color, { fill });

    // Superstructure à étages (paquebot) : une ville qui flotte
    if (d.decks) {
      for (let i = 0; i < d.decks; i++) {
        const w = 9 - i * 2.4, h = 0.8;
        const deck = box(w, h, 1.6 - i * 0.3, d.color, d.fill);
        deck.position.set(-1 + i * 0.6, 2.6 + i * 0.95, 0);
        add(deck);
      }
      const mast = box(0.2, 2.2, 0.2, d.color, d.fill);
      mast.position.set(-1 + d.decks * 0.6, 2.6 + d.decks * 0.95 + 0.9, 0);
      add(mast);
    }

    // Réservoirs cylindriques (citerne) : silhouette bombée, très reconnaissable
    if (d.tanks) {
      for (let i = 0; i < d.tanks; i++) {
        const cyl = new THREE.CylinderGeometry(2.6, 2.6, 8.4, 12, 1, true);
        cyl.rotateZ(Math.PI / 2);
        const t = makeSolid(cyl, d.color, { fill: d.fill, thresholdAngle: 40 });
        t.position.set(-1, (i - (d.tanks - 1) / 2) * 5.2, 0);
        add(t);
      }
    }

    // Conteneurs empilés (cargo) : anguleux, dépareillés
    if (d.crates) {
      const tint = [0x9fd6b0, 0xffd08a, 0xff9fb5, 0x9fc4ff];
      for (let i = 0; i < d.crates; i++) {
        const c = box(2.4, 1.7, 1.7, tint[i % tint.length], 0x101a14);
        c.position.set(-7.5 + (i % 4) * 3.1, 2.4 + Math.floor(i / 4) * 1.9, 0);
        add(c);
      }
    }

    // Croix lumineuse (navire-hôpital) : identifiable même de loin
    if (d.cross) {
      for (const [w, h] of [[3.4, 1.0], [1.0, 3.4]]) {
        const bar = new THREE.Mesh(
          new THREE.PlaneGeometry(w, h),
          new THREE.MeshBasicMaterial({ color: 0xff4d6a })
        );
        bar.position.set(1, 0, zf);
        add(bar);
      }
    }

    // Nacelles latérales (transport de passagers)
    if (d.pods) {
      for (const sy of [1, -1]) {
        const pod = new THREE.CylinderGeometry(1.1, 1.1, 7, 10, 1, true);
        pod.rotateZ(Math.PI / 2);
        const p = makeSolid(pod, d.color, { fill: d.fill, thresholdAngle: 40 });
        p.position.set(-2, sy * 3.2, 0);
        add(p);
      }
    }

    // Tuyères (remorqueur : il n'est presque que ça)
    const nz = d.nozzles || 2;
    for (let i = 0; i < nz; i++) {
      const cone = new THREE.ConeGeometry(0.75, 1.5, 8, 1, true);
      cone.rotateZ(Math.PI / 2);
      const c = makeSolid(cone, d.color, { fill: d.fill, thresholdAngle: 40 });
      c.position.set(d.profile[Math.floor(d.profile.length / 2)][0] - 1.2,
        (i - (nz - 1) / 2) * 1.9, 0);
      add(c);
      const glow = new THREE.Mesh(
        new THREE.CircleGeometry(0.55, 10),
        new THREE.MeshBasicMaterial({ color: 0xffc06a, transparent: true, opacity: 0.85 })
      );
      glow.position.set(c.position.x - 0.9, c.position.y, 0);
      add(glow);
    }

    // Hublots : ce sont des gens à bord, il faut que ça se voie
    const n = d.windows || 6;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(1, n - 1);
      pts.push(new THREE.Vector3(-8 + t * 16, 0.9, zf));
    }
    this.group.add(new THREE.Points(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.PointsMaterial({ color: 0xffe9b0, size: 0.55 })
    ));
  }

  get position() { return this.group.position; }
  isAlive() { return this.alive; }

  /**
   * Vitesse réelle. Sous `HURT_AT` de coque, la propulsion est touchée et le
   * transport DÉCROCHE du convoi. C'est de là que doit naître le retardataire :
   * on le perd parce qu'il s'est fait mordre, pas à cause d'un décalage arbitraire
   * décidé au départ.
   */
  /** Allure nominale, multiplicateur global compris (réglable au panneau T). */
  get baseSpeed() { return this.def.speed * TUNE.convoySpeedMul; }

  get effSpeed() {
    const ratio = this.hp / this.maxHp;
    const at = TUNE.crippledAt;
    if (ratio >= at) return this.baseSpeed;
    // La pénalité doit être SÉVÈRE : à −55 % seulement, un cargo blessé (4,13)
    // restait plus rapide que la citerne saine (4,0), donc il ne décrochait
    // jamais et le dilemme n'existait pas. Au seuil → `crippledSpeedMin + range`
    // de l'allure, à 0 % de coque → `crippledSpeedMin`.
    const min = TUNE.crippledSpeedMin;
    return this.baseSpeed * (min + (ratio / Math.max(0.01, at)) * (0.5 - min));
  }

  get crippled() { return this.hp / this.maxHp < TUNE.crippledAt; }

  /** Halo « en retard » : ambre, et rouge pulsant quand le saut n'attend plus que lui. */
  setLaggard(on, urgent) {
    if (on && !this.halo) {
      const r = this.radius * 1.9;
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * r * 1.5, Math.sin(a) * r, 0));
      }
      this.halo = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(pts),
        neonLineMat(0xffaa33, 0.85)
      );
      this.group.add(this.halo);
    }
    if (this.halo) {
      this.halo.visible = !!on;
      this.halo.material.color.setHex(urgent ? 0xff4466 : 0xffaa33);
      this.halo.material.opacity = urgent ? 0.6 + Math.abs(Math.sin(Date.now() / 160)) * 0.4 : 0.7;
    }
  }

  takeDamage(d) {
    if (!this.alive) return;
    this.hp -= d;
    const t = 1 - Math.max(0, this.hp) / this.maxHp;
    this.body.userData.edgeMat.color.set(new THREE.Color(this.def.color).lerp(new THREE.Color(0xff4433), t));
    if (this.hp <= 0) { this.alive = false; this.group.visible = false; }
  }
}

/**
 * LA FLOTTE. Elle progresse vers le point de saut à la vitesse de son élément le
 * plus lent — donc protéger le traînard est une contrainte, pas une option.
 *
 * `souls` compte les survivants encore en vie ; un transport détruit les emporte
 * définitivement. C'est la véritable barre de vie de la partie.
 */
export class Convoy {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.transports = [];
    this.lostSouls = 0;
  }

  /** Place la flotte à l'entrée du couloir, en formation lâche. */
  build(fleet, startX, spanY) {
    this.clear();
    fleet.forEach((typeId, i) => {
      const t = new Transport(typeId, i);
      const rows = Math.ceil(fleet.length / 2);
      const col = i % 2, row = Math.floor(i / 2);
      t.group.position.set(
        startX - col * 55 - row * 8,
        (row - (rows - 1) / 2) * (spanY / Math.max(1, rows)) * 1.1,
        CONVOY_Z
      );
      this.transports.push(t);
      this.group.add(t.group);
    });
    return this;
  }

  clear() {
    while (this.group.children.length) {
      const c = this.group.children[0];
      this.group.remove(c);
      c.traverse?.((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    }
    this.transports = [];
  }

  setVisible(v) { this.group.visible = v; }

  get alive() { return this.transports.filter((t) => t.alive && !t.jumped); }
  get lost() { return this.transports.filter((t) => !t.alive); }
  get saved() { return this.transports.filter((t) => t.jumped); }

  /** Survivants encore embarqués (les sautés comptent : ils sont sauvés). */
  get souls() {
    return this.transports.filter((t) => t.alive).reduce((s, t) => s + t.souls, 0);
  }

  /**
   * LA FLOTTE EST L'ÉCONOMIE. Les fonctions encore assurées — on interroge
   * `t.alive` et NON le getter `alive` (qui exclut les sautés) : un transport
   * qui a franchi le saut continue évidemment de rendre ses services au secteur
   * suivant. Une fonction perdue l'est pour toute la traversée.
   */
  get roles() {
    return new Set(this.transports.filter((t) => t.alive).map((t) => t.def.role).filter(Boolean));
  }

  hasRole(role) { return this.roles.has(role); }

  /** Le transport qui assure cette fonction, vivant ou non (pour l'affichage). */
  bearerOf(role) { return this.transports.find((t) => t.def.role === role) || null; }

  /**
   * Allure du convoi : celle du plus lent VALIDE. Les éclopés ne la commandent
   * pas — sinon toute la flotte se calerait sur le blessé et personne ne
   * décrocherait jamais, donc aucun dilemme.
   */
  get speed() {
    const list = this.alive.filter((t) => !t.crippled);
    const pool = list.length ? list : this.alive;
    if (!pool.length) return 0;
    return Math.min(...pool.map((t) => t.baseSpeed));
  }

  /**
   * Celui qu'il faut couvrir : le plus éloigné du point de rassemblement (la
   * baleine). Sans centre fourni, on retombe sur « le plus en arrière ».
   */
  laggardFrom(cx, cy) {
    const list = this.alive;
    if (!list.length) return null;
    // Priorité aux ÉCLOPÉS : c'est celui qui ne suivra pas qu'il faut désigner,
    // pas simplement celui qui se trouve au bord de la formation.
    const pool = list.some((t) => t.crippled) ? list.filter((t) => t.crippled) : list;
    if (cx === undefined) return pool.reduce((a, b) => (b.position.x < a.position.x ? b : a));
    const d2 = (t) => (t.position.x - cx) ** 2 + (t.position.y - cy) ** 2;
    return pool.reduce((a, b) => (d2(b) > d2(a) ? b : a));
  }

  get laggard() { return this.laggardFrom(this._cx, this._cy); }

  /** Mémorise le point de rassemblement courant (la baleine). */
  setGatherPoint(x, y) { this._cx = x; this._cy = y; }

  /** Transports dans / hors de la bulle de saut. */
  splitByBubble(cx, cy, radius) {
    const inside = [], outside = [];
    for (const t of this.alive) {
      (Math.hypot(t.position.x - cx, t.position.y - cy) <= radius ? inside : outside).push(t);
    }
    return { inside, outside };
  }

  /** N'allume le halo que sur le retardataire, l'éteint sur les autres. */
  markLaggard(target, urgent) {
    for (const t of this.transports) {
      if (t.alive) t.setLaggard(t === target, !!urgent);
    }
  }

  /** Le plus proche d'un point (les Cylons prennent le plus accessible). */
  nearestTo(x, y) {
    let best = null, bd = Infinity;
    for (const t of this.alive) {
      const d = (t.position.x - x) ** 2 + (t.position.y - y) ** 2;
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  /**
   * Déplacement de la flotte.
   *
   * ⚠ RÉÉCRIT après une partie test. L'ancienne version avait trois défauts, tous
   * signalés par l'utilisateur d'une phrase chacun :
   *
   * 1. « la flotte se déplace comme un bloc où on aurait regroupé tous les
   *    vaisseaux ». C'était littéral : un même `wantY` lissé au même taux pour
   *    tous, et tous à la vitesse du plus lent. Chaque transport a maintenant sa
   *    propre inertie, sa propre allure de croisière (jitter par vaisseau, stable
   *    d'une frame à l'autre) et son propre retard à rejoindre sa station.
   * 2. « la baleine arrive très loin en avant de la flotte ». En RALLIEMENT, la
   *    station visée se déplaçait avec la baleine mais la flotte ne pouvait jamais
   *    dépasser son allure nominale : dès que la baleine allait plus vite, l'écart
   *    croissait SANS BORNE. Un convoi qui rattrape son escorte pousse ses moteurs :
   *    d'où `CATCHUP`, un facteur d'allure autorisé quand on est distancé.
   * 3. Les transports finissaient DANS la roche : la sonde regardait toujours vers
   *    +X (même quand ils manœuvraient vers la baleine, dans une autre direction),
   *    ne tenait pas compte de leur propre rayon, et se battait contre le lissage
   *    de formation. Elle suit désormais la direction réelle de marche, sonde à la
   *    largeur de la coque, et l'esquive PRIME sur la formation le temps de dégager.
   */
  update(dt, limitX, terrain, orderId, gather, arena, holding = false, viewHalfW = 41) {
    const order = FLEET_ORDERS.find((o) => o.id === orderId) || FLEET_ORDERS[0];
    // Étalement : sur la HAUTEUR VISIBLE (≈ demi-largeur / aspect) pour RALLIEMENT,
    // sur l'arène pour DISPERSER — disperser doit justement sortir du champ.
    const span = order.follow
      ? viewHalfW * 0.62 * order.spread * 4
      : (arena ? arena.y : 108) * order.spread;
    const list = this.alive;
    // Jusqu'où un transport distancé peut pousser ses moteurs pour recoller.
    // Réglable : à 1 l'écart croît sans borne dès que la baleine va plus vite, trop
    // haut et « le plus lent commande le départ » ne veut plus rien dire.
    const CATCHUP = TUNE.convoyCatchup;

    list.forEach((t, i) => {
      // --- une vie propre ---------------------------------------------------
      // Traits stables tirés une fois par vaisseau : sans eux ils bougent tous
      // exactement pareil, et six coques distinctes se lisent comme un bloc.
      if (t._trait === undefined) {
        t._trait = {
          pace: 0.9 + ((i * 0.173) % 1) * 0.22,   // allure de croisière propre
          lag: 0.35 + ((i * 0.317) % 1) * 0.5,    // mollesse à rejoindre sa station
          drift: ((i * 0.611) % 1) * Math.PI * 2, // phase de son balancement
          off: (((i * 0.437) % 1) * 2 - 1) * 9,   // décalage de station personnel
        };
        t._vx = 0; t._vy = 0;
        t._side = 0; t._hold = 0;
      }
      const tr = t._trait;
      tr.drift += dt * 0.35;

      // --- station visée ----------------------------------------------------
      const slot = list.length > 1 ? (i / (list.length - 1)) * 2 - 1 : 0;
      const centerY = gather ? gather.y : 0;
      // Le balancement propre évite la formation au cordeau, qui est ce qui donnait
      // l'impression d'un seul objet rigide.
      const wantY = centerY + slot * span + tr.off * 0.35 + Math.sin(tr.drift) * 2.6;
      let wantX;
      if (order.follow && gather) {
        // RALLIEMENT : ⚠ ils se rangent AUTOUR de la baleine, pas en file derrière.
        // Mesuré avant correction : 1 transport visible sur 6 (champ visible 81×56
        // unités, transports à 34-71). On escortait une flotte qu'on ne voyait pas.
        // Les stations sont donc dimensionnées sur l'ÉCRAN et non sur l'arène, et
        // réparties de part et d'autre — une escorte encadre ce qu'elle protège.
        // (Le cas TENIR est identique : la station suit la baleine, qui ne bouge
        // plus. Pas besoin d'une branche séparée.)
        wantX = gather.x + FOLLOW_X[i % FOLLOW_X.length] * viewHalfW + tr.off * 0.3;
      } else {
        // Sinon ils poussent vers la sortie du secteur, chacun à son allure.
        wantX = Math.min(limitX, t.position.x + 60);
      }

      // --- cap et allure ----------------------------------------------------
      let dx = wantX - t.position.x;
      let dy = wantY - t.position.y;
      const dist = Math.hypot(dx, dy);
      // Allure : la sienne, bridée par celle du convoi… sauf s'il est distancé,
      // auquel cas il pousse ses moteurs pour recoller (sinon l'écart explose).
      const behind = order.follow && gather ? Math.max(0, gather.x - 40 - t.position.x) : 0;
      const urge = 1 + Math.min(CATCHUP - 1, behind / 70);
      // ⚠ Le plafond doit être appliqué APRÈS `urge`, sinon ce n'est pas un plafond :
      // en le multipliant ensuite on mesurait des transports à 10,9 alors qu'ils
      // plafonnent nominalement à 5,6 — plus rapides que la baleine, et « le plus
      // lent commande le départ » ne voulait plus rien dire.
      const cruise = Math.min(t.effSpeed * tr.pace * urge, t.effSpeed * CATCHUP) * order.speedMul;

      let ux = dist > 0.01 ? dx / dist : 1;
      let uy = dist > 0.01 ? dy / dist : 0;

      // --- esquive (prime sur la formation) ---------------------------------
      if (terrain) {
        const pad = t.radius + 2;
        const look = t.radius + 20;
        t._hold = Math.max(0, t._hold - dt);
        const clearAt = (ax, ay) => !terrain.rayHit(t.position.x, t.position.y, ax, ay, look, pad);
        if (!clearAt(ux, uy)) {
          const base = Math.atan2(uy, ux);
          const first = t._hold > 0 && t._side ? t._side : (t.position.y >= centerY ? 1 : -1);
          let found = null;
          for (const step of [0.4, 0.8, 1.2, 1.7, 2.4]) {
            for (const side of [first, -first]) {
              const a = base + side * step;
              if (clearAt(Math.cos(a), Math.sin(a))) { found = { a, side }; break; }
            }
            if (found) break;
          }
          if (found) {
            ux = Math.cos(found.a); uy = Math.sin(found.a);
            if (found.side !== t._side) t._hold = 0.9;
            t._side = found.side;
          } else {
            ux = 0; uy = 0;   // enfermé : on attend plutôt que de forcer dans la masse
          }
        }
      }

      // --- SÉPARATION MUTUELLE ---------------------------------------------
      // Les voies libres du décor étant les seuls passages, les six coques
      // convergeaient toutes dans la même et se chevauchaient (étalement mesuré à
      // 9,9 unités pour six vaisseaux de rayon 6). Elles se repoussent donc entre
      // elles : c'est ce qui fait une FLOTTE plutôt qu'un tas.
      for (const o of list) {
        if (o === t) continue;
        const sx = t.position.x - o.position.x;
        const sy = t.position.y - o.position.y;
        const d = Math.hypot(sx, sy);
        const min = t.radius + o.radius + 4;
        if (d > min || d < 0.01) continue;
        const push = (min - d) / min;
        ux += (sx / d) * push * 3.2;
        uy += (sy / d) * push * 3.2;
      }
      // …et de la BALEINE. La répulsion mutuelle ne la concernait pas : un transport
      // finissait à 1 unité d'elle, donc encastré dedans à l'écran. Une escorte se
      // tient à distance de ce qu'elle escorte.
      if (gather) {
        const sx = t.position.x - gather.x, sy = t.position.y - gather.y;
        const d = Math.hypot(sx, sy);
        const min = t.radius + 9;
        if (d < min && d > 0.01) {
          const push = (min - d) / min;
          ux += (sx / d) * push * 3.2;
          uy += (sy / d) * push * 3.2;
        }
      }
      { const n = Math.hypot(ux, uy); if (n > 0.01) { ux /= n; uy /= n; } }

      // --- intégration : de l'inertie, chacun la sienne ---------------------
      const want = dist < 3 ? 0 : cruise;
      const k = Math.min(1, dt / Math.max(0.05, tr.lag));
      t._vx += (ux * want - t._vx) * k;
      t._vy += (uy * want - t._vy) * k;
      t.position.x += t._vx * dt;
      t.position.y += t._vy * dt;
      if (!order.follow) t.position.x = Math.min(t.position.x, limitX);

      // ⚠ CAP DU TRANSPORT. Ils n'avaient **aucune** rotation (`rotation.z` restait à 0
      // pour toujours) : un cargo qui montait en formation se déplaçait donc en crabe,
      // proue obstinément vers la sortie. C'est le contraire de ce qu'on veut vendre
      // (« il faut imaginer de gros vaisseaux lents ») : une masse tourne LENTEMENT,
      // mais elle tourne, et c'est précisément cette lenteur qui se voit et qui pèse.
      // La proue est en +X (cf. les profils dans `convoyConfig`), donc aucun décalage.
      // Le taux est divisé par la mollesse propre du navire (`lag` ∈ [0,35 ; 0,85]) :
      // six masses qui ne virent pas ensemble, et jamais toutes à la même vitesse.
      // ⚠ RÉGLABLE (`TUNE.convoyTurnRate`) et pas codé en dur : il l'était à 0,18, et sur
      // un « la vitesse de rotation des civils n'est pas bonne » il était impossible de
      // savoir s'il fallait monter ou descendre sans toucher au code. C'est exactement le
      // cas que la règle du panneau T existe pour éviter.
      const spd = Math.hypot(t._vx, t._vy);
      if (spd > 0.4) {
        const wantRot = Math.atan2(t._vy, t._vx);
        let dr = ((wantRot - t.group.rotation.z + Math.PI) % (Math.PI * 2)) - Math.PI;
        if (dr < -Math.PI) dr += Math.PI * 2;
        t.group.rotation.z += dr * Math.min(1, dt * (TUNE.convoyTurnRate / Math.max(0.35, tr.lag)));
      }

      // FORCER : les moteurs s'usent, et ça se paie en coque.
      if (order.wear) t.takeDamage(order.wear * dt);

      // Garde-fou de dernier recours : on ne laisse JAMAIS un transport dans la
      // roche, même si l'esquive a échoué.
      if (terrain) terrain.push(t.position, t.radius);
    });
  }

  /** Marque comme sauvés les transports arrivés dans le rayon du saut. */
  jump(cx, cy, radius) {
    const out = { saved: [], left: [] };
    for (const t of this.alive) {
      if (Math.hypot(t.position.x - cx, t.position.y - cy) <= radius) {
        t.jumped = true;
        t.group.visible = false;
        out.saved.push(t);
      } else {
        // Resté en arrière : le saut part sans lui, il est perdu corps et biens
        t.alive = false;
        t.group.visible = false;
        this.lostSouls += t.souls;
        out.left.push(t);
      }
    }
    return out;
  }

  /**
   * Réengage les transports sauvés dans le secteur suivant.
   *
   * ⚠ `spanY` est la LARGEUR TOTALE de la formation, et l'appelant lui passait
   * `ARENA.y * 1.2`. Tant que l'arène faisait 108 de haut ça donnait 130, soit à peu
   * près un écran ; après le rescale (420) ça donnait **504 pour un champ visible haut
   * de 146** — deux rangées sur trois naissaient hors de l'écran. Grief exact :
   * « après un 1er saut la baleine et les civils sont très loin ». Régression typique
   * d'un changement d'échelle : la formule était juste, sa donnée d'entrée ne l'était
   * plus. On sort donc du couloir pour se caler sur le CHAMP VISIBLE (cf. les autres
   * grandeurs dérivées : `gatherView`, `helmLeadView`, `FOLLOW_X`).
   */
  redeploy(startX, spanY) {
    const keep = this.saved;
    for (const t of keep) {
      t.jumped = false;
      t.group.visible = true;
    }
    const rows = Math.ceil(Math.max(1, keep.length) / 2);
    keep.forEach((t, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      t.position.set(
        startX - col * 55 - row * 8,
        (row - (rows - 1) / 2) * (spanY / Math.max(1, rows)) * 1.1,
        CONVOY_Z
      );
      // On sort d'un saut : tout le monde est aligné sur la sortie, pas de cap hérité
      // du secteur précédent (ils tournent maintenant, cf. `update`).
      t.group.rotation.z = 0;
      t._vx = 0; t._vy = 0;
    });
    return keep.length;
  }
}
