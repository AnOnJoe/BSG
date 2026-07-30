import { HallOfFame } from '../core/HallOfFame.js';
import { FLEET, TRANSPORT_TYPES, FLEET_ROLES, totalSouls } from '../data/convoyConfig.js';
import { SECTORS } from '../data/campaign.js';

/**
 * MENU DE DÉPART.
 *
 * Le jeu s'ouvrait sur le hangar, ce qui ne tenait plus : on n'est pas un
 * chantier naval qui prépare une expédition, on est une flotte déjà en fuite.
 * Le hangar est devenu le PONT HANGAR, une escale entre deux sauts — il ne peut
 * donc plus servir d'écran d'accueil.
 *
 * Ce menu dit ce qu'on va faire et à quoi on tient : les six coques et ce que
 * chacune porte. Le joueur doit savoir AVANT de partir que la citerne conditionne
 * le calcul forcé et que le remorqueur porte l'atelier — sinon il apprendra ces
 * règles en les perdant, ce qui est punitif au lieu d'être tragique.
 *
 * Même contrat que les autres écrans : `enter()` / `exit()` / `update(dt)`.
 */
export class StartMenu {
  constructor(app) {
    this.app = app;
    this.ui = document.getElementById('menu-ui');
    this._onKey = (e) => this._key(e);
  }

  enter() {
    this._build();
    window.addEventListener('keydown', this._onKey);
  }

  exit() {
    window.removeEventListener('keydown', this._onKey);
    this.ui.innerHTML = '';
  }

  update() { /* statique */ }

  _key(e) {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') return; // Entrée = boss key
    if (e.code === 'KeyG') { e.preventDefault(); this.app.startCampaign(); }
    if (e.code === 'KeyH') { e.preventDefault(); this.app.toHangar('menu'); }
    // Raccourci de TEST : droit au combat, sans l'arc du CIC.
    if (e.code === 'KeyC') { e.preventDefault(); this.app.startCombatDirect(); }
  }

  _build() {
    const hof = HallOfFame.top(5);
    const souls = totalSouls();

    const fleet = FLEET.map((id) => {
      const t = TRANSPORT_TYPES[id];
      const role = FLEET_ROLES[t.role];
      const bare = t.role === 'souls';
      return `<div class="mn-ship${bare ? ' bare' : ''}">
        <div class="mn-ship-name">${t.name}</div>
        <div class="mn-ship-souls">${t.souls.toLocaleString('fr-FR')} âmes</div>
        <div class="mn-ship-role">${role.icon} <b>${role.name}</b> — ${role.gives}</div>
      </div>`;
    }).join('');

    const route = SECTORS.map((s, i) =>
      `<span class="mn-leg"><i>${i + 1}</i>${s.name}</span>`).join('<span class="mn-arrow">›</span>');

    this.ui.innerHTML = `
      <div id="menu">
        <div class="mn-frame">
          <div class="mn-head">
            <div class="mn-title">B S G</div>
            <div class="mn-sub">Les Colonies sont tombées. Il reste ceci.</div>
          </div>

          <div class="mn-brief">
            <p>Tu commandes une baleine de guerre et tu escortes
            <b>${souls.toLocaleString('fr-FR')} survivants</b> répartis sur six coques civiles qui ne
            peuvent ni tirer ni manœuvrer.</p>
            <p>Les Cylons vous retrouvent <b>toutes les 33 minutes</b> — on ne sait pas comment. Le
            seul recours est de sauter encore, et le calcul n'aboutit jamais avant leur arrivée :
            il faudra <b>tenir sous le feu</b> les derniers pourcents.</p>
            <p class="mn-warn">Ce que tu perds ne revient pas. Chaque coque porte une fonction dont
            la flotte entière dépend.</p>
          </div>

          <div class="mn-fleet">${fleet}</div>

          <div class="mn-route"><span class="mn-route-label">TRAVERSÉE</span>${route}</div>

          <div class="mn-actions">
            <button id="mn-start" class="btn-primary">COMMENCER LA TRAVERSÉE <b>G</b></button>
            <button id="mn-hangar">PONT HANGAR — ⛭ ${Math.floor(this.app.salvage)} de matériel <b>H</b></button>
          </div>

          <!-- RACCOURCI DE TEST. Volontairement à part et étiqueté comme tel : ce n'est
               pas une façon de jouer, c'est un outil pour juger le pilotage et les
               vitesses sans traverser 42 scènes de passerelle à chaque essai. -->
          <div class="mn-dev">
            <button id="mn-direct" class="mn-devbtn">⚙ TEST — combat direct, sans le CIC <b>C</b></button>
          </div>

          <!-- Repartir de zéro. Nécessaire depuis que la progression existe : une
               sauvegarde d'avant migre ses anciens crédits en matériel, donc on
               démarre riche et on ne voit pas le début sobre du jeu. Deux temps :
               un bouton discret ne doit pas effacer un vaisseau sur un clic. -->
          <div class="mn-wipe">
            <button id="mn-reset" class="mn-reset">Repartir de zéro — effacer vaisseau, matériel et plans</button>
          </div>

          <p class="mn-note">Trois emplacements sont aménagés et trois plans connus : le reste
          s'aménage et se récupère en route. On ne paie personne — c'est notre flotte et nos
          ingénieurs. Le <b>matériel</b> s'arrache aux épaves, et l'équipe de pont ne mène que
          quelques <b>chantiers</b> par escale.</p>

          ${hof.length ? `<div class="mn-hof"><span class="mn-hof-label">TRAVERSÉES PRÉCÉDENTES</span>${
            hof.map((e) => `<span class="mn-hof-row">secteur ${e.wave} · ⛭${e.credits} · ${e.date}</span>`).join('')
          }</div>` : ''}

          <div class="mn-keys">
            <span><b>Tab</b> changer de poste</span><span><b>V</b> plein écran</span>
            <span><b>T</b> réglages</span><span><b>Entrée</b> écran de travail</span>
          </div>
        </div>
      </div>`;

    this.ui.querySelector('#mn-start').addEventListener('click', () => this.app.startCampaign());
    this.ui.querySelector('#mn-hangar').addEventListener('click', () => this.app.toHangar('menu'));
    this.ui.querySelector('#mn-direct').addEventListener('click', () => this.app.startCombatDirect());

    // Effacer une progression demande DEUX clics : le premier ne fait que demander
    // confirmation. Un bouton destructeur qui agit au premier clic est un piège.
    const reset = this.ui.querySelector('#mn-reset');
    reset.addEventListener('click', () => {
      if (!reset.classList.contains('armed')) {
        reset.classList.add('armed');
        reset.textContent = 'Confirmer : tout effacer et repartir à trois emplacements';
        setTimeout(() => {
          if (!reset.isConnected) return;
          reset.classList.remove('armed');
          reset.textContent = 'Repartir de zéro — effacer vaisseau, matériel et plans';
        }, 4000);
        return;
      }
      this.app.wipeSave();
    });
  }
}
