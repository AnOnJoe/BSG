/**
 * LE DÉNOUEMENT — « on ne sait pas comment ils nous trouvent ».
 *
 * C'est le ressort le plus fort de la saison, et il n'était pas exploité. Il se
 * joue au DERNIER secteur, et il retourne le jeu : depuis le début on protège
 * six coques, et la seule sortie consiste à en détruire une soi-même.
 *
 * Pourquoi ici et pas plus tôt : détruire un de ses transports ne pesait rien
 * tant que les âmes n'étaient qu'un compteur. Ce n'est qu'avec l'économie de
 * flotte (`FLEET_ROLES`) que le sacrifice ampute réellement — et le coupable
 * étant tiré au hasard, ce peut être la citerne dont on a besoin pour forcer le
 * calcul, ou le paquebot et ses 20 400 âmes.
 *
 * LE DILEMME est un arbitrage d'information contre temps :
 *  - chaque RELEVÉ écarte un innocent à coup sûr, mais coûte de la charge FTL,
 *    c'est-à-dire précisément ce qui permet de fuir. Attendre la certitude, c'est
 *    subir des assauts supplémentaires ;
 *  - on peut tirer AVANT d'être sûr. Moins cher en calcul, mais tuer un innocent
 *    coûte ses âmes, sa fonction, et ne rompt pas la boucle.
 *
 * Le tir sur un civil doit être un ORDRE EXPLICITE (`designate`) : sans ça, une
 * balle perdue massacrerait la flotte qu'on est venu sauver, et ce serait subi
 * au lieu d'être décidé.
 */
export class SignalHunt {
  constructor() { this.reset(); }

  reset() {
    this.active = false;
    this.culprit = null;      // le transport compromis (tiré au sort)
    this.cleared = new Set(); // transports écartés par les relevés
    this.fixes = 0;           // relevés effectués
    this.designated = null;   // transport sur lequel le tir est autorisé
    this.resolved = false;    // le coupable a été détruit : la boucle est rompue
    this.wrongKills = [];     // innocents abattus (pour le récit de fin)
  }

  /**
   * Ouvre la chasse sur la flotte encore en vie. Le coupable est tiré au sort
   * parmi les survivants : on ne peut donc pas apprendre la réponse par cœur, et
   * sa fonction perdue ne sera pas la même d'une partie à l'autre.
   */
  start(transports) {
    const alive = transports.filter((t) => t.alive);
    if (!alive.length) return false;
    this.reset();
    this.active = true;
    this.culprit = alive[Math.floor(Math.random() * alive.length)];
    return true;
  }

  /** Suspects restants : vivants et non écartés. */
  suspects(transports) {
    return transports.filter((t) => t.alive && !this.cleared.has(t));
  }

  /** Un seul suspect : le relèvement est établi. */
  certain(transports) { return this.suspects(transports).length === 1; }

  /**
   * RELEVÉ. Écarte un innocent — jamais le coupable, et donc toujours un progrès :
   * un relevé qui pourrait ne rien apprendre transformerait la déduction en
   * loterie, et payer de la charge FTL pour rien serait juste frustrant.
   * @returns le transport écarté, ou null s'il n'y a plus rien à écarter.
   */
  fix(transports) {
    const innocents = this.suspects(transports).filter((t) => t !== this.culprit);
    if (!innocents.length) return null;
    const out = innocents[Math.floor(Math.random() * innocents.length)];
    this.cleared.add(out);
    this.fixes++;
    return out;
  }

  /** Autorise (ou retire) le tir sur un civil. */
  designate(t) {
    this.designated = this.designated === t ? null : t;
    return this.designated;
  }

  /** Le tir du joueur peut-il toucher ce transport ? */
  canFireOn(t) { return this.active && this.designated === t; }

  /**
   * À appeler quand un transport meurt. Renvoie ce que ça signifie, pour que
   * `Range` sache quoi annoncer — et il FAUT l'annoncer : abattre un innocent
   * sans retour explicite laisserait le joueur croire que la boucle est rompue.
   */
  onTransportLost(t) {
    if (!this.active || this.resolved) return 'none';
    if (t === this.culprit) { this.resolved = true; return 'culprit'; }
    if (this.designated === t) { this.wrongKills.push(t); this.designated = null; return 'innocent'; }
    return 'none';
  }
}
