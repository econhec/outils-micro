/* Régressions des scripts HTML réels, sans dépendance externe.
   Seuls les contrôles et le tracé sont simulés ; les questions, calculs et
   textes de résultats sont exécutés depuis les pages. Le rendu DOM est
   vérifié séparément par navigateur.js (Playwright facultatif). */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function charger(racine, fichier) {
  const ctx = vm.createContext({ console, document: { getElementById: () => ({}) } });
  const Econ = vm.runInContext(fs.readFileSync(path.join(racine, 'commun/econ.js'), 'utf8') + '; Econ;', ctx);
  const curseurs = [], menus = [], valeurs = {}, objets = [];
  let questions;
  function objet(type, args, attrs) {
    const o = { type, attrs: attrs || {}, defaultTicks: { setAttribute() {} },
      dataX: [], dataY: [], on() {}, setAttribute(a) { Object.assign(this.attrs, a); },
      X: () => typeof args[0] === 'function' ? args[0]() : args[0],
      Y: () => typeof args[1] === 'function' ? args[1]() : args[1],
      moveTo(xy) { args = xy; } };
    objets.push(o); return o;
  }
  const board = { attr: {}, create: objet, update() {}, on() {},
    setBoundingBox() {}, getBoundingBox: () => [-5, 130, 130, -5] };
  function controle(opt) {
    let v = opt.valeur;
    return { element: { parentNode: { style: {} } }, valeur: () => v,
      fixer(x) { v = x; }, changer(x) { v = x; if (opt.surChangement) opt.surChangement(); } };
  }
  Econ.board = () => board;
  Econ.curseur = (_, opt) => { const c = controle(opt); curseurs.push(c); return c; };
  Econ.choix = (_, opt) => { const c = controle(opt); menus.push(c); return c; };
  Econ.bascule = (_, opt) => controle({ valeur: opt.coche });
  Econ.resultats = () => ({ fixer: (cle, v) => { valeurs[cle] = v; } });
  Econ.boutonReinit = Econ.pied = Econ.texte = Econ.zone = Econ.pointOptimal = () => {};
  Econ.courbeIndiff = () => objet('curve', [], {});
  ctx.Pred = { init(q) { questions = q; } };
  const html = fs.readFileSync(path.join(racine, fichier), 'utf8');
  for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
    if (m[1].trim()) vm.runInContext(m[1], ctx, { filename: fichier });
  }
  return { valeurs, questions, objets, curseurs,
    regler: values => values.forEach((v, i) => curseurs[i].changer(v)),
    famille: f => menus[0].changer(f),
    point: xy => objets.find(o => o.type === 'glider').moveTo(xy),
    reponse: n => questions[n - 1].reponse() };
}

module.exports = function (racine, verifier) {
  const proche = (a, b) => Math.abs(a - b) < 1e-8;
  const co = charger(racine, 'choix-optimal.html');
  const cas = [
    ['cobb', .5, 5, 4, 100, [10,12.5], 0, 1, '1,25'],
    ['ces', .5, 5, 4, 100, null, 0, 1, '1,25'],
    ['compl', .5, 5, 4, 100, [100/9,100/9], 3, 1, 'non défini'],
    ['subs', .5, 5, 4, 100, [0,25], 1, 2, '1,00'],
    ['subs', .5, 4, 4, 100, [12.5,12.5], 0, 1, '1,00'],
    ['quasi', 6, 5, 4, 100, [4.8,19], 0, 1, '1,25'],
    ['quasi', 12, 5, 10, 60, [12,0], 2, 1, '1,00']
  ];
  for (const [f, a, px, py, rev, xy, relation, direction, tms] of cas) {
    co.famille(f); co.regler([a,-1,px,py,rev]);
    const tag = f + ' ' + [a,px,py,rev].join('/');
    verifier(tag + ' : relation TMS/prix', co.reponse(2) === relation);
    verifier(tag + ' : hausse de prix', co.reponse(3) === direction);
    verifier(tag + ' : TMS affiché', co.valeurs.tms.includes(tms));
    if (xy) {
      co.point(xy);
      verifier(tag + ' : aucune amélioration au panier optimal', co.reponse(1) === 2);
      co.curseurs[4].changer(rev);
      verifier(tag + ' : panneau reconnaît optimum ou coin', /optimum|aucun échange/.test(co.valeurs.point));
    }
  }
  co.famille('compl'); co.regler([.5,-1,5,4,100]);
  for (const [xy, expected] of [[[5,18.75],0],[[15,6.25],1]]) {
    co.point(xy); verifier('compléments : amélioration hors coude', co.reponse(1) === expected);
  }
  co.famille('subs'); co.regler([.5,-1,2,4,100]); co.point([50,0]);
  verifier('substituts : coin X seul', co.reponse(1) === 2 && co.reponse(2) === 2);
  verifier('co-q3 : scénario explicite', /25 %/.test(co.questions[2].texte));
  verifier('co-q3 : effet nul des compléments et domaine quasi linéaire',
    /hicksien est nul/.test(co.questions[2].explication) && /régime intérieur/.test(co.questions[2].explication));

  const mo = charger(racine, 'monopole.html');
  for (const [A,c,q1,q2,ps] of [[14,20,3,3,0],[14,14,3,3,0],[24,6,0,2,27],[24,0,2,2,48],[14,13.5,0,2,1/48]]) {
    mo.regler([A,1.5,c,0]);
    const tag = 'monopole A=' + A + ' c=' + c;
    verifier(tag + ' : élasticité ou inactivité', mo.reponse(1) === q1);
    verifier(tag + ' : incidence ou inactivité', mo.reponse(2) === q2);
    verifier(tag + ' : perte sèche', proche(mo.reponse(3), ps));
    if (c >= A) {
      for (const cle of ['pM','moit','L','eps']) verifier(tag + ' : ' + cle + ' sans interprétation active', mo.valeurs[cle] === '—');
      const ptM = mo.objets.find(o => o.attrs.name === 'M');
      verifier(tag + ' : point M masqué', ptM.attrs.visible() === false);
    }
  }
  verifier('monopole : condition de taxe dans la question', /&lt; <em>A<\/em> − <em>c<\/em>/.test(mo.questions[1].texte));
  verifier('monopole : perte sèche bornée dans la correction', /max\(A − c, 0\)/.test(mo.questions[2].explication));
};

if (require.main === module) {
  let n = 0, echecs = 0;
  module.exports(path.resolve(process.argv[2] || path.join(__dirname, '..')), (nom, ok) => {
    n++; if (!ok) { echecs++; console.error('ECHEC ' + nom); }
  });
  console.log(n + ' régressions des pages, ' + echecs + ' échec(s).');
  process.exitCode = echecs ? 1 : 0;
}
