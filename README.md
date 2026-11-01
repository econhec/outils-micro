# Outils interactifs — ECON 20851

Dix-huit graphiques manipulables pour le cours de microéconomie intermédiaire :
contrainte budgétaire, choix optimal, boîte d'Edgeworth, courbe d'offre,
monopole, offre de travail, et d'autres.

<https://econhec.github.io/outils-micro/>

## Vérification locale

Depuis ce dossier, `node test/verifie.js` exécute les contrôles mathématiques,
les vérifications des questions et les régressions des scripts HTML réels.
Aucune dépendance Node supplémentaire n'est nécessaire. `test/verifie.html`
exécute les contrôles mathématiques dans le navigateur ; il ne remplace pas
les régressions des scripts ni la lecture de leurs corrections visibles.

Le test facultatif `node test/navigateur.js` utilise Playwright disponible dans
l'environnement et un navigateur Chromium. Avec Edge installé, sous PowerShell :

```powershell
$env:BROWSER_CHANNEL = 'msedge'
node test/navigateur.js
```

Sans cette variable, il utilise le Chromium de Playwright. Le test démarre un
serveur sur une adresse locale, bloque les requêtes externes et ferme le serveur
et le navigateur à la fin. `TOOLBOX_SCREENSHOTS` peut désigner un dossier de
captures. Il vérifie les corrections, le masquage initial des résultats et le
mode de révision « Recommencer », où les résultats restent visibles.
