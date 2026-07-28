import * as THREE from 'three';

/**
 * Palette néon centralisée — un seul endroit pour régler l'ambiance.
 */
export const PALETTE = {
  bg:          0x070616, // indigo profond
  hull:        0x3a9dff, // bleu (livrée bleu & blanc)
  slot:        0x2b6f86,
  slotHover:   0xffffff,
  laser:       0xff3388, // magenta
  missile:     0xffaa33, // ambre
  interceptor: 0x66ff99, // vert
  reactor:     0x4aa8ff, // bleu
  shield:      0xa97bff, // violet
  armor:       0xcfe8f2, // blanc-bleu
  radar:       0x33ff88, // vert radar
  target:      0xff5566, // rouge cible
  beam:        0xff5599,
};

const _c = new THREE.Color();
const _white = new THREE.Color(0xffffff);

/**
 * Couleur d'un module en fonction de son niveau : plus le niveau est haut,
 * plus la teinte tire vers le blanc (donc « brûle » davantage sous le bloom).
 */
export function colorForLevel(base, level, maxLevel) {
  _c.set(base);
  const t = maxLevel > 1 ? ((level - 1) / (maxLevel - 1)) * 0.45 : 0;
  _c.lerp(_white, t);
  return _c.getHex();
}

/** Assombrit une couleur (multiplie le RGB par f). */
export function darken(hex, f) {
  _c.set(hex);
  _c.multiplyScalar(f);
  return _c.getHex();
}

/**
 * Volume « solide néon » : surface pleine et opaque (teinte sombre) + arêtes
 * néon vives par-dessus. Donne des modules massifs (qui cachent le fond) tout
 * en gardant le style néon. Retourne un Group avec userData.{fillMat, edgeMat}.
 */
export function makeSolid(geometry, edgeColor, opts = {}) {
  const g = new THREE.Group();
  const fillOpacity = opts.fillOpacity ?? 1;
  const fillMat = new THREE.MeshBasicMaterial({
    color: opts.fill ?? darken(edgeColor, 0.14),
    transparent: fillOpacity < 1, // opaque par défaut => rendu déterministe (la lueur additive passe toujours au-dessus)
    opacity: fillOpacity,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const mesh = new THREE.Mesh(geometry, fillMat);
  const edges = makeEdges(geometry, edgeColor, { thresholdAngle: opts.thresholdAngle ?? 20 });
  edges.renderOrder = 1;
  g.add(mesh);
  g.add(edges);
  g.userData.fillMat = fillMat;
  g.userData.edgeMat = edges.material;
  return g;
}

/**
 * Construit un maillage fil de fer (arêtes néon) à partir d'une géométrie.
 * thresholdAngle élevé => on masque les diagonales de triangulation coplanaires
 * et on ne garde que la silhouette + les vraies arêtes (rendu low-poly propre).
 */
export function makeEdges(geometry, color, opts = {}) {
  const edgesGeo = new THREE.EdgesGeometry(geometry, opts.thresholdAngle ?? 20);
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: opts.opacity ?? 1,
  });
  const seg = new THREE.LineSegments(edgesGeo, mat);
  seg.userData.baseColor = color;
  return seg;
}

/** Matériau ligne néon simple (pour beams, cercles, réticules 3D). */
export function neonLineMat(color, opacity = 1) {
  return new THREE.LineBasicMaterial({ color, transparent: true, opacity });
}

/** Cercle fil de fer (LineLoop) dans le plan XY. */
export function makeCircle(radius, color, segments = 64, opacity = 1) {
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.LineLoop(geo, neonLineMat(color, opacity));
}
