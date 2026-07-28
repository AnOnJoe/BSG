# CLAUDE.md — BSG

Jeu spatial WebGL **Three.js**, low-poly fil de fer néon. Baleine mère modulaire
(livrée bleu & blanc) construite au **hangar**, puis combat par **vagues** vs CPU.
Voir `README.md` pour le détail gameplay. Ce fichier = conventions & pièges pour coder.

## Nature du projet
- **Site statique** : pas de build, pas de npm, pas de bundler. Modules ES natifs.
- Three.js + addons chargés par **import map** (CDN jsdelivr) dans `index.html`
  (`three@0.160.0`). Ne pas passer à un système de build sans raison.
- Cible : hébergement local pour l'instant.

## Lancer & vérifier
```bash
cd BSG && python3 -m http.server 8000   # http://localhost:8000
```
- `python3 -m http.server` n'envoie **aucun en-tête de cache** → le navigateur sert
  souvent de vieux fichiers JS. Toujours **Cmd+Shift+R** (ou DevTools « Disable cache »)
  après un changement. Beaucoup de faux bugs signalés = cache.
- **Vérif automatisée** (headless) : Chrome est là
  (`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`) et `puppeteer-core`
  est installé dans le scratchpad de session. Pattern utilisé : lancer un serveur,
  ouvrir la page, piloter via `window.app` / `window.TUNE`, lire l'état, prendre des
  screenshots. `Math.random`/`Date`/`requestAnimationFrame` sont dispo (c'est du
  navigateur — la restriction Workflow ne s'applique pas ici).
- Contrôle syntaxe rapide : `find js -name '*.js' -print0 | xargs -0 -n1 node --check`.
  (node ne résout pas les imports, mais valide la syntaxe de chaque module.)
- **Debug console** : `window.app` (l'App), `window.app.range` (combat), `window.TUNE`.

## Architecture (points d'entrée)
- `js/main.js` — `App` : scène, caméra, renderer, boucle RAF, bascule Hangar↔Combat,
  boss key (Entrée), panneau T, crédits, starfield/nébuleuses.
- `js/game/Range.js` — **cœur du combat** (déplacement, vagues, ennemis, drones,
  projectiles, bonus, IEM, HUD, caméra qui suit). C'est le plus gros fichier.
- `js/game/Ship.js` — agrégat coque + modules ; défense (coque/bouclier) + énergie.
- `js/data/hullConfig.js` (forme + slots) et `js/data/moduleConfig.js` (modules).
- `js/core/` — Renderer(bloom), Camera, Input/Aim/WeaponControl, Fx, ScreenShake,
  Audio, Tune, HallOfFame, SaveManager, NeonMaterials.
- `js/core/PowerBus.js` + `js/core/CommandRing.js` — **répartition d'énergie** (armes /
  boucliers / moteurs) et son menu radial. Voir ci-dessous.
- `js/core/Stations.js` — **postes** (pilote / artilleur / drones) : lequel le joueur tient,
  et le transit. Point d'extension unique pour un futur coop.
- `js/core/AutoHelm.js` — **barreur IA** : produit les mêmes `thrust`/`turn` que
  l'InputController, donc la physique de `Range` est identique qu'on soit à la barre ou non.

## La TRAVERSÉE (structure du jeu)
Le jeu n'est plus une survie sans fin mais une **traversée de 5 secteurs** vers un refuge
(`data/campaign.js`). Chaque secteur a son terrain, son nombre de vagues et ses thèmes
autorisés — c'est ce qui lui donne un caractère : la Ceinture grouille de chasseurs dans les
rochers, le Blocus aligne des bâtiments lourds dans le vide (rien pour se cacher). Un cuirassé
garde la sortie du Cimetière et de la Porte. Entre deux secteurs, un **saut** répare
(`JUMP_REPAIR`) : franchir doit soigner, pas seulement enchaîner. Au bout, `_win()` appelle
enfin `_end('victory')`, qui n'avait jamais été déclenché.

### Vagues à THÈME (`data/waves.js`)
`_composeWave` renvoyait la même composition dès la vague 3 et seuls les PV montaient. Sept
thèmes qui demandent chacun une réponse différente (NUÉE → IEM et CIWS ; COLONNE BLINDÉE →
missiles et mode SEMI ; PORTE-DRONES → défense rapprochée). Chacun a un seuil de progression et
on évite de répéter le précédent. Mesuré : 7 thèmes distincts sur 14 vagues.
Prime de vague plafonnée à 6 (elle était quadratique face à une menace linéaire).

## TERRAIN (`data/terrainConfig.js` + `entities/Terrain.js`)
L'arène était un rectangle vide. Les obstacles **coupent les tirs**, donc la ligne de vue est
une ressource et se placer devient une décision :
- le laser hitscan s'arrête sur le rocher **avant** la cible (`Terrain.rayHit`) ;
- les projectiles meurent à l'impact, quelle que soit leur faction ;
- l'équipage **refuse** de tirer sur une cible masquée et l'annonce (« CIBLE MASQUÉE ») —
  attention, il faut aussi mettre `quality` à 0, sinon le HUD affiche BONNE alors que rien ne
  peut partir (piège rencontré) ;
- les nuages de poussière ne bloquent rien mais divisent la portée radar par ~3, ce qui fait
  exploser la dispersion de l'équipage : s'y cacher a un prix.
Génération : tout placement chevauchant un obstacle posé ou la zone franche centrale est rejeté.

## MISE EN SCÈNE
L'épique est un **contraste**, pas une intensité constante :
- **Annonce radar** : pendant la respiration, le HUD annonce le thème qui arrive
  (`⚠ CONTACT 8s — NUÉE`) et `_announceNextWave` fixe le thème à l'avance pour que l'annonce
  soit tenue. Cela rend la respiration **active** : on prépare l'énergie et l'escadron avant le
  choc au lieu d'attendre.
- **Ralenti dramatique** (`Range.drama`) sur la destruction d'un cuirassé et sur sa propre mort.
  ⚠ Le `dt` reçu est déjà mis à l'échelle : il faut le rediviser par `_dramaScale` pour
  décompter en temps réel, sinon un ralenti à 0,3 dure trois fois trop longtemps.
- Bannières de secteur, pastilles de progression, ping radar.

## Rythme : jeu de postes, pas beat'em all
Un jeu de postes **ne peut pas** être nerveux : sans respiration, on n'a jamais le temps de
changer de poste, et la mécanique centrale devient inutilisable. Le ralentissement n'est donc
pas cosmétique. Réglages : `enemySpeedMul` 0.6, `enemyFireMul` 1.6 (intervalle ×), `spawnDist`
78 (approche longue et lisible), `waveBreak` 8 s. Plus le ralenti à 25 % dès qu'un panneau de
commandement est ouvert (`Range.timeScale`).

## Énergie répartie (cœur du game design)
Le jeu est une **sim de capitaine** : le plaisir vient du **triage sous pression**, pas de
l'adresse au pilotage (le vaisseau est volontairement lourd). Le débit des réacteurs
(`ship.energyRegen`) est donc **réparti entre 3 bus rivaux** dont la somme fait 1 :
- `w` **armes** → remplit `ship.energy`, que le laser consomme,
- `s` **boucliers** → régén du bouclier (elle ne ponctionne **plus** `energy`),
- `m` **moteurs** → multiplie `shipAccel` / `angAccel`.

`engineMul` vaut **exactement 1.0 au tiers** : le profil ÉQUILIBRE reproduit le pilotage
d'origine, on ne juge que l'écart. Bascule via l'**anneau de passerelle** (clic droit
maintenu) : pendant l'ouverture le temps passe à `TUNE.slowMoScale` **et les armes se
taisent** (`reconfiguring` dans `Range.update`) — c'est ce coût qui empêche la micro-gestion
continue. La bascule s'établit en `TUNE.powerShiftTime` via une **rampe paramétrique**
(`from` → `target` avec un `t` qui avance à vitesse constante) : un lissage exponentiel
n'atteindrait jamais la cible, piège déjà rencontré ici.

Cadences mesurées (laser Nv1, nominal 7 tirs/s) : ATTAQUE 4,3 · ÉQUILIBRE 2,3 · DÉFENSE 1,3.
Régén bouclier : 21,8 PV/s en DÉFENSE contre 7,3 en ATTAQUE.

## Postes (le geste central du jeu)
Le joueur **ne tient qu'un poste à la fois** ; l'équipage (IA) tient les autres. Le jeu est
là : *où ai-je le plus de valeur ajoutée, maintenant ?* Trois postes (`Stations.js`) :

| Poste | L'IA sait | L'IA ne sait pas (ton créneau) | Chiffres |
|---|---|---|---|
| **COMMANDANT** | rien : elle n'y touche pas | répartir l'énergie, couper un module, l'IEM | profils d'énergie |
| **PILOTE** (`AutoHelm.js`) | appliquer la consigne, éviter les bords | juger **quand** changer de consigne | ENGAGER · RÉCUPÉRER · ROMPRE |
| **ARTILLEUR** (`WeaponControl.js`) | tirer sur le plus proche à portée | toucher ce qui manœuvre, choisir la cible | mode de tir |
| **DRONES** (`Range.droneOrder`) | rien : elle applique ta consigne sans l'adapter | regrouper, replier avant qu'ils meurent | ordre d'escadron |

### Consigne ≠ exécution (la frontière du commandement)
Le **commandant pose les consignes de TOUS les postes** depuis sa console (`Range.setOrder`,
au clic) : sinon il devrait descendre à la barre pour dire au barreur quoi faire, ce qui n'a
aucun sens. Ce qu'il ne peut pas faire à distance, c'est **exécuter** :

| Poste | Consigne (commandant OU poste) | Exécution (au poste seulement) |
|---|---|---|
| PILOTE | engager / récupérer / rompre | barrer à la main |
| ARTILLEUR | semi / rafale / auto | viser (100 % contre 30 %) |
| DRONES | attaque / escorte / repli | **désigner la cible** de l'escadron |

La désignation (poste drones) était indispensable : dès lors que le commandant peut poser la
consigne d'escadron, sans elle ce poste n'aurait plus rien d'exclusif — un poste vide.
Au poste, le curseur choisit la cible via `_nearestHostileTo(aim.point)`, **y compris une pièce
précise du cuirassé** (vérifié sur 4 pièces nommées) ; hors du poste, `designated` retombe à
`null` et l'escadron reprend le plus proche. Piège de test : forcer `aim.point` en JS ne sert à
rien, `AimController.update()` le recalcule chaque frame depuis le curseur réel.

**Règle du projet : chaque IA doit être compétente mais MÉDIOCRE, et son insuffisance doit
être VISIBLE ET SITUÉE.** Une IA parfaite rend les postes décoratifs ; une IA nulle rend le
jeu punitif. D'où l'indicateur « SOLUTION DE TIR » au HUD : sans lui, les ratés de l'équipage
passeraient pour un bug au lieu d'être le signal « va à la tourelle ».

Le **transit coûte** (`TUNE.stationSwitchTime`) : pendant l'installation, l'équipage a déjà
repris le poste que tu quittes mais évacué celui que tu rejoins, qui reste donc **VACANT**
(cf. `Stations.crewed()`). Sans ce coût tu serais partout à la fois.

Règle de partage IA/joueur : **ce qui est infini s'automatise, ce qui est rare se décide.**
Le laser puise dans l'énergie qui se régénère ⇒ équipage. Les munitions finies et les longues
recharges restent des décisions.

## On est DANS le vaisseau (cadrage)
La vue du monde n'est plus le fond d'écran : c'est l'**écran tactique** du poste, encadré par
le décor de la passerelle (`#bay` > `#cockpit-shell` + `#scene`). Les marges sont des variables
CSS (`--bay-l/r/t/b`) ; `body.expanded` les met à 0 pour la **vue plein écran** (touche **V** ou
le bouton ⛶ — une touche dédiée car le clic gauche sert déjà à tirer). Chaque poste peut avoir
sa géométrie : la console du commandant porte trois groupes, donc `--bay-b` y est plus grande.

**L'affichage, c'est l'écran.** Ce qui appartient à la surface de l'écran (vignette CRT,
flash de dégâts, bannières, overlay de fin) est cadré sur lui via `--bay-*`, pas sur la
fenêtre — sinon ça déborde sur le décor et n'est pas centré sur la vue. Les consoles, elles,
restent dans la passerelle : ce sont des objets du vaisseau, pas de l'affichage.

**Dézoom.** L'écran cadré est plus petit (544 px contre 800) à FOV constant : tout paraît plus
petit sans qu'on voie plus large. `Range._followCamera` recule donc la caméra selon le produit
de `TUNE.viewZoom` (vue générale), d'une **compensation de la taille d'écran**
(`screenRefH / viewport.h`, plafonnée à 2) et de `capitalCamZoom`. Mesuré en cockpit :
**104 × 70 unités visibles** (contre 87 × 54 sans compensation), baleine à 117 px. Régler la
largeur de vue = `viewZoom` dans le panneau **T**.

**⚠ Piège central : tout ce qui convertit écran ↔ monde doit passer par `core/Viewport.js`.**
Le canvas n'occupe plus la fenêtre ; utiliser `window.innerWidth` décale silencieusement la
visée du rendu — rien ne plante, on rate simplement ses tirs. Concernés : `AimController`
(NDC), `Hangar` (sélection des slots), `Range` (réticule), `Hud` (flèches de bord).
Trois pièges rencontrés, tous silencieux :
1. le **canvas est un élément remplacé** : avec `width:auto` il prend la taille de ses attributs
   et **ignore `right`/`bottom`** ⇒ il faut des `width`/`height` explicites en `calc()` ;
2. `renderer.setSize(w, h)` écrit `canvas.style` ⇒ passer `updateStyle = false`, sinon Three
   écrase le cadrage CSS ;
3. les marges sont **animées** (0,25 s) ⇒ remesurer sur `transitionend`, sinon la visée reste
   calée sur la géométrie d'avant la bascule.
Écart de visée mesuré après cadrage : **0,07 unité** (cockpit) et **0,07** (plein écran), soit
moins d'un pixel. Pour mesurer, il faut **figer la scène** — sinon le vaisseau navigue entre le
calcul de la projection et la lecture, et on lit ~20 unités d'écart qui n'existent pas.

Note : `EnemyShip.position` renvoie un **clone**, mais `Drone.position` et `CapitalPart.position`
exposent la référence vive — toute projection dessus doit cloner (`.project()` mute).

### Un cockpit par poste (c'est ce qui règle le fouillis)
Les panneaux des quatre métiers étaient empilés en permanence. Désormais `Hud.js` distingue :
- un **tronc commun** minimal, vital quel que soit le poste : coque/bouclier + crédits
  (`#vital-panel`), vague et cible (`#enemy-panel`), état du cuirassé, radar, colonne des
  postes ;
- un **cockpit unique** en bas au centre (`#cockpit`), avec les instruments du poste courant et
  ses commandes chiffrées. `Hud.setStations()` bascule la visibilité ; `setHelm()` et
  `setSquadron()` alimentent les instruments spécifiques.

**Exclusivité du commandement.** Répartition d'énergie, anneau (donc le ralenti) et IEM ne
répondent QU'à la console du commandant — vérifié en test. Sans ça, ce ne serait pas un poste
mais un menu accessible de partout. Le refus est explicite au HUD (« ÉNERGIE — console du
commandant »), sinon le joueur croit à un bug. Levier si c'est trop contraignant :
`TUNE.stationSwitchTime`.
Exception assumée : les **missiles** (Espace) partent depuis n'importe quel poste — ils sont
autoguidés, donc un ordre suffit ; l'énergie et l'IEM, elles, exigent d'être à la console.
L'**activation/coupure des modules** a quitté les touches 1..9 (devenues les commandes du poste
courant) pour vivre sur cette console, au clic.

### Conduite de tir de l'équipage (`WeaponControl._fireControl`)
Trois erreurs, chacune motivée : **perception retardée** (même modèle que
`EnemyShip.perceived` : on tire là où la cible était), **dispersion** croissante avec la
distance et ×`crewNoRadarMul` hors portée radar — ce qui donne enfin un rôle mécanique au
module radar —, et **délai de verrouillage**. Plus un garde-fou : au-delà de `crewHoldFactor`
fois la taille angulaire de la cible, l'équipage **renonce** au lieu de vider ta réserve.

Taux de touche mesurés (laser Nv1, portée 40) : **100 %** à courte portée ou sur cible
immobile bien pistée · **30 %** sur cible qui manœuvre · **~30 %** hors portée radar ·
**100 %** pour un joueur au poste sur le même cas. À noter : la portée du laser (40) dépasse
le **champ visible** (~36 de demi-largeur) — au-delà, le joueur ne *peut pas* viser, seul
l'équipage tire. Autre justification des postes.

### Consignes persistantes (le principe qui unifie les postes)
Chaque poste a des **consignes** que le joueur pose et que l'équipage **continue d'appliquer
sans jamais les adapter** quand il s'en va : `weapons.modeId`, `droneOrder`, `helmOrder`.
C'est le cœur du contrat : l'IA exécute, le joueur juge **quand** changer. Laisse RÉCUPÉRER
en place et le barreur ira aux caisses pendant que tu es à la tourelle — mais il continuera
aussi à y aller quand ce sera devenu une mauvaise idée.
(Les « allures » du poste pilote ont été retirées : elles ne faisaient que doubler l'anneau
d'énergie, qui reste accessible depuis n'importe quel poste.)

## Cuirassé (`data/capitalConfig.js` + `entities/CapitalShip.js`)
L'adversaire d'échelle, toutes les 5 vagues. **4,0× la longueur de la baleine à l'écran**
(892 px contre 224 px, mesuré) : il déborde du cadre, d'où le recul de caméra
`TUNE.capitalCamZoom` — sans lui on perd précisément ce qu'on cherche.

**Il n'a pas de PV de coque** : il meurt quand ses 10 `parts` sont détruites. L'objectif reste
donc lisible en permanence, et chaque pièce change la situation :
- chaque part expose `position` / `radius` / `takeDamage()` — la **même interface** que
  `EnemyShip` et `Drone` — donc le raycast laser, les têtes chercheuses et la conduite de tir
  de l'équipage la traitent sans une ligne de code spécifique ;
- les batteries ont un **secteur de tir** (`dir` + `arc`) : mesuré, dos 2 · ventre 3 · proue 1 ·
  **poupe 0**. L'arrière est donc un angle mort permanent — et c'est là que sont les moteurs,
  ce qui crée une boucle tactique émergente : on s'abrite derrière, on lui arrache ses moteurs,
  il est immobilisé (déplacement mesuré 4,8 → 0,0 sur 2,5 s) ;
- pont détruit ⇒ cadence de toutes les batteries × `bridgeFirePenalty`.

Lisibilité : les tourelles sont surdimensionnées et portent un **cercle de désignation** —
sur une masse de 46 unités, une tourelle réaliste serait invisible, or c'est *la* cible que le
joueur doit choisir. Idem pour le `fill` : trop sombre, la coque n'était qu'un contour.

### Menaces et réponses (piège : un garde-fou crée des angles morts)
Le `crewHoldFactor` qui évite le gaspillage a créé un trou : un drone (`radius` 1.3, `speed`
17) est une cible si petite et si vive que la solution est jugée mauvaise en permanence — les
tourelles y perdent leur temps. Mesuré, 3 drones collés à la coque : **9,2 s et 22 tirs** au
laser seul, contre **1,0 s** avec un Canon Anti-Drone. **Toute nouvelle pénalité de conduite de
tir doit être accompagnée d'une réponse dédiée**, sinon elle crée une menace incontrable.
- `ciws` (`entities/modules/Ciws.js`) : `targets: 'small'` + `autoTrack` ⇒ ne cible que les
  drones, tire **quel que soit le poste** du joueur, sans les faiblesses humaines, et ignore
  les `FIRE_MODES`. Coûteux en énergie : sous un essaim, les lasers se taisent.
- Les **intercepteurs** priorisent désormais les drones ennemis (périmètre 55, ou 30 en
  ESCORTE) avant les vaisseaux — c'est littéralement leur rôle, et ils ne le faisaient pas.

### Modes de tir (`FIRE_MODES`)
Consigne persistante : l'équipage continue de l'appliquer quand tu quittes le poste. Cadences
mesurées sur 3 s, cible à 20 : **SEMI** 6 (soutenable indéfiniment, réserve stable à 90/90) ·
**RAFALE** 10 (73/90) · **AUTO** 20 (assèche à 3/90). Le classement doit rester **strict** —
un « mode posé » qui tirerait plus que la rafale annulerait le compromis (c'est arrivé :
`rate: 0.45` sur SEMI le rendait plus rapide que RAFALE et sa pause).

Pour un futur coop : tout passe par `Stations`. Comme tous les joueurs sont sur le **même
vaisseau**, aucun conflit d'autorité sur la physique ; et si l'artilleur **désigne** des cibles
au lieu de viser au pixel, la latence devient indolore (un hôte simule, les autres envoient des
intentions basse fréquence).

## Conventions & idiomes
- **Équilibrage → `js/core/Tune.js`** (objet `TUNE` + `TUNE_SPECS`). Toute valeur
  réglable en jeu passe par là (lue en direct, persistée localStorage, éditable via
  panneau **T**). Ajouter un réglage = 1 entrée dans `TUNE` + 1 dans `TUNE_SPECS`.
- **Visuel néon** via `NeonMaterials.js` : `makeEdges` (arêtes), `makeSolid` (volume
  plein opaque + arêtes), `makeCircle`, `PALETTE`, `darken`.
- **Data-driven** : ajouter un module = entrée dans `MODULE_CONFIG` + `SLOT_ACCEPTS`
  + `MODULE_COST`, une classe dans `entities/modules/`, et l'enregistrer dans
  `MODULE_CLASSES` (Ship.js). Nouvelle coque = un fichier config du même format.
- **Perf** : `renderer.setPixelRatio(1)` volontairement (le bloom multi-passes est
  cher en Retina). Ne pas remonter sans raison. Garde-fous anti-emballement sur les
  projectiles (Range) et les effets (Fx).
- Français partout (UI, commentaires) avec accents corrects.

## Pièges déjà rencontrés (ne pas refaire)
- **Tri des transparents** : un remplissage `transparent:true opacity:1` peut se
  dessiner par-dessus une lueur additive de façon incohérente (coque tantôt noire,
  tantôt qui glow). ⇒ `makeSolid` rend le fill **opaque** quand `fillOpacity>=1`.
- **Bloom & grandes surfaces claires** : toute grande zone claire « crame » (blob)
  sous le bloom. Pour du blanc/pâle propre : couleur désaturée + bloom modéré
  (`Renderer.baseStrength`, threshold). Éviter les gros plans quasi-blancs opaques.
- **Muzzle flash / traînées** : utiliser une **texture ronde** (radiale) sur le plan,
  sinon ça fait des **carrés** (cf. `Fx._glow`).
- **Conflit de nom sur `Module`** : la base `Module` fait `this.cooldown = 0`. Ne pas
  définir un getter `cooldown` dans une sous-classe (crash « only a getter »). Cf. Emp
  qui utilise `cooldownTime` + `cooldownLeft`.
- **`.project(camera)`** mute le Vector3 → toujours cloner avant de projeter.
- **Cache navigateur** (voir plus haut) : re-tester en hard-refresh avant de conclure
  à un bug.

## État & prochaines pistes
Fait : hangar+upgrades+crédits, combat par vagues, 4 types d'ennemis + encerclement,
intercepteurs autonomes (2 camps), IEM, bonus, radar/mini-radar, bouclier-bulle,
Hall of Fame, boss key, panneau de réglages, ambiance (nébuleuses/galaxie/vignette/
débris/audio), **énergie répartie + anneau de passerelle** (lot ① de la bascule vers
la sim de capitaine).

Suite prévue de cette bascule :
- **②** sections de coque (proue/dos/ventre/poupe) : dégâts localisés selon l'angle
  d'impact, section à 0 ⇒ modules de cette section HS jusqu'à réparation. Les slots de
  `hullConfig.js` reçoivent un champ `section`.
- **③** ordres d'escadron dans l'anneau (attaquer / escorter-intercepter / réparer).
- **④** ciblage manuel + focus : `radar.maxTargets` n'est utilisé nulle part aujourd'hui,
  et tout passe par `_nearestEnemy()`.
- **Courbe de difficulté** (problème connu) : `MAX_ENEMIES = 4` et `_composeWave` renvoie
  la même composition dès la vague 3 ⇒ au-delà, seuls les PV montent. La prime de vague
  `40 * wave` est quadratique alors que la menace est linéaire (le build finit maxé).
  `_end(type)` ignore son paramètre : il n'y a pas de victoire.
