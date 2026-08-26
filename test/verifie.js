/* verifie.js — les mêmes contrôles que test/verifie.html, en ligne de commande.

       node test/verifie.js

   Utile pour une intégration continue. Sur un poste sans Node, ouvrir
   test/verifie.html dans un navigateur : les contrôles mathématiques y sont
   identiques (ils viennent tous les deux de controles.js). Seule la
   troisième partie ci-dessous, qui relit les fichiers HTML, demande Node.
*/

'use strict';

const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');

let echecs = 0, nbControles = 0;

function verifier(nom, condition, detail) {
  nbControles++;
  if (!condition) {
    echecs++;
    if (echecs <= 50) {
      console.log('  ECHEC  ' + nom + (detail ? '\n         ' + detail : ''));
    }
  }
}

function titre(t) { console.log('\n' + t); }

/* econ.js ne touche ni au DOM ni à JSXGraph au moment de son évaluation :
   seules ses fonctions de tracé en ont besoin, et on ne les appelle pas. */
const Econ = eval(fs.readFileSync(path.join(RACINE, 'commun', 'econ.js'), 'utf8') + '; Econ;');
const controles = require('./controles.js');

titre('1 et 2. Formes closes et questions de prédiction');
const info = controles(Econ, verifier);
console.log('  (' + info.combinaisons.toLocaleString('fr-CA') +
            ' combinaisons balayées pour marshall-hicks, ' +
            info.combinaisonsMono.toLocaleString('fr-CA') + ' pour monopole)');

/* ------------------------------------------------------------------ */
/* 3. Identifiants de questions et champs obligatoires                 */
/* ------------------------------------------------------------------ */

titre('3. Questions de prédiction : identifiants et champs obligatoires');

const pages = fs.readdirSync(RACINE).filter((f) => f.endsWith('.html'));
const vus = new Map();
let nbQuestions = 0;

for (const page of pages) {
  const html = fs.readFileSync(path.join(RACINE, page), 'utf8');
  if (!/Pred\.init\s*\(/.test(html)) continue;

  // On isole le bloc Pred.init pour ne pas ramasser des « id: » d'ailleurs.
  const bloc = html.slice(html.indexOf('Pred.init'));
  const ids = [...bloc.matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]);

  verifier(page + ' : au moins une question', ids.length > 0);

  for (const id of ids) {
    nbQuestions++;
    verifier('identifiant unique : ' + id, !vus.has(id),
             vus.has(id) ? 'déjà présent dans ' + vus.get(id) : '');
    vus.set(id, page);
    verifier('identifiant de la forme outil-qN : ' + id,
             /^[a-z-]+-q\d+$/.test(id), 'dans ' + page);
  }

  const compte = (motif) => (bloc.match(motif) || []).length;
  verifier(page + ' : autant de type que d\'id', compte(/type:\s*'/g) === ids.length);
  verifier(page + ' : autant de reponse() que d\'id',
           compte(/reponse:\s*function/g) === ids.length);
  verifier(page + ' : autant d\'explication que d\'id',
           compte(/explication:/g) === ids.length);

  // Garde-fou contre le retour des nombres écrits en dur : une réponse qui
  // se contente de renvoyer un littéral ne dépend pas de l'état de la page.
  const enDur = [...bloc.matchAll(/reponse:\s*function\s*\(\)\s*\{\s*return\s+[\d.,+-]+\s*;?\s*\}/g)];
  verifier(page + ' : aucune réponse écrite en dur', enDur.length === 0,
           enDur.map((m) => m[0]).join(' | '));
}

console.log('  (' + nbQuestions + ' question(s) dans ' +
            [...new Set(vus.values())].length + ' page(s))');

titre(echecs === 0
  ? 'Tout est en ordre : ' + nbControles.toLocaleString('fr-CA') + ' contrôles passés.'
  : echecs.toLocaleString('fr-CA') + ' ECHEC(S) sur ' +
    nbControles.toLocaleString('fr-CA') + ' contrôles.');

process.exit(echecs === 0 ? 0 : 1);
