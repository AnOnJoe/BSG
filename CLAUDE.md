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
- **`node tools/check-syntax.mjs`** — contrôle syntaxe des 58 modules.
  ⚠⚠ **`node --check fichier.js` NE VALIDE RIEN ICI.** C'était la commande documentée
  du projet et elle renvoie **0 sur des fichiers syntaxiquement invalides** : sur un
  `.js`, node applique les règles CommonJS et abandonne dès qu'il voit un `import`.
  Elle a laissé passer **deux écrans noirs** (une apostrophe non échappée dans une aide
  de `Tune.js`, un export manquant dans `scenes.js`). L'outil copie chaque module en
  `.mjs` temporaire avant de lancer `node --check` — vérifié, il attrape `['x', 'l'a']`
  là où la commande d'origine renvoyait 0.
- **`node tools/check-dangling.mjs`** — traque les **appelants sans définition**
  (`this.app.machin()` alors que `App.machin` n'existe pas). Écrit après le bug
  `toggleExpand`, resté deux sessions : la touche **V** ne marchait pas et rien ne le
  signalait. Un contrôle de syntaxe ne voit pas ce genre de trou, et la lecture non plus.
  Heuristique : un résultat se vérifie à la main (faux positif possible sur un champ
  homonyme), zéro résultat est une bonne nouvelle.
- **Faire CLIQUER les tests, pas seulement lire l'état.** Deux « bugs » relevés ici
  n'étaient que des lectures du DOM faites avant la frame suivante — laisser passer
  ~250 ms après une action avant de mesurer.

### ⚠ PIÈGES DE MESURE (cinq faux bugs, tous produits par le banc de test)
La règle : **une mesure qui accuse le jeu doit d'abord être soupçonnée elle-même.**
Chacun de ces cas a produit un rapport alarmant et faux.
- **Le pool d'ennemis est partagé avec les vagues.** `r.enemies[0]` est réutilisé par
  l'assaut suivant : PV remis à zéro en pleine mesure, et son IA le déplace — donc
  « cible immobile » ne l'est pas. Pour juger la conduite de tir, appeler
  `weapons._fireControl()` **directement** sur une cible synthétique
  (`{position, radius}`), et mettre `assaultTimer = Infinity`.
  ⚠ Et `assaultTimer = Infinity` **ne suffit pas** : un `spawn()` remet `rotation.z` à 0, ce
  qui a produit des pointes de rotation de **3247 °/s** là où le code plafonne à 275. Vérifier
  que `e.type` n'a pas changé pendant la mesure, et sinon **ne pas passer par le pool du tout** :
  pour une loi explicite (rotation, dispersion), la simuler hors du jeu est plus fiable que de
  la mesurer dedans.
- **Le laser est HITSCAN** : il ne crée aucun projectile. Compter `range.bolts` mesure
  zéro quoi qu'il arrive ; il faut lire les dégâts cumulés.
- **`WeaponControl.ordered` est une liste MISE EN CACHE.** Monter un module en test sans
  appeler `weapons.refresh()` le rend totalement invisible : gâchette tenue 200 relevés
  sur 200, munitions intactes, aucun tir. On croit l'arme cassée.
- **L'équipement de départ est maigre** (3 plans sur 9) : pas de bouclier, pas de
  missiles. Tester `shieldUp` sans monter de module bouclier ne teste rien.
- **Tuer la baleine dans une phase invalide toutes les suivantes.** Une phase qui
  encaisse doit rendre le joueur invulnérable (`ship.structure = ship.structureMax` à
  chaque tick) — sinon les phases d'après tournent sur une partie terminée, tout est à
  zéro et on cherche la cause dans le code.
- **Ne pas extrapoler une grandeur qui accélère.** Juger la course FTL sur 60 s donnait
  « la flotte arrive avant le calcul » ; la traversée complète donne **+60 s d'avance**.
  Le taux de calcul monte avec l'éloignement (clarté 0,43 → 0,92).
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
- `js/core/Stations.js` — **postes** (commandant / pilote / artilleur / drones / ingénieur) : lequel le joueur tient,
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
- **COULOIR et non arène** : `ARENA` vaut **900 × 420** (cf. « Échelle » plus bas), on entre par
  `ENTRY_X` (gauche) et on sort à droite. Le niveau a une direction — c'était le grief
  « enchaînement d'arènes ».
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

## ÉCONOMIE : MATÉRIEL + CHANTIERS (`data/progression.js`)
« L'argent n'est pas une bonne monnaie vu que c'est notre flotte et nos ingénieurs. » Juste : il
n'y a **personne à qui acheter**. Les crédits sont remplacés par deux ressources qui ne se
substituent pas :

| Ressource | D'où elle vient | Ce qu'elle limite |
|---|---|---|
| **MATÉRIEL** | épaves, Cylons abattus, décisions du CIC | le stock de pièces |
| **CHANTIERS** | l'équipe de pont, renouvelés **à chaque saut** | combien de travaux par escale |

**C'est la seconde qui fait le jeu.** Avec mille pièces en soute on ne mène toujours que deux
travaux entre deux sauts : la question n'est plus « ai-je les moyens ? » mais « qu'est-ce qui passe
en premier ? ». Et elle est liée au **remorqueur** : mesuré, 2 chantiers avec l'atelier, **1 sans**.
Démonter ne consomme **aucun** chantier et rend la moitié du matériel — on dévisse, on ne fabrique
rien. Les sauvegardes sont **migrées** (`credits` → `salvage`), pas jetées.

### Déblocage progressif
Tout était ouvert d'emblée — douze emplacements, neuf modules, de quoi tout tester tout de suite,
donc rien à découvrir. Au départ : **3 emplacements aménagés sur 12** et **3 plans sur 9**.
- les autres emplacements sont des **coques nues** : les AMÉNAGER coûte du matériel + un chantier ;
- les modules inconnus ne s'achètent pas, leur **plan se récupère** — un par saut dans un ordre
  **fixe** (`PLAN_ORDER`), plus un par cuirassé démonté. L'ordre n'est pas tiré au hasard : une
  progression aléatoire pourrait laisser un joueur sans arme secondaire toute la traversée.
  Mesuré sur 4 sauts : 3 → 7 plans, matériel 320 → 1280.
- les plans inconnus restent **affichés**, grisés : on doit savoir ce qui existe et avoir quelque
  chose à espérer.

### Le pont hangar, refondu
Il « faisait décalé », et pour des raisons précises : une colonne de douze grosses cartes qui
**débordait de l'écran**, des boutons de navigateur là où tout le reste parle en pastilles, les
types d'emplacement en **anglais minuscule** (« weapon »), et aucun lien entre la baleine au centre
et la liste. Il est maintenant organisé par **section de coque** — les mêmes que le poste
d'ingénieur : on répare et on équipe la même géographie.
⚠ Un emplacement **non aménagé** doit se distinguer nettement d'un emplacement **libre** (bordure
pointillée, marqueur 3D `locked` éteint), sinon on clique en croyant pouvoir équiper. Et tout refus
dit **pourquoi** (« plan non récupéré », « plus de chantier ce saut-ci », « matériel insuffisant ») :
un bouton grisé muet se lit comme un bug.

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

## LE DÉNOUEMENT (`core/SignalHunt.js`) — détruire un des siens
« On ne sait pas comment ils nous trouvent. » Le ressort le plus fort de la saison, et il
**retourne le jeu** : depuis le début on protège six coques, et la seule sortie consiste à en
détruire une soi-même. Il se joue au dernier secteur (`sector.finale`).

**Pourquoi ici et pas plus tôt** : tant que les âmes n'étaient qu'un compteur, abattre un de ses
transports ne pesait rien. Ce n'est qu'avec l'économie de flotte que le sacrifice ampute — et le
coupable étant **tiré au sort**, ce peut être la citerne dont on a besoin pour forcer le calcul.

**L'arbitrage est information contre temps.** Chaque **RELEVÉ** écarte un innocent à coup sûr mais
coûte `TUNE.signalFixCost` (11 %) de charge FTL, c'est-à-dire exactement ce qui permet de fuir.
Mesuré : la certitude complète prend **5 relevés** et fait tomber le calcul de **74 à 19 %**. On
peut donc tirer avant d'être sûr — moins cher, mais tuer un innocent coûte ses âmes, sa fonction,
et **ne rompt pas la boucle**.
⚠ Un relevé n'écarte **jamais** le coupable : payer de la charge FTL pour n'apprendre parfois rien
transformerait la déduction en loterie.

**Le tir sur un civil exige un ordre explicite** (`SignalHunt.designate`, clic sur la console du
commandant). Sans cette autorisation, un civil n'entre pas dans `_hostilesForPlayer()` — sinon une
balle perdue massacrerait la flotte qu'on est venu sauver, et l'horreur serait **subie** au lieu
d'être décidée. Corollaire assumé : une fois désigné, l'équipage l'engage aussi.

**Deux issues :**
- détruire le coupable puis sauter ⇒ `_win()`, et le bilan nomme qui a été sacrifié **et** les
  innocents abattus avant lui. Les taire viderait la décision de son poids.
- sauter sans avoir résolu ⇒ `_loopAgain()` : on ressort au **même point**, il n'existe plus
  aucune victoire, seule l'extinction de la flotte peut finir la partie. Le CIC joue un arc court
  du refus (`PORTE_BOUCLE`, 5 scènes, **aucun choix** — c'est le sens du refus) et le bandeau dit
  « MÊME POINT, TOUR n ». Les assauts se resserrent de `loopAssaultTighten` par tour : refuser doit
  coûter, pas ennuyer.

⚠ La clé de mémorisation de l'arc du CIC (`Bridge._lastSector`) inclut le **tour de boucle**, sinon
revenir à la Porte reprenait l'arc à sa dernière réplique et sautait la passerelle.

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
- Contrôles : `Espace`/clic = suivant · `1..3` = choisir · **`N` = passer les DIALOGUES**.
  ⚠ `N` expédiait l'arc entier : on entrait au combat sans qu'aucun choix n'ait été fait, donc
  « no décision no impact ». Elle saute désormais les répliques et **s'arrête à chaque choix**, et
  son libellé annonce combien de décisions restent. Première correction encore trouée : elle ne
  regardait que **devant**, donc sur un choix la touche sautait par-dessus — marteler `N` menait au
  combat avec zéro décision. Vérifié : marteler `N` ou `Espace` reste bloqué sur le choix.
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

### ⚠ LE DÉCOR ÉTAIT INFRANCHISSABLE EN LIGNE DROITE
Grief de partie test : « gros problème d'évitement des obstacles… c'est très fouillis », « je veux
juste que la flotte suive mon vaisseau qui va tout droit ». **La cause n'était pas dans le code de
pilotage.** Mesuré : sur 51 lignes horizontales échantillonnées, **zéro** n'était libre pour un
corps de rayon 10, et dans **tous** les terrains sauf le vide. Aucune consigne ne peut donner un
résultat propre là-dedans. `Terrain.build` réserve donc des **VOIES** (`lanes`, `laneHalf`) où rien
de bloquant n'est posé — 9 à 19 lignes libres sur 51 selon le terrain, sans marquage visible.

Trois bugs de pilotage s'y ajoutaient, et chacun est un piège à ne pas refaire :
1. `desired = rot + away * 1.15` était **relatif au cap courant** et réappliqué chaque frame : un
   **intégrateur**. Le cap faisait plus d'un tour complet.
2. `Terrain.rayHit` ignorait le **rayon du corps qui sonde** : un passage à trois unités du caillou
   était déclaré libre alors qu'une coque de rayon 4,2 le raclait. D'où le paramètre `pad` — à
   laisser à 0 pour la **ligne de vue** (un tir n'a pas d'épaisseur), à passer pour une trajectoire.
3. L'esquive **remplaçait l'objectif** au lieu de composer avec lui : la baleine partait
   perpendiculairement à la sortie et n'arrivait jamais.
Remplacé par des **MOUSTACHES** : on sonde plusieurs caps autour du cap voulu, du plus direct au
plus détourné, et on prend le premier dégagé — le détour est donc minimal et toujours orienté vers
l'objectif. Hystérésis sur le côté choisi (sans elle, 21 inversions en 25 s).
Mesuré, 25 s dans la Ceinture sans intervention : avance **−45 → +71**, coque **72 → 100**.

### ⚠ Trois boucles de rétroaction, toutes mesurées
- **La baleine RECULAIT.** Le barreur escortait le traînard, or le traînard est le transport le plus
  **éloigné** de la baleine, donc toujours derrière ; il faisait demi-tour, et en RALLIEMENT la
  flotte reculait avec lui, ce qui éloignait encore le traînard. Règle : **si la flotte suit, la
  baleine MÈNE** (`ctx.fleetFollows`).
- **La baleine distançait la flotte** de 101 unités en 8 s, **vidant la bulle de saut** (0/6) —
  ordonner le saut aurait tué toute la flotte. Deux correctifs faux avant le bon : ralentir
  proportionnellement (l'écart se stabilisait à 87, encore au-delà du rayon 78) puis couper les gaz
  (**blocage mutuel**, tout avançait à 1,3/s au lieu de 4, la flotte suivant une baleine à l'arrêt).
  Le bon modèle est un **asservissement de vitesse** : au-delà de `helmLeadView` (part du champ
  visible) la baleine se cale sur l'allure du convoi. Écart tenu à 44, bulle 6/6.
  ⚠ **Un POINT DE ROUTE échappe à cet asservissement**, sinon l'ordre du joueur est annulé sans
  un mot dès qu'il clique devant la flotte — c'est-à-dire dans le cas normal.

### La flotte n'est plus un bloc
« Elle se déplace comme un bloc où on aurait regroupé tous les vaisseaux » — c'était littéral : même
position visée lissée au même taux pour tous, tous à la vitesse du plus lent. Chaque transport a
maintenant ses **traits propres** (allure de croisière, mollesse, balancement, décalage de station),
sa propre inertie, et ils **se repoussent entre eux** — sans quoi ils convergeaient tous dans la
même voie libre et se chevauchaient. `convoyCatchup` leur permet de pousser les moteurs pour
recoller, ⚠ **plafond appliqué après le facteur d'urgence** sinon ce n'est pas un plafond (mesuré
des transports à 10,9 pour un nominal de 5,6). Mesuré : 6 vitesses distinctes en permanence,
**0 encastrement sur 400 relevés**.

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
- **Matière du cockpit** : rivets et joints de panneaux sur les montants, et surtout l'écran
  **encastré** dans la coque (ombre interne + chanfrein) — c'est le signal « on est derrière une
  vitre » le plus efficace. ⚠ Les **hublots latéraux** ont été essayés puis **retirés** : les marges
  portent déjà les panneaux du HUD, et des ouvertures y ressemblaient à des points parasites, pas à
  une coque. Tout est en dégradés répétés (aucun asset) et `#cockpit-shell` reste en
  `pointer-events: none` — vérifié, `elementFromPoint` renvoie bien le canvas.
- **Ambiance sonore** synthétisée (`Audio.ambience`) : une note très basse **battante** (deux sinus
  désaccordés de 7 cents — un oscillateur seul donne un bourdon électronique mort) plus un **souffle**
  de ventilation en bande étroite, qui donne le volume de la pièce. La basse monte au combat, le
  souffle domine au CIC, transitions sur 2 s (une ambiance qui change brusquement s'entend, et
  s'entendre est ce qu'elle ne doit pas faire). Mesuré : basse 0,047 → 0,140 du CIC au combat. Le
  menu reste **silencieux** : ce n'est pas un lieu du vaisseau.

## LA RÉFÉRENCE EST HOMEWORLD : on ordonne à des masses
Verdict de la première vraie partie : « **dans l'ensemble c'est trop nerveux · il faut
imaginer de gros vaisseaux lents · regarde Homeworld · on est plus dans un style RTS** ».
C'est la correction de cap la plus importante reçue sur le projet, et elle tranche une
ambiguïté qui traînait depuis le début : ce n'est pas un shoot avec des menus, c'est un RTS
spatial à une seule flotte. **La latence de réponse EST la mécanique** — on anticipe, on ne
réagit pas.

⚠ **« Trop nerveux » ne veut PAS dire « tout ralentir ».** Le même retour dit « les
intercepteurs ça va » et « les missiles ne sont pas assez rapides ». Ce qui rend une scène de
RTS spatial lisible, c'est **l'écart entre les masses et les petits engins** : on voit venir
une passe de chasse parce que les bâtiments, eux, lambinent. La règle du projet est donc :

> **La masse commande la lenteur. Ce qui est gros est lourd ; ce qui est petit reste vif ;
> les armes ne ralentissent jamais.**

Hiérarchie mesurée après correction (unités/s) :

| | avant | après |
|---|---|---|
| cuirassé | 6,7 | **4,4** |
| gunship (bâtiment léger) | 7,6 | **5,0** |
| porte-drones | 10,1 | **6,9** |
| **convoi civil** | 8,4-10,9 | **5,2-6,8** |
| raider | 12,6 | inchangé |
| **baleine (pointe)** | 21 | **16,9** — validée par le joueur |
| chasseur | 18,9 | inchangé |
| intercepteur / drone | 36 | inchangé — validé par le joueur |
| missile | 46 | **78** |

**Le convoi était le pire contre-exemple**, et il avait été laissé de côté au premier passage
sous prétexte qu'il est « l'horloge du niveau ». Mesuré : le paquebot Cloud 9, plus grosse coque
civile du jeu (rayon 7,2 · 20 400 âmes), filait à **9,7 — deux fois l'allure d'un gunship cylon
et du cuirassé**. Et `convoyCatchup` portait un traînard à **17,1**, donc plus vite que
l'escorte elle-même (16,9) : un civil qui recolle dépassait le vaisseau censé le protéger.
Corrigé par `convoySpeedMul` 2,1 → 1,3 ; vérifié qu'aucun civil, même en recollant (9,8 au
plus), ne dépasse plus la baleine.

### Temps de rotation, tous vaisseaux (référence)
Le chiffre à citer pour la baleine est **18,9 s le tour complet**, mais il n'y en a pas qu'un :
sa rotation passe par le **bus moteurs** (`angAccel * engineMul`), donc le profil d'énergie la
change du simple au double. C'est un effet de gameplay réel — le profil COURSE est aussi un
profil de manœuvre.

| baleine, profil d'énergie | rotation | 180° | **360°** |
|---|---|---|---|
| COURSE (moteurs 60 %) | 28,1 °/s | 6,6 s | **12,9 s** |
| ÉQUILIBRE | 19,0 °/s | 9,7 s | **18,9 s** |
| ATTAQUE ou DÉFENSE (moteurs 20 %) | 14,4 °/s | 12,6 s | **24,8 s** |

### ⚠⚠ L'ÉTALON DE ROTATION : la baleine a le rayon du REMORQUEUR
C'est l'information qui a débloqué tout le calibrage, et elle est venue du joueur :
« **la baleine fait la taille du remorqueur, sa vitesse de rotation est parfaite, mais les
autres qui sont beaucoup plus gros tournent beaucoup trop vite** ». Vérifié :
`Ship.collisionRadius` vaut **4,2**, exactement le rayon du remorqueur.

> **RÈGLE : rayon 4,2 → 19 °/s. Toute coque plus grosse tourne PLUS LENTEMENT que la baleine.**
> Le taux vaut `convoyTurnRate × (4,2 / rayon)^turnMassExp`. Ce n'est plus un tâtonnement mais
> une loi ancrée sur un point validé en jeu.

| vaisseau | rayon | rotation | demi-tour |
|---|---|---|---|
| **BALEINE** (référence validée) | 4,2 | **19 °/s** | **9,7 s** |
| Remorqueur — même taille, donc même virage | 4,2 | 19 °/s | 10,1 s |
| Cargo lourd | 6,0 | 11,1 °/s | 17,3 s |
| Transport Gemenon | 6,2 | 10,6 °/s | 18,1 s |
| Citerne à tylium | 6,4 | 10,1 °/s | 19,0 s |
| Navire-hôpital | 6,6 | 9,6 °/s | 19,9 s |
| **Paquebot Cloud 9** | 7,2 | 8,5 °/s | 22,7 s |
| **CUIRASSÉ cylon** | 46 | 7 °/s | 27,4 s |

Les ennemis sont **tous plus petits que la baleine**, donc la règle les autorise à être vifs :
chasseur 275 °/s (0,7 s) · raider 179 °/s (1,1 s) · porte-drones 62 °/s (3,1 s) · gunship
48 °/s (4,0 s). ⚠ Sous la même loi ils tomberaient à 54 · 39 · 31 · 22 °/s — c'est un choix de
design ouvert (une chasse embarquée doit-elle rester acrobatique ?), pas un oubli.

⚠ **Quatre corrections sont nées de cette seule question, et aucune ne se voyait à la lecture :**
- **`lag` était tiré de l'INDICE dans la liste** (`0.35 + ((i * 0.317) % 1) * 0.5`). Le paquebot
  étant premier, il recevait la valeur la plus basse et devenait **le plus vif des six** :
  demi-tour en 2,5 s contre 8,6 s pour le navire-hôpital. La plus grosse coque du jeu était la
  plus agile, **par accident de rangement**. La rotation vient maintenant du **rayon**, et `lag`
  ne garde que l'inertie de translation (elle aussi dérivée de la masse).
- **`Math.min(1, dt * taux)` sature sur une frame longue** et fait pivoter la coque d'un bloc
  (relevé des pointes impossibles en headless). Remplacé partout — convoi, ennemis, cuirassé —
  par une **vitesse angulaire plafonnée**. Sur un bâtiment lourd, ce saut ruinait à lui seul
  l'impression de masse.
- **L'amorti d'approche mangeait la moitié du virage.** Il commençait à 69° du but, donc à
  vitesse de rotation ÉGALE un civil mettait 15,4 s là où la baleine met 9,7 : les deux familles
  devenaient **incomparables**, et aucun étalonnage n'était possible. D'où `TURN_GAIN = 3`, qui
  réserve l'amorti aux 23 derniers degrés.
- **Le cuirassé tournait à 24 °/s**, donc plus vite que la baleine, pour une coque **dix fois
  plus longue**. C'était la violation la plus grossière de la règle. Ramené à 7 °/s ; il ne fait
  que présenter sa bordée, la lenteur ne le pénalise pas, elle le rend imposant.

**Le poste clé était la ROTATION, pas la vitesse.** La baleine tournait à **95 °/s**
(`angAccel` 3,0 ÷ `angDrag` 1,8) : le chiffre d'un chasseur. Elle est à **19 °/s**, soit un
demi-tour en **9,7 s** (mesuré), et elle s'arrête en 4 s sur son erre. Côté ennemi, le taux
de lissage du cap était **fixé à 4 pour tous les types** — un bâtiment lourd pivotait aussi
sec qu'un chasseur ; c'est devenu un trait par type (`turn`), de 0,7 pour un gunship à 4,0
pour un chasseur.

**Les transports ne tournaient pas du tout** : `rotation.z` restait à 0 pour toujours, donc
un cargo qui montait en formation se déplaçait **en crabe**, proue obstinément vers la sortie.
Ils ont maintenant un cap qui suit leur marche, divisé par leur mollesse propre — six allures
de virage distinctes en permanence. Mesuré sur un demi-tour demandé : **60 à 85° en 2 s**,
puis 75 à 185° au bout de 8 s.

⚠ **Ce taux était CODÉ EN DUR (0,18), et ça s'est payé cash.** Sur un retour de partie « la
vitesse de rotation des civils n'est pas bonne », il était impossible de savoir s'il fallait
monter ou descendre — seule une mesure a montré que le virage ne faisait que 1 à 12° en 5 s,
donc à la limite du perceptible. C'est exactement le cas que la règle du panneau T existe pour
éviter : `TUNE.convoyTurnRate`. **Une valeur de sensation doit être une jauge, sinon chaque
retour du joueur devient une devinette.**

Corollaire : **le déplacement au clic devient le geste principal**, pas une option. C'est
l'idiome du genre, et il est le seul praticable avec une telle inertie.

## Rythme : jeu de postes, pas beat'em all
Un jeu de postes **ne peut pas** être nerveux : sans respiration, on n'a jamais le temps de
changer de poste, et la mécanique centrale devient inutilisable. Le ralentissement n'est donc
pas cosmétique. Réglages : `enemySpeedMul` **1.26**, `enemyFireMul` 1.6 (intervalle ×),
`spawnDist` **164** (approche longue et lisible), `waveBreak` 8 s. Plus le ralenti à 25 % dès
qu'un panneau de commandement est ouvert (`Range.timeScale`).
⚠ Ces chiffres sont **relatifs au monde** : `enemySpeedMul` a l'air agressif à 1,26 alors qu'il
vaut exactement les 0,6 d'avant dans un monde 2,1× plus grand. Ne pas les lire dans l'absolu —
c'est le rapport à `spawnDist` et aux portées qui fait le rythme.

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
là : *où ai-je le plus de valeur ajoutée, maintenant ?* Cinq postes (`Stations.js`) :

| Poste | L'IA sait | L'IA ne sait pas (ton créneau) | Chiffres |
|---|---|---|---|
| **COMMANDANT** | rien : elle n'y touche pas | répartir l'énergie, couper un module, l'IEM | profils d'énergie |
| **PILOTE** (`AutoHelm.js`) | appliquer la consigne, éviter les bords | juger **quand** changer de consigne | ENGAGER · **TENIR** · RÉCUPÉRER · ROMPRE |
| **ARTILLEUR** (`WeaponControl.js`) | tirer sur le plus proche à portée | toucher ce qui manœuvre, choisir la cible | mode de tir |
| **DRONES** (`Range.droneOrder`) | rien : elle applique ta consigne sans l'adapter | regrouper, replier avant qu'ils meurent | ordre d'escadron |
| **INGÉNIEUR** (`Engineer.js`) | colmater la section la plus abîmée | juger **laquelle sert maintenant** | 4,5 → 10,8 PV/s au poste |

### Consigne ≠ exécution (la frontière du commandement)
Le **commandant pose les consignes de TOUS les postes** depuis sa console (`Range.setOrder`,
au clic) : sinon il devrait descendre à la barre pour dire au barreur quoi faire, ce qui n'a
aucun sens. Ce qu'il ne peut pas faire à distance, c'est **exécuter** :

| Poste | Consigne (commandant OU poste) | Exécution (au poste seulement) |
|---|---|---|
| PILOTE | engager / **tenir** / récupérer / rompre | barrer à la main |
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
(`screenRefH / viewport.h`, plafonnée à 2), du **zoom personnel à la molette**
(`userZoom`) et de `capitalCamZoom`. Régler la largeur de vue = `viewZoom`, panneau **T**.

## ÉCHELLE : c'est un RAPPORT, pas une taille
Grief de partie test : « l'espace est immense et ça ne se ressent pas, les vaisseaux sont
énormes dans un tout petit espace, on a l'impression de piloter un kart entre les
astéroïdes ». Mesuré à `viewZoom` 1,15 : champ visible **81 × 56 unités**, donc un paquebot
occupait **36 %** de la largeur de l'écran, un rocher 28 %, et les obstacles étaient espacés
de **37 unités** — à peine une longueur de paquebot.

**Agrandir le monde seul ne change RIEN à l'image**, et élargir la vue seule raccourcit le
couloir en nombre d'écrans. Il faut les deux, dans le même rapport (×2,1) : `viewZoom` 2,4,
couloir `ARENA` 430×108 → **900×420**, et toutes les vitesses, portées et distances
d'engagement à l'échelle. Mesuré après :

| | avant | après |
|---|---|---|
| champ visible | 81 × 56 | **217 × 146** |
| paquebot / largeur d'écran | 36 % | **6,6 %** |
| plus gros rocher / largeur | 28 % | **14,6 %** |
| espacement des obstacles | 37 | **116** |
| couloir en écrans | 5,3 | **8,3** |

⚠ **La hauteur est gratuite ; la longueur se paie, mais pas comme je l'ai d'abord écrit.**
J'ai longtemps documenté que rallonger le couloir « rallonge la traversée et casse la course
contre `sector.ftlTime` ». C'est faux, et la confusion vient d'avoir pris **l'arrivée au bout
du couloir pour la fin du secteur**. Elle ne l'est pas :

> **Le bout du couloir n'est PAS un objectif.** `CONVOY_LIMIT` est seulement l'endroit où la
> flotte cesse d'avancer. Le secteur se termine quand le **calcul de saut aboutit** et qu'on
> ordonne le départ. La longueur du couloir n'agit donc que sur la **clarté** (`FtlDrive.clarity`,
> fonction de la FRACTION parcourue), c'est-à-dire sur la vitesse du calcul — pas sur une
> distance à couvrir.

Conséquence pratique : un couloir long est **bon marché**. Mesuré, en ralentissant le convoi de
8,4-10,9 à 5,2-6,8 sans toucher à la longueur, le calcul aboutit à **200 s au lieu de 170 s** —
30 s de plus, et la flotte n'a parcouru que **69 %** du couloir au moment du saut. Elle en
épuisait la quasi-totalité avant, donc la longueur sert enfin à quelque chose.

### ⚠⚠ CINQ VALEURS ABSOLUES OUBLIÉES PAR LE RESCALE
Le piège de ce genre de chantier : chaque oubli fait disparaître un effet **en silence**.
Aucun ne lève d'erreur, aucun ne se voit à la lecture.
- **Les drones ennemis devenaient inoffensifs bouclier levé.** `shieldRadius` 9 → 19 pousse
  leur orbite à 20,5 pour une portée de tir restée à 12 : ils tournaient sans jamais tirer,
  et le canon anti-drone perdait sa raison d'être. Portée à 25 **et plancher-née sur la
  distance d'orbite** (`Math.max(fireRange, orbitR + 3)`) — le bouclier doit ARRÊTER les
  tirs, pas empêcher qu'ils partent. Vérifié : 3 drones à 21 du centre, **13 traçantes en
  10 s** contre 0 avant.
- **Les projectiles restaient à 26/55.** Un tir mettait deux fois plus longtemps à arriver,
  et un cuirassé léger qui engage à 50 voyait ses tirs mourir à 55. Règle : un projectile
  doit porter **nettement** plus loin que la distance d'engagement de qui le lance.
- **Les missiles à 22/s** contre un chasseur passé à 18,9/s : 3 unités/s de rattrapage, ils
  accompagnaient la cible. À 46/s, vérifié : **34 PV en 10 s**.
- **Les distances d'engagement des ennemis** (12-24) n'avaient pas bougé : ils venaient se
  coller à la coque, ce qui annule « l'approche longue et lisible » dont dépend tout le
  rythme lent. Mises à l'échelle + `TUNE.enemyRangeMul` pour rejuger en jeu.
- **Le panneau T devenait un piège** : `helmStandoff` 50 avec une jauge bornée à 40 et
  `shieldRadius` 19 bornée à 16 — y toucher **rabattait la valeur** et annulait le rescale.
  Plus trois défauts hors du **pas** de leur jauge, donc marqués « modifié » en permanence
  et impossibles à retrouver. **Toute valeur mise à l'échelle doit voir ses bornes ET son
  pas suivre.** Un test le vérifie désormais (bornes, pas, aide, orphelins).

### Conduite de tir : le rescale ne l'a PAS dégradée
`crewSpread` a été **divisée par 2,1** en même temps que les distances doublaient : l'erreur
latérale au but vaut angle × distance, donc garder la valeur d'avant divisait le taux de
touche. ⚠ Première tentative fausse : élargir `crewHoldFactor`, ce qui fait tirer l'équipage
sur de **mauvaises** solutions au lieu de préserver sa précision. Mesuré sur 1 500 appels
directs à `_fireControl` par cas (portée laser 84, radar 63, seuil 0,667) :

| distance | cible immobile | cible qui manœuvre |
|---|---|---|
| 20 | 100 % (q 0,99) | 100 % (q 0,56) |
| 50 | 100 % (q 0,93) | 100 % (q 0,48) |
| **63** (là où le barreur se place) | **100 %** (q 0,86) | **66 %** (q 0,23) |
| 80 (hors radar) | 91 % (q 0,36) | 43 % (q 0,12) |
| 100 | 63 % | 44 % |

Le profil est celui d'avant : parfait à la distance de combat tenue, dégradé au-delà du
radar. C'est bien la portée radar qui décide de la distance utile de combat.

## ZOOM À LA MOLETTE et POINT DE ROUTE
« Ça reste trop karting en mode pilote, je pense qu'il faut pouvoir zoomer et dézoomer avec
la molette » puis « ou alors il faut un déplacement au clic souris ». Les deux sont faits, et
le second est plus qu'un confort : on **ordonne un point** à un vaisseau capital, on ne le
conduit pas — les flèches, en donnant poussée et virage, invitaient à conduire.

- **Molette** : un cran multiplie le recul par 1,12 (progression géométrique — un pas additif
  serait imperceptible dézoomé et brutal serré), borné par `zoomMin`/`zoomMax`. Le HUD
  l'annonce (`VUE 182 %`), sinon on ne sait pas comment revenir.
  ⚠ **AUCUN effet de jeu** : `Range.viewHalfW` se calcule sur le zoom de BASE. Si la bulle de
  saut suivait le zoom personnel, dézoomer l'élargirait et rendrait les sauts triviaux.
  Vérifié : demi-largeur de référence **inchangée** à 108,3 après 8 crans de dézoom.
- **Point de route** (clic gauche, **poste de pilote uniquement** — ailleurs le clic tire ou
  désigne) : c'est le **même barreur IA** qui y mène, donc exactement la même inertie et la
  même esquive, sans duplication. Freinage anticipé (`helmBrakeDist` 90), effacé à l'arrivée
  (`helmArriveDist` 14) ou dès qu'on touche aux flèches. Mesuré : 157 unités parcourues en
  9 s, vitesse 0 → 22 → 7, point consommé.
  ⚠ **Bug rencontré : l'asservissement d'escorte annulait l'ordre.** La baleine approchait à
  20 unités puis s'y bloquait (vitesse 1,1, distance qui remontait) parce que la flotte était
  loin derrière : `lead > slack × 1,7` forçait la poussée à −0,3. Or le cas normal du clic est
  de désigner un point DEVANT la flotte pour la mener. Le point de route est donc **exclu**
  de cet asservissement — garder le convoi groupé redevient la responsabilité du joueur, ce
  qui est exactement le sens de prendre la main.

**Le poste de pilote garde sa raison d'être**, objection légitime une fois le clic en place :
le clic donne le cap, mais le **routage** se juge sur deux choses que l'équipage IA ignore
complètement — se mettre **à couvert** (le décor coupe les tirs, elle n'en tient aucun compte)
et tenir la flotte **dans la bulle** avant d'amorcer. Les deux sont devenus des instruments
du cockpit (`.ck-nav`) ; sans eux cette valeur restait invisible et le poste paraissait vide.

### Grandeurs DÉRIVÉES du champ visible
Trois valeurs étaient calibrées à la main sur une demi-largeur observée une fois (41), donc
changer `viewZoom` au panneau T les cassait **silencieusement** — flotte hors champ, bulle
qui déborde. Elles s'expriment maintenant en **part de la demi-largeur visible** :
`gatherView` (bulle de saut, 0,95 → son bord affleure l'écran), `helmLeadView` (avance
tolérée du barreur) et `Convoy.FOLLOW_X` (stations de RALLIEMENT).

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

**Seuils de « SOLUTION DE TIR » DÉRIVÉS de la géométrie**, et non posés à la main. Un tir touche
quand l'erreur de visée reste sous la taille **angulaire** de la cible, donc quand
`quality >= 1 − 1/crewHoldFactor` (**0,667**). Or « BONNE » commençait à **0,60** : le HUD annonçait
une bonne solution là où l'on ne touche pas. Mesuré sur 8 500 tirs (4 profils de cible × 4 distances),
par tranches de 0,025 : **≤54 % de touches jusqu'à 0,675, puis 100 % au-delà** — la transition est
franche. Les seuils suivent maintenant `crewHoldFactor`, donc ils restent justes s'il est réglé.

### Cible prioritaire et pistes du radar (`radar.maxTargets`)
La **cible prioritaire** (touche **X**) est une consigne persistante de plus : l'équipage continue de
l'engager quand le joueur quitte le poste, sans jamais la remettre en question. Réservée au poste
d'artilleur — le commandant pose le mode de tir à distance, mais choisir où concentrer le feu demande
d'y être. Elle se libère seule si la cible meurt ou sort de la portée radar.

⚠ **Première tentative creuse, et instructive.** J'avais fait de `maxTargets` un budget de verrous
consommé par tourelle : ça ne changeait **absolument rien**, parce que toutes les tourelles
interrogent `nearestHostileTo` depuis leur propre position et **convergent donc sur le même
ennemi** — le budget n'était jamais atteint. Mesuré `[13,13,13]` à 1 comme à 3 pistes. Le radar tient
désormais une **liste** de pistes et les tourelles s'y **répartissent**. Mesuré, 3 lasers contre
3 ennemis à 12/20/30 :

| Pistes | Cibles des tourelles | Effet |
|---|---|---|
| 1 | `[13,13,13]` | tout le feu sur une cible : redoutable sur un gros bâtiment, débordé par une nuée |
| 2 | `[13,20,13]` | |
| 3 | `[13,20,31]` | un canon par menace, mais chacune tombe plus lentement |
| 1 + priorité à 30 | `[31,31,31]` | concentration totale sur la désignée |

Améliorer le radar achète donc de la **souplesse tactique**, et non un chiffre de portée.

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

## POSTE D'INGÉNIEUR — sections de coque (`Engineer.js` + `HULL_CONFIG.sections`)
Le cuirassé ennemi se démontait pièce par pièce depuis longtemps ; le joueur, lui, n'avait qu'une
barre de PV globale. Il a maintenant **quatre sections** — PROUE, CŒUR, POUPE, PROPULSION — qui
encaissent selon le **point d'impact** (`Ship.takeDamage(d, at)` ramène le point dans le repère de
la coque, qui tourne). Vérifié sur les quatre : un tir à l'avant va en PROUE, à la queue en
PROPULSION.

**⚠ Les sections ne remplacent PAS `structure`, elles courent en parallèle.** La létalité du jeu
est donc inchangée — pas de régression d'équilibrage — et la couche locale n'ajoute qu'une chose :
une section tombée met **ses modules hors service jusqu'à réparation**. Le bouclier protège aussi
la coque locale (sections intactes tant que la bulle tient), ce qui garde son rôle cohérent.

**L'IA est délibérément fruste** : elle colmate la section **la plus abîmée**, alors que la bonne
décision est presque toujours ailleurs. Démontré : poupe à 8 PV mais vide de modules, laser éteint
en proue ⇒ l'équipage part sur la POUPE. C'est *le* signal « descends à la machine ».

Au poste, le joueur **choisit** la section et répare `engRepairPlayerMul` fois plus vite (mesuré
**4,5 → 10,8 PV/s**). Les deux avantages sont nécessaires : sans le choix il n'apporterait rien,
sans le débit choisir ne changerait rien à temps. Une section repasse en service à
`Ship.SECTION_BACK` (**25 %**) — exiger 100 % rendrait le poste inutile en combat, où l'on ne finit
jamais un chantier.

Deux garde-fous, tous deux parce qu'un **refus muet se lit comme un bug** :
- un module coupé par une section percée ne se rallume **pas** au clic, et le HUD l'affiche « HS »
  barré en magenta — à distinguer d'un module volontairement éteint par le commandant ;
- percée et remise en service sont annoncées au journal **avec le nom des modules** concernés.

⚠ Piège rencontré : `Hud.setCommands` tombait dans un `else` qui servait `HELM_ORDERS` à tout poste
non prévu, donc le cockpit de l'ingénieur affichait « ENGAGER / RÉCUPÉRER / ROMPRE ». Tout nouveau
poste doit avoir sa branche explicite.

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
- **Équilibrage → `js/core/Tune.js`** (objet `TUNE` + `TUNE_SPECS` + `TUNE_DEFAULTS`).
  **RÈGLE : toute valeur qui peut poser un problème d'équilibrage ou de gameplay doit
  être là.** S'il faut toucher au code pour tester un chiffre, c'est qu'il manque une
  entrée. **78 réglages, couverture 78/78** (un test le vérifie).
  Ajouter un réglage = 1 entrée dans `TUNE` + 1 dans `TUNE_SPECS`, cette dernière au
  format `[clé, label, min, max, pas, groupe, aide]` — le **groupe** et l'**aide** ne
  sont pas optionnels en pratique : sans eux le panneau redevient illisible.
  ⚠ Le test vérifie aussi que **chaque défaut tombe DANS ses bornes et SUR son pas**.
  Les deux se cassent dès qu'on met une valeur à l'échelle sans toucher à sa jauge, et
  le symptôme est vicieux : la valeur est rabattue au maximum de la jauge dès qu'on
  l'effleure (donc le réglage s'annule tout seul), ou marquée « modifiée » à jamais
  parce que le pas ne contient pas le défaut.
  Les valeurs doivent être lues **en direct** au point d'usage (getters sur les
  objets de données quand il le faut : `FTL_MODES`, `FIRE_MODES`, `FLEET_ORDERS`,
  `JUMP_REPAIR`). Deux exceptions assumées et **dites dans l'aide** : les PV des
  transports et des sections s'appliquent au montage, pour qu'un curseur bougé en
  pleine bataille ne soigne ni ne perce rien d'un coup.
  ⚠ La bulle de saut est construite à **rayon 1 puis mise à l'échelle** — sans ça il
  faudrait reconstruire la géométrie à chaque cran du curseur.

### Le panneau T doit rester UTILISABLE
69 jauges à plat, ce n'est pas « complet », c'est **inutilisable** : on ne règle rien et
le panneau perd sa raison d'être. Quatre choses le rendent praticable (`game/TunePanel.js`) :
- **groupes repliables**, les trois premiers ouverts (Fuite & saut, Flotte civile,
  Dénouement — les mécaniques les plus jeunes, donc les moins calibrées) ;
- **aide en clair sous chaque libellé**, jamais en infobulle : cachée, elle n'aide pas.
  Elle dit ce que le réglage change **et ce qu'il coûte** — un chiffre isolé ne se règle
  pas sans savoir contre quoi il s'échange ;
- **filtre** qui cherche aussi dans l'aide, donc on retrouve un réglage par son EFFET
  sans connaître son nom. Mesuré : « traînard » → 2, « rafale » → 3, « pont hangar » → 2 ;
- **marquage des valeurs modifiées** (liseré ambre, compteur global, pastille par groupe
  visible même replié, retour au défaut d'un clic). Sans ça, après vingt minutes de
  tâtonnement on ne sait plus ce qu'on a touché, et un mauvais réglage oublié **se prend
  pour un bug**. Le JSON n'exporte que le **diff**.
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
- **Appelant sans définition** : `App.toggleExpand()` a disparu du fichier (perdue dans `16a4533`)
  alors que ses deux appelants ET tout le CSS `body.expanded` étaient restés. La touche **V** et le
  bouton ⛶ levaient donc « toggleExpand is not a function » pendant deux sessions. Ça ne se voit
  pas à la lecture, seulement à l'usage — d'où l'intérêt de faire *cliquer* les tests headless sur
  les commandes, et pas seulement de lire l'état.
- **Le contrôle de syntaxe du projet ne contrôlait rien** : `node --check` sur un `.js` est un
  no-op pour un module ES. Voir « Lancer & vérifier ». C'est le pire genre de piège — un outil
  de garde qui dit toujours oui.
- **Une valeur mise à l'échelle sans ses bornes de jauge** s'annule dès qu'on touche au curseur.
  Cinq cas dans le rescale, tous silencieux : voir « Échelle ».
- **`shieldUp` demande un module bouclier monté** ; il n'y en a pas dans l'équipement de départ.
  Même remarque pour les missiles. Écrire `ship.shield = 60` ne lève aucune bulle.
- **`ARENA.y * 1.2` comme étalement de formation** : juste à 108 de haut (130 ≈ un écran),
  absurde à 420 (**504 pour un champ visible de 146**) — la flotte naissait hors de l'écran à
  chaque saut. Toute formation se dérive du **champ visible**, jamais du couloir.
- **Un malus de scène qui ne se dénoue jamais.** Les modules coupés par une décision du CIC
  restaient éteints pour le reste de la partie, sans nom et sans marque distinctive : le joueur
  ne savait ni lequel il avait perdu, ni qu'il ne reviendrait pas. Un effet annoncé « au
  prochain combat » doit être **nommé**, **marqué** (`_crewDetached`, pastille ambre pointillée
  « DÉT. », distincte du « HS » magenta d'une section percée) et **repris** au saut suivant.
- **Un objectif d'IA peut être mortel sans que l'IA soit en cause.** La consigne RÉCUPÉRER
  mettait `closing = 1` sans zone morte : le barreur poussait contre un rocher pour atteindre
  une caisse collée dessus, et raclait la coque jusqu'à la défaite. L'esquive faisait pourtant
  son travail. **Quand une manœuvre propre n'existe pas, c'est l'objectif qu'il faut refuser**,
  pas le pilotage qu'il faut corriger : `_nearestPickup()` écarte les caisses dont la position
  ou la ligne d'approche n'est pas dégagée.

## Dépôt & journaux de session
- BSG est un **sous-dépôt git autonome** (`BSG/.git`), volontairement séparé du dépôt parent
  `~/ClaudeCode` qui est lié au contexte professionnel. C'est du perso : il n'a qu'un remote,
  `origin` = **github.com/AnOnJoe/BSG** (public), et pas la double destination GitLab du parent.
- **Jouable en ligne : https://anonjoe.github.io/BSG/** — GitHub Pages sert `main` à la racine.
  Aucune étape de build : un `git push` suffit à publier (compter ~1 min de reconstruction).
  Le site étant statique et Three.js venant du CDN, il n'y a rien de plus à faire.
  ⚠ Corollaire : **tout ce qui est commité est public**, et l'est définitivement. Relire avant
  de pousser (un chemin `/Users/<nom>/…` a déjà dû être retiré d'un journal pour ça — puis les
  journaux ont quitté le dépôt, cf. ci-dessous).
  ⚠ « Semi-public » n'existe pas sur GitHub : la visibilité est *public* ou *private*
  (*internal* n'existe qu'en organisation Enterprise). Et **passer ce dépôt en privé couperait
  GitHub Pages** sur un compte gratuit — Pages depuis un dépôt privé demande un plan payant, et
  restreindre l'accès au site demande Enterprise Cloud. Pour cacher le code tout en gardant le
  jeu jouable, il faudrait héberger le site ailleurs (Cloudflare Pages déploie depuis un dépôt
  privé, gratuitement).
### ⚠ LES JOURNAUX DE SESSION NE VIVENT PAS DANS CE DÉPÔT
Ils sont dans le dépôt **parent, privé et local** : `~/ClaudeCode/CC-Session-Logs/BSG/`.
À lire via `/resume` avant de reprendre — ils contiennent les décisions de design et leur
*pourquoi*, ce que le code seul ne dit pas.

**Pourquoi les avoir sortis d'ici** : ce dépôt est public, donc un journal commité est
lisible par n'importe qui **et le reste** — le retirer plus tard ne le retire pas de
l'historique publié. Ce sont aussi les seuls fichiers du projet qui parlent d'autre chose que
du jeu. `CC-Session-Logs/` est donc dans `.gitignore`.

⚠ **`/compress` écrit dans le dossier du projet courant**, donc il recréera
`BSG/CC-Session-Logs/` : le fichier produit doit être **déplacé** vers le chemin ci-dessus.
Le `.gitignore` empêche de le commiter par accident, il n'empêche pas de l'écrire.

⚠ Le dépôt parent **n'a aucun remote** (vérifié) : les journaux y sont privés mais **non
sauvegardés**. C'est le prix assumé de ce choix.

## État
**La boucle est celle de Battlestar Galactica saison 1** : escorter six transports civils
(50 000 âmes) à travers cinq secteurs, en tenant chaque fois jusqu'à ce que le calcul de saut
aboutisse. On ne nettoie plus des vagues.

Fait : **menu de départ** puis boucle CIC ↔ combat, **pont hangar** en escale · **la flotte est
l'économie** (six fonctions dont la perte se paie) · hangar + upgrades + crédits · **5 postes exclusifs** (commandant / pilote / artilleur /
drones / **ingénieur**) avec équipage IA médiocre et lisible · **sections de coque** et modules HS · **énergie répartie** en 3 bus + anneau de
passerelle · conduite de tir humaine (retard, dispersion, renoncement) · modes de tir · ordres
d'escadron **et de flotte** · désignation de cible · **cuirassé** démontable pièce par pièce ·
canon anti-drone · **terrain** qui coupe les tirs · **cadrage cockpit** + plein écran ·
**traversée de 5 secteurs** avec victoire · vagues à thème · **phase passerelle (CIC)** avec
dialogues et choix à conséquences (**un arc par secteur**, 42 scènes) · **saut sur place** (bulle
de rassemblement + amorçage vulnérable) · **dénouement** : le transport compromis à identifier
et à détruire soi-même, sinon la boucle tourne sans fin · **cible prioritaire** d'artillerie et pistes de radar ·
**échelle du monde** (couloir 900×420, champ visible 217×146) avec **zoom molette** et
**déplacement au clic** · mise en scène (annonce radar, ralenti, saut FTL, **matière de
cockpit**, **ambiance sonore**).

## Prochaines pistes
Les cinq chantiers décidés sont faits : **5** (scènes par secteur), **2** (économie de campagne),
**4** (dénouement), **3** (ingénieur) et **6** (finitions).

0. **REJOUER APRÈS LE VIRAGE HOMEWORLD.** La première partie a dit « trop nerveux » et l'échelle
   « est bonne » : le chantier suivant est donc de vérifier que l'inertie va dans le bon sens sans
   tomber dans l'excès inverse. Le seul curseur à toucher si c'est trop pesant est **`angAccel`**
   (0,9 → 19 °/s ; à 1,4 on passe à 31 °/s). Points ouverts :
   - un demi-tour en **9,7 s** est-il jouable à la barre, ou faut-il que le clic devienne le seul
     mode de conduite ?
   - **les ennemis** : point explicitement laissé ouvert par le joueur (« j'ai un doute »), à
     juger maintenant que les civils sont à leur allure. Les deux lectures possibles étaient : le
     chasseur à 18,9 dépasse la baleine (normal dans le genre — c'est ce qui le rend menaçant),
     ou le cuirassé à 4,4 et le gunship à 5,0 sont devenus ennuyeux à attendre.
   - le convoi à **5,2-6,8** : bonne masse, ou trop pesant ? Deux jauges, `convoySpeedMul` et
     `convoyTurnRate`, et elles se règlent en jeu.
1. **JOUER UNE TRAVERSÉE COMPLÈTE.** La boucle a un début, une économie, cinq postes et deux fins,
   mais **elle n'a jamais été jouée en entier**. Les tests headless valident les mécanismes, jamais
   le dosage. À juger manette en main :
   - `signalFixCost` (11 %, soit **55 % de calcul pour la certitude complète**) — c'est le réglage
     dont je doute le plus ; il peut rendre le dénouement intenable ou trivial ;
   - ce que vaut réellement un transport, et si perdre la citerne se **sent** ;
   - si le pont hangar arrive trop tard dans la traversée ;
   - `engRepairRate` (4,5 PV/s, 10,8 au poste) : assez pour que descendre à la machine vaille le
     transit ?
   - la durée réelle d'un secteur, et le temps de démontage du cuirassé.
   Tout est réglable en direct dans le panneau **T**.
   Signal déjà relevé : un joueur qui ne touche à rien voit la flotte immobile (ordre RALLIEMENT par
   défaut, elle suit une baleine à l'arrêt) et le calcul bloqué au minimum de clarté. Le premier
   secteur devra pousser à avancer plus explicitement.
   Points d'attention nés du rescale, à juger à l'œil et non au chiffre :
   - **l'échelle elle-même** : le paquebot ne fait plus que 6,6 % de la largeur d'écran. Le grief
     de karting est réglé sur le papier, mais le risque symétrique est que tout paraisse **trop
     petit et trop lent**. `viewZoom` est le seul curseur à bouger, et la molette permet de
     comparer sans quitter la partie ;
   - **la létalité des drones** : ils ne pouvaient plus tirer du tout bouclier levé, donc toute la
     difficulté ressentie récemment était **fausse de ce côté**. Le canon anti-drone redevient
     nécessaire, et ça n'a jamais été joué ainsi ;
   - **`enemyRangeMul`** : les Cylons tiennent maintenant 25 à 50 unités. À juger : est-ce lisible,
     ou est-ce qu'ils paraissent lointains et désengagés ?
   - **le point de route** est-il le geste naturel, ou les flèches restent-elles le réflexe ?
   - une traversée dure **~230 s par secteur** en poussant (DISPERSER), soit ~20 min à cinq
     secteurs sans compter le CIC ni les escales. À vérifier que ça ne traîne pas.
2. Plus loin : **coop multi-postes** (l'architecture est prête, cf. `Stations.js`), autres coques,
   boutique plus riche, varier les scènes du CIC au-delà d'un arc par secteur.

**Hors périmètre décidé : le tactile.** Mesuré en émulation iOS — aucun code tactile dans le
projet, canvas à **0 px de large en portrait**, et une meurtrière de 380×137 en paysage sur
iPhone. Sur iPad (canvas 708×564) il faut un clavier. Ça demanderait une couche de contrôles
tactiles ET une mise en page mobile, or une sim de capitaine à cinq postes a besoin de surface
d'écran. Décision : on ne le fait pas.
