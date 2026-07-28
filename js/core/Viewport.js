/**
 * Géométrie de l'ÉCRAN TACTIQUE (le canvas), qui n'occupe plus toute la fenêtre :
 * en mode cockpit il est encadré par le décor du vaisseau.
 *
 * Tout ce qui convertit écran ↔ monde doit passer par ici. Sinon la visée, le
 * réticule et les flèches de bord se décalent du rendu — c'est LE piège de ce
 * cadrage, et il est silencieux : rien ne plante, on rate simplement ses tirs.
 *
 * Le rect est mis en cache (`refresh()` au resize et au changement de mode) :
 * `getBoundingClientRect()` à chaque mousemove forcerait un calcul de layout.
 */
export const viewport = {
  x: 0, y: 0, w: 1, h: 1,

  /** À rappeler dès que le canvas change de taille ou de position. */
  refresh(canvas) {
    const r = canvas.getBoundingClientRect();
    this.x = r.left;
    this.y = r.top;
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    return this;
  },

  /** Coordonnées page (clientX/clientY) → NDC [-1, 1] du rendu. */
  ndcX(clientX) { return ((clientX - this.x) / this.w) * 2 - 1; },
  ndcY(clientY) { return -((clientY - this.y) / this.h) * 2 + 1; },

  /** NDC du rendu → coordonnées page, pour poser du DOM sur un point 3D. */
  pageX(ndcX) { return this.x + (ndcX * 0.5 + 0.5) * this.w; },
  pageY(ndcY) { return this.y + (-ndcY * 0.5 + 0.5) * this.h; },

  /** Centre de l'écran tactique en coordonnées page. */
  get cx() { return this.x + this.w / 2; },
  get cy() { return this.y + this.h / 2; },
  get aspect() { return this.w / this.h; },
};
