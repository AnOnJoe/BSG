const KEY = 'bsg.save.v1';

/**
 * Persistance dans localStorage.
 *
 * Format courant : { build, salvage, fitted, plans }.
 *  - `salvage` a remplacé `credits` : on ne paie personne, on récupère du matériel
 *    (cf. `data/progression.js`). Les anciennes sauvegardes sont MIGRÉES plutôt que
 *    jetées — perdre son vaisseau parce qu'on a renommé une clé serait absurde.
 *  - `fitted` : emplacements aménagés · `plans` : modules dont on a les plans.
 *    Absents d'une vieille sauvegarde, on retombe sur les valeurs de départ, sauf
 *    pour les slots réellement occupés qu'on considère forcément aménagés.
 * Rétro-compatible aussi avec le tout premier format (un tableau = le build seul).
 */
export const SaveManager = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return { build: data, salvage: 0, fitted: null, plans: null };
      const build = Array.isArray(data.build) ? data.build : [];
      return {
        build,
        // `credits` : ancien nom de la même ressource.
        salvage: data.salvage ?? data.credits ?? 0,
        fitted: Array.isArray(data.fitted) ? data.fitted : null,
        plans: Array.isArray(data.plans) ? data.plans : null,
      };
    } catch (e) {
      console.warn('Sauvegarde illisible, réinitialisation.', e);
      return null;
    }
  },

  save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        build: state.build,
        salvage: state.salvage,
        fitted: state.fitted,
        plans: state.plans,
      }));
    } catch (e) {
      console.warn('Sauvegarde impossible.', e);
    }
  },

  clear() { localStorage.removeItem(KEY); },
};
