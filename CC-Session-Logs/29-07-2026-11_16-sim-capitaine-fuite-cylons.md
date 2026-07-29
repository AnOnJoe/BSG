# Session Log: 29-07-2026 11:16 - sim-capitaine-fuite-cylons

## Quick Reference (for AI scanning)
**Confidence keywords:** BSG, Battlestar Galactica, Three.js, game-design, sim-de-capitaine, postes, stations, cockpit, PowerBus, énergie-répartie, anneau-passerelle, CommandRing, AutoHelm, barreur-IA, conduite-de-tir, WeaponControl, cuirassé, CapitalShip, basestar, CIWS, canon-anti-drone, terrain, astéroïdes, occlusion, Viewport, visée, cadrage, plein-écran, campagne, secteurs, traversée, victoire, convoi, Convoy, flotte-civile, transports, 50000-âmes, FtlDrive, saut-FTL, 33-minutes, DRADIS, Bridge, CIC, RPG, dialogues, scenes.js, ordres-flotte, ralliement, disperser, forcer, bulle-de-rassemblement, amorçage, perturbation, clarity, git-init, sous-dépôt
**Projects:** BSG (`~/ClaudeCode/BSG`), dépôt parent `~/ClaudeCode` (pro, non touché)
**Outcome:** Le MVP « survie par vagues » est devenu une sim de commandement façon Battlestar Galactica saison 1 — 4 postes exclusifs, flotte civile de 50 000 âmes à escorter, cycle des 33 minutes joué en phase RPG dans le CIC, saut sur place avec bulle de rassemblement ; 11 commits sur un sous-dépôt git dédié.

## Decisions Made
- **Direction de game design : « sim de capitaine »** plutôt que roguelite, campagne ou mise en scène — le vaisseau est déjà lourd et modulaire, le plaisir doit venir du triage sous pression, pas de l'adresse.
- **Énergie répartie entre 3 bus rivaux** (armes / boucliers / moteurs) : on ne peut pas être bon partout. `engineMul` calibré à exactement 1.0 au tiers pour conserver le pilotage de référence.
- **4 postes exclusifs** (commandant / pilote / artilleur / drones) : le joueur en tient un, l'équipage tient les autres. Règle du projet : *chaque IA doit être compétente mais MÉDIOCRE, et son insuffisance doit être VISIBLE ET SITUÉE*.
- **Consigne ≠ exécution** : le commandant ordonne à distance (conduite, mode de tir, escadron, flotte) ; barrer, viser et désigner n'appartiennent qu'au poste. C'est ce qui garde un intérêt à se déplacer.
- **« Ce qui est infini s'automatise, ce qui est rare se décide »** : laser (énergie régénérée) → équipage ; missiles (munitions finies) et IEM (recharge longue) → décisions du capitaine.
- **Exclusivité du commandement** : énergie, modules et IEM ne répondent qu'à la console du commandant, sinon ce n'est pas un poste mais un menu. Exception assumée : les missiles partent de partout (autoguidés).
- **Un cockpit par poste** : tronc commun minimal + un seul bloc d'instruments qui change. C'est ce qui a réglé le « fouillis ».
- **Cadrage cockpit** : la vue du monde devient l'écran tactique du poste, encadré par la passerelle, avec mode plein écran (V).
- **Modèle Battlestar Galactica saison 1** : on ne nettoie plus des vagues (stock à épuiser ⇒ trop facile), on tient une échéance en protégeant des civils.
- **Flotte civile complète** (6 transports, 50 000 âmes) plutôt qu'un convoi symbolique — l'enjeu n'est plus sa propre survie.
- **Couloir traversé** plutôt qu'arène tenue, pour répondre au grief « enchaînement d'arènes ».
- **33 minutes = délai avant l'arrivée des Cylons, rien d'autre.** Le calcul FTL est une horloge INDÉPENDANTE qui tourne pendant le répit et arrive incomplète.
- **Les 33 minutes se jouent dans le CIC** (phase RPG, dialogues, choix à conséquences), pas sur l'écran tactique.
- **Choix RPG avec effets réels** sur le combat suivant, chacun annoncé au journal.
- **Pas de porte de saut** : elle n'existe pas dans la série, et un portail que les Cylons pourraient emprunter détruirait le ressort des 33 minutes. Remplacée par une bulle de rassemblement centrée sur la baleine.
- **Aucun saut automatique** : choisir l'instant EST la décision du jeu.
- **Sous-dépôt git dédié à BSG** (`git init` dans `BSG/`) parce que c'est du perso, séparé du dépôt parent lié au pro.

## Key Learnings
- **Le problème d'un jeu plat n'est pas le manque de contenu** : ici le joueur n'avait qu'une seule décision par seconde (où viser). Rendre les systèmes existants *rivaux* vaut mieux qu'ajouter des modules.
- **Une IA parfaite rend les postes décoratifs ; une IA nulle rend le jeu punitif.** Il faut une médiocrité *située et lisible* (30 % de touches sur cible qui manœuvre contre 100 % au poste, avec un indicateur qui dit quand elle décroche).
- **Toute pénalité de conduite de tir doit venir avec une réponse dédiée**, sinon elle crée une menace incontrable (le garde-fou anti-gaspillage a rendu les drones intouchables → d'où le CIWS).
- **Un lissage exponentiel n'atteint jamais sa cible** : après 1 s le profil plafonnait à 0,556 au lieu de 0,60. Rampe paramétrique `from → target` avec `t` à vitesse constante.
- **Le canvas est un élément remplacé** : avec `width: auto` il prend la taille de ses attributs et ignore `right`/`bottom`. Dimensions explicites obligatoires.
- **`renderer.setSize(w, h)` écrit `canvas.style`** → passer `updateStyle = false` quand le CSS pilote le cadrage.
- **Les marges animées faussent la mesure** : remesurer sur `transitionend`, sinon la visée reste calée sur l'ancienne géométrie.
- **Pour mesurer la visée, il faut figer la scène** : sinon le vaisseau navigue entre le calcul de la projection et la lecture, et on lit ~20 unités d'écart qui n'existent pas.
- **Forcer `aim.point` en JS ne sert à rien** : `AimController.update()` le recalcule chaque frame depuis le curseur réel. Il faut bouger la vraie souris.
- **Séparer les portées de radar** : détecter un écho n'est pas avoir une solution de tir. Un DRADIS longue portée rendait l'équipage précis partout.
- **Déformer un icosaèdre par `Math.random()` par sommet troue la maille** (géométrie non indexée) : utiliser un bruit continu de la direction.
- **Un `repeating-linear-gradient(90deg)` produit des barres verticales** — l'inverse d'un effet de vitesse horizontal.
- **Une pénalité de vitesse doit être sévère pour créer un décrochage** : à −55 %, un cargo blessé (4,13) restait plus rapide que la citerne saine (4,0) et ne décrochait jamais.
- **`.project(camera)` mute le Vector3.** `EnemyShip.position` renvoie un clone (donc pas de bug), mais `Drone.position` et `CapitalPart.position` exposent la référence vive.

## Solutions & Fixes
- **Bug mortel du saut** : ordonner le saut mettait toute la flotte hors du rayon → `Convoy.jump()` la détruisait → défaite en un appui. Garde-fou : un ordre qui n'emporterait personne est refusé avec la distance restante.
- **Calibrage temporel cassé** : FTL prêt à 87 s, contact à 120 s, flotte à la porte à 278 s. Corrigé : vitesses relevées (min 4,0 ⇒ 167 s), `FtlDrive` lit enfin `sector.ftlTime`, FTL prêt +57 s avant l'arrivée au 1er secteur et +2 s à la Porte.
- **`sector.ftlTime` défini mais jamais lu** : un `TUNE` global l'écrasait, donc la difficulté par secteur ne s'appliquait pas.
- **Clic sur un module changeait le profil d'énergie** : `onToggle` était branché sur `_onNumberKey`, devenu « commandes du poste ». Callback dédié `_toggleModule`.
- **`_beginJump()` se rappelait lui-même** en fin d'amorçage et relançait un amorçage sans fin → le saut ne partait jamais. Ordre (`_spoolJump`) et exécution (`_beginJump`) séparés.
- **Barreur immobile** : `AutoHelm` sortait en `thrust = 0` sans cible. Il escorte le retardataire (46 unités en 5 s au lieu de 0).
- **Barreur qui foncait dans les rochers** : il ignorait le terrain. Sonde devant lui et infléchit son cap (0 relevé dans la roche sur 70, 0 PV perdu).
- **Transports qui traversaient les astéroïdes** : `terrain.push` n'était appliqué qu'au joueur et aux ennemis. Évitement + push (0 encastrement sur 60 relevés).
- **Solution de tir annoncée « BONNE » sur cible masquée** : la `quality` ignorait l'occlusion. Mise à 0 quand masquée.
- **Libellé « VAGUE 1/undefined »** : plus de dénominateur depuis que les assauts sont infinis.
- **Répit qui démarrait avec 3 ennemis en vue**, contredisant le journal « DRADIS vide » : spawn d'ouverture retiré.
- **CSS `#target-panel` vs `#enemy-panel`** : le panneau de vague atterrissait sous la topbar.
- **Classement des modes de tir inversé** : SEMI tirait plus que RAFALE (9 contre 6). `rate` 0,45 → 0,30 et pause 0,7 → 0,45.
- **Drones absents au poste DRONES** : `Ship.mount` range les baies par défaut. La consigne pilote maintenant le déploiement.
- **Effet FTL dans le mauvais sens** : `translateX(160%)` alors qu'on file vers la droite.

## Files Modified
- `js/core/PowerBus.js` : **nouveau** — 3 bus rivaux, presets, rampe paramétrique, `engineMul` = 1.0 au tiers.
- `js/core/CommandRing.js` : **nouveau** — anneau radial (clic droit), ralenti, réservé au commandant.
- `js/core/Stations.js` : **nouveau** — 4 postes, transit avec poste VACANT, point d'extension coop.
- `js/core/AutoHelm.js` : **nouveau** — barreur IA (mêmes `thrust`/`turn` que le joueur), escorte, esquive du terrain.
- `js/core/Viewport.js` : **nouveau** — conversions écran ↔ monde centralisées (visée à 0,07 unité près).
- `js/core/FtlDrive.js` : **nouveau** — moteur de saut, modes (arrêt/calcul/forcé), `preCharge`, `clarity()`.
- `js/entities/CapitalShip.js` : **nouveau** — cuirassé 4× la baleine, 10 pièces ciblables avec secteurs de tir.
- `js/entities/Terrain.js` : **nouveau** — volumes irréguliers, occlusion des tirs, brouillage radar.
- `js/entities/Convoy.js` : **nouveau** — 6 transports distincts, décrochage des éclopés, bulle de saut.
- `js/entities/modules/Ciws.js` : **nouveau** — canon anti-drone automatique.
- `js/game/Bridge.js` : **nouveau** — phase passerelle (CIC), 9 scènes, choix à effets.
- `js/data/` : **nouveaux** — `capitalConfig.js`, `terrainConfig.js`, `waves.js`, `campaign.js`, `orders.js`, `convoyConfig.js`, `scenes.js`.
- `js/core/WeaponControl.js` : réécrit — artillerie autonome, conduite de tir humaine, modes de tir, occlusion.
- `js/game/Hud.js` : réécrit — tronc commun + 4 cockpits, panneau FTL/flotte, bandeau central, journal.
- `js/game/Range.js` : très largement remanié — postes, cuirassé, terrain, convoi, saut, assauts continus.
- `js/main.js` : 3 écrans (`_show`), `pendingEffects`, mode plein écran, resize sur le canvas.
- `js/core/Tune.js` : ~30 réglages ajoutés (tous dans le panneau T).
- `css/style.css` : cockpits, cadrage `#bay`, CIC, bulle, effets ; règles mortes supprimées.
- `index.html` : `#bay` + `#cockpit-shell` + `#bridge-ui`.
- `CLAUDE.md` / `README.md` : documentation à jour à chaque palier.

## Setup & Config
- **Sous-dépôt git dédié** : `git init -b main` dans `/Users/joachim.henry/ClaudeCode/BSG`, `.gitignore` propre (`.DS_Store`, `node_modules/`, `*.json.bak`).
- **Dépôt parent `~/ClaudeCode` intact** : branche `main`, `BSG/` y reste non suivi. Une première tentative de commit dans le parent a été **entièrement annulée** sur demande.
- **Aucun remote** : le dépôt est purement local, ce n'est donc pas encore une sauvegarde.
- **Vérification headless** : `puppeteer-core` réinstallé dans le scratchpad de session (absent au départ), Chrome présent. Scripts dans le scratchpad (`check-*.mjs`).
- **Contrôle syntaxe** : `find js -name '*.js' -print0 | xargs -0 -n1 node --check`.
- **Serveur de test** : `python3 -m http.server 8765 --directory .../BSG` (aucun en-tête de cache → Cmd+Shift+R).

## Pending Tasks
- **Aucun remote git** : à configurer (GitHub / GitLab perso) pour que ce soit une vraie sauvegarde. Demande une action interactive d'authentification.
- **Poste d'INGÉNIEUR inexistant** : le lot ② (sections de coque localisées) n'est fait que côté ennemi ; `hullConfig.js` n'a pas de champ `section`. C'est le 4e métier annoncé.
- **`radar.maxTargets` toujours inutilisé** : le lot ④ n'est fait qu'à moitié (pas de désignation de cible prioritaire persistante pour l'artillerie).
- **Libellé « solution de tir » mal calibré** : annonce BONNE à 40 % de touches sur cible qui zigzague (seuils dans `WeaponControl._updateSolution`).
- **Scènes identiques aux 5 sauts** : `scenes.js` ne varie pas par secteur.
- **Mystère narratif absent** : « on ne sait pas comment ils nous trouvent » (traduction jeu : un transport compromis à identifier et détruire).
- **Décor du cockpit sobre** : liserés et équerres, pas de matière (rivets, reflets, hublots).
- **Équilibrage jamais joué en entier** : durée réelle d'une traversée, `ftlMinClarity` assez incitatif ?, combat contre le cuirassé.
- Du README d'origine : autres coques, boutique plus riche, menu de départ, sons d'ambiance, multijoueur coop.

## Errors & Workarounds
- **`viewport.pageX is not a function`** : `viewport` utilisé dans `Range.js` sans import. → import ajouté.
- **Canvas non réduit malgré `left/right`** : élément remplacé → `width`/`height` explicites en `calc()`.
- **Test annonçant 20 unités d'écart de visée** : scène en mouvement. → figer position/rotation/vitesse pendant la mesure.
- **Test de désignation faux** : `aim.point` forcé en JS, écrasé chaque frame. → bouger la vraie souris vers la projection écran.
- **Test IEM invalide** : IEM montée sur un slot `utility` alors que `slotType: 'weapon'` → `mount` échouait en silence. → slot d'arme.
- **Traversée de campagne qui semblait bloquée** : `waveBreak` 8 s × 20 vagues dépassait le timeout. → temporisations raccourcies dans le test.
- **« Déploiement incomplet, cas ignoré »** : le CIWS tuait les drones pendant leur approche, donc les 3 n'étaient jamais réunis. → condition d'attente corrigée (c'était un résultat, pas un échec).
- **Erreur de syntaxe dans un script de test** : apostrophes échappées `\\'` dans un heredoc non interpolé. → guillemets doubles.
- **Contenu du `Raw Session Log` ci-dessous** : la conversation dépasse largement ce qui peut être recopié littéralement. Les **messages utilisateur sont reproduits fidèlement** ; les réponses de l'assistant sont résumées avec les mesures clés. Ce n'est donc pas une transcription mot pour mot.

## Key Exchanges
- « comment rendre le jeu plus intéressant ? » → diagnostic chiffré (difficulté plafonnant vague 4, prime quadratique, `_end(type)` jamais appelé avec `'victory'`) puis arbitrage de direction → **sim de capitaine**.
- « le laser n'est pas auto donc je dois être le capitaine et le tireur » → renversement : l'artillerie devient autonome, et **rendre l'IA imparfaite fait émerger la valeur du joueur** (30 % contre 100 %).
- « ya un bug quand on clique sur un module ça change la posture » → reliquat de l'époque où les chiffres activaient les modules.
- « le commandant doit pouvoir donner des ordres aux autres » → distinction **consigne** (à distance) / **exécution** (au poste), et création de la désignation de cible pour que le poste drones ne soit pas vide.
- « les 33 minutes c'est le temps que le FTL soit prêt ou que les Cylons arrivent ? » → **incohérence réelle** : le calcul ne démarrait qu'au contact alors qu'il devrait tourner pendant le répit. Deux horloges désormais parallèles, affichées côte à côte.
- « la flotte doit atteindre une porte ? c'est dans la série ça ? » → **non**, invention de l'assistant ; objection sur les Cylons qui emprunteraient le portail (cela détruirait le ressort des 33 minutes) → saut sur place + bulle + amorçage vulnérable.
- « donc ça ne sert à rien d'avancer de gauche à droite ? » → **si, c'était devenu un vestige** → perturbation du saut précédent, calcul ×2,38 plus rapide à l'autre bout.
- « mais avant tu vas versionner » / « non je veux un sous dépôt BSG car c'est du perso » → approche parent annulée, `git init` dans `BSG/`.

## Custom Notes
None

---

## Quick Resume Context

BSG est devenu une **sim de commandement façon Battlestar Galactica saison 1** : on escorte 6 transports civils (50 000 âmes) à travers 5 secteurs, en tenant chaque fois jusqu'à ce que le calcul de saut aboutisse. Le joueur ne tient **qu'un poste à la fois** (commandant / pilote / artilleur / drones), l'équipage tient les autres avec une compétence volontairement médiocre et lisible. Les « 33 minutes » de répit se jouent en **phase RPG dans le CIC** (`js/game/Bridge.js` + `js/data/scenes.js`), avec des choix qui se paient dans le combat.

Tout est **data-driven** (`js/data/`) et tous les réglages passent par `js/core/Tune.js` (panneau **T**). Le dépôt est un **sous-dépôt git local dédié** (11 commits sur `main`, working tree propre, **aucun remote**).

Prochains pas les plus utiles : configurer un remote (sauvegarde), **jouer une traversée complète** pour juger l'équilibrage (rien n'a jamais été joué en entier — seuls les mécanismes sont vérifiés en headless), et créer le **poste d'ingénieur** (sections de coque du joueur, lot ② non fait côté joueur), qui est le seul des 4 métiers annoncés à ne pas exister.

---

## Raw Session Log

> **Note de fidélité** : les messages de l'utilisateur sont reproduits verbatim. Les réponses de l'assistant, très longues (analyses de design, code, tests headless), sont condensées en actions et mesures. Ce n'est pas une transcription intégrale.

### 1. `/resume`
**Assistant** — Aucun session log pour BSG. Contexte chargé depuis `CLAUDE.md`/`README.md` : ~3 800 lignes, 34 modules, `Range.js` (742 l.) au cœur. BSG non versionné (dépôt parent).

### 2. « On a un MVP qui fonctionne mais comment rendre le jeu plus intéressant ? En fait je penses qu'il y a une vrai question de gamedesign et du type de jeu souhaité »
**Assistant** — Diagnostic ancré dans le code : `MAX_ENEMIES = 4` et `_composeWave` figé dès n≥3 (au-delà seuls les PV montent) ; prime `40 * wave` quadratique contre menace linéaire ; `_end(type)` ignore son paramètre (pas de victoire) ; ciblage `_nearestEnemy()` partout, `radar.maxTargets` inutilisé ; arène rectangulaire vide. → Question de direction posée : **sim de capitaine** retenue.

### 3. Plan mode — lot ① (bus d'énergie + anneau)
Plan écrit puis approuvé. Livré : `PowerBus.js`, `CommandRing.js`, énergie répartie, ralenti à l'ouverture de l'anneau.
**Mesures** : cadences soutenues laser Nv1 (nominal 7/s) — ATTAQUE 4,3 · ÉQUILIBRE 2,3 · DÉFENSE 1,3 ; régén bouclier 21,8 PV/s en défense contre 7,3 en attaque ; `engineMul` exactement 1,00 au tiers.
**Correctifs** : lissage exponentiel remplacé par rampe paramétrique (plafonnait à 0,556 au lieu de 0,60) ; tiers exacts pour le profil équilibré.

### 4. « le laser n'est pas auto donc je dois etre le capitaine et le tirreur ce qui n'est pas optimal / par contre on pourrait imaginer un jeu coop ou en multijoueur chacun occupe un poste »
**Assistant** — Contradiction reconnue (l'anneau posé sur la souris déjà saturée par la visée). Principe dégagé : *ce qui est infini s'automatise, ce qui est rare se décide*. Artillerie autonome + notion de poste (`Stations.js`) comme architecture du futur coop.
**Mesures** : portée jugée par tourelle (cadence pleine jusqu'à 43, 0 à 50) ; 0 missile automatique ; 0 tir anneau ouvert contre 5 hors anneau ; bonus manuel ×1,35 exact (6 → 8,1).
**Trouvé** : CSS `#target-panel` vs `#enemy-panel` (bandeau de vague mal placé).

### 5. « avant il faut rendre les IA d'aide plus humaine car elle doivent faire des erreurs surtout si le vaisseau ennemie est loin non visible et bouge »
**Assistant** — Conduite de tir humaine calquée sur `EnemyShip.perceived` : perception retardée, dispersion croissante ×`crewNoRadarMul` hors radar, verrouillage, et **renoncement** au-delà de `crewHoldFactor`.
**Mesures** : 100 % à courte portée · **30 % sur cible qui manœuvre** · ~30 % hors radar · **100 % pour le joueur au poste**. Portée laser (40) > champ visible (~36) : au-delà le joueur ne *peut* pas viser.
**Correctifs** : `quality` intégrant l'erreur de suivi (annonçait BONNE à 40 % de touches) ; lissage du libellé.

### 6. « le commandant doit pouvoir donner des ordres aux autres genre il doit pouvoir dire au pilote dans quel mode se mettre » + « le jeux doit peut être aussi etre un peu moins nerveux moins beat them all »
**Assistant** — Les deux disent la même chose : un jeu de postes ne peut pas être nerveux. Livré : 3 postes exclusifs, transit coûteux (poste VACANT), barreur IA, modes de tir, ordres d'escadron, rythme ralenti (`enemySpeedMul` 0,6 · `spawnDist` 78 · `waveBreak` 8 s).
**Mesures** : barreur convergeant de 47 à 23,5 sur une consigne de 24 ; modes SEMI 6 / RAFALE 10 / AUTO 20 tirs par 3 s.
**Correctifs** : classement des modes inversé ; drones inexistants (baies rangées par défaut).

### 7. « j'ai un soucis avec les intercepteurs enemis / mes drones ne m'en protege pas / l'artilleur ne tire pas dessus / est-ce qu'il ne faudrait pas un canon rapide anti drone ? » + « le jeu manque un coté épique … trop arene »
**Assistant** — Diagnostic : le garde-fou anti-gaspillage rendait les drones quasi intouchables. Leçon retenue : *toute pénalité de conduite de tir doit venir avec une réponse dédiée*.
**Mesures** : 3 drones collés à la coque — laser seul **9,2 s** contre **1,0 s** avec CIWS. Intercepteurs priorisant enfin les drones.
Puis arbitrage sur l'épique → **échelle** (cuirassé) : 4,0× la baleine à l'écran (892 px contre 224), 10 pièces destructibles, secteurs de tir (dos 2 · ventre 3 · proue 1 · **poupe 0**), moteurs détruits 4,8 → 0,0.

### 8. « l'interface est un peu fouilli … remplacer l'activation des modules par une console pour le commandant … chaque poste devrait avoir son cockpit »
**Assistant** — Refonte du HUD : tronc commun minimal + **un cockpit par poste**. 4e poste COMMANDANT, modules au clic, exclusivité vérifiée (énergie / anneau / IEM refusés ailleurs, acceptés à la console).

### 9. « bug dans le cockpit du commandant : cliquer sur un module change le type de posture »
**Assistant** — `onToggle` branché sur `_onNumberKey`, devenu « commandes du poste ». Callback `_toggleModule` dédié. Vérifié : profil inchangé au clic, 2 modules basculés, touche 2 → `defense`.

### 10. « le commandant doit pouvoir donner des directives aux autres … alors que là il faut passer pilote, changer de mode, puis redevenir commandant »
**Assistant** — Distinction **consigne / exécution**. Console d'ordres pour les 3 postes. Problème créé et résolu : le poste drones devenait vide → **désignation de cible** (vérifiée sur 4 pièces nommées du cuirassé).

### 11. « le cockpit du commandant prends trop de place … on est dans les yeux du commandant et la vue principale c'est un écran … cliquer pour passer en plein écran »
**Assistant** — Cadrage cockpit : `#bay` + `#cockpit-shell` + canvas encadré, mode plein écran (**V**, pas le clic qui sert à tirer).
**Risque traité** : toutes les conversions écran ↔ monde centralisées dans `Viewport.js`. **Écart de visée 0,071 unité (cockpit) et 0,066 (plein écran)**.
**4 pièges** : élément remplacé (`width: auto` ignore `right`), `setSize` écrivant le style, marges animées, import manquant.

### 12. « dans la nouvelle fenetre il faut tout recentrer … et il faut une vue dézoomé »
**Assistant** — Overlays (vignette, flash, bannières, issue) cadrés sur l'écran ; dézoom compensant la taille d'écran : **104 × 70 unités visibles** contre 87 × 54.

### 13. « en amélioration on avait prévu d'autres choses tu les as ? »
**Assistant** — Backlog vérifié dans le code (pas de mémoire) : `MAX_ENEMIES` toujours 4, prime quadratique, `_end('victory')` jamais appelé, `radar.maxTargets` inutilisé, pas de `section` sur la coque joueur, poste d'ingénieur inexistant.

### 14. « non on fait lieu destination et mise en scene et courbe de progression »
**Assistant** — 4 paliers, un commit chacun.
**A** 7 thèmes de vague (7 distincts sur 14 vagues, 1 répétition), `MAX_ENEMIES` 8, prime plafonnée.
**B** Terrain : occlusion vérifiée géométriquement (rocher r=6 à x=15 → faisceau coupé à 9,0), « CIBLE MASQUÉE ».
**C** Traversée de 5 secteurs + **VICTOIRE** (jouée de bout en bout en test).
**D** Annonce radar du prochain thème (respiration active) + ralenti dramatique (1 → 0,32 → 1).

### 15. « merge sur main »
Fast-forward, historique linéaire, branche supprimée, parent intact.

### 16. « j'ai testé la traversé c'est trop facile pas assez long … on arrive au milieu de l'arene … aucun effet de saut … les asteroid sont trop plat … comme la 1ere saison de Battle Star Galactica … recharger le moteur de saut »
**Assistant** — Rappel mécanique de la saison 1 (épisode « 33 », flotte civile, calcul de saut, ressources finies). Renversement d'objectif proposé et arbitré : **flotte civile complète** + **couloir défilant**.
Livré en 4 paliers : boucle convoi/FTL (dilemme du traînard vérifié : 4 emportés, Paquebot abandonné, 12 400 âmes perdues), IA cylonne visant les civils (distance moyenne 67 → 15, 70 PV en 14 s), décor volumétrique, saut hyperespace + Raiders à œil balayant.

### 17. « les vaisseaux civil sont tous identiques et un peu moche / le radar doit avoir beaucoup plus de portée / un compteur pour les 33 minutes / scénariser ces 33 minutes / une grosse barre de progression FTL / 50 000 humains / un effet spécial FTL »
**Assistant** — 6 traités, le 7e (effet FTL) déjà livré. Six gabarits distincts pour **exactement 50 000 âmes**, cycle « 33 » avec journal de passerelle, bandeau central, **deux portées de radar séparées** (conduite de tir 1,5 · DRADIS 11 → 220 unités).
**Correctif** : répit démarrant avec 3 ennemis en vue, contredisant « DRADIS vide ».

### 18. Plan mode — « la 1ere partie … c'est fade et juste trés long … du dialogue … un petit coté rpg … le saut est pret avant meme les 33 minutes ce qui est nul … des que j'qi fini le saut on meurt tous … peut être que l'on ne devrait pas être sur l'ecran principale mais … l'interieur des vaisseau et on a la partie RPG »
**Assistant** — Calibrage chiffré et jugé cassé : **FTL prêt 87 s, contact 120 s, flotte à la porte 278 s** ⇒ ordonner le saut détruisait toute la flotte (bug mortel). Deux trouvailles : `sector.ftlTime` jamais lu, `terrain.push` non appliqué aux transports.
Arbitrages : **choix RPG à effets réels** + **passerelle dessinée en fil de fer néon**.
Livré : correctifs (écart FTL/arrivée +57 s → +2 s selon secteur, garde-fou, traînard visible, barreur qui escorte, convoi qui contourne) puis **phase CIC** (9 scènes, 4 décisions, effets appliqués et annoncés, `N` pour passer).

### 19. « Le pilote n'esquive pas les obstacles » + « les 33 minutes c'est le temps que le FTL soit pret ou le temps que les cylon arrivent ? »
**Assistant** — Réponse : **délai avant les Cylons, rien d'autre**. Incohérence reconnue : le calcul ne démarrait qu'au contact alors qu'il devrait tourner pendant le répit. Deux horloges parallèles, affichées côte à côte au CIC (0 % à 33:00 → 74 % à 01:00, puis 84 % au combat avec 66 s à tenir). Barreur esquivant (0 relevé dans la roche sur 70).

### 20. « la flotte doit atteindre une porte ? c'est dans la série ça ? … la porte se materialise … translucide … que les Cylon ne puisse pas prendre la porte … ou alors tu as une autre idée ? »
**Assistant** — **Non, pas de porte dans la série** (saut sur place, aucune infrastructure). Objection posée : un portail emprunté par les Cylons supprimerait le ressort des 33 minutes. Arbitrage → **saut sur place + bulle de rassemblement + amorçage vulnérable**.
Livré : bulle centrée sur la baleine (translucide → franche → pulsante), amorçage 5,5 s **immobile** (vérifié : 6 transports emportés, saut refusé si personne dans la bulle), **ordres à la flotte** (RALLIEMENT 6/6 · DISPERSER 4/6 · FORCER usure réelle), décrochage des éclopés (5,2 → 2,0 d'allure, 24 unités de retard en 14 s).
**Piège** : `_beginJump()` se rappelait lui-même et relançait un amorçage sans fin.

### 21. « donc ca ne sert a rien d'avancer de gauche a droite dans l'arene ? est-ce que la flotte ne devrait pas avoir un ordre de suivre la baleine ou pas ? »
**Assistant** — Les deux justes. Avancer était devenu un **vestige** → perturbation du saut précédent : calcul **0,099 %/s à l'entrée contre 0,235 %/s à la sortie (×2,38)**, avec explication au HUD. Et SERRER devient **RALLIEMENT** : la flotte converge sur la baleine et **la suit** (184 → 150 en 7 s, 6/6 dans la bulle). Les deux ordres s'opposent enfin vraiment : rassembler pour partir, ou avancer pour partir plus tôt.

### 22. `/compress`
Ce log.
