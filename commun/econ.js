/* econ.js — fonctions communes aux outils interactifs d'ECON 20851.
   Aucune dépendance sauf JSXGraph (chargé avant ce fichier).

   Trois familles de fonctions :
     Econ.nb / Econ.curseur / Econ.bascule / Econ.choix  — interface
     Econ.pref.<famille>                                  — préférences et demandes
     Econ.board / Econ.courbeIndiff / Econ.droiteBudget   — tracé
*/

const Econ = (function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Couleurs                                                            */
  /* JSXGraph écrit ces valeurs dans des attributs SVG, qui ne résolvent  */
  /* pas les variables CSS : il faut des couleurs littérales ici. Elles   */
  /* reprennent celles de article/preambule.tex.                          */
  /* ------------------------------------------------------------------ */

  const COUL = {
    titre:   '#1c3e66',  // bleu foncé (titrecouleur)
    accent:  '#468c96',  // turquoise (plusfr)
    indiff:  '#1c3e66',  // courbes d'indifférence
    budget:  '#b0342d',  // contrainte budgétaire
    second:  '#2e7d32',  // deuxième courbe / situation comparée
    tiers:   '#8e44ad',  // troisième objet (compensation, etc.)
    gris:    '#888'
  };

  /* ------------------------------------------------------------------ */
  /* Affichage des nombres (virgule décimale, comme dans les notes)      */
  /* ------------------------------------------------------------------ */

  let compteurId = 0;   // pour relier chaque libellé à sa commande

  function nb(x, d) {
    if (d === undefined) d = 2;
    if (!isFinite(x)) return '—';
    let s = x.toFixed(d);
    if (/^-0(,|\.)?0*$/.test(s.replace('.', ','))) s = s.slice(1);  // pas de « -0,00 »
    return s.replace('.', ',').replace(/-/g, '−');             // vrai signe moins
  }

  /* ------------------------------------------------------------------ */
  /* Fabriques de commandes                                              */
  /* ------------------------------------------------------------------ */

  // Crée un curseur ; renvoie un objet { valeur(), fixer(v), element }.
  function curseur(hote, opt) {
    const bloc = document.createElement('div');
    bloc.className = 'curseur';

    const lab = document.createElement('label');
    const nom = document.createElement('span');
    nom.innerHTML = opt.etiquette;
    const val = document.createElement('span');
    val.className = 'valeur';
    lab.appendChild(nom);
    lab.appendChild(val);

    const inp = document.createElement('input');
    inp.type = 'range';
    inp.min = opt.min;
    inp.max = opt.max;
    inp.step = opt.pas !== undefined ? opt.pas : 0.01;
    inp.value = opt.valeur;

    // Relie le libellé au curseur : sans cela un lecteur d'écran annonce
    // « curseur, 0,5 » sans dire de quoi, et cliquer le libellé ne fait rien.
    inp.id = 'c' + (++compteurId);
    lab.htmlFor = inp.id;

    bloc.appendChild(lab);
    bloc.appendChild(inp);
    (typeof hote === 'string' ? document.getElementById(hote) : hote).appendChild(bloc);

    const dec = opt.decimales !== undefined ? opt.decimales : 2;
    function afficher() {
      val.textContent = opt.format ? opt.format(parseFloat(inp.value))
                                   : nb(parseFloat(inp.value), dec);
    }
    afficher();

    inp.addEventListener('input', function () {
      afficher();
      if (opt.surChangement) opt.surChangement(parseFloat(inp.value));
    });

    return {
      element: inp,
      valeur: function () { return parseFloat(inp.value); },
      // On ramène la valeur dans la plage et sur le pas avant de l'écrire.
      // Sinon le navigateur le fait en silence et l'appelant croit avoir posé
      // une valeur que le curseur ne porte pas — c'est ainsi qu'un point
      // déplaçable et son curseur finissaient par se contredire.
      fixer: function (v) {
        const min = parseFloat(inp.min), max = parseFloat(inp.max);
        const pas = parseFloat(inp.step);
        let x = Math.min(max, Math.max(min, v));
        if (isFinite(pas) && pas > 0) x = min + Math.round((x - min) / pas) * pas;
        inp.value = x;
        afficher();
      }
    };
  }

  // Case à cocher.
  function bascule(hote, opt) {
    const bloc = document.createElement('label');
    bloc.className = 'bascule';
    const inp = document.createElement('input');
    inp.type = 'checkbox';
    inp.checked = !!opt.coche;
    const txt = document.createElement('span');
    txt.innerHTML = opt.etiquette;
    bloc.appendChild(inp);
    bloc.appendChild(txt);
    (typeof hote === 'string' ? document.getElementById(hote) : hote).appendChild(bloc);

    inp.addEventListener('change', function () {
      if (opt.surChangement) opt.surChangement(inp.checked);
    });
    return {
      element: inp,
      valeur: function () { return inp.checked; },
      fixer: function (v) { inp.checked = v; }
    };
  }

  // Menu déroulant. options = [[valeur, libellé], ...]
  function choix(hote, opt) {
    const bloc = document.createElement('div');
    bloc.className = 'choix';
    const lab = document.createElement('label');
    lab.innerHTML = opt.etiquette;
    const sel = document.createElement('select');
    sel.id = 'm' + (++compteurId);
    lab.htmlFor = sel.id;
    opt.options.forEach(function (o) {
      const el = document.createElement('option');
      el.value = o[0];
      el.textContent = o[1];
      sel.appendChild(el);
    });
    sel.value = opt.valeur;
    bloc.appendChild(lab);
    bloc.appendChild(sel);
    (typeof hote === 'string' ? document.getElementById(hote) : hote).appendChild(bloc);

    sel.addEventListener('change', function () {
      if (opt.surChangement) opt.surChangement(sel.value);
    });
    return {
      element: sel,
      valeur: function () { return sel.value; },
      fixer: function (v) { sel.value = v; }
    };
  }

  // Bouton « Réinitialiser ».
  function boutonReinit(hote, surClic) {
    const b = document.createElement('button');
    b.className = 'reinit';
    b.textContent = 'Réinitialiser';
    b.addEventListener('click', surClic);
    (typeof hote === 'string' ? document.getElementById(hote) : hote).appendChild(b);
    return b;
  }

  // Zone de lecture des résultats : Econ.resultats('cmd', ['X*', 'Y*']) puis .fixer('X*', '3,25')
  function resultats(hote, lignes) {
    const bloc = document.createElement('div');
    bloc.className = 'resultats';
    const refs = {};
    lignes.forEach(function (l) {
      const cle = typeof l === 'string' ? l : l[0];
      const lib = typeof l === 'string' ? l : l[1];
      const d = document.createElement('div');
      const s = document.createElement('span');
      s.innerHTML = lib + ' : ';   // espace insécable : le « : » ne part pas seul à la ligne
      const v = document.createElement('span');
      v.className = 'nb';
      v.textContent = '—';
      d.appendChild(s);
      d.appendChild(v);
      bloc.appendChild(d);
      refs[cle] = v;
    });
    (typeof hote === 'string' ? document.getElementById(hote) : hote).appendChild(bloc);
    return {
      fixer: function (cle, texte) { if (refs[cle]) refs[cle].innerHTML = texte; }
    };
  }

  /* ------------------------------------------------------------------ */
  /* Préférences : utilité, TMS, demandes marshalliennes                 */
  /*                                                                     */
  /* Chaque famille expose :                                             */
  /*   u(X, Y, p)        utilité                                         */
  /*   tms(X, Y, p)      TMS (valeur absolue de la pente, > 0)           */
  /*   yIndiff(X, u, p)  Y tel que u(X,Y) = u   (null si hors domaine)   */
  /*   demande(pX,pY,I,p) -> {X, Y}                                      */
  /*   nom, params                                                       */
  /* p = objet de paramètres, typiquement {a: 0.5, r: ...}               */
  /* ------------------------------------------------------------------ */

  const pref = {

    // Cobb-Douglas : u = X^a · Y^(1-a)
    cobb: {
      nom: 'Cobb-Douglas',
      u: function (X, Y, p) {
        if (X <= 0 || Y <= 0) return 0;
        return Math.pow(X, p.a) * Math.pow(Y, 1 - p.a);
      },
      tms: function (X, Y, p) {
        if (X <= 0) return Infinity;
        return (p.a / (1 - p.a)) * (Y / X);
      },
      yIndiff: function (X, u, p) {
        if (X <= 0 || u <= 0) return null;
        return Math.pow(u / Math.pow(X, p.a), 1 / (1 - p.a));
      },
      demande: function (pX, pY, I, p) {
        return { X: p.a * I / pX, Y: (1 - p.a) * I / pY };
      },
      // Dépense minimale pour atteindre u (fonction de dépense).
      depense: function (pX, pY, u, p) {
        const a = p.a;
        return u * Math.pow(pX / a, a) * Math.pow(pY / (1 - a), 1 - a);
      },
      // Demande hicksienne (compensée).
      hicks: function (pX, pY, u, p) {
        const e = pref.cobb.depense(pX, pY, u, p);
        return { X: p.a * e / pX, Y: (1 - p.a) * e / pY };
      }
    },

    // Substituts parfaits : u = a·X + (1-a)·Y
    subs: {
      nom: 'substituts parfaits',
      u: function (X, Y, p) { return p.a * X + (1 - p.a) * Y; },
      tms: function (X, Y, p) { return p.a / (1 - p.a); },
      yIndiff: function (X, u, p) {
        const Y = (u - p.a * X) / (1 - p.a);
        return Y >= 0 ? Y : null;
      },
      demande: function (pX, pY, I, p) {
        const rX = p.a / pX, rY = (1 - p.a) / pY;
        if (rX > rY) return { X: I / pX, Y: 0 };
        if (rY > rX) return { X: 0, Y: I / pY };
        return { X: I / (2 * pX), Y: I / (2 * pY) }; // indifférent : point médian
      }
    },

    // Compléments parfaits : u = min(X/a, Y/(1-a))
    compl: {
      nom: 'compléments parfaits',
      u: function (X, Y, p) { return Math.min(X / p.a, Y / (1 - p.a)); },
      // Sur la branche horizontale, une unité de X de plus n'apporte rien :
      // UMx = 0, donc TMS = 0. Sur la verticale, c'est l'inverse. Seul le
      // coude lui-même n'a pas de tangente.
      tms: function (X, Y, p) {
        const cX = X / p.a, cY = Y / (1 - p.a);
        if (Math.abs(cX - cY) < 1e-9) return NaN;   // au coude
        return cX > cY ? 0 : Infinity;
      },
      // Le L complet : le coude est en (a·u, (1-a)·u).
      coude: function (u, p) { return { X: p.a * u, Y: (1 - p.a) * u }; },
      yIndiff: function (X, u, p) {
        if (X < p.a * u) return null;
        return (1 - p.a) * u;
      },
      demande: function (pX, pY, I, p) {
        const k = I / (p.a * pX + (1 - p.a) * pY);
        return { X: p.a * k, Y: (1 - p.a) * k };
      }
    },

    // Quasi linéaire : u = a·ln(X) + Y
    quasi: {
      nom: 'quasi linéaire',
      u: function (X, Y, p) {
        if (X <= 0) return -Infinity;
        return p.a * Math.log(X) + Y;
      },
      tms: function (X, Y, p) { return X > 0 ? p.a / X : Infinity; },
      yIndiff: function (X, u, p) {
        if (X <= 0) return null;
        const Y = u - p.a * Math.log(X);
        return Y >= 0 ? Y : null;
      },
      demande: function (pX, pY, I, p) {
        let X = p.a * pY / pX;
        if (pX * X > I) X = I / pX;           // solution en coin
        return { X: X, Y: (I - pX * X) / pY };
      }
    },

    // CES : u = (a·X^r + (1-a)·Y^r)^(1/r), élasticité de substitution 1/(1-r)
    // En r = 0 la formule se casse (1/r infini, et Math.pow(1, Infinity) vaut
    // NaN en JavaScript) alors que la limite existe : c'est Cobb-Douglas. On
    // bascule donc sur cobb au voisinage de zéro, comme on le fait pour la
    // CRRA en sigma = 1.
    ces: {
      nom: 'CES',
      estCobb: function (p) { return Math.abs(p.r) < 1e-6; },
      u: function (X, Y, p) {
        if (X <= 0 || Y <= 0) return 0;
        if (pref.ces.estCobb(p)) return pref.cobb.u(X, Y, p);
        return Math.pow(p.a * Math.pow(X, p.r) + (1 - p.a) * Math.pow(Y, p.r), 1 / p.r);
      },
      tms: function (X, Y, p) {
        if (X <= 0 || Y <= 0) return Infinity;
        if (pref.ces.estCobb(p)) return pref.cobb.tms(X, Y, p);
        return (p.a / (1 - p.a)) * Math.pow(X / Y, p.r - 1);
      },
      yIndiff: function (X, u, p) {
        if (X <= 0 || u <= 0) return null;
        if (pref.ces.estCobb(p)) return pref.cobb.yIndiff(X, u, p);
        const reste = (Math.pow(u, p.r) - p.a * Math.pow(X, p.r)) / (1 - p.a);
        if (reste <= 0) return null;
        return Math.pow(reste, 1 / p.r);
      },
      demande: function (pX, pY, I, p) {
        if (pref.ces.estCobb(p)) return pref.cobb.demande(pX, pY, I, p);
        const s = 1 / (1 - p.r);                       // élasticité de substitution
        const ratio = Math.pow(p.a * pY / ((1 - p.a) * pX), s);  // X/Y à l'optimum
        const Y = I / (pX * ratio + pY);
        return { X: ratio * Y, Y: Y };
      }
    }
  };

  /* ------------------------------------------------------------------ */
  /* Tracé                                                               */
  /* ------------------------------------------------------------------ */

  // Marque d'une classe CSS tout point que l'étudiant peut saisir, pour que le
  // curseur change au survol et que l'animation l'épargne. Appelé une fois par
  // tableau, après que la page a fini de créer ses objets.
  function marquerDeplacables(b) {
    let n = 0;
    for (const k in b.objects) {
      const o = b.objects[k];
      if (!o.rendNode || o.elementClass !== JXG.OBJECT_CLASS_POINT) continue;
      // Même test que JSXGraph lui-même au début d'un déplacement : getAttribute
      // renvoie la valeur brute (qui peut être 'inherit' ou une fonction), donc
      // on lit la visibilité calculée et on évalue `fixed`.
      const visible = !!(o.visPropCalc && o.visPropCalc.visible);
      const fige = o.evalVisProp ? o.evalVisProp('fixed') : o.getAttribute('fixed');
      const saisissable = visible && o.isDraggable && !fige;
      if (saisissable !== o.rendNode.classList.contains('deplacable')) {
        o.rendNode.classList.toggle('deplacable', saisissable);
      }
      if (saisissable) n++;
    }
    return n;
  }

  // Place une étiquette SUR une courbe, à la fraction t de son tracé, pour que
  // le nom de l'objet soit lu au même endroit que l'objet lui-même.
  // La courbe doit être construite avec updateDataArray (dataX/dataY peuplés).
  function etiquetteSurCourbe(b, courbe, tArg, contenu, opt) {
    opt = opt || {};
    // Position interpolée le long des points réellement tracés : cela marche
    // aussi bien pour une courbe échantillonnée en 240 points que pour un
    // segment qui n'en a que deux (les portions hors cadre valent NaN).
    function pos() {
      // t accepte une fonction : une étiquette peut ainsi fuir une zone
      // encombrée selon les réglages courants.
      const t = typeof tArg === 'function' ? tArg() : tArg;
      const xs = courbe.dataX, ys = courbe.dataY;
      if (!xs || !xs.length) return null;
      const bons = [];
      for (let i = 0; i < xs.length; i++) {
        if (isFinite(xs[i]) && isFinite(ys[i])) bons.push(i);
      }
      if (!bons.length) return null;
      if (bons.length === 1) return [xs[bons[0]], ys[bons[0]]];
      const cible = Math.min(bons.length - 1.0001, Math.max(0, t * (bons.length - 1)));
      const lo = bons[Math.floor(cible)], hi = bons[Math.floor(cible) + 1];
      const f = cible - Math.floor(cible);
      return [xs[lo] + f * (xs[hi] - xs[lo]), ys[lo] + f * (ys[hi] - ys[lo])];
    }
    // Quand la courbe n'a rien à montrer, on masque l'étiquette au lieu de
    // l'expédier hors cadre : un texte téléporté resterait dans le DOM, donc
    // sélectionnable et lu par les outils d'accessibilité.
    return texte(b,
      function () { const p = pos(); return p ? p[0] : 0; },
      function () { const p = pos(); return p ? p[1] : 0; },
      contenu,
      Object.assign({
        fontSize: 13,
        anchorX: 'middle',
        anchorY: 'bottom',
        visible: function () { return pos() !== null; },
        cssStyle: 'font-family: Georgia, serif; text-shadow: 0 0 3px #fff, 0 0 3px #fff, 0 0 2px #fff;'
      }, opt));
  }

  // Crée un tableau JSXGraph aux réglages communs.
  // bornes = [xmin, ymax, xmax, ymin] (convention JSXGraph)
  function board(id, bornes, opt) {
    opt = opt || {};
    const b = JXG.JSXGraph.initBoard(id, {
      boundingbox: bornes,
      axis: false,
      keepaspectratio: false,
      showCopyright: false,
      showNavigation: false,
      pan: { enabled: false },
      zoom: { enabled: false },
      grid: false
    });
    // Zones de saisie généreuses : attraper un point à la souris, et surtout au
    // doigt, ne doit pas demander de viser. `precision` n'est pas un attribut
    // d'initialisation — il faut l'écrire dans les options après coup.
    // (Défauts de JSXGraph : mouse 4, touch 30.)
    // On ne touche pas à `hasPoint` : JSXGraph l'écrase à chaque événement avec
    // precision[périphérique] — c'est une variable de travail, pas un réglage.
    // `touch` reste modéré : JSXGraph gèle le déplacement dans une bordure de
    // largeur touch/3, donc une valeur trop forte crée une bande morte au bord.
    Object.assign(b.options.precision, { mouse: 12, touch: 38, pen: 12 });
    // Après la construction de la page, puis à chaque mise à jour (une bascule
    // peut rendre déplaçable un point créé invisible), on signale ce qui bouge.
    setTimeout(function () { marquerDeplacables(b); }, 0);
    b.on('update', function () { marquerDeplacables(b); });
    if (opt.axes !== false) {
      const style = {
        strokeColor: '#444', strokeWidth: 1, highlight: false, fixed: true,
        ticks: {
          insertTicks: false,
          ticksDistance: opt.pasGrad || 1,
          minorTicks: 0,
          drawLabels: opt.graduations !== false,
          label: { fontSize: 11, offset: [0, -12] },
          strokeColor: '#999'
        }
      };
      b.create('axis', [[0, 0], [1, 0]], Object.assign({}, style, {
        name: opt.nomX || '', withLabel: !!opt.nomX,
        label: { position: 'rt', offset: [-8, 16], fontSize: 14, anchorX: 'right' }
      }));
      b.create('axis', [[0, 0], [0, 1]], Object.assign({}, style, {
        name: opt.nomY || '', withLabel: !!opt.nomY,
        label: { position: 'rt', offset: [14, -8], fontSize: 14 },
        ticks: Object.assign({}, style.ticks, {
          ticksDistance: opt.pasGradY || opt.pasGrad || 1,
          label: { fontSize: 11, offset: [-16, 0] }
        })
      }));
    }
    return b;
  }

  // Courbe d'indifférence passant par (X0, Y0), tracée comme fonction de X.
  // fam = objet de Econ.pref ; renvoie l'objet courbe JSXGraph.
  function courbeIndiff(b, fam, p, niveau, opt) {
    opt = opt || {};
    // Bornes lues à chaque redessin, et non figées à la création : un outil
    // dont le cadre bouge (setBoundingBox) doit pouvoir passer des fonctions.
    const val = function (v, defaut) {
      return typeof v === 'function' ? v() : (v !== undefined ? v : defaut());
    };
    const fxmax = function () { return val(opt.xmax, function () { return b.getBoundingBox()[2]; }); };
    const fymax = function () { return val(opt.ymax, function () { return b.getBoundingBox()[1]; }); };
    const fxmin = function () { return val(opt.xmin, function () { return 0.001; }); };

    const c = b.create('curve', [[], []], Object.assign({
      strokeColor: COUL.indiff,
      strokeWidth: 2,
      highlight: false,
      fixed: true
    }, opt.style || {}));

    c.updateDataArray = function () {
      // fam, p et niveau acceptent une valeur ou une fonction qui la renvoie.
      const F = typeof fam === 'function' ? fam() : fam;
      const u = typeof niveau === 'function' ? niveau() : niveau;
      const par = typeof p === 'function' ? p() : p;
      const xs = [], ys = [];
      const xmax = fxmax(), ymax = fymax(), xmin = fxmin();

      // Les compléments parfaits ne sont pas une fonction de X : leur courbe
      // est un L. On la trace en deux segments, sinon il ne reste que la
      // branche horizontale et le coude disparaît.
      if (F.coude && u > 0) {
        const k = F.coude(u, par);
        if (k.X <= xmax) {
          // Les deux branches s'arrêtent au bord du cadre : inutile de
          // produire des points que le cadre masque de toute façon.
          this.dataX = [k.X, k.X, xmax];
          this.dataY = [ymax, k.Y, k.Y];
          return;
        }
        this.dataX = []; this.dataY = [];
        return;
      }

      const n = 260;
      for (let i = 0; i <= n; i++) {
        const X = xmin + (xmax - xmin) * i / n;
        const Y = F.yIndiff(X, u, par);
        if (Y === null || !isFinite(Y) || Y > ymax * 1.6) {
          // On coupe la courbe plutôt que de la faire sortir du cadre.
          if (xs.length && !isNaN(xs[xs.length - 1])) { xs.push(NaN); ys.push(NaN); }
          continue;
        }
        xs.push(X); ys.push(Y);
      }
      this.dataX = xs;
      this.dataY = ys;
    };
    if (opt.etiquette) {
      etiquetteSurCourbe(b, c, opt.etiquettePos !== undefined ? opt.etiquettePos : 0.7,
        opt.etiquette, Object.assign({
          cssStyle: 'font-family: Georgia, serif; text-shadow: 0 0 3px #fff, 0 0 3px #fff, 0 0 2px #fff; color: ' +
                    ((opt.style && opt.style.strokeColor) || COUL.indiff) + ';'
        }, opt.etiquetteStyle || {}));
    }
    return c;
  }

  // Droite de budget pX·X + pY·Y = I, bornée au quadrant positif.
  function droiteBudget(b, pX, pY, I, opt) {
    opt = opt || {};
    const c = b.create('curve', [[], []], Object.assign({
      strokeColor: COUL.budget,
      strokeWidth: 2,
      highlight: false,
      fixed: true
    }, opt.style || {}));

    c.updateDataArray = function () {
      const a = typeof pX === 'function' ? pX() : pX;
      const bb = typeof pY === 'function' ? pY() : pY;
      const R = typeof I === 'function' ? I() : I;
      this.dataX = [0, R / a];
      this.dataY = [R / bb, 0];
    };
    return c;
  }

  // Point mis en évidence, avec projections en pointillé sur les deux axes.
  function pointOptimal(b, fx, fy, opt) {
    opt = opt || {};
    const P = b.create('point', [fx, fy], Object.assign({
      name: opt.nom || '',
      size: 4,
      strokeColor: '#fff',
      strokeWidth: 1.5,
      fillColor: COUL.titre,
      fixed: true,
      highlight: false,
      label: { fontSize: 14, offset: [8, 10] }
    }, opt.style || {}));

    if (opt.projections !== false) {
      const st = {
        strokeColor: '#888', strokeWidth: 1, dash: 2,
        highlight: false, fixed: true, straightFirst: false, straightLast: false
      };
      b.create('segment', [[0, function () { return P.Y(); }], P], st);
      b.create('segment', [[function () { return P.X(); }, 0], P], st);
    }
    return P;
  }

  // Étiquette de texte légère.
  function texte(b, x, y, contenu, opt) {
    return b.create('text', [x, y, contenu], Object.assign({
      fontSize: 13,
      cssStyle: 'font-family: Georgia, serif;',
      highlight: false,
      fixed: true
    }, opt || {}));
  }

  // Polygone de remplissage défini par une liste de sommets (fonction).
  function zone(b, sommetsFn, opt) {
    opt = opt || {};
    const c = b.create('curve', [[], []], Object.assign({
      strokeWidth: 0,
      fillColor: opt.couleur || '#468c96',
      fillOpacity: opt.opacite !== undefined ? opt.opacite : 0.22,
      highlight: false,
      fixed: true
    }, opt.style || {}));
    c.updateDataArray = function () {
      const s = sommetsFn();
      this.dataX = s.map(function (q) { return q[0]; });
      this.dataY = s.map(function (q) { return q[1]; });
      if (s.length) { this.dataX.push(s[0][0]); this.dataY.push(s[0][1]); }
    };
    return c;
  }

  /* ------------------------------------------------------------------ */
  /* Divers                                                              */
  /* ------------------------------------------------------------------ */

  // Recherche de racine par bissection (utilisée pour VC/VE et les seuils).
  // Renvoie null si l'intervalle n'encadre pas de racine : sans ce contrôle,
  // la boucle pousse lo jusqu'à hi et rend une borne comme si c'était la
  // solution — une valeur fausse impossible à distinguer d'une bonne.
  function bissection(f, lo, hi, tol, iterMax) {
    tol = tol || 1e-9;
    iterMax = iterMax || 200;
    let flo = f(lo);
    const fhi = f(hi);
    if (!isFinite(flo) || !isFinite(fhi)) return null;
    if (flo === 0) return lo;
    if (fhi === 0) return hi;
    if ((flo < 0) === (fhi < 0)) return null;
    for (let i = 0; i < iterMax; i++) {
      const mid = (lo + hi) / 2;
      const fmid = f(mid);
      if (Math.abs(fmid) < tol || (hi - lo) / 2 < tol) return mid;
      if ((flo < 0) === (fmid < 0)) { lo = mid; flo = fmid; } else { hi = mid; }
    }
    return (lo + hi) / 2;
  }

  // Pied de page commun (lien de retour + mention du cours).
  function pied() {
    const f = document.createElement('footer');
    f.innerHTML = '<span><a href="index.html">← Tous les outils</a></span>' +
                  '<span>ECON 20851 — Microéconomie intermédiaire</span>';
    document.body.appendChild(f);
  }

  return {
    COUL: COUL,
    nb: nb,
    curseur: curseur,
    bascule: bascule,
    choix: choix,
    boutonReinit: boutonReinit,
    resultats: resultats,
    pref: pref,
    board: board,
    courbeIndiff: courbeIndiff,
    droiteBudget: droiteBudget,
    pointOptimal: pointOptimal,
    texte: texte,
    zone: zone,
    bissection: bissection,
    etiquetteSurCourbe: etiquetteSurCourbe,
    marquerDeplacables: marquerDeplacables,
    pied: pied
  };
})();
