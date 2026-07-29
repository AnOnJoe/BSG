/**
 * CONTRÔLE DE SYNTAXE DES MODULES ES.
 *
 * ⚠ Écrit après avoir découvert que la commande documentée jusqu'ici —
 *   find js -name '*.js' -print0 | xargs -0 -n1 node --check
 * NE VALIDE PAS les modules ES. Node traite un `.js` comme du CommonJS, échoue sur
 * les `export`, puis retente en module et **renvoie 0 quoi qu'il arrive**. Vérifié :
 * un fichier contenant `['x', 'part de l'ecran']` (apostrophe non échappée, erreur
 * de syntaxe franche) passait le contrôle avec succès. Deux fichiers cassés ont
 * ainsi atteint le navigateur dans la même session, et le seul symptôme était un
 * écran noir.
 *
 * Le même contenu en `.mjs`, lui, est bien rejeté. On copie donc chaque module vers
 * un `.mjs` temporaire et on le fait analyser : c'est exact, et ça n'exécute rien
 * (donc les imports CDN n'ont pas besoin d'être résolus).
 *
 * Usage :  node tools/check-syntax.mjs     (depuis la racine du dépôt)
 */
import { readdirSync, statSync, copyFileSync, mkdtempSync, rmSync } from 'fs';
import { join, sep } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';

const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.js') || f.endsWith('.mjs')) files.push(p);
  }
};
for (const root of ['js', 'tools']) {
  try { walk(root); } catch { /* dossier absent */ }
}

const dir = mkdtempSync(join(tmpdir(), 'bsg-syn-'));
const tmp = join(dir, 'm.mjs');
let bad = 0;
for (const f of files) {
  copyFileSync(f, tmp);
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
  } catch (e) {
    bad++;
    const msg = String(e.stderr || e.message)
      .split('\n').filter((l) => l.trim()).slice(0, 4)
      .join('\n').replaceAll(tmp, f);
    console.error(`\n✖ ${f}\n${msg}`);
  }
}
rmSync(dir, { recursive: true, force: true });
console.log(bad
  ? `\n${bad} fichier(s) invalide(s) sur ${files.length}.`
  : `syntaxe ES valide : ${files.length} modules`);
process.exit(bad ? 1 : 0);
