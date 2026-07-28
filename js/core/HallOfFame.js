const KEY = 'bsg.hof.v1';

/**
 * Hall of Fame : meilleures vagues atteintes, persistées (localStorage).
 * Trié par vague décroissante, top 10 conservé.
 */
export const HallOfFame = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  },

  /** Ajoute un score ; renvoie { top, id } (id pour surligner la nouvelle entrée). */
  add(wave, credits) {
    const id = `${wave}-${Math.round(credits)}-${Math.floor(performance.now())}`;
    const entry = { wave, credits: Math.round(credits), date: new Date().toLocaleDateString('fr-FR'), id };
    const list = this.load();
    list.push(entry);
    list.sort((a, b) => b.wave - a.wave || (b.credits || 0) - (a.credits || 0));
    const top = list.slice(0, 10);
    try { localStorage.setItem(KEY, JSON.stringify(top)); } catch (e) { /* ignore */ }
    return { top, id };
  },

  top(n = 6) { return this.load().slice(0, n); },
};
