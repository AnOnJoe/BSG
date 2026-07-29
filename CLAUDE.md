# CLAUDE.md — BSG

Jeu spatial WebGL **Three.js**, low-poly fil de fer néon. On commande une baleine mère modulaire
(livrée bleu & blanc) et on **escorte six transports civils** à travers cinq secteurs, en tenant
chaque fois jusqu'à ce que le calcul de saut aboutisse.
Voir `README.md` pour le détail gameplay. Ce fichier = conventions & pièges pour coder.

## Nature du projet
- **Site statique** : pas de build, pas de npm, pas de bundler. Modules ES natifs.
- Three.js + addons chargés par **import map** (CDN jsdelivr) dans `index.html`
  (`three@0.160.0`). Ne pas passer à un système de build sans raison.
- Publié tel quel sur **GitHub Pages** (cf. « Dépôt » en bas) : aucune étape de build.

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
- `js/main.js` — `App` : scène, caméra, renderer, boucle RAF, bascule entre les **quatre écrans**
  (menu → CIC → combat, plus le pont hangar en escale), boss key (Entrée), panneau T, crédits,
  starfield/nébuleuses.
- `js/game/StartMenu.js` — **menu de départ** : le jeu ne s'ouvre plus sur le hangar.
- `js/game/Range.js` — **cœur du combat** (déplacement, vagues, ennemis, drones,
  projectiles, bonus, IEM, HUD, caméra qui suit). C'est le plus gros fichier.
- `js/game/Ship.js` — agrégat coque + modules ; défense (coque/bouclier) + énergie.
- `js/data/hullConfig.js` (forme + slots) et `js/data/moduleConfig.js` (modules).
- `js/core/` — Renderer(bloom), Camera, Input/Aim/WeaponControl, Fx, ScreenShake,
  Audio, Tune, HallOfFame, SaveManager, NeonMaterials.
- `js/core/PowerBus.js` + `js/core/CommandRing.js` — **répartition d'énergie** (armes /
  boucliers / moteurs) et son menu radial. Voir ci-dessous.
- `js/core/Stations.js` — **postes** (commandant / pilote / artilleur / drones) : lequel le joueur tient,
  et le transit. Point d'extension unique pour un futur coop.
- `js/core/AutoHelm.js` — **barreur IA** : produit les mêmes `thrust`/`turn` que
  l'InputController, donc la physique de `Range` est identique qu'on soit à la barre ou non.

## LA FUITE — modèle Battlestar Galactica saison 1
**Le renversement d'objectif est le cœur du jeu.** On ne nettoie plus des vagues (un stock à
épuiser ⇒ fin garantie, donc trop facile) : on **tient une échéance en protégeant des gens**.

- `data/convoyConfig.js` + `entities/Convoy.js` — la **flotte civile**. Les transports ne tirent
  pas, ne manœuvrent pas, et **le plus lent commande le départ**. Un transport perdu emporte ses
  survivants **définitivement** : l'échec est partiel et cumulatif, pas un game over.
- `core/FtlDrive.js` — le **moteur de saut**, horloge du niveau. Le commandant peut **forcer** le
  calcul (×2,4) au prix de l'énergie des armes et boucliers : mesuré +11 %/4 s contre +4,6 %, et
  90 → 42 d'énergie. C'est l'arbitrage central — gagner du temps contre encaisser.
- **Le dilemme** : le saut n'emporte que ce qui est dans `JUMP_RADIUS`. Il part seul quand toute
  la flotte est à la porte ; sinon c'est au commandant d'ordonner le départ (**J**) en
  abandonnant le traînard, sous le feu qui continue.
- **COULOIR et non arène** : `ARENA.x` passe à 430, on entre par `ENTRY_X` (gauche) et la porte
  est à `JUMP_X` (droite). Le niveau a une direction — c'était le grief « enchaînement d'arènes ».
- **Les Cylons viennent pour la flotte**, pas pour le joueur : chacun prend le transport le plus
  proche de lui, sauf si la baleine est à moins de `TUNE.cylonPlayerAggro`. Vérifié : baleine
  parquée à 364 d'écart, ils passent de 67 à 15 de distance moyenne de la flotte et lui infligent
  70 PV en 14 s. **Sans ça, « escorter » ne voulait rien dire.**
- **Assauts continus** : le compteur ne s'arrête jamais, même si le précédent n'est pas nettoyé.
  La difficulté monte par la PRESSION (`ftlTime`, `assaultEvery`), pas par les PV.

## SAUT SUR PLACE (il n'y a pas de porte dans la série)
La « porte de saut » était une invention de game design, ajoutée pour donner une direction au
couloir. Dans BSG le saut se fait **sur place** : chaque vaisseau a son moteur, calcule, et
disparaît là où il est. Aucune infrastructure — et surtout, un portail que les Cylons pourraient
emprunter détruirait le ressort central (sauter ne ferait plus fuir, les 33 minutes n'auraient
plus de raison d'être).

À la place, une **BULLE DE RASSEMBLEMENT** de rayon `GATHER_RADIUS` centrée sur la baleine :
- **translucide** pendant le calcul, **franche** quand il aboutit, **pulsante** à l'amorçage —
  l'idée « translucide → actif » de l'utilisateur, appliquée au rassemblement ;
- elle donne un vrai travail au pilote : **se placer au milieu des siens** avant d'amorcer ;
- `Convoy.splitByBubble()` dit qui partira et qui restera, affiché au HUD et sur le DRADIS.

**AMORÇAGE (`TUNE.jumpSpoolTime`, 5,5 s).** Déclencher n'est pas partir : pendant l'amorçage la
flotte ET la baleine sont **immobiles**, donc des cibles fixes. Le « bon moment » pour sauter,
c'est quand on a dégagé les environs — pas dès que le calcul est prêt. **Aucun saut automatique** :
choisir l'instant EST la décision du jeu.
⚠ Piège rencontré : `_beginJump()` se rappelait lui-même en fin d'amorçage et relançait un
amorçage sans fin. L'ordre (`_spoolJump`) et l'exécution (`_beginJump`) doivent rester séparés.

### Le retardataire naît des DÉGÂTS
Sous 40 % de coque, la propulsion est touchée et le transport décroche (`Transport.effSpeed`).
La pénalité doit être **sévère** : à −55 % seulement, un cargo blessé (4,13) restait plus rapide
que la citerne saine (4,0) et ne décrochait donc jamais. À 20-50 % d'allure, mesuré : 5,2 → 2,0 et
**24 unités de retard en 14 s**. `laggardFrom()` désigne en priorité les éclopés — c'est celui qui
ne suivra pas qu'il faut montrer, pas celui qui se trouve au bord de la formation.

### Pourquoi le couloir ? (le calcul est perturbé au point d'arrivée)
Question légitime de l'utilisateur : depuis que le saut se fait sur place, **avancer ne servait
plus à rien** — le couloir de 860 unités était un vestige de la porte supprimée.

Il a donc une fonction mécanique : le saut précédent laisse une **perturbation**, on débarque là
où les coordonnées ne se stabilisent pas. `FtlDrive.clarity(progress)` va de `TUNE.ftlMinClarity`
(0,42) à l'entrée jusqu'à 1 à l'autre bout, calculée sur la position **moyenne de la flotte**.
Mesuré : **0,099 %/s à l'entrée contre 0,235 %/s à la sortie, soit ×2,38**. Traverser paie.

Le HUD dit **pourquoi** ça rame (« PERTURBÉ 55 % · éloignez-vous du point d'arrivée ») : sans ça
le joueur constate un calcul lent sans comprendre qu'il doit avancer.

## ORDRES À LA FLOTTE (`FLEET_ORDERS`, console du commandant)
Trois consignes qui forment un triangle : chacune est bonne contre une situation et mauvaise
contre les autres, **aucune n'est le bon choix par défaut**. Mesuré :

| Ordre | Étalement | Dans la bulle | Effet |
|---|---|---|---|
| RALLIEMENT | 36 | **6/6** | ils convergent sur la baleine et **la suivent** — le joueur mène. Couvrables et prêts à sauter, mais cible dense, et ils ne progressent plus vers la sortie (donc le calcul reste perturbé si l'on traîne) |
| DISPERSER | 206 | **4/6** | pertes diluées, mais il faudra rappeler avant de sauter |
| FORCER | 88 | 6/6 | ×1,35 en allure, mais les moteurs s'usent (−1,7 PV/s) |

Le nerf : **on ne saute qu'en étant rassemblé**. Disperser oblige donc à rallier puis à attendre,
sous le feu. Et RALLIEMENT immobilise la progression, donc laisse le calcul perturbé : les deux
ordres s'opposent vraiment. Seul le commandant les donne (`setOrder('fleet', …)` exige
`manned('command')`).

### DEUX HORLOGES, à ne jamais confondre
C'était une incohérence de conception, relevée par l'utilisateur :
- **les 33 minutes** = le délai avant que les Cylons ne retrouvent la flotte. **Rien d'autre.**
- **le calcul de saut** est une horloge INDÉPENDANTE, et il tourne **dès le saut précédent** —
  l'équipage calcule pendant tout le répit, il ne l'attend pas. Le faire démarrer à l'arrivée des
  Cylons n'avait aucun sens.

Il n'aboutit jamais à temps, et c'est tout le sujet de l'épisode : ils débarquent alors qu'il
manque encore quelques pourcents. Traduction dans les données (`data/campaign.js`) :
`ftlPreCharge` = % acquis pendant le répit (74 % → 50 % selon le secteur, donc de plus en plus
serré), puis `ftlTime` = secondes de calcul **restant après le contact**. Mesuré au premier
secteur : on arrive au combat à **84 %** avec **66 s à tenir sous le feu**.

Le CIC **montre** les deux jauges côte à côte (`Bridge._render`) : le décompte du contact et le
calcul qui progresse scène par scène, avec un repère des 100 % pour voir ce qui manquera. Sans cet
affichage, l'incohérence resterait invisible au joueur.

## LA FLOTTE EST L'ÉCONOMIE (`FLEET_ROLES`)
Les âmes n'étaient qu'un compteur : perdre un transport ne coûtait **rien** mécaniquement,
c'était même une coque de moins à défendre — et s'il s'agissait de la citerne (la plus lente,
4,0) toute la flotte accélérait. **Perdre rendait le jeu plus facile**, l'inverse exact de ce
que le jeu raconte. Chaque coque porte donc une fonction, perdue **définitivement** avec elle :

| Transport | Fonction | Ce que sa perte coûte |
|---|---|---|
| Citerne à tylium | **FORCER** le calcul | le levier disparaît (refus explicite au HUD) |
| Cargo lourd | les **pièces** | pont hangar fermé, les crédits ne servent plus |
| Remorqueur | l'**atelier** | réparation au saut 40 → 12 PV, plus de munitions |
| Navire-hôpital | l'**infirmerie** | dispersion ET retard de suivi ×`crewFatigueMul` |
| Paquebot · Transport Gemenon | **des vies** | rien — et c'est délibéré (32 500 âmes) |

Deux d'entre eux n'ont **aucun** effet mécanique : il faut que sacrifier puisse être rationnel
et coûte quand même. C'est aussi ce qui rendra le **dénouement** mordant — détruire soi-même un
transport compromis n'a de poids que si ça ampute vraiment.

`crewFatigueMul` = **2,2**, calibré : fenêtre de tir 100 → 71 % sur cible qui manœuvre, 66 → 37 %
à longue portée, mais **100 % maintenu** sur cible proche et immobile. L'insuffisance est donc
visible et **située**, conformément à la règle du projet. À 1,7 l'écart n'était que de 9 points
(invisible en jeu) ; à 2,8 la cible lointaine tombait à 24 %, donc punitif.

⚠ `Range._watchFleetRoles()` compare les fonctions d'une frame à l'autre au lieu d'annoncer la
perte à l'impact : c'est ce qui attrape **tous** les chemins de mort — un tir, l'usure de l'ordre
FORCER, ou un traînard abandonné au saut.

### Écrans : MENU → CIC → COMBAT, et le hangar est une escale
Le jeu s'ouvrait sur le hangar, ce qui ne tenait plus : on n'est pas un chantier qui prépare une
expédition, on est une flotte déjà en fuite. `game/StartMenu.js` accueille et **annonce les six
coques et leur fonction** — il faut les connaître avant de les perdre, sinon la règle est punitive
au lieu d'être tragique. Le hangar devient le **PONT HANGAR**, escale entre deux sauts (touche
**H** depuis le CIC), **conditionnée au cargo**.

**⚠ `Range.enter()` ne met plus la traversée en place.** Il appelait `_startGame()`, qui remet
`sectorIndex` à 0 et reconstruit la flotte — or on repasse par le CIC entre chaque secteur, donc
revenir au combat écrasait tout ce que `_arriveSector()` venait de préparer : **on rejouait
éternellement le premier secteur**, et les crédits gagnés en route n'étaient dépensables qu'après
avoir perdu. D'où `newCampaign()`, appelé par `App.startCampaign()` **avant le premier CIC** (la
flotte doit exister dès la passerelle, sinon le pont hangar s'y croit fermé et le bandeau reste
vide), puis `_resumeSector()` à chaque entrée en combat. Vérifié : progression stricte 0→1→2→3→4,
coque et crédits conservés, `ftlPreCharge` par secteur appliqué (74 → 50 %).

Le bouton de la barre est **contextuel et ne permet plus de quitter le combat** : c'est par là que
passait la remise à zéro. Deux pièges rencontrés :
- l'escale au pont hangar repasse par `Bridge.exit()`/`enter()` et **rejouait l'arc du CIC** depuis
  le début en annulant les choix déjà faits (on pouvait même les repayer en boucle) ⇒ on ne
  réinitialise que sur **changement de secteur** (`Bridge._lastSector`) ;
- l'état de la barre était posé par `_show()`, jamais appelé pour l'écran initial ⇒ le bouton
  restait visible sur le menu.

### PHASE PASSERELLE — les 33 minutes se jouent dans le CIC
`game/Bridge.js` + `data/scenes.js`. Le répit se passait sur l'écran tactique : rien à voir, rien
à faire, une baleine immobile et un compteur qui descend. Il se joue maintenant **à l'intérieur**,
en DOM (c'est de l'interface, pas du monde 3D), avec un décor de CIC en fil de fer néon :
consoles latérales, écran DRADIS qui porte le décompte, silhouettes d'équipage dont celle qui
parle s'allume.

- Le décompte descend **par scène** (`scene.at`), pas en temps réel : on lit à son rythme, la
  tension vient du contenu et du compteur, pas d'un chrono qui punirait un joueur lent.
- **Les choix se paient** : `effect` est appliqué à l'entrée du combat par
  `Range._applyPendingEffects()` (via `App.pendingEffects`) — PV/vitesse d'un transport nommé,
  modules coupés, énergie, crédits, avance de calcul FTL. Chaque effet est **annoncé au journal**
  au début de l'action ; subir un malus sans savoir d'où il vient serait incompréhensible.
- Contrôles : `Espace`/clic = suivant · `1..3` = choisir · **`N` = passer à l'action** (le skip
  doit rester possible à tout instant, c'était la réponse au « trop long »).
- Boucle à trois écrans : `Hangar → Passerelle → Combat → Passerelle → …` (`App._show`). Après un
  saut, `Range._arriveSector()` rend la main au CIC (`pendingSector`).

⚠ Le combat démarre donc **juste avant le contact** : `TUNE.contactDelay` (12 s de sursis pour se
placer) a remplacé les 120 s de répit en vol, et `Range.DRADIS_LOG` n'est plus égrené là (le
journal a été joué au CIC).

### Calibrage du cycle (il était cassé)
Mesuré avant correction : FTL prêt à **87 s**, contact à **120 s**, flotte à la porte à **278 s**.
Donc le saut était prêt avant le contact, et l'ordonner détruisait **toute la flotte** (aucun
transport dans le rayon ⇒ `Convoy.jump()` les tue tous ⇒ `lost-fleet`). Corrigé :
- vitesses des transports relevées (minimum **4,0**) ⇒ traversée en **167 s** ;
- `FtlDrive` lit enfin **`sector.ftlTime`** (110→165 s) — il était défini dans `campaign.js` mais
  jamais lu, un `TUNE` global l'écrasait ;
- le FTL est prêt **avant** l'arrivée, avec un écart qui se resserre : **+57 s** au premier
  secteur, **+2 s** à la Porte. C'est là qu'est le dilemme, et la pression monte d'elle-même ;
- **garde-fou** : `_requestJump()` refuse un ordre qui n'emporterait aucun transport, en disant la
  distance restante. Un ordre qui tue toute la flotte d'un coup n'est pas un dilemme, c'est un piège.

### Le barreur esquive le décor
Il ignorait le terrain et barrait droit dans les rochers. `AutoHelm` reçoit `ctx.terrain`, sonde
devant lui (`Terrain.rayHit`, portée fonction de sa poussée) et infléchit son cap du côté qui
dégage — le contournement **prime sur l'objectif**, on y revient après. Il ralentit aussi tant
qu'il n'a pas dégagé, puisque racler une coque coûte de la structure. Vérifié face à un mur de
rochers : **0 relevé dans la roche sur 70, 0 PV perdu**.

### Ne pas laisser le barreur planté
`AutoHelm` sortait en `thrust = 0` sans cible ni bord proche : la baleine restait immobile tout le
répit. En consigne ENGAGER sans ennemi, il **escorte** le retardataire (`ctx.escort`), à
`helmEscortDist` (plus serré qu'une distance de combat).

### Le convoi contourne le décor
`terrain.push` n'était appliqué qu'au joueur et aux ennemis : les transports traversaient les
astéroïdes. `Convoy.update` reçoit le terrain, regarde devant lui (`Terrain.rayHit`) et se décale
latéralement, plus un `push` de sécurité. Vérifié : 0 encastrement sur 60 relevés dans `belt`.
Les astéroïdes DENSES sont réservés à `belt` — ailleurs, débris et épaves, pour ne pas répéter le
même motif à chaque secteur.

### Le cycle « 33 » (mécanique, côté combat)
Repris de l'épisode : les Cylons reviennent toutes les **33 minutes**. Le décompte est affiché
en temps FICTION (33:00 → 00:00), comprimé par `TUNE.dradisCompress` (16,5×) pour tenir dans une
partie : ~2 min de répit réel. Le calcul FTL étant plus long que le répit, **les Cylons arrivent
avant qu'on puisse sauter** — on se bat donc en attendant la fin du calcul, exactement comme
dans la série.

Pendant le répit, **le DRADIS est vide** (plus aucun spawn d'ouverture) et le journal de
passerelle égrène des rapports à chaque palier (`Range.DRADIS_LOG`). Sans ces lignes, l'attente
n'est pas de la tension mais du temps mort. À zéro : contact, et les assauts s'enchaînent selon
`assaultEvery`.

### Deux portées de radar, à ne pas confondre
`radarRangeMul` (1,5) sert à la **conduite de tir** ; `dradisRangeMul` (11) à l'**affichage** du
DRADIS, soit ~220 unités. Il fallait les séparer : on escorte une flotte étalée dans un couloir
de 860, il faut voir qui se fait mordre à l'autre bout — mais un DRADIS qui porte loin ne doit
pas rendre l'équipage précis partout (cf. `crewNoRadarMul`). Le DRADIS montre aussi les
**civils** (bleu, ambre s'ils sont sous 50 % de coque) et la porte de saut.

### Bandeau central
Les deux informations qui commandent tout sont au centre haut : le **décompte du prochain
contact** et la **charge FTL** sur une grande barre horizontale. Le reste du HUD est périphérique.

### Flotte : six gabarits distincts, 50 000 âmes
Tous les transports partaient du même profil extrudé avec les mêmes hublots : à l'écran ils se
ressemblaient. Chaque type a maintenant sa propre construction — superstructure à étages du
paquebot, réservoirs cylindriques de la citerne, conteneurs empilés du cargo, croix lumineuse de
l'hôpital, nacelles du transport, tuyères du remorqueur. On doit savoir lequel on est en train de
perdre.

### Décor : des VOLUMES, pas des disques
Les rochers étaient des `ExtrudeGeometry` — des prismes dont on voyait la face plate. Désormais
`Terrain._rockGeo` déforme un icosaèdre par un **bruit continu de la direction** (et non
`Math.random()` par sommet, qui trouerait la maille non indexée), plus des carcasses de vaisseaux
(`wreckage`), des menus débris, plusieurs plans de profondeur et une dérive lente. ~160 objets
par secteur, dimensionnés pour un couloir de 860×216. Seuls les obstacles `blocks` ont besoin
d'être espacés — les débris peuvent se serrer.

### Saut FTL et Raiders
L'effet de saut est en **DOM** (46 traînées horizontales qui s'allongent puis flash) : étirer un
nuage de `Points` coûterait cher pour une seconde d'animation. ⚠ Un `repeating-linear-gradient`
donnait des barres **verticales** — l'inverse de l'effet cherché. Les ennemis ont une silhouette
de **Raider** : ailes en croissant et **œil rouge qui balaye** en triangle (vitesse constante
puis inversion nette), ce qui les rend vivants et reconnaissables bien plus que la forme.

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

## Dépôt & journaux de session
- BSG est un **sous-dépôt git autonome** (`BSG/.git`), volontairement séparé du dépôt parent
  `~/ClaudeCode` qui est lié au contexte professionnel. C'est du perso : il n'a qu'un remote,
  `origin` = **github.com/AnOnJoe/BSG** (public), et pas la double destination GitLab du parent.
- **Jouable en ligne : https://anonjoe.github.io/BSG/** — GitHub Pages sert `main` à la racine.
  Aucune étape de build : un `git push` suffit à publier (compter ~1 min de reconstruction).
  Le site étant statique et Three.js venant du CDN, il n'y a rien de plus à faire.
  ⚠ Corollaire : **tout ce qui est commité est public**, journaux de session compris. Relire
  avant de pousser (un chemin `/Users/<nom>/…` a déjà dû être retiré du journal pour ça).
- `CC-Session-Logs/` — journaux de session (`/compress`). À lire via `/resume` avant de reprendre :
  ils contiennent les décisions de design et leur *pourquoi*, ce que le code seul ne dit pas.

## État
**La boucle est celle de Battlestar Galactica saison 1** : escorter six transports civils
(50 000 âmes) à travers cinq secteurs, en tenant chaque fois jusqu'à ce que le calcul de saut
aboutisse. On ne nettoie plus des vagues.

Fait : **menu de départ** puis boucle CIC ↔ combat, **pont hangar** en escale · **la flotte est
l'économie** (six fonctions dont la perte se paie) · hangar + upgrades + crédits · **4 postes exclusifs** (commandant / pilote / artilleur /
drones) avec équipage IA médiocre et lisible · **énergie répartie** en 3 bus + anneau de
passerelle · conduite de tir humaine (retard, dispersion, renoncement) · modes de tir · ordres
d'escadron **et de flotte** · désignation de cible · **cuirassé** démontable pièce par pièce ·
canon anti-drone · **terrain** qui coupe les tirs · **cadrage cockpit** + plein écran ·
**traversée de 5 secteurs** avec victoire · vagues à thème · **phase passerelle (CIC)** avec
dialogues et choix à conséquences (**un arc par secteur**, 42 scènes) · **saut sur place** (bulle
de rassemblement + amorçage vulnérable) · mise en scène (annonce radar, ralenti, saut FTL).

## Prochaines pistes
Ordre décidé avec l'utilisateur : **2 → 4 → 3 → 6**, les chantiers 5 (scènes par secteur) et
2 (économie de campagne) étant faits.

1. **Le DÉNOUEMENT** — « on ne sait pas comment ils nous trouvent ». Il vient **après** l'économie
   de campagne, et ce n'est pas un hasard : la décision finale est « on élimine le navire
   compromis », or détruire un de ses transports ne mordait rien tant que les âmes n'étaient qu'un
   compteur. Deux issues voulues : le détruire ⇒ la boucle se rompt, victoire ; refuser ⇒ les
   assauts ne s'arrêtent plus et la partie ne peut finir que par l'extinction de la flotte.
   L'amorce est posée : l'émission détectée dans les dialogues du Cimetière et du Blocus, et le
   jalon `trackSignal` (enregistré dans `App.signalTracked`, encore sans mécanique).
2. **Jouer une traversée complète.** À faire **maintenant que l'économie existe** : combien vaut
   un transport, est-ce que perdre la citerne se sent, le pont hangar arrive-t-il trop tard.
   Les tests headless valident les mécanismes, jamais le dosage.
   Signal relevé : un joueur qui ne touche à rien voit la flotte immobile (ordre RALLIEMENT par
   défaut, elle suit une baleine à l'arrêt) et le calcul bloqué au minimum de clarté. Le premier
   secteur devra pousser à avancer plus explicitement.
3. **Poste d'INGÉNIEUR** — le seul métier annoncé qui n'existe pas. Les sections de coque ne sont
   faites que côté ennemi (le cuirassé et ses dix pièces) ; `hullConfig.js` n'a toujours pas de
   champ `section`. Il gagne à venir après l'économie, qui a installé pièces et atelier.
4. **Finitions** : cible prioritaire persistante pour l'artillerie (`radar.maxTargets` reste
   inutilisé), calibrage des seuils de `WeaponControl._updateSolution` (annonce encore BONNE à
   ~40 % de touches sur cible qui zigzague), matière dans le décor du cockpit.
5. Plus loin : **coop multi-postes** (l'architecture est prête, cf. `Stations.js`), autres coques,
   boutique plus riche, sons d'ambiance.

**Hors périmètre décidé : le tactile.** Mesuré en émulation iOS — aucun code tactile dans le
projet, canvas à **0 px de large en portrait**, et une meurtrière de 380×137 en paysage sur
iPhone. Sur iPad (canvas 708×564) il faut un clavier. Ça demanderait une couche de contrôles
tactiles ET une mise en page mobile, or une sim de capitaine à quatre postes a besoin de surface
d'écran. Décision : on ne le fait pas.
