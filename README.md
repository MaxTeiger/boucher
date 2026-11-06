# Le Boucher

Jeu d'action mobile en 3D (Three.js, sans build), publié sur https://boucher.maxteiger.com via GitHub Pages.

Tu joues le boucher : déplacement au doigt (joystick qui apparaît sous le pouce) ou au clavier (ZQSD / WASD / flèches), attaques automatiques. Chaque ennemi vaincu donne **un** bonus selon son type (affiché au-dessus de lui) :

| Stat | Ennemis |
|---|---|
| ⚔️ Attaque | recrue, bandit, chevalier noir |
| ❤️ Santé | arbre, grand chêne, roche de lave |
| ✚ Régénération | slime, champignon, diablotin |
| 👟 Vitesse (max 9) | lapin, salamandre |
| ⚡ Cadence (max +300 %) | loup |

Les ennemis réapparaissent après un délai (anneau de compte à rebours). Trois zones (Prairie, Forêt sombre, Terres de feu) séparées par des portes : battre les 2 mini-boss d'une zone ouvre la suivante. La dernière zone a un mini-boss et le boss final (dragon), qui ouvre un portail vers l'île suivante : stats et armes conservées, ennemis plus forts, palette différente (printemps, automne, hiver), progression sans fin.

Armes : chaque boss donne son arme, puis des copies quand on le rebat (+10 % de dégâts par copie, `1 + île` copies par victoire). À 5, 10, 15… copies l'arme peut évoluer (★, +25 %). Sanglier, Ent, Golem et Dragon débloquent chacun un emplacement : jusqu'à 5 armes en même temps (la première en main, les autres tournent autour du boucher). Dégât d'un coup = attaque × multiplicateur de l'arme.

Mort : retour au camp avec ses stats. Sauvegarde automatique dans `localStorage` (`boucher-save-v1`).

## Fichiers

- `index.html`, `style.css`, `game.js` : tout le jeu (modèles 3D faits de primitives).
- `vendor/three.module.min.js` (Three.js r170) et `vendor/lilita.woff2` (police Lilita One, OFL) : copiés en local.
- `icon.png` : icône d'écran d'accueil iOS.

## Tests et équilibrage

Paramètres d'URL (rien n'est sauvegardé en mode test) :

- `?test=boss|z2|z3|end|inv|weapon` : scènes prêtes (près du chef bandit, zone 2, zone 3, après le dragon, inventaire, fiche d'arme).
- `?test=fresh&bot&sim=7200&dbg` : un bot joue 2 h de jeu sans rendu ; `document.body.dataset.dbg` donne le moment où chaque boss tombe, les stats et les morts. Lancer avec Chrome headless : `--dump-dom --virtual-time-budget=400000`.

Courbe : à chaque palier (zone, une île = 3 paliers) PV ennemis ×9, dégâts ×5,5, bonus ×5 (`HPM`, `DMGM`, `RWM`). Au 2026-11-06, le bot finit l'île 1 en 15 à 22 min.
