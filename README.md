# BSG — Chantier de vaisseaux

Jeu spatial WebGL au style **low-poly fil de fer néon**. On **construit et améliore**
un vaisseau mère « baleine » (livrée **bleu & blanc**, dos foncé / ventre clair) dans
un **hangar**, puis on **traverse cinq secteurs** hostiles jusqu'à un refuge, en
commandant l'équipage depuis les postes de la passerelle.

Rendu **Three.js** (chargé depuis un CDN via import map) + post-processing bloom.
Aucun build ni dépendance : c'est un **site statique**.

## Lancer

Un serveur statique local suffit (nécessaire pour les modules ES) :

```bash
cd BSG
python3 -m http.server 8000
# puis ouvrir http://localhost:8000   (Cmd+Shift+R pour éviter le cache)
```

## Contrôles (champ de tir)

| Entrée | Action |
|---|---|
| **Tab** ou clic sur une icône | **changer de poste** (commandant · pilote · artilleur · drones) |
| **Chiffres** | **commandes du poste courant** (énergie · conduite · mode de tir · escadron) |
| **← / →** (ou A/D · Q/D) | virer sur place — *au poste de pilote* (inertie de navire) |
| **↑ / ↓** (ou W/S · Z/S) | avancer / reculer dans l'axe du nez — *au poste de pilote* |
| **Souris** | viser — *au poste d'artilleur* |
| **Clic gauche** | tir des lasers — *au poste d'artilleur* |
| **Barre Espace** | tir des **missiles** (ordre du capitaine, depuis n'importe quel poste) |
| **Clic droit** (maintenu) | **anneau de passerelle** : répartir l'énergie — *console du commandant* |
| **E** | **IEM** (impulsion) — *console du commandant* |
| **Clic sur un module** | l'activer / le couper — *console du commandant* |
| **Entrée** | « boss key » : bascule sur un faux écran de travail (pause + son coupé) |
| **V** ou ⛶ | **vue plein écran** : le décor du cockpit s'efface |
| **T** | panneau de **réglages** (équilibrage en direct) |

Le **nez suit le cap** (proue directrice, la poupe balaie) ; les tourelles visent
l'ennemi **indépendamment** du cap. La rotation est **lourde** (inertie) et pivote
plutôt vers la proue.

## Hangar

- Clique un **emplacement** sur la baleine (ou dans le panneau) → menu des modules
  compatibles. La baleine a **12 slots** : armes dorsales/ventrales, 2 propulsions,
  utilitaires (proue, cœur, soute, menton).
- **Équiper / Changer / Retirer** ; **Améliorer** (Nv 1 → 3). Tout coûte des
  **crédits** (gagnés en combat) ; retirer rembourse 50 %.
- Le **build et les crédits** sont sauvegardés (localStorage) et rechargés au démarrage.

## La fuite

Les Colonies sont tombées. Tu escortes ce qui reste : **six transports civils, 50 000 âmes**,
qui ne peuvent ni tirer ni manœuvrer — un paquebot, un transport de passagers, un navire-hôpital,
un cargo, une citerne et un remorqueur, tous reconnaissables au premier regard. Les Cylons vous retrouvent à chaque saut, on ne sait pas
comment. Le seul recours est de **sauter encore**.

**Les Cylons reviennent toutes les 33 minutes.** Ces minutes-là, tu les passes **dans le CIC** :
tu écoutes ton équipage, et tu décides. Le mécanicien veut détacher une équipe pour réparer le
cargo ? Le navire-hôpital réclame du courant pour ses blocs opératoires ? Chaque réponse **se paie
dans le combat qui suit** — une coque réparée contre un module hors service, du courant donné
contre de l'énergie en moins, des condensateurs préchargés contre une réserve entamée.

`Espace` fait avancer, `1-3` choisit, et **`N` passe directement à l'action** si tu veux en finir
avec les préliminaires.

Puis le décompte tombe, et la bataille commence : la flotte s'ébranle vers le point de saut
pendant que le calcul FTL tourne. Il aboutira **avant** que le dernier traînard soit à la porte —
c'est là que tout se joue.

Un secteur n'est pas une arène à nettoyer, c'est un **saut à préparer** : tu entres par la
gauche, la porte de saut est loin à droite, et le **moteur FTL calcule** pendant que la flotte
avance. Les assauts ne s'arrêtent jamais — tu ne peux pas « finir » une vague, seulement tenir
jusqu'à l'échéance.

Le commandant peut **forcer le calcul** pour partir plus tôt, mais l'énergie qu'il y met est
prise sur les armes et les boucliers. Et le saut **n'emporte que ce qui est arrivé à la porte** :
si un transport traîne, il faut choisir — l'attendre sous le feu, ou ordonner le départ (**J**)
et le laisser. Les âmes perdues le sont pour de bon, jusqu'à la fin de la partie.

Les Cylons ne viennent pas pour toi : **ils viennent pour eux**. Rester planté à côté du convoi
ne suffit pas, il faut aller intercepter.

Cinq secteurs jusqu'au refuge — Périphérie,
la Ceinture, Cimetière de coques, le Blocus, la Porte. Chacun a son **décor** et son caractère :
la Ceinture est un dédale de roches où le radar se brouille, le Blocus un vide dégagé où rien
ne protège. Un **cuirassé** garde la sortie de deux d'entre eux. Entre deux secteurs, un
**saut** : coque réparée, munitions rechargées, prime encaissée. Au bout : la **victoire**.

Le décor n'est pas décoratif — **les astéroïdes et les épaves arrêtent les tirs**. Se mettre à
couvert fonctionne, pour toi comme pour l'ennemi : ton équipage refuse même de tirer sur une
cible masquée et te le dit. Les nuages de poussière, eux, laissent passer les tirs mais
aveuglent le radar : s'y cacher se paie en précision.

Les vagues **changent de nature** et pas seulement de PV : nuée de chasseurs, colonne blindée,
escadre porte-drones, force de siège… Chacune demande une autre réponse. Et pendant la
respiration entre deux vagues, **le radar annonce ce qui arrive** — de quoi répartir l'énergie
et déployer l'escadron avant le contact plutôt que d'attendre.

## Combat (vagues vs CPU)

- **Vaste arène** (±190 × ±120) aux **limites visibles** ; la **caméra suit** ta
  baleine puis se **bloque aux bords** (tu te décentres vers le bord).
- Les ennemis apparaissent **hors-champ** et foncent : **flèches en bord d'écran**
  + **mini-radar** (coin bas-droite) pour les repérer.
- **CUIRASSÉ** gardant la sortie de certains secteurs : un bâtiment **quatre fois plus long que ta baleine**, qui
  déborde de l'écran (la caméra recule pour le contenir). On ne l'esquive pas, on le **démonte**
  — il n'a pas de barre de vie, il a **dix pièces** : sept batteries, un îlot de commandement,
  deux moteurs. Chacune se vise et se détruit séparément, et chacune change la donne : une
  batterie réduite au silence ouvre un angle mort où s'installer, les moteurs arrachés
  l'immobilisent, l'îlot détruit dérègle toute sa conduite de tir. Ses batteries ont des
  **secteurs de tir** — sa poupe ne couvre rien, et c'est justement là que sont ses moteurs.
- **Rythme posé, pas beat'em all** : les ennemis sont lents, tirent peu souvent, apparaissent
  loin (approche longue et lisible), et une **respiration de ~8 s** sépare les vagues. Sans ça
  on n'aurait jamais le temps de changer de poste — la mécanique centrale serait inutilisable.
- **Vagues à thème** (cf. la traversée), et non plus une composition figée dont seuls
  les PV montaient. **Types d'ennemis** :
  **Chasseur** (rapide, fragile), **Raider** (polyvalent), **Cuirassé** (lourd,
  gros PV/dégâts), **Porte-drones** (déploie des intercepteurs). Ils **encerclent**
  (maintiennent leur distance et tournent autour), avec un léger **temps de réaction**.
- **Crédits** gagnés par ennemi détruit et par vague.
- **Bonus** ramassables en volant dessus : **caisse de munitions** (recharge les
  missiles) et **kit de réparation** (restaure la coque). Ils clignotent puis disparaissent.
- Coque à 0 = **défaite** → overlay **Rejouer / Hangar** + **🏆 Hall of Fame**
  (persisté). Arriver au refuge = **victoire**.

## Systèmes

**Postes** — tu ne tiens **qu'un poste à la fois** ; l'équipage tient les autres. Tout le jeu
est là : *où suis-je le plus utile, maintenant ?* Tu circules dans ton vaisseau selon l'urgence
(colonne d'icônes en bas à gauche, ou **Tab**), et **1-2-3** donne les commandes du poste où tu
te trouves.

| Poste | Ce que l'équipage sait faire | Ce qu'il ne sait pas — ton créneau | Chiffres |
|---|---|---|---|
| **Commandant** | rien : il n'y touche pas | énergie, modules, IEM, **ordres aux autres postes** | profils d'énergie |
| **Pilote** | appliquer la consigne, éviter les bords | juger **quand** changer de consigne | engager · récupérer · rompre |
| **Artilleur** | tirer sur le plus proche à portée | toucher ce qui manœuvre, choisir la cible | mode : semi · rafale · auto |
| **Drones** | appliquer ta consigne sans jamais l'adapter | **désigner la cible** de l'escadron | attaque · escorte · repli |

**L'équipage n'est pas une machine.** Il suit la cible avec du retard, disperse d'autant plus
qu'elle est loin, voit mal ce qui sort de la portée du **radar**, et **renonce à tirer** quand
la solution est trop mauvaise plutôt que de vider ta réserve d'énergie. Concrètement : ~100 %
de touches sur une cible proche et régulière, mais **30 %** sur une cible qui manœuvre — là où
tu ferais 100 % en prenant la tourelle. Le HUD affiche en permanence la **solution de tir**
(bonne / dégradée / sans solution) : c'est ton signal pour descendre au poste.

**Changer de poste coûte** : le temps de t'installer, le poste que tu rejoins est **vacant** —
l'équipage l'a quitté, tu n'y es pas encore. On ne peut pas être partout.

Tes **consignes persistent** quand tu t'en vas, et c'est tout le contrat : le barreur n'ira
jamais chercher une caisse de lui-même, mais si tu laisses la consigne **RÉCUPÉRER** en place
il continuera d'y aller pendant que tu es à la tourelle — y compris quand ce sera devenu une
mauvaise idée. L'équipage exécute ; c'est toi qui juges du moment.

**Tu es dans le vaisseau.** La vue du combat n'est pas un fond d'écran : c'est l'**écran
tactique** de ton poste, encadré par la structure de la passerelle, qui prend la couleur du
poste où tu es assis et en porte le nom. Pour y voir large — approche d'un cuirassé, manœuvre
serrée — **V** (ou le bouton ⛶) passe la vue en **plein écran** : le décor s'efface, la console
se replie en surimpression. Tout ce qui est *affiché* (vignette, alertes, bannières) appartient
à cet écran et s'y cadre ; les consoles, elles, sont des instruments de la passerelle.

La vue est **volontairement large** — une centaine d'unités de côté — pour qu'on lise la
situation tactique plutôt que le détail de sa coque. Réglable via *Recul caméra général* dans le
panneau **T**.

**Chaque poste a son cockpit.** L'écran n'affiche que les instruments du poste où tu te trouves
— un compas et une jauge de vitesse à la barre, la solution de tir et les munitions à la
tourelle, l'état de l'escadron à la console des drones, la répartition d'énergie et les modules
chez le commandant. Seul reste affiché en permanence ce qui est vital partout : coque, bouclier,
vague, cible, radar.

Conséquence : **répartir l'énergie, couper un module ou déclencher l'IEM exige d'être à la
console du commandant.** Sinon ce ne serait pas un poste, juste un menu. Les missiles (Espace)
font exception : ils sont autoguidés, un ordre suffit de n'importe où.

**Le commandant commande.** Sa console porte les consignes de *tous* les postes : il ordonne au
barreur de récupérer une caisse, à l'artilleur de passer en semi-automatique, à l'escadron de se
replier — sans quitter sa place. Ce qu'il ne peut pas faire à distance, c'est **exécuter** :
barrer, viser, ou désigner la cible de l'escadron. La consigne dit *quoi* ; le poste fait le
*comment*. C'est pour ça qu'aller à un poste sert encore à quelque chose.

**Énergie répartie** — tu ne pilotes pas un chasseur, tu **commandes** un vaisseau mère : le
débit des **réacteurs** est réparti entre trois **bus rivaux** dont la somme fait 100 % —
**ARMES** (remplit la réserve que le laser consomme), **BOUCLIERS** (vitesse de régén) et
**MOTEURS** (accélération et virage). On ne peut pas être bon partout.

Le **clic droit maintenu** ouvre l'**anneau de passerelle** : quatre profils au choix —
**ATTAQUE** (60/20/20), **DÉFENSE** (20/60/20), **COURSE** (20/20/60) et **ÉQUILIBRE**
(33/33/33) ; on choisit à l'angle de la souris, on relâche pour appliquer, et on ramène le
curseur au centre pour annuler. Pendant l'ouverture **le temps ralentit** — mais **les armes
se taisent**, l'équipage étant occupé à rebrancher les circuits. Ouvrir l'anneau coûte donc
des dégâts : on choisit des moments, on ne micro-gère pas. La bascule met ~0,6 s à s'établir.

Concrètement, sur le laser Nv1 (cadence nominale 7 tirs/s) : **4,3 tirs/s** soutenus en
ATTAQUE, **2,3** en ÉQUILIBRE, **1,3** en DÉFENSE. Et le bouclier remonte à **21,8 PV/s** en
DÉFENSE contre **7,3** en ATTAQUE. Le panneau joueur affiche en permanence le profil courant
et les trois jauges (repère pointillé = le tiers neutre).

**Défense** — le **bouclier** absorbe avant la **coque** (base + armure). Tant qu'il
a de la charge, il forme une **bulle** infranchissable par les **drones ennemis** et
qui **intercepte les tirs** à son bord. S'il tombe à 0 il se **brise** (délai plus
long avant régén) mais **reprotège dès qu'il a de nouveau de la charge**. La régén
puise dans l'énergie, après un court délai sans être touché.

**IEM** — capacité active à recharge : détruit les **drones ennemis** proches et
**paralyse** les vaisseaux ennemis dans le rayon (1-2 s). La recharge s'affiche sur
le chip du module.

**Défense rapprochée** — les drones ennemis sont de trop petites cibles, trop vives, pour la
conduite de tir des tourelles : ton équipage y perd son temps (~9 s pour dégager 3 drones
collés à la coque). Le **Canon Anti-Drone** est fait pour ça — cadence énorme, portée courte,
entièrement **automatique** : il crépite seul quel que soit le poste où tu te trouves, et
dégage les mêmes 3 drones en **1 s**. En échange il **dévore l'énergie** : sous un essaim, tes
lasers se taisent faute de réserve. Défendre ses arrières se paie.

**Intercepteurs autonomes** — la **baie** déploie un escadron de drones (triangles
fil de fer) qui foncent sur l'ennemi et tirent seuls. Les ennemis en déploient aussi
(dès la vague 2). Les drones sont **destructibles** ; le porte-drones les reconstruit lentement.

**Collision** — un seul plan de profondeur : les vaisseaux ne se chevauchent pas
(contact = dégâts + rejet) ; les tirs touchent par collision de cercles.

## Modules

- **Armes** : Canon Laser · Lance-Missiles (tête chercheuse) · **Canon Anti-Drone** · Baie Intercepteurs · IEM
- **Utilitaires / passifs** : Réacteur (poussée + énergie) · Bouclier · Armure · Radar

## Panneau de réglages (touche T)

Jauges pour équilibrer **en direct**, **persistées** en JSON (localStorage) ; bouton
**Copier JSON** pour figer un preset, **Réinitialiser** pour les défauts. Réglages :
régén énergie, coût laser, accélération/traînée/virage du vaisseau, vitesse & cadence
des ennemis, rayon bouclier, délai & durée des bonus, réparation, **pivot de rotation**,
**portée radar**, **portée IEM**. Défauts dans `js/core/Tune.js`.

## Ambiance & effets

Fond spatial (**nébuleuses** colorées, **étoiles** multicolores en parallaxe, **galaxie**
spirale, **vignette** CRT + scanlines), **bloom** néon, **secousse d'écran**, **explosions**
et **champs de débris**, flashs de tir ronds, et **audio synthétisé** (WebAudio, sans
fichier : laser, missile, IEM, impacts, moteur, victoire/défaite).

## Architecture (data-driven)

- `js/data/` — `hullConfig.js` (forme + slots de la coque), `moduleConfig.js` (modules,
  stats par niveau, coûts).
- `js/entities/` — `Hull.js`, `EnemyShip.js`, `Drone.js`, `Pickup.js`, et `modules/`
  (LaserCannon, MissileLauncher, InterceptorBay, Emp, Reactor, Shield, Armor, Radar).
- `js/game/` — `Ship.js` (agrégat + défense/énergie), `Hangar.js`, `Range.js` (combat),
  `Hud.js`, `TunePanel.js`.
- `js/core/` — `Renderer.js` (bloom), `Camera.js`, `AimController.js`, `InputController.js`,
  `WeaponControl.js`, `Fx.js`, `ScreenShake.js`, `Audio.js`, `Tune.js`, `HallOfFame.js`,
  `SaveManager.js`, `NeonMaterials.js`.

L'archi est **data-driven** : ajouter un module = une entrée dans `moduleConfig` + une
petite classe ; ajouter une autre coque = un fichier de config du même format.

## Prochaines pistes

**Coop à plusieurs postes** — chacun tient un poste du même vaisseau (capitaine, artillerie,
ingénieur). L'architecture est déjà en place (`Stations.js`) : il s'agit de poser un opérateur
distant là où il y a une IA. Avant ça, chaque poste doit gagner de la substance : **sections de
coque** qui cassent localement (ingénieur), **ordres d'escadron** (capitaine), **désignation de
cibles** (artillerie).

Ensuite : courbe de difficulté (les vagues doivent changer de nature, pas seulement de PV) et
condition de victoire, autres formes de vaisseau mère, boutique plus riche, menu de départ.
