import { TUNE } from './Tune.js';
import { ENGINEER_ORDERS } from '../data/orders.js';

/**
 * POSTE D'INGÉNIEUR — le cinquième métier, et le dernier annoncé qui manquait.
 *
 * Il répare les SECTIONS de coque (cf. `HULL_CONFIG.sections`). Une section
 * tombée met ses modules hors service : le travail consiste donc à décider **quoi
 * remettre en marche d'abord**, sous le feu, avec un débit de réparation limité.
 *
 * RÈGLE DU PROJET : l'IA doit être compétente mais MÉDIOCRE, et son insuffisance
 * VISIBLE ET SITUÉE. Ici, l'équipage applique une règle bête — il colmate la
 * section **la plus abîmée** — alors que la bonne décision est presque toujours
 * ailleurs : remettre en marche le canon qui vient de se taire, ou la propulsion
 * avant d'essayer de rompre. On le voit donc rafistoler une poupe vide pendant
 * que le laser est éteint, et c'est exactement le signal « descends à la machine ».
 *
 * Le joueur au poste répare `engRepairPlayerMul` fois plus vite ET choisit la
 * section : les deux avantages sont nécessaires. Sans le choix il n'aurait aucune
 * valeur ajoutée ; sans le débit, choisir ne changerait rien à temps.
 *
 * CONSIGNE / EXÉCUTION, comme partout : le commandant peut poser la PRIORITÉ
 * (`ENGINEER_ORDERS`) depuis sa console, mais désigner la section précise et
 * bénéficier du débit accéléré n'appartient qu'au poste.
 */
export class Engineer {
  constructor() { this.reset(); }

  reset() {
    this.orderId = 'damage';   // priorité posée par le commandant
    this.target = null;        // section désignée par le joueur au poste
    this.progress = 0;         // pour l'affichage : ce qui a été réparé cette section
  }

  get order() {
    return ENGINEER_ORDERS.find((o) => o.id === this.orderId) || ENGINEER_ORDERS[0];
  }

  setOrder(id) {
    if (!ENGINEER_ORDERS.some((o) => o.id === id)) return false;
    this.orderId = id;
    return true;
  }

  /** Sections encore à réparer, dans l'ordre du plan de coque. */
  static pending(ship) {
    return ship.sectionList.filter((s) => s.hp < s.maxHp);
  }

  /**
   * La section que l'ÉQUIPAGE choisirait. Volontairement fruste : la plus abîmée,
   * en tenant compte de la priorité du commandant s'il en a posé une. Elle ignore
   * ce qui compte vraiment — quel module est éteint et s'il sert maintenant.
   */
  static crewPick(ship, order) {
    const pending = Engineer.pending(ship);
    if (!pending.length) return null;
    // La priorité du commandant restreint le champ ; s'il n'y a rien à faire dans
    // son périmètre, l'équipage retombe sur le reste plutôt que de rester inerte.
    const scoped = order?.sections
      ? pending.filter((s) => order.sections.includes(s.def.id))
      : pending;
    const pool = scoped.length ? scoped : pending;
    return pool.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a));
  }

  /**
   * Fait avancer la réparation d'une frame.
   * @param atPost le joueur tient-il le poste (débit accéléré + section choisie) ?
   * @param crewed l'équipage tient-il le poste ? (en transit, personne ne répare)
   * @returns { section, repaired, restored } pour l'annonce au HUD.
   */
  update(dt, ship, atPost, crewed) {
    this.section = null;
    if (!atPost && !crewed) return { section: null, repaired: 0, restored: false };

    let s = atPost ? this.target : null;
    // Section désignée déjà réparée (ou disparue) : on n'immobilise pas l'atelier.
    if (!s || s.hp >= s.maxHp) s = Engineer.crewPick(ship, this.order);
    if (!s) return { section: null, repaired: 0, restored: false };

    const rate = TUNE.engRepairRate * (atPost ? TUNE.engRepairPlayerMul : 1);
    const amount = rate * dt;
    const restored = ship.repairSection(s, amount);
    this.section = s;
    return { section: s, repaired: amount, restored };
  }
}
