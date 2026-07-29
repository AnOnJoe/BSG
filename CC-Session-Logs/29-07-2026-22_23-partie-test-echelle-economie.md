# Session Log: 29-07-2026 22:23 - partie-test-echelle-economie

## Quick Reference (for AI scanning)
**Confidence keywords:** BSG, partie test, playtest, échelle, scale, viewZoom, zoom molette, point de route,
waypoint, AutoHelm, moustaches, whisker, évitement obstacles, voies, lanes, Convoy, flotte, RALLIEMENT,
TENIR, hold, économie, matériel, salvage, chantiers, works, progression, plans, pont hangar, deck,
StartMenu, SignalHunt, dénouement, Engineer, sections de coque, radar maxTargets, pistes, stackFalloff,
GitHub Pages, anonjoe.github.io, node --check, check-syntax, check-dangling, TUNE, panneau T, 73 réglages
**Projects:** BSG (`~/ClaudeCode/BSG`, sous-dépôt git autonome, remote public `github.com/AnOnJoe/BSG`)
**Outcome:** Dépôt rendu public et publié sur GitHub Pages (jouable en ligne) ; chantiers 5-2-4-3-6 livrés
(scènes par secteur, économie de flotte, dénouement, poste d'ingénieur, finitions) ; huit vagues de
retours de partie test corrigées ; le rescale d'échelle + zoom molette + point de route sont écrits mais
NON VÉRIFIÉS et NON POUSSÉS (outil Bash indisponible en fin de session).

## Decisions Made
- **Dépôt public + GitHub Pages** plutôt qu'un portage en artefact Claude. Le CSP des artefacts interdit
  tout hôte externe (l'import map CDN de Three.js est mort), il aurait fallu inliner ~1,6 Mo et le
  `localStorage` était incertain. Pages : zéro modification, `git push` publie. Audit avant publication :
  aucun secret, aucun contenu professionnel dans l'historique ; un chemin `/Users/<nom>/…` retiré du journal.
- **Ordre des chantiers 2 → 4 → 3 → 6** (au lieu de 2 → 3 → …) : le dénouement ne mord que si perdre un
  transport coûte quelque chose, donc il devait suivre immédiatement l'économie de flotte.
- **La flotte est l'économie** : chaque transport porte une fonction (tylium/pièces/atelier/infirmerie),
  deux ne portent que des vies. Sans ça, perdre un transport rendait le jeu PLUS FACILE.
- **L'argent supprimé** : remplacé par MATÉRIEL (stock récupéré) + CHANTIERS (capacité de l'équipe par
  escale). C'est la seconde ressource qui fait choisir, pas le stock.
- **Aménager un emplacement ne consomme pas de chantier** (seulement du matériel) : sinon « aménager puis
  équiper » mangeait toute l'escale et on repartait avec des emplacements vides.
- **Plancher des chantiers à 2** (3 avec atelier) : à un seul, aucun arbitrage possible.
- **Ordre des plans FIXE et non aléatoire** : le hasard pouvait laisser un joueur sans arme secondaire
  toute la traversée.
- **`N` au CIC ne saute plus les décisions**, seulement les répliques. Supprimer la touche aurait ramené le
  grief « fade et trop long ».
- **Le cuirassé BARRE la route au lieu de chasser** : `campaign.js` disait « coupe la route » depuis le
  début ; poursuivre le joueur était un vestige de la boucle par vagues.
- **La distance de combat dérive de la portée des armes**, bornée par le radar : améliorer le radar permet
  littéralement de combattre de plus loin.
- **Le zoom molette n'a AUCUN effet de jeu** : `viewHalfW` se calcule sur le zoom de base, sinon dézoomer
  élargirait la bulle de saut et rendrait les sauts triviaux.
- **Point de route au clic, exclusif au poste de pilote** : le métier passe de « barrer » à « router ».
  Réponse à l'objection « le pilote ne sert plus à rien » : l'IA ne sait pas se mettre à couvert ni tenir
  la flotte dans la bulle, d'où deux instruments dédiés pour rendre cette valeur visible.
- **Missiles depuis n'importe quel poste : exception conservée** (documentée). Autoguidés = un ordre suffit ;
  l'exclusivité de l'artilleur reste la visée manuelle, le mode de tir et la cible prioritaire.
- **Tactile écarté** : mesuré en émulation iOS, canvas à 0 px en portrait, meurtrière 380×137 en paysage.
- **Le rescale n'est pas poussé sans mesure** : il touche vitesses, portées, décor, caméra et contrôles.

## Key Learnings
- **`node --check` NE VALIDE PAS les modules ES.** Sur un `.js` contenant `export`, Node essaie CommonJS,
  échoue, puis **renvoie 0 quoi qu'il arrive**. Vérifié : `['x', 'part de l'ecran']` (apostrophe non
  échappée) passait le contrôle. Le même contenu en `.mjs` est rejeté. C'était LA commande de vérification
  documentée du projet — deux fichiers cassés ont atteint le navigateur dans la session, symptôme = écran
  noir. Remplacé par `tools/check-syntax.mjs` (copie en `.mjs` puis `--check`).
- **Un appelant sans définition ne se voit pas à la lecture.** `App.toggleExpand()` avait disparu du fichier
  (perdu dans `16a4533`) alors que ses deux appelants et tout le CSS `body.expanded` restaient : la touche
  **V** ne marchait pas depuis deux sessions. D'où `tools/check-dangling.mjs`.
- **Le décor était infranchissable en ligne droite** : 0 ligne libre sur 51 échantillonnées pour un corps de
  rayon 10, dans TOUS les terrains sauf le vide. Aucun algorithme de pilotage ne pouvait donner un résultat
  propre — la cause d'un grief de pilotage peut être dans la génération de niveau.
- **Un cap d'évitement relatif au cap courant est un intégrateur** : `desired = rot + offset` réappliqué
  chaque frame faisait tourner le vaisseau sur plus d'un tour complet.
- **`Terrain.rayHit` sans `pad`** déclarait libre un passage qu'une coque de rayon 4,2 raclait.
- **Trois boucles de rétroaction mesurées** : (a) le barreur escortait le traînard, qui est par définition
  derrière ⇒ la baleine reculait et la flotte avec ; (b) ralentir proportionnellement laissait l'écart se
  stabiliser au-delà du rayon de bulle ⇒ bulle vide ; (c) couper les gaz créait un blocage mutuel
  (baleine attend flotte, flotte suit baleine) à 1,3/s au lieu de 4. Solution : asservissement de VITESSE.
- **Un plafond appliqué avant un facteur multiplicatif n'est pas un plafond** : `min(a,b) * urge` laissait
  les transports à 10,9 pour un nominal de 5,6.
- **Un verrou radar est par CIBLE, pas par tourelle** : première version du budget de pistes sans effet
  (`[13,13,13]` à 1 comme à 3 pistes) car toutes les tourelles convergent sur le plus proche.
- **Les seuils de « solution de tir » se dérivent de la géométrie** : on touche quand
  `quality >= 1 − 1/crewHoldFactor` (0,667). « BONNE » commençait à 0,60 : mensonge mesuré (≤54 % de touches
  jusqu'à 0,675, 100 % au-delà, transition franche sur 8 500 tirs).
- **Le rapport taille/champ est le seul levier d'échelle** : agrandir le monde ET les vitesses donne
  exactement la même image. Mesuré : paquebot à 36 % de la largeur d'écran, rochers espacés de 37 unités
  (une longueur de paquebot) = « karting ».
- **Tout ce qui doit « tenir à l'écran » doit dériver du champ visible**, pas d'une valeur observée une
  fois. Sinon toucher `viewZoom` casse silencieusement bulle, formation et avance du barreur.
- **Pièges de méthode de test** : lire le DOM avant la frame suivante (deux faux bugs : cockpit qui ne
  suivait pas le poste, boss key inerte) ; recréer l'objet cible à chaque frame (le verrouillage repart,
  0 % dans les deux cas) ; attendre 9 s pour un saut qui prend 10,1 s ; grep insensible à la casse
  attrapant « console du commandant » comme une erreur console.
- **`#run-bar` est en `pointer-events: none`** (pour ne pas bloquer la visée) : un bouton enfant s'affiche,
  change d'état… et ne reçoit jamais le clic. Il faut rétablir `auto` explicitement.

## Solutions & Fixes
- **Voies garanties dans le décor** (`Terrain.build` + `lanes`/`laneHalf`) : 9 à 19 lignes libres sur 51.
- **Esquive par MOUSTACHES** : on sonde plusieurs caps autour du cap voulu, on prend le premier dégagé,
  avec hystérésis sur le côté. Mesuré 25 s dans la Ceinture : avance −45 → +71, coque 72 → 100,
  oscillations 21 → 10 puis 6.
- **`rayHit(..., pad)`** : `pad = 0` pour la ligne de vue (un tir n'a pas d'épaisseur), rayon du corps sinon.
- **Convoi réécrit** : traits propres par transport (allure, mollesse, balancement, station), inertie
  individuelle, répulsion mutuelle et répulsion de la baleine, rattrapage borné (`convoyCatchup`).
  Mesuré : 6 vitesses distinctes, 0 encastrement sur 400 relevés.
- **Consigne TENIR** (`HELM_ORDERS`) : moteurs coupés, esquive conservée si l'on dérive vers un rocher,
  immobilise aussi la flotte en RALLIEMENT.
- **`Bridge._skipTalk`** : `N` s'arrête à chaque choix ; ⚠ première version encore trouée (ne regardait que
  `index + 1`, donc sautait par-dessus un choix courant).
- **`sceneNeeds(scene)`** : dépendance aux transports DÉDUITE des effets, scènes écartées si le transport
  est mort (9 → 8 scènes sans l'hôpital) + garde `t.alive` dans `_applyPendingEffects`.
- **Cuirassé en ligne de barrage** : tient son X, ne se décale qu'en Y, chasse arrière seulement si la
  flotte l'a dépassé. Mesuré : ligne tenue à x = 0 pendant que la flotte passe de −386 à −298.
- **`Ship.radarTracks`** : somme des `maxTargets` des radars actifs ; les tourelles se répartissent sur la
  liste de pistes. Mesuré : 1 piste `[13,13,13]`, 3 pistes `[13,20,31]`, priorité `[31,31,31]`.
- **Bouton de SAUT** dans le bandeau central, avec ses états (« calcul 74 % », « 4/6 partent · 2 restent »,
  « aucun transport dans la bulle », « AMORÇAGE 4,2 s ») + `pointer-events: auto`.
- **Étiquettes des civils** projetées (icône de fonction, nom court, barre de coque, ◈ dans la bulle) et
  **flèches de bord pour les civils** avec leur distance.
- **Civils sur un plan de profondeur séparé** (`CONVOY_Z = -6`) : plus aucun chevauchement partiel.
- **Sections de coque + poste d'ingénieur** : dégâts localisés par point d'impact, modules HS jusqu'à
  réparation, IA qui colmate le plus abîmé (démontré : poupe vide à 8 PV choisie alors que le laser est
  éteint), 4,5 → 10,8 PV/s au poste, remise en service à 25 %.
- **Économie** : `data/progression.js`, `App.salvage/works/fitted/plans`, migration `credits → salvage`.
- **Pont hangar refondu** par section de coque, refus explicites, alerte « plus de chantier » en haut.
- **Menu de départ** + bouton « Repartir de zéro » armé en deux clics.
- **Panneau T** : 47 → 73 réglages, groupes repliables, aide en clair sous chaque libellé, filtre cherchant
  aussi dans l'aide, marquage des valeurs modifiées, export du diff seul.

## Files Modified
- `js/game/Range.js` : `newCampaign`/`_resumeSector`, `_watchFleetRoles`, `_setFtlMode`, `_jumpRepair`,
  `_openFinale`, `_takeSignalFix`, `_designateTransport`, `_designateSection`, `_updateEngineer`,
  `_onHullHit`, `_recoverPlans`, `_loopAgain`, `_designatePriority`, `_updateFleetTags`,
  `_navClick`/`_buildNavMark`/`_updateNavMark`, `_wheelZoom`, `viewHalfW`, `gatherR`, `arena`,
  `ARENA = { x: 900, y: 420 }`, `ENTRY_X`/`CONVOY_LIMIT` à l'échelle
- `js/core/AutoHelm.js` : consigne `hold`, `fleetFollows`, asservissement de vitesse sur la flotte,
  esquive par moustaches, standoff dérivé de la portée, priorité au `waypoint`, freinage à l'approche
- `js/entities/Convoy.js` : `update()` réécrit (vie propre, séparation, rattrapage), `roles`/`hasRole`,
  `CONVOY_Z`, `FOLLOW_X` en part du champ visible, `baseSpeed`
- `js/entities/Terrain.js` : `lanes`, `rayHit(..., pad)`, écart minimal proportionnel
- `js/core/Tune.js` : 73 réglages groupés + aide, `TUNE_DEFAULTS` exporté
- `js/game/TunePanel.js` : réécrit (groupes, filtre, marquage, undo, export du diff)
- `js/game/Hud.js` : `setSignal`, `setSections`, `setPriority`, `setFleetTags`, `setZoom`, bouton de saut,
  instruments de route (couvert / bulle / point), `#hud-hint` restauré
- `js/game/Hangar.js` : refonte complète (sections, matériel/chantiers, plans, refus explicites)
- `js/game/Bridge.js` : arcs par secteur, `_renderFleet`, `notify`, `_skipTalk`, `reset`, clé `secteur#loop`
- `js/game/Ship.js` : sections de coque, `takeDamage(d, at)`, `radarTracks`, `_sumActive` + `stackFalloff`
- `js/core/SignalHunt.js`, `js/core/Engineer.js`, `js/game/StartMenu.js`, `js/data/progression.js` : **nouveaux**
- `js/data/scenes.js` : 5 arcs + `PORTE_BOUCLE` (42 scènes), `sceneNeeds`, `crewFor`
- `js/data/convoyConfig.js` : `FLEET_ROLES`, `role` et `tag` par transport
- `js/data/orders.js` : `ENGINEER_ORDERS`, `TENIR`, getters TUNE sur `FLEET_ORDERS`
- `js/data/hullConfig.js` : `sections` + `section` par slot
- `js/data/campaign.js` : `finale: true` sur la Porte, `JUMP_REPAIR` en getters TUNE
- `js/data/moduleConfig.js` : portées ×2,1 · `js/data/terrainConfig.js` : voies + densité à l'échelle
- `js/core/SaveManager.js` : migration `credits → salvage`, `fitted`, `plans`
- `js/core/WeaponControl.js` : `fatigue`, seuils dérivés, `priority`, pistes radar
- `js/entities/Drone.js`, `js/entities/Hull.js` (état `locked`), `js/data/capitalConfig.js`,
  `js/entities/CapitalShip.js` (barrage), `js/main.js` (menu, écrans, salvage, `toggleExpand` rétabli)
- `css/style.css` : menu, pont hangar, sections, signal, étiquettes, zoom, route, matière de cockpit
- `index.html` : `#menu-ui`, matière du cockpit, titre
- `tools/check-syntax.mjs`, `tools/check-dangling.mjs` : **nouveaux**
- `CLAUDE.md`, `README.md` : mis à jour à chaque chantier

## Setup & Config
- Remote : `origin` = `https://github.com/AnOnJoe/BSG` — **public** depuis cette session.
- **GitHub Pages** actif (`main`, racine) : **https://anonjoe.github.io/BSG/** — `git push` publie (~1 min).
- Vérifié en ligne : aucune erreur, MIME `application/javascript`, `localStorage` disponible.
- ⚠ Tout commit est public, journaux de session compris.
- Vérifications : `node tools/check-syntax.mjs` (PAS `node --check`), `node tools/check-dangling.mjs`,
  serveur `python3 -m http.server 8123`, tests puppeteer dans le scratchpad de session (`t-*.mjs`).
- Dernier commit poussé : `365885b`. Travail non commité : le rescale + molette + point de route.

## Pending Tasks
- **VÉRIFIER puis pousser le rescale** : syntaxe, conduite de tir de l'équipage (`crewSpread` divisé par
  2,1 — l'écart latéral vaut angle × distance), durée de traversée (course FTL), molette, point de route.
- Mettre à jour `CLAUDE.md`/`README.md` pour l'échelle, la molette, le point de route et les deux outils
  de contrôle (dont l'avertissement sur `node --check`).
- **Jouer une traversée complète** : rien n'a jamais été joué en entier. Réglage le plus douteux :
  `signalFixCost` (11 %, soit 55 % de calcul pour la certitude complète au dénouement).
- Décider si les missiles restent lançables depuis tous les postes (exception documentée).
- Retirer éventuellement les trailers `Claude-Session:` de l'historique public (demande une réécriture).
- Varier les scènes du CIC au-delà d'un arc par secteur ; coop multi-postes ; autres coques.

## Errors & Workarounds
- **`node --check` renvoie 0 sur un `.js` ESM invalide** → `tools/check-syntax.mjs` (copie `.mjs`).
- **`App.toggleExpand()` disparu** (touche V morte depuis 2 sessions) → rétabli + `check-dangling.mjs`.
- **`scenes.js` sans `sceneNeeds`** alors que `Bridge` l'importait (mon script d'édition avait échoué sur
  une ancre modifiée, les suivants avaient réussi) → écran noir, réparé.
- **Apostrophe non échappée** dans une aide de `Tune.js` → écran noir, non détecté par l'ancien contrôle.
- **`Hangar.menu` vs `App.menu`** (faux positif du détecteur, homonymie réelle) → renommé `equipMenu`.
- **Bouton de saut sans clic** (`#run-bar` en `pointer-events: none`) → `auto` explicite sur `.rb-jump`.
- **Style de `#hud-hint` supprimé** avec l'ancien bloc CSS du hangar → identifiant propre, cadré sur l'écran.
- **Sauvegarde migrée = 1760 de matériel** → bouton « Repartir de zéro » en deux clics.
- **Outil Bash indisponible en fin de session** (classificateur de sûreté) : édition possible via Edit/Write,
  aucune commande `node` → travail écrit mais non vérifié.

## Key Exchanges
- « on ne va pas faire pour ipad et iphone » → tactile documenté hors périmètre avec les mesures.
- « le mystère narratif on le réserve pour la fin avec une décision » → dénouement à deux issues, et
  réordonnancement des chantiers (4 juste après 2) parce que le sacrifice devait coûter.
- « l'argent n'est pas une bonne monnaie vu que c'est notre flotte et nos ingénieurs » → matériel + chantiers.
- « tout ce qui peut poser problème en termes d'équilibrage doit être gérable dans le menu T » → 73 réglages.
- « avec une petite aide en face qui explique » → aide en clair sous chaque libellé, jamais en infobulle.
- « je veux juste que la flotte suive mon vaisseau qui va tout droit, c'est compliqué » → découverte que le
  décor était infranchissable en ligne droite.
- « la baleine est super loin de la flotte (pourquoi pas mais il faut une explication) » → 1 transport
  visible sur 6, bulle 2× plus large que l'écran ; formation redimensionnée + flèches de bord.
- « du coup le pilote ne sert plus à rien ? » → objection acceptée : point de route exclusif au poste, et
  deux instruments (couvert / flotte dans la bulle) pour rendre visible ce que l'IA ne juge pas.

## Custom Notes
None

---

## Quick Resume Context
BSG est public et jouable sur **https://anonjoe.github.io/BSG/** ; le dernier état poussé est `365885b`.
Les cinq chantiers de game design sont livrés et huit vagues de retours de partie test corrigées. Il reste
un lot **écrit mais non vérifié ni poussé** : le rescale d'échelle (champ visible ×2,1, couloir 900×420,
vitesses/portées/densité à l'échelle, `crewSpread` divisé par 2,1), le **zoom à la molette** et le **point
de route au clic** exclusif au poste de pilote. À reprendre par : `node tools/check-syntax.mjs`, puis les
tests puppeteer du scratchpad (`t-scale`, `t-solution`, `t-hold`, `t-vis`, `t-eco`, `t-finale`), puis commit
et push. ⚠ Ne plus utiliser `node --check` : il ne valide pas les modules ES.

---

## Raw Session Log

> Note : les **messages de l'utilisateur sont reproduits mot pour mot** (c'est la matière décisionnelle) ;
> les réponses de l'assistant sont **condensées** en actions et résultats mesurés, la conversation
> complète dépassant largement la taille exploitable d'un fichier. Les mesures citées sont celles
> réellement relevées en test headless.

### 1. Documentation et publication

**U :** « sauvegarde la doc et aussi maj claude.md »
**A :** Audit de `CLAUDE.md` (539 l.) et `README.md` : trouvé des contradictions réelles — le README parlait
encore de la « porte de saut » supprimée deux paragraphes après avoir expliqué le saut sur place, l'arène
donnée à ±190×±120 au lieu du couloir ±430×±108, la touche **J** absente du tableau, l'inventaire des
fichiers ignorant 20 modules, et des pistes listant comme à faire ce qui était livré. Corrigé, commité
(`2908ec9`), `CC-Session-Logs/` versionné.

**U :** « envois BSG vers github/AnOnJoe »
**A :** `gh auth` OK (AnOnJoe). Découvert que le remote **existait déjà** (privé, 3 commits en retard) —
ma remarque précédente « aucun remote » était fausse. Poussé `838a04e..2908ec9`.

**U :** « est-ce que le jeu peut etre poussé en tant que artefact Claude et rester jouable ? »
**A :** Réponse mesurée : CSP des artefacts interdit tout hôte externe ⇒ import map CDN morte ; il faudrait
inliner ~1,6 Mo (52 modules + Three.js) ; `localStorage` incertain en iframe. Recommandé GitHub Pages.

**U :** « Rend le github public et active github page »
**A :** Audit de sécurité avant publication : aucun secret, aucun contenu professionnel dans tout
l'historique ; un chemin `/Users/<nom>/…` retiré du journal (`4adea4e`). Public + Pages actifs.
Vérifié en navigateur réel : 0 erreur, 0 requête en échec, MIME correct, `localStorage` OK, boucle
hangar → passerelle → combat, 6 transports, 138 obstacles. Signalé les deux points : tout commit est
public (journaux inclus) et les trailers `Claude-Session:` sont désormais visibles.

**U :** « C'est quoi l'URL ? On peut jouer sur téléphone ? »
**A :** URL + test en émulation iOS : **aucun code tactile** (0 `touchstart`), canvas à **0 px de large en
portrait**, meurtrière **380×137** en paysage, ~60 fps. iPad jouable avec clavier. Conclusion : non.

### 2. Recap et plan

**U :** « qu'est ce qui est en place et ce qui manquerait ? […] commencer par le hangar n'a plus lieu
d'être ? […] scénariser l'ajout de module ? »
**A :** Trouvé que le hangar était **cassé mécaniquement** : `_startGame()` remet `sectorIndex = 0`, donc y
retourner relançait la traversée ⇒ les crédits gagnés n'étaient dépensables qu'après avoir perdu. Et que
perdre un transport ne coûtait rien (voire aidait). Proposé la flotte comme économie.

**U :** « on voit d'abord 2 3 5 6 » / « pour le mystère narratif on le réserve pour la fin avec une
décision genre on élimine le navire et la boucle s'interrompt […] ou on ne l'élimine pas et on est dans
une boucle infinie jusqu'à destruction totale de toute la flotte »
**A :** Réordonné en 2 → 4 → 3 → 6 : le dénouement ne mord que si perdre un transport coûte.

### 3. Chantiers livrés

- **5 — scènes par secteur** : 42 scènes (5 arcs distincts, 5 distributions distinctes), mystère planté au
  Cimetière et au Blocus, jalon `trackSignal`. `59888a8`.
- **2 — économie de flotte** : `FLEET_ROLES`, `newCampaign()`/`_resumeSector()` (progression stricte
  0→1→2→3→4 vérifiée), pont hangar en escale, menu de départ, `crewFatigueMul` calibré à 2,2 (fenêtre de
  tir 100→71 % sur cible qui manœuvre, 100 % maintenu à bout portant). `44f606b`.
- **4 — dénouement** : `SignalHunt`, 5 relevés à 11 % (74 → 19 % de calcul), tir sur civil sur ordre
  explicite, deux issues vérifiées, arc `PORTE_BOUCLE`. `887bf8b`.
- **3 — ingénieur** : 4 sections, routage par point d'impact, modules HS, IA fruste démontrée,
  4,5 → 10,8 PV/s. Bug trouvé : le cockpit de l'ingénieur affichait les commandes du pilote. `3265180`.
- **6 — finitions** : cible prioritaire (X), pistes de radar (première version creuse, refaite),
  seuils de solution dérivés de la géométrie, matière de cockpit, ambiance sonore, `toggleExpand()`
  rétabli. `107db6b`.

**U :** « tout ce qui peut poser problème ne terme d'équilibrage de et de gameplay doit etre gérable dans
le menu T » puis « avec une petite aide en face qui explique ce que fait ce paramettre sinon je vais m'y
perdre »
**A :** 47 → 69 réglages (couverture 69/69 testée), groupes repliables, **aide en clair sous chaque
libellé** (jamais en infobulle), filtre cherchant dans l'aide (« traînard » → 2, « rafale » → 3),
marquage des valeurs modifiées, export du diff seul. `4a9db38` / `513cd89`.

### 4. Retours de partie test

**U :** « gros probleme d'evitement des obstacles des pilote auto baleine et flotte […] c'est tres fouilli
quand on est commandant […] je veux juste que la flotte suive mon vaisseau qui va tout droit »
**A :** Mesuré : la baleine **reculait** de 45 unités en 25 s, cap sur plus d'un tour, 28 PV perdus sans
ennemi. Cause racine : **0 ligne libre sur 51** dans tous les terrains ⇒ voies garanties. Plus trois bugs
(intégrateur de cap, `rayHit` sans `pad`, esquive qui remplace l'objectif) ⇒ moustaches. Plus la boucle de
rétroaction escorte/suivi. Résultat : +71 d'avance, coque 100/100, oscillations 21 → 10.

**U :** « la flotte se déplace comme un bloc […] chacun devrait avoir sa propre vie » / « je voudrais
pouvoir ordonner au pilote de ne pas bouger »
**A :** Convoi réécrit (traits propres, inertie, répulsion) : 6 vitesses distinctes, 0 encastrement sur 400
relevés. Consigne TENIR ajoutée.

**U :** « c'est pas logique de pouvoir passer toutes la partie RPG car dans ce cas no décision no impact »
**A :** `N` saute les répliques et s'arrête aux choix. Première correction encore trouée (ne regardait que
devant) ⇒ marteler `N` menait au combat avec 0 décision. Fermé et vérifié. `6cb7a4a`.

**U :** « le hangar fait décalé au niveau design » / « pas autant de module ni d'emplacement dispo, il
faudrait pouvoir les débloquer » / « l'argent n'est pas une bonne monnaie vu que c'est notre flotte et nos
ingénieurs »
**A :** Économie matériel + chantiers, 3 emplacements sur 12 et 3 plans sur 9, plans récupérés dans un ordre
fixe, hangar refondu par section de coque. `ab700f8` / `258d298`.

**U :** « qu'est ce qui se passe si on met plusieurs radar ou plusieurs coque ou blouclies ? »
**A :** Mesuré : **le radar ne cumulait pas du tout** (1, 2, 3 ou 4 → portée 20, 1 piste) alors qu'il coûtait
un emplacement pris à la défense. Les pistes s'additionnent désormais. Armure/bouclier/réacteur cumulent
linéairement ⇒ levier `stackFalloff` laissé à 1 pour ne pas changer l'équilibrage en silence. `e231b77`.

**U :** « le nombre de civil qui partent il faut l'indiquer sur combien ex 5/6 » / « On ne sais pas quel
navire est qui dans la zone de jeu » / « si je passe sur un navire civil il faut que tout le vaisseau soit
sur le même axe z » / « j'ai perdu l'hopital et ca me dit que je peux donner +180 de coques a l'hopital »
/ « le cuirrassé ennemi il vient vers nous ? on est en mode fuir pas chasse » / « notre vaisseau en mode
attaque doit rester le plus loin possible tout en permettant d'attaquer »
**A :** Six corrections, toutes mesurées : « 4/6 partent · 2 restent » ; étiquettes avec icône de fonction ;
`CONVOY_Z = -6` (plus aucun chevauchement) ; `sceneNeeds` (9 → 8 scènes) ; cuirassé en barrage (ligne tenue
à x = 0) ; standoff 24 → 30 borné par le radar. Plus le bouton de saut manquant et son piège
`pointer-events`. `365885b`.

**U :** « globalement je trouve que l'echelle n'est pas bonne […] les vaisseaux sont enorme dans un tout
petit espace […] on a l'impression de piloter un kart entre les asteroid »
**A :** Mesuré : champ 81×56, paquebot **36 %** de la largeur, rocher 28 %, espacement 37 u, bulle à 98 %.
Rescale coordonné (champ ×2,1, couloir, vitesses, portées, densité) : baleine 18 → 9 %, paquebot 36 → 17 %,
espacement 37 → 108 u, pacing préservé. **Découverte que `node --check` ne validait rien** ⇒
`tools/check-syntax.mjs`.

**U :** « ca reste trop karting en mode pilote […] il faut pouvoir zoomer et dézoomer avec la molette […]
et du coup prevoir une arene plus grande » puis « ou alors il faut un déplacement au clique souris ? »
**A :** Molette (pas géométrique, indicateur, bornes réglables) avec `viewHalfW` calculé sur le zoom de base
pour qu'elle n'ait **aucun effet de jeu**. Hauteur d'arène 226 → 420 (gratuite ; la longueur ne l'est pas,
elle commande la course FTL). Point de route au clic, exclusif au poste de pilote, via `AutoHelm`.

**U :** « du coup le pilote ne sert plus a rien juste le capitaine qui donne le cap a suivre non ? »
**A :** Objection acceptée : le clic est **exclusif au poste**, et le métier passe de « barrer » à
« router » — l'IA ne sait ni se mettre à couvert (le décor coupe les tirs) ni tenir la flotte dans la
bulle. Deux instruments ajoutés au cockpit du pilote pour rendre cette valeur visible.

**U :** « par contre on peut lancer des Missilles de n'importe quel poste »
**A :** Exception assumée et documentée (autoguidés = un ordre) ; l'exclusivité de l'artilleur reste la
visée manuelle, le mode de tir et la cible prioritaire — qui redirige aussi les missiles. Changement
proposé mais non appliqué sans demande.

**Fin de session :** outil Bash indisponible (classificateur de sûreté). Le rescale, la molette et le point
de route sont **écrits, non vérifiés, non poussés** — décision explicite de ne pas pousser un lot touchant
vitesses, portées, décor, caméra et contrôles sans mesure.
