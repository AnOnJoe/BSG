const KEY = 'bsg.save.v1';

/**
 * Persistance dans localStorage : { build: [{slotId,moduleId,level}], credits }.
 * Rétro-compatible avec l'ancien format (tableau = build seul).
 */
export const SaveManager = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return { build: data, credits: 0 }; // ancien format
      return { build: Array.isArray(data.build) ? data.build : [], credits: data.credits || 0 };
    } catch (e) {
      console.warn('Sauvegarde illisible, réinitialisation.', e);
      return null;
    }
  },

  save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ build: state.build, credits: state.credits }));
    } catch (e) {
      console.warn('Sauvegarde impossible.', e);
    }
  },

  clear() { localStorage.removeItem(KEY); },
};
