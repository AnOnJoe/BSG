/**
 * DÉTECTEUR D'APPELANTS SANS DÉFINITION.
 *
 * Motivé par un vrai bug qui a survécu deux sessions : `App.toggleExpand()` avait
 * disparu du fichier alors que ses deux appelants ET tout le CSS `body.expanded`
 * étaient restés. La touche V et le bouton plein écran levaient donc
 * « toggleExpand is not a function ». Ce genre de trou ne se voit PAS à la lecture,
 * et `node --check` ne le voit pas non plus (il valide la syntaxe, pas les liens).
 *
 * Principe : pour les receveurs dont on connaît la classe avec certitude
 * (`this.app.`, `this.hud.`, `this.signal.`…), on vérifie que la méthode appelée
 * existe bien dans cette classe.
 *
 * ⚠ Heuristique, pas un analyseur : il peut produire des FAUX POSITIFS quand un
 * champ porte le même nom qu'un écran (c'est arrivé avec `Hangar.menu`, un élément
 * DOM, confondu avec `App.menu` qui est le StartMenu — le champ a été renommé
 * `equipMenu`, ce qui lève aussi l'ambiguïté à la lecture). Un résultat se vérifie
 * donc à la main ; zéro résultat, en revanche, est une bonne nouvelle.
 *
 * Usage :  node tools/check-dangling.mjs     (depuis la racine du dépôt)
 */
import fs from 'fs';
import path from 'path';

// Collecte : pour chaque classe exportée, ses méthodes et getters définis.
const files = [];
const walk = (d) => { for (const f of fs.readdirSync(d)) {
  const p = path.join(d, f);
  if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.js')) files.push(p);
} };
walk('js');

const defined = new Map();   // classe -> Set(membres)
const srcOf = new Map();
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  srcOf.set(f, src);
  for (const m of src.matchAll(/export class (\w+)/g)) {
    const cls = m[1];
    const body = src.slice(m.index);
    const set = new Set();
    for (const d of body.matchAll(/^  (?:static\s+)?(?:get |set |async )?([A-Za-z_]\w*)\s*[({]/gm)) set.add(d[1]);
    for (const d of body.matchAll(/^    this\.([A-Za-z_]\w*)\s*=/gm)) set.add(d[1]);
    defined.set(cls, set);
  }
}

// Objets dont on connaît la classe avec certitude
const receivers = {
  'this.app.': 'App', 'app.': 'App',
  'this.hud.': 'Hud',
  'this.range.': 'Range',
  'this.bridge.': 'Bridge',
  'this.menu.': 'StartMenu',
  'this.hangar.': 'Hangar',
  'this.signal.': 'SignalHunt',
  'this.engineer.': 'Engineer',
  'this.stations.': 'Stations',
  'this.weapons.': 'WeaponControl',
  'this.ftl.': 'FtlDrive',
  'this.convoy.': 'Convoy',
  'this.autoHelm.': 'AutoHelm',
};
const problems = [];
for (const [f, src] of srcOf) {
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    if (/^\s*(\*|\/\/)/.test(line)) return;              // commentaires
    for (const [recv, cls] of Object.entries(receivers)) {
      const set = defined.get(cls);
      if (!set) continue;
      const re = new RegExp(recv.replace('.', '\\.') + '(\\w+)\\s*\\(', 'g');
      for (const m of line.matchAll(re)) {
        const name = m[1];
        if (set.has(name)) continue;
        if (/^(then|catch|call|apply|bind|toString|hasOwnProperty)$/.test(name)) continue;
        problems.push(`${f}:${i + 1}  ${cls}.${name}()  →  ${line.trim().slice(0, 70)}`);
      }
    }
  });
}
console.log(problems.length ? problems.join('\n') : 'aucun appelant sans définition détecté');
console.log('\nclasses analysées :', [...defined.keys()].length);
