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
            <button id="mn-hangar">PONT HANGAR — armer la baleine <b>H</b></button>
          </div>

          ${hof.length ? `<div class="mn-hof"><span class="mn-hof-label">TRAVERSÉES PRÉCÉDENTES</span>${
            hof.map((e) => `<span class="mn-hof-row">secteur ${e.wave} · ◈${e.credits} · ${e.date}</span>`).join('')
          }</div>` : ''}

          <div class="mn-keys">
            <span><b>Tab</b> changer de poste</span><span><b>V</b> plein écran</span>
            <span><b>T</b> réglages</span><span><b>Entrée</b> écran de travail</span>
          </div>
        </div>
      </div>`;

    this.ui.querySelector('#mn-start').addEventListener('click', () => this.app.startCampaign());
    this.ui.querySelector('#mn-hangar').addEventListener('click', () => this.app.toHangar('menu'));
  }
}
