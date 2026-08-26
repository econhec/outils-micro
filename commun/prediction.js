/* prediction.js — mode « prédiction » des outils interactifs d'ECON 20851.

   Le panneau de résultats reste invisible tant que l'étudiant n'a pas répondu
   à une première question. L'idée tient en une phrase : voir la bonne réponse
   sans avoir parié dessus n'apprend presque rien, alors que se tromper
   franchement sur une prédiction laisse une trace.

   À charger APRÈS econ.js et AVANT le script de la page : ce fichier
   enveloppe Econ.resultats pour retenir les valeurs avant qu'elles
   n'atteignent le DOM (voir « Rétention » plus bas).

   La page déclare ses questions puis appelle :
       Pred.init([ {...}, {...} ]);

   Une question :
       id        identifiant unique dans tout le site : « outil-qN »
       type      'direction' | 'choix' | 'numerique'
       texte     l'énoncé (HTML permis)
       options   pour direction/choix : tableau de libellés
       unite     pour numerique : suffixe affiché (« $ », « heures »…)
       tolerance pour numerique : écart relatif accepté (0,02 par défaut)
       decimales pour numerique : décimales de la bonne réponse affichée
       reponse   fonction SANS ARGUMENT renvoyant la bonne réponse, calculée
                 à partir de l'état courant de la page : indice de l'option
                 pour direction/choix, nombre pour numerique
       explication  le mécanisme, en une à trois phrases

   La règle absolue : `reponse` appelle les fonctions qui font déjà tourner
   l'outil. Aucune bonne réponse n'est écrite en dur, donc aucune ne devient
   fausse quand on bouge un curseur ou change une valeur par défaut.

   Sobriété d'affichage : une seule question à la fois, panneau de résultats
   retiré de la page jusqu'à la FIN de la série, et carte repliée en une
   ligne une fois la série finie. La page ne doit jamais donner l'impression
   de parler de trois endroits à la fois.

   Pourquoi jusqu'à la fin, et non après la première question : plusieurs
   panneaux affichent une ligne qui EST la réponse d'une question ultérieure
   — « Effet total » dans marshall-hicks, « Perte sèche » dans monopole. Un
   panneau révélé trop tôt transforme la dernière question en lecture.
   Chaque question doit rester répondable à partir des curseurs et de la
   théorie seuls ; c'est une contrainte de rédaction autant que d'affichage.
*/

const Pred = (function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Réglages                                                            */
  /* ------------------------------------------------------------------ */

  // Code du site GoatCounter. Vider la chaîne suffit à tout désactiver :
  // aucun script externe n'est alors chargé et aucune mesure n'est prise,
  // les outils fonctionnant exactement pareil.
  const SITE_MESURE = 'econhec';

  const TOL_DEFAUT = 0.02;

  /* ------------------------------------------------------------------ */
  /* Rétention des résultats                                             */
  /*                                                                     */
  /* Cacher le panneau par du style ne suffirait pas : les valeurs         */
  /* resteraient dans le DOM, lisibles en trois clics dans l'inspecteur.   */
  /* On enveloppe donc Econ.resultats : tant que la rétention est active,  */
  /* la vraie valeur est gardée en mémoire et une pastille part dans le    */
  /* DOM à sa place — puis le panneau entier est retiré de l'affichage.    */
  /* La page a beau recalculer à chaque cran de curseur, aucun chiffre     */
  /* juste n'atteint l'écran avant la première réponse.                    */
  /* ------------------------------------------------------------------ */

  let retenu = false;
  const panneaux = [];   // un par appel à Econ.resultats sur la page

  if (typeof Econ !== 'undefined' && Econ.resultats) {
    const resultatsOrig = Econ.resultats;
    Econ.resultats = function (hote, lignes) {
      const api = resultatsOrig(hote, lignes);
      const hoteEl = typeof hote === 'string' ? document.getElementById(hote) : hote;
      // Le bloc que l'on vient d'ajouter est le dernier enfant de l'hôte ;
      // ses spans .nb suivent l'ordre de `lignes`.
      const bloc = hoteEl.lastElementChild;
      const spans = bloc ? bloc.querySelectorAll('.nb') : [];
      const elements = {}, valeurs = {};
      lignes.forEach(function (l, i) {
        elements[typeof l === 'string' ? l : l[0]] = spans[i];
      });

      const fixerOrig = api.fixer;
      api.fixer = function (cle, texte) {
        valeurs[cle] = texte;                    // on retient toujours la vérité
        if (retenu) {
          if (elements[cle]) elements[cle].textContent = '···';
        } else {
          fixerOrig(cle, texte);
        }
      };

      panneaux.push({ bloc: bloc, elements: elements, valeurs: valeurs, fixer: fixerOrig });
      return api;
    };
  }

  function retenir() {
    retenu = true;
    panneaux.forEach(function (p) {
      if (p.bloc) p.bloc.classList.add('pred-retenu');
      for (const cle in p.elements) {
        if (p.elements[cle]) p.elements[cle].textContent = '···';
      }
    });
    // Le premier rendu de la page a eu lieu AVANT cet appel : les éléments du
    // graphique dont la visibilité dépend de Pred.retenu() sont donc dessinés.
    // On le signale en différé — les pages attachent leur écouteur juste
    // après Pred.init, un envoi synchrone partirait dans le vide.
    setTimeout(function () {
      try {
        document.dispatchEvent(new CustomEvent('pred-retenu'));
      } catch (e) { /* sans conséquence */ }
    }, 0);
  }

  function reveler() {
    if (!retenu) return;
    retenu = false;
    panneaux.forEach(function (p) {
      if (p.bloc) p.bloc.classList.remove('pred-retenu');
      for (const cle in p.valeurs) p.fixer(cle, p.valeurs[cle]);
    });
    // Certaines pages affichent des réponses SUR le graphique (« VC = … $ »).
    // Elles conditionnent la visibilité de ces éléments à Pred.retenu() et
    // se redessinent sur cet événement.
    try {
      document.dispatchEvent(new CustomEvent('pred-revele'));
    } catch (e) { /* sans conséquence */ }
  }

  /* ------------------------------------------------------------------ */
  /* Mesure d'usage                                                      */
  /*                                                                     */
  /* Anonyme et sans témoin (cookie) : on compte des visites et des       */
  /* réponses, jamais des personnes. Rien n'est stocké dans la page, rien */
  /* ne permet de relier deux réponses entre elles.                       */
  /*                                                                     */
  /* Le compteur est chargé dès l'inclusion du fichier, et non depuis     */
  /* init() : la page d'accueil ne pose aucune question et doit tout de   */
  /* même être comptée. Si le script externe est bloqué — bloqueur de     */
  /* publicité, hors ligne, réglage d'entreprise — tout le reste continue */
  /* de fonctionner : c'est le rôle du try/catch et de la file d'attente. */
  /* ------------------------------------------------------------------ */

  const outil = (location.pathname.split('/').pop() || 'index')
                  .replace(/\.html?$/i, '') || 'index';

  // Événements émis avant l'arrivée du script externe (chargé en async).
  // Bornée : si le script ne vient jamais, la file ne grossit pas sans fin.
  const enAttente = [];

  function envoyer(chemin) {
    window.goatcounter.count({ path: chemin, title: chemin, event: true });
  }

  (function chargerMesure() {
    if (!SITE_MESURE) return;
    const s = document.createElement('script');
    s.async = true;
    s.setAttribute('data-goatcounter', 'https://' + SITE_MESURE + '.goatcounter.com/count');
    s.src = 'https://gc.zgo.at/count.js';
    // count.js compte la visite tout seul au chargement ; on ne vide ici que
    // les événements de prédiction émis entre-temps.
    s.addEventListener('load', function () {
      try {
        while (enAttente.length) envoyer(enAttente.shift());
      } catch (e) { /* sans effet sur l'outil */ }
    });
    document.head.appendChild(s);
  })();

  function compter(chemin) {
    try {
      if (window.goatcounter && window.goatcounter.count) envoyer(chemin);
      else if (SITE_MESURE && enAttente.length < 20) enAttente.push(chemin);
    } catch (e) { /* la mesure ne doit jamais casser l'outil */ }
  }

  /* ------------------------------------------------------------------ */
  /* Mémoire de session                                                  */
  /*                                                                     */
  /* Revenir sur la page dans la même session ne re-pose pas la question  */
  /* d'office : la carte se présente repliée, avec de quoi recommencer.   */
  /* sessionStorage peut lever une exception en navigation privée : on    */
  /* s'en passe alors sans bruit.                                         */
  /* ------------------------------------------------------------------ */

  function dejaVu() {
    try { return sessionStorage.getItem('pred-vu-' + outil) === '1'; }
    catch (e) { return false; }
  }

  function marquerVu() {
    try { sessionStorage.setItem('pred-vu-' + outil, '1'); } catch (e) { /* tant pis */ }
  }

  /* ------------------------------------------------------------------ */
  /* Lecture d'un nombre saisi                                           */
  /* ------------------------------------------------------------------ */

  // Les étudiants écrivent « 3,45 » ; le champ HTML rend « 3.45 ». On accepte
  // les deux, ainsi que le vrai signe moins et les espaces de milliers.
  function lireNombre(s) {
    if (typeof s !== 'string') return NaN;
    const net = s.replace(/\s/g, '').replace(/−/g, '-').replace(',', '.');
    if (net === '' || !/^-?\d*\.?\d+$/.test(net)) return NaN;
    return parseFloat(net);
  }

  /* ------------------------------------------------------------------ */
  /* La carte                                                            */
  /* ------------------------------------------------------------------ */

  function init(questions, opt) {
    opt = opt || {};
    if (!questions || !questions.length) return;   // page sans question : rien ne change

    // La carte prend la place du panneau de résultats : la question occupe
    // l'espace où la réponse apparaîtra, elle ne s'y ajoute pas.
    const cible = document.querySelector(opt.panneau || '#cmd .resultats');
    if (!cible) return;                            // structure inattendue : on s'abstient

    const carte = document.createElement('div');
    carte.className = 'prediction';
    cible.parentNode.insertBefore(carte, cible);

    let i = 0;          // question courante
    let justes = 0;     // bonnes réponses de la série en cours

    if (dejaVu()) {
      replier(false);   // déjà faites cette session : une ligne, pas une carte
    } else {
      retenir();
      poser();
    }

    function replier(avecScore) {
      carte.classList.add('pred-mince');
      carte.innerHTML = '';
      const t = document.createElement('span');
      t.textContent = avecScore
        ? 'Prédictions : ' + justes + ' sur ' + questions.length + '.'
        : 'Prédictions déjà faites dans cette session.';
      carte.appendChild(t);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pred-lien';
      b.textContent = 'Recommencer';
      b.addEventListener('click', function () {
        i = 0; justes = 0;
        carte.classList.remove('pred-mince');
        poser();                                   // sans rétention : on refait pour soi
      });
      carte.appendChild(b);
    }

    function poser() {
      const q = questions[i];
      carte.innerHTML = '';

      const titre = document.createElement('h3');
      titre.textContent = 'Prédiction' +
        (questions.length > 1 ? ' ' + (i + 1) + ' de ' + questions.length : '');
      carte.appendChild(titre);

      const enonce = document.createElement('p');
      enonce.className = 'pred-question';
      enonce.innerHTML = q.texte;
      carte.appendChild(enonce);

      const zone = document.createElement('div');
      zone.className = 'pred-reponse';
      carte.appendChild(zone);

      let lire;                                    // renvoie la réponse saisie

      if (q.type === 'numerique') {
        const champ = document.createElement('input');
        champ.type = 'text';                       // « text » pour accepter la virgule
        champ.inputMode = 'decimal';
        champ.className = 'pred-nombre';
        champ.id = 'pred-champ-' + q.id;
        const lab = document.createElement('label');
        lab.htmlFor = champ.id;
        lab.className = 'pred-lecteur';
        lab.textContent = 'Votre estimation';
        zone.appendChild(lab);
        zone.appendChild(champ);
        if (q.unite) {
          const u = document.createElement('span');
          u.className = 'pred-unite';
          u.innerHTML = ' ' + q.unite;
          zone.appendChild(u);
        }
        champ.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); valider(); }
        });
        lire = function () { return lireNombre(champ.value); };

      } else {
        // Un groupe de boutons radio : navigable au clavier par les flèches,
        // sans qu'on ait à réécrire quoi que ce soit.
        const fieldset = document.createElement('fieldset');
        fieldset.className = 'pred-options';
        const legende = document.createElement('legend');
        legende.className = 'pred-lecteur';
        legende.textContent = 'Choisissez une réponse';
        fieldset.appendChild(legende);
        q.options.forEach(function (o, k) {
          const lab = document.createElement('label');
          const inp = document.createElement('input');
          inp.type = 'radio';
          inp.name = 'pred-' + q.id;
          inp.value = k;
          const txt = document.createElement('span');
          txt.innerHTML = o;
          lab.appendChild(inp);
          lab.appendChild(txt);
          fieldset.appendChild(lab);
        });
        zone.appendChild(fieldset);
        lire = function () {
          const c = fieldset.querySelector('input:checked');
          return c ? parseInt(c.value, 10) : NaN;
        };
      }

      const barre = document.createElement('div');
      barre.className = 'pred-barre';

      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = 'bouton pred-valider';
      bouton.textContent = 'Vérifier';
      bouton.addEventListener('click', valider);
      barre.appendChild(bouton);

      const passer = document.createElement('button');
      passer.type = 'button';
      passer.className = 'pred-passer';
      passer.textContent = 'passer';
      passer.addEventListener('click', function () { conclure(null); });
      barre.appendChild(passer);

      carte.appendChild(barre);

      const retour = document.createElement('div');
      retour.className = 'pred-retour';
      retour.setAttribute('aria-live', 'polite');
      carte.appendChild(retour);

      // On dit où sont passés les résultats : un panneau qui disparaît sans
      // explication se lit comme une panne.
      if (retenu && questions.length > 1) {
        const note = document.createElement('p');
        note.className = 'pred-attente';
        note.textContent = 'Les résultats chiffrés s\'afficheront après les ' +
                           questions.length + ' prédictions.';
        carte.appendChild(note);
      }

      function valider() {
        const donnee = lire();
        if (isNaN(donnee)) {
          retour.innerHTML = '<p class="pred-vide">Choisissez une réponse — ' +
                             'même incertaine, c\'est là tout l\'intérêt.</p>';
          return;
        }
        conclure(donnee);
      }
    }

    // Affiche la correction, révèle le panneau, enregistre l'événement.
    // `donnee` vaut null quand l'étudiant passe la question.
    function conclure(donnee) {
      const q = questions[i];
      const bonne = q.reponse();
      let juste = false, detail = '';

      if (donnee === null) {
        detail = 'passer';
      } else if (q.type === 'numerique') {
        const tol = (q.tolerance !== undefined ? q.tolerance : TOL_DEFAUT);
        const marge = Math.max(Math.abs(bonne) * tol, 1e-9);
        juste = Math.abs(donnee - bonne) <= marge;
        detail = juste ? 'correct' : 'incorrect/' + (donnee < bonne ? 'trop-bas' : 'trop-haut');
      } else {
        juste = (donnee === bonne);
        detail = juste ? 'correct' : 'incorrect/' + donnee;
      }
      if (juste) justes++;

      compter('/pred/' + outil + '/' + q.id + '/' + detail);

      // Les chiffres n'arrivent qu'au bout de la série : tant qu'il reste une
      // question, le panneau resterait un corrigé à ciel ouvert.
      const dernier = (i === questions.length - 1);
      if (dernier) { reveler(); marquerVu(); }

      // La question est jouée : on fige ses commandes.
      Array.prototype.forEach.call(
        carte.querySelectorAll('input, .pred-valider, .pred-passer'),
        function (el) { el.disabled = true; });

      const retour = carte.querySelector('.pred-retour');
      let entete;
      if (donnee === null) {
        entete = '<p class="pred-note">Question passée. La réponse : ' +
                 libelle(q, bonne) + '.</p>';
      } else if (juste) {
        entete = '<p class="pred-juste"><strong>✓ Exact.</strong></p>';
      } else {
        entete = '<p class="pred-faux"><strong>✗ Inexact</strong> — la bonne réponse : ' +
                 libelle(q, bonne) + '.</p>';
      }
      retour.innerHTML = entete +
        '<p class="pred-explication">' + q.explication + '</p>';

      // Le panneau vient de se remplir : on ramène le focus sur la correction
      // pour qu'un lecteur d'écran la lise sans avoir à la chercher.
      retour.setAttribute('tabindex', '-1');
      retour.focus({ preventScroll: true });

      const suite = document.createElement('button');
      suite.type = 'button';
      if (!dernier) {
        suite.className = 'bouton pred-suite';
        suite.textContent = 'Question suivante';
        suite.addEventListener('click', function () { i++; poser(); });
      } else {
        suite.className = 'pred-lien pred-suite';
        suite.textContent = 'Réduire';
        suite.addEventListener('click', function () { replier(true); });
      }
      retour.appendChild(suite);
    }

    function libelle(q, bonne) {
      if (q.type === 'numerique') {
        return '<strong>' + Econ.nb(bonne, q.decimales !== undefined ? q.decimales : 2) +
               (q.unite ? ' ' + q.unite : '') + '</strong>';
      }
      return '<strong>' + q.options[bonne] + '</strong>';
    }
  }

  /* ------------------------------------------------------------------ */
  /* Mention de transparence, ajoutée au pied de page commun             */
  /* ------------------------------------------------------------------ */

  function poserMention() {
    if (!SITE_MESURE) return;                       // rien compté, rien à dire
    const f = document.querySelector('footer');
    if (!f || f.querySelector('.pred-mention')) return;
    const s = document.createElement('span');
    s.className = 'pred-mention';
    s.innerHTML = 'Visites et réponses comptées de façon anonyme, sans témoin ni ' +
                  'renseignement personnel, pour améliorer le cours. ' +
                  '<a href="https://www.goatcounter.com/help/privacy" ' +
                  'rel="noopener noreferrer" target="_blank">Détails</a>.';
    f.appendChild(s);
  }

  // Les outils construisent leur pied de page avec Econ.pied() ; la page
  // d'accueil, elle, écrit le sien directement dans le HTML. On couvre les
  // deux cas, et poserMention() se garde d'écrire deux fois.
  if (typeof Econ !== 'undefined' && Econ.pied) {
    const piedOrig = Econ.pied;
    Econ.pied = function () { piedOrig(); poserMention(); };
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', poserMention);
  } else {
    poserMention();
  }

  return {
    init: init,
    compter: compter,
    outil: outil,
    // Vrai tant que la première série de questions n'est pas finie. Les pages
    // s'en servent pour masquer les annotations du graphique qui donneraient
    // une réponse : visible devient « … && !Pred.retenu() ».
    retenu: function () { return retenu; }
  };
})();
