/* controles.js — les contrôles proprement dits, indépendants du navigateur.

   Utilisé par test/verifie.html (double-clic, rien à installer) et par
   test/verifie.js (Node, pour une intégration continue éventuelle). Ne fait
   aucune entrée-sortie : on lui passe Econ et une fonction `verifier`.

   Ce qui est vérifié :
     1. les formes closes de Cobb-Douglas dans econ.js, contre un calcul
        indépendant, sur une grille de paramètres ;
     2. les propriétés que supposent les questions de prédiction de
        marshall-hicks — non pas aux réglages par défaut, mais partout dans
        la plage des curseurs.

   Le point 2 est le cœur de l'affaire. Une bonne réponse calculée à
   l'exécution ne peut pas devenir fausse quand on change une valeur par
   défaut — c'est tout l'intérêt — mais la QUESTION, elle, peut être mal
   posée : admettre une autre réponse que celle attendue pour certains
   réglages. C'est ce que ces balayages cherchent à prendre en défaut.
*/

(function (racine) {
  'use strict';

  function controles(Econ, verifier) {
    const C = Econ.pref.cobb;

    function proche(a, b, tol) {
      return Math.abs(a - b) <= (tol || 1e-9) * Math.max(1, Math.abs(b));
    }

    /* -------------------------------------------------------------- */
    /* 1. Cobb-Douglas : formes closes contre calcul indépendant       */
    /* -------------------------------------------------------------- */

    for (let a = 0.15; a <= 0.851; a += 0.05) {
      for (let pX = 1; pX <= 12; pX += 1) {
        for (let pY = 1; pY <= 8; pY += 1) {
          for (let I = 50; I <= 150; I += 25) {
            const p = { a: a };
            const d = C.demande(pX, pY, I, p);

            verifier('le budget est épuisé',
              proche(pX * d.X + pY * d.Y, I), `a=${a.toFixed(2)} pX=${pX} pY=${pY} I=${I}`);

            verifier('la part du budget en X vaut a',
              proche(pX * d.X / I, a), `a=${a.toFixed(2)} pX=${pX}`);

            // La fonction de dépense inverse la demande : e(p, u(x*)) = I.
            const u = C.u(d.X, d.Y, p);
            verifier('e(p, u(x*)) = I',
              proche(C.depense(pX, pY, u, p), I), `a=${a.toFixed(2)} pX=${pX} I=${I}`);

            // Au prix initial, hicksienne et marshallienne coïncident.
            const h = C.hicks(pX, pY, u, p);
            verifier('hicksienne = marshallienne au prix initial',
              proche(h.X, d.X) && proche(h.Y, d.Y), `a=${a.toFixed(2)} pX=${pX}`);

            verifier('TMS = pX/pY à l\'optimum',
              proche(C.tms(d.X, d.Y, p), pX / pY), `a=${a.toFixed(2)} pX=${pX} pY=${pY}`);
          }
        }
      }
    }

    /* -------------------------------------------------------------- */
    /* 2. marshall-hicks : les trois questions sont-elles bien posées ? */
    /* -------------------------------------------------------------- */

    // Reprise exacte des grandeurs de la page.
    function scene(pX0, pX1, pY, I, a) {
      const p = { a: a };
      const A = C.demande(pX0, pY, I, p);
      const Cc = C.demande(pX1, pY, I, p);
      const u0 = C.u(A.X, A.Y, p);
      const B = C.hicks(pX1, pY, u0, p);
      return {
        A: A, B: B, Cc: Cc,
        xM: function (q) { return a * I / q; },
        xH: function (q) { return a * C.depense(q, pY, u0, p) / q; }
      };
    }

    // Plages réelles des curseurs de la page (pas compris).
    const PX0 = [4, 5, 6, 7, 8];
    const PX1 = [2, 3, 4, 5, 6, 7, 8, 9, 10];
    const PY = [3, 4, 5, 6];
    const REV = [80, 100, 120];
    const PART = [0.2, 0.35, 0.5, 0.65, 0.8];

    let combinaisons = 0;

    PX0.forEach(function (pX0) {
      PX1.forEach(function (pX1) {
        PY.forEach(function (pY) {
          REV.forEach(function (I) {
            PART.forEach(function (a) {
              combinaisons++;
              const s = scene(pX0, pX1, pY, I, a);
              const sub = s.B.X - s.A.X;
              const dp = pX1 - pX0;
              const contexte = `pX0=${pX0} pX1=${pX1} pY=${pY} I=${I} a=${a}`;

              // Q1 : l'effet de substitution est de signe opposé à la
              // variation de prix. C'est la seule garantie de la théorie ;
              // si elle tombait en défaut quelque part, la question serait
              // fausse pour ces réglages-là.
              if (Math.abs(dp) < 1e-12) {
                verifier('Q1 : prix inchangé, substitution nulle',
                  Math.abs(sub) < 1e-9, contexte);
              } else {
                verifier('Q1 : substitution de signe opposé à la variation de prix',
                  (sub > 0) === (dp < 0), contexte + ` sub=${sub.toFixed(4)}`);
              }

              // Q2 : la hicksienne est plus raide, donc elle se déplace
              // MOINS horizontalement pour la même variation de prix.
              // Mesuré comme dans la page, autour du prix initial.
              const h = 0.05;
              const dM = Math.abs(s.xM(pX0 + h) - s.xM(pX0 - h));
              const dH = Math.abs(s.xH(pX0 + h) - s.xH(pX0 - h));
              verifier('Q2 : la hicksienne est la plus raide des deux',
                dH < dM, contexte + ` dM=${dM.toFixed(5)} dH=${dH.toFixed(5)}`);

              // Q3 : l'effet total vaut aI(1/p1 − 1/p0), et la
              // décomposition boucle exactement.
              const total = s.Cc.X - s.A.X;
              verifier('Q3 : effet total = aI(1/p1 − 1/p0)',
                proche(total, a * I * (1 / pX1 - 1 / pX0)), contexte);
              verifier('Q3 : substitution + revenu = effet total',
                proche(sub + (s.Cc.X - s.B.X), total), contexte);
            });
          });
        });
      });
    });

    /* -------------------------------------------------------------- */
    /* 3. monopole : les trois questions sont-elles bien posées ?       */
    /*                                                                  */
    /* Reprise des formules de la page (demande linéaire p = A − BY,    */
    /* coût C = F + cY), balayées sur les plages réelles des curseurs.  */
    /* La question 1 a une bonne réponse qui change avec les réglages : */
    /* |η| = (A + c)/(A − c) vaut exactement 1 en c = 0 (« unitaire »)  */
    /* et dépasse 1 partout ailleurs (« élastique »). Le balayage       */
    /* vérifie que la logique de la question suit fidèlement ce partage */
    /* et que « inélastique » n'est jamais la bonne réponse.            */
    /* -------------------------------------------------------------- */

    let combMono = 0;

    function moScene(A, B, c) {
      const ecart = Math.max(A - c, 0);
      const YM = ecart / (2 * B);
      const pM = A - B * YM;
      const YT = ecart / B;
      const PS = 0.5 * (YT - YM) * (pM - c);
      const pMde = function (cc) {
        const e = Math.max(A - cc, 0);
        return A - B * (e / (2 * B));
      };
      return { YM: YM, pM: pM, YT: YT, PS: PS, pMde: pMde };
    }

    for (let A = 14; A <= 30; A += 1) {
      for (let B = 0.5; B <= 3.001; B += 0.1) {
        B = Math.round(B * 10) / 10;
        for (let c = 0; c <= 20; c += 0.5) {
          combMono++;
          const s = moScene(A, B, c);
          const ctx = `A=${A} B=${B} c=${c}`;

          if (c >= A) {
            // Le monopole ne produit rien : pas de surplus, pas de perte.
            verifier('mono : c ≥ A, perte sèche nulle', Math.abs(s.PS) < 1e-9, ctx);
            continue;
          }

          // Q1 : |η| à l'optimum vaut (A + c)/(A − c) — unitaire si c = 0,
          // élastique sinon, inélastique jamais.
          const eta = (1 / B) * (s.pM / s.YM);
          verifier('mono Q1 : |η| = (A+c)/(A−c)',
            proche(eta, (A + c) / (A - c), 1e-9), ctx);
          if (c === 0) {
            verifier('mono Q1 : élasticité unitaire en c = 0',
              Math.abs(eta - 1) < 1e-9, ctx);
          } else {
            verifier('mono Q1 : demande élastique dès que c > 0',
              eta > 1 + 1e-12, ctx + ` eta=${eta.toFixed(6)}`);
          }

          // Q2 : répercussion d'une taxe unitaire, mesurée comme dans la
          // page — toujours strictement en deçà du montant de la taxe, et
          // exactement la moitié pour cette demande linéaire.
          const d = Math.min(1, (A - c) / 4);
          verifier('mono Q2 : taxe laisse une production positive', d > 0 && c + d < A, ctx);
          const r = (s.pMde(c + d) - s.pMde(c)) / d;
          verifier('mono Q2 : répercussion < 1', r < 1 - 1e-12, ctx + ` r=${r.toFixed(4)}`);
          verifier('mono Q2 : répercussion = 1/2 (demande linéaire)',
            proche(r, 0.5, 1e-9), ctx);

          // Q3 : le triangle géométrique égale la forme close (A − c)²/(8B).
          verifier('mono Q3 : PS = (A−c)²/(8B)',
            proche(s.PS, Math.pow(A - c, 2) / (8 * B), 1e-9), ctx);
        }
      }
    }

    /* -------------------------------------------------------------- */
    /* 4. derivee-tangente : les trois questions du chapitre 1          */
    /*                                                                  */
    /* Les quatre fonctions de la page, avec leur dérivée analytique.   */
    /* On vérifie surtout deux choses : que la dérivée codée est bien   */
    /* la dérivée de la fonction codée (différences centrées), et que   */
    /* les propriétés invoquées par les questions tiennent partout —    */
    /* écart négatif là où la fonction est concave, point du théorème   */
    /* des accroissements finis strictement intérieur, sécante à égale  */
    /* distance des deux bouts pour la seule quadratique.               */
    /* -------------------------------------------------------------- */

    const DT = {
      racine: { f: (X) => 6 * Math.sqrt(X), d: (X) => 3 / Math.sqrt(X), concave: true },
      log:    { f: (X) => 5 * Math.log(X),  d: (X) => 5 / X,            concave: true },
      quad:   { f: (X) => 10 * X - 0.25 * X * X, d: (X) => 10 - 0.5 * X, concave: true,
                milieu: true },
      cube:   { f: (X) => 0.06 * X * X * X - 1.5 * X * X + 9 * X + 20,
                d: (X) => 0.18 * X * X - 3 * X + 9, concave: false }
    };

    let combDT = 0;

    for (const nom in DT) {
      const F = DT[nom];
      for (let X0 = 0.5; X0 <= 14.001; X0 += 0.5) {
        for (let h = 0.05; h <= 6.001; h += 0.25) {
          combDT++;
          const ctx = `${nom} X0=${X0.toFixed(2)} h=${h.toFixed(2)}`;
          const sec = (F.f(X0 + h) - F.f(X0)) / h;
          const dA = F.d(X0);

          // La dérivée codée est-elle celle de la fonction codée ?
          const e = 1e-5;
          verifier('dt : d() est la dérivée de f()',
            Math.abs((F.f(X0 + e) - F.f(X0 - e)) / (2 * e) - dA) < 1e-4, ctx);

          // Q1 : pour une fonction concave, la sécante est sous la tangente.
          if (F.concave) {
            verifier('dt Q1 : écart négatif si f est concave', sec - dA < 0, ctx);
          }

          // Q2 : une fonction concave reste SOUS sa tangente — c'est le terme
          // de Taylor d'ordre 2, ½·f ″·(X − X0)², qui prend le signe de f ″.
          // On échantillonne l'intervalle exactement comme le fait la page.
          if (F.concave) {
            let audessus = true;
            for (let k = 1; k <= 60 && audessus; k++) {
              const x = X0 + h * k / 60;
              if ((F.f(X0) + dA * (x - X0)) - F.f(x) <= 1e-12) audessus = false;
            }
            verifier('dt Q2 : tangente au-dessus de la courbe si f est concave',
              audessus, ctx);
          }

          // Sur la quadratique, l'écart vaut exactement (f ″/2)·h = −0,25h :
          // c'est le même terme de Taylor, vu depuis la sécante.
          if (F.milieu) {
            verifier('dt : écart = −0,25h sur la quadratique',
              proche(sec - dA, -0.25 * h, 1e-9), ctx);
          }
        }
      }
    }

    /* -------------------------------------------------------------- */
    /* 5. optimisation : les trois questions du chapitre 1              */
    /* -------------------------------------------------------------- */

    const OP = {
      concave: { f: (X) => 12 * X - 0.3 * X * X, d: (X) => 12 - 0.6 * X,
                 dd: () => -0.6, xmin: 0, xmax: 30, stat: [20], nMax: 1, bord: false },
      quatre:  { f: (X) => -0.02 * Math.pow(X, 4) + 0.45 * Math.pow(X, 3)
                          - 3 * X * X + 7 * X + 10,
                 d: (X) => -0.08 * Math.pow(X, 3) + 1.35 * X * X - 6 * X + 7,
                 dd: (X) => -0.24 * X * X + 2.7 * X - 6,
                 xmin: 0, xmax: 13, stat: null, nMax: 3, bord: false },
      convexe: { f: (X) => 0.3 * X * X - 6 * X + 40, d: (X) => 0.6 * X - 6,
                 dd: () => 0.6, xmin: 0, xmax: 20, stat: [10], nMax: 1, bord: true }
    };

    for (const nom in OP) {
      const F = OP[nom];
      const ctx = 'optimisation ' + nom;

      // Points stationnaires : donnés, ou trouvés comme dans la page.
      let xs = [];
      if (F.stat) { xs = F.stat.slice(); }
      else {
        let xa = F.xmin, da = F.d(xa);
        for (let k = 1; k <= 800; k++) {
          const xb = F.xmin + (F.xmax - F.xmin) * k / 800, db = F.d(xb);
          if (da === 0) xs.push(xa);
          else if ((da < 0) !== (db < 0)) {
            const r = Econ.bissection(F.d, xa, xb, 1e-11);
            if (r !== null) xs.push(r);
          }
          xa = xb; da = db;
        }
      }

      // Q2 : le nombre de points stationnaires que la page affichera.
      verifier('op Q2 : nombre de points stationnaires', xs.length === F.nMax,
               ctx + ` trouvé ${xs.length}, attendu ${F.nMax}`);

      // Chaque racine annule bien f ′.
      xs.forEach(function (x) {
        verifier('op : f ′ = 0 aux points stationnaires', Math.abs(F.d(x)) < 1e-6,
                 ctx + ` x=${x.toFixed(4)}`);
      });

      // Q3 : le maximum est-il intérieur ou au bord ?
      const bornes = Math.max(F.f(F.xmin), F.f(F.xmax));
      let sommet = -Infinity;
      xs.forEach(function (x) { if (F.dd(x) < 0) sommet = Math.max(sommet, F.f(x)); });
      verifier('op Q3 : localisation du maximum', (sommet > bornes) === !F.bord,
               ctx + ` sommet=${sommet.toFixed(2)} bornes=${bornes.toFixed(2)}`);

      // Le maximum annoncé domine vraiment tout l'intervalle : on balaie.
      let vrai = -Infinity;
      for (let k = 0; k <= 2000; k++) {
        vrai = Math.max(vrai, F.f(F.xmin + (F.xmax - F.xmin) * k / 2000));
      }
      verifier('op Q3 : ce maximum est bien le plus grand de l\'intervalle',
               Math.max(sommet, bornes) >= vrai - 1e-6,
               ctx + ` annoncé=${Math.max(sommet, bornes).toFixed(3)} balayé=${vrai.toFixed(3)}`);

      // Q1 : le signe de f ′ indique la direction qui améliore.
      for (let X = F.xmin; X <= F.xmax; X += 0.25) {
        const d = F.d(X);
        if (Math.abs(d) < 0.03) continue;              // zone du verdict « stationnaire »
        const pas = 1e-4;
        const mieux = d > 0 ? F.f(X + pas) : F.f(X - pas);
        verifier('op Q1 : le signe de f ′ donne la bonne direction', mieux > F.f(X),
                 ctx + ` X=${X.toFixed(2)}`);
      }
    }

    /* -------------------------------------------------------------- */
    /* 6. demande-engel : part budgétaire et homothétie                 */
    /*                                                                  */
    /* La question 1 affirme que la part du budget est FIGÉE en          */
    /* Cobb-Douglas et qu'elle bouge en CES, dans un sens qui dépend du  */
    /* signe de r. On le vérifie sur toute la grille plutôt que de s'y   */
    /* fier : c'est le seul moyen de savoir que les trois options sont   */
    /* toutes atteignables et qu'aucune n'est jamais fausse à tort.      */
    /* -------------------------------------------------------------- */

    let combDE = 0, vusCES = { hausse: 0, baisse: 0 };
    const pY0 = 4, I0 = 100;

    for (const nomFam of ['cobb', 'ces']) {
      const F = Econ.pref[nomFam];
      for (let a = 0.1; a <= 0.901; a += 0.05) {
        for (let r = -3; r <= 0.901; r += 0.2) {
          for (let pX = 2; pX <= 10.001; pX += 1) {
            combDE++;
            const p = { a: a, r: r };
            const ctx = `${nomFam} a=${a.toFixed(2)} r=${r.toFixed(1)} pX=${pX}`;
            const part = (q) => q * F.demande(q, pY0, I0, p).X / I0;
            const s0 = part(pX), s1 = part(2 * pX);

            if (nomFam === 'cobb') {
              verifier('de Q1 : part du budget figée en Cobb-Douglas',
                Math.abs(s1 - s0) < 1e-9 && proche(s0, a), ctx);
            } else if (Math.abs(r) > 1e-6) {
              // Hors du cas Cobb-Douglas (r = 0), la part DOIT bouger, et le
              // sens est celui de −r : mauvaise substituabilité (r < 0), la
              // part monte ; bonne substituabilité (r > 0), elle baisse.
              verifier('de Q1 : part mobile en CES', Math.abs(s1 - s0) > 1e-9, ctx);
              verifier('de Q1 : sens dicté par le signe de r',
                (s1 > s0) === (r < 0), ctx + ` s0=${s0.toFixed(4)} s1=${s1.toFixed(4)}`);
              if (s1 > s0) vusCES.hausse++; else vusCES.baisse++;
            }

            // Q2 : les deux familles sont homothétiques — doubler le revenu
            // double les deux demandes, exactement.
            const d1 = F.demande(pX, pY0, I0, p), d2 = F.demande(pX, pY0, 2 * I0, p);
            verifier('de Q2 : homothétie, X* double', proche(d2.X, 2 * d1.X), ctx);
            verifier('de Q2 : homothétie, Y* double', proche(d2.Y, 2 * d1.Y), ctx);
          }
        }
      }
    }
    verifier('de Q1 : les deux sens sont atteignables en CES',
      vusCES.hausse > 0 && vusCES.baisse > 0,
      `hausse=${vusCES.hausse} baisse=${vusCES.baisse}`);

    /* -------------------------------------------------------------- */
    /* 7. vc-ve : signes, classement et forme close                     */
    /*                                                                  */
    /* Le classement des deux mesures s'inverse avec le sens de la       */
    /* variation de prix : c'est ce que teste la question 2, et c'est la */
    /* raison pour laquelle elle ne peut pas être devinée une fois pour  */
    /* toutes.                                                           */
    /* -------------------------------------------------------------- */

    const Ivv = 100, pYvv = 1;
    let combVV = 0, sensVV = { vc: 0, ve: 0 };

    for (let a = 0.2; a <= 0.801; a += 0.05) {
      for (let p0 = 1; p0 <= 4.001; p0 += 0.25) {
        for (let p1 = 0.5; p1 <= 5.001; p1 += 0.25) {
          combVV++;
          const p = { a: a };
          const A = C.demande(p0, pYvv, Ivv, p);
          const Cc = C.demande(p1, pYvv, Ivv, p);
          const u0 = C.u(A.X, A.Y, p), u1 = C.u(Cc.X, Cc.Y, p);
          const VC = Ivv - C.depense(p1, pYvv, u0, p);
          const VE = C.depense(p0, pYvv, u1, p) - Ivv;
          const ctx = `a=${a.toFixed(2)} p0=${p0} p1=${p1}`;

          // Forme close : VC = I[1 − (p1/p0)^a], VE = I[(p0/p1)^a − 1].
          verifier('vv : VC = I[1 − (p1/p0)^a]',
            proche(VC, Ivv * (1 - Math.pow(p1 / p0, a))), ctx);
          verifier('vv : VE = I[(p0/p1)^a − 1]',
            proche(VE, Ivv * (Math.pow(p0 / p1, a) - 1)), ctx);

          if (Math.abs(p1 - p0) < 1e-12) {
            verifier('vv Q1 : prix inchangé, les deux sont nulles',
              Math.abs(VC) < 1e-9 && Math.abs(VE) < 1e-9, ctx);
            verifier('vv Q2 : prix inchangé, les deux coïncident',
              Math.abs(Math.abs(VC) - Math.abs(VE)) < 1e-9, ctx);
          } else {
            // Q1 : le signe suit le sens du changement (convention du cours :
            // positif = bénéfique, donc une baisse de prix est positive).
            verifier('vv Q1 : VC positive ssi le prix baisse', (VC > 0) === (p1 < p0), ctx);
            verifier('vv Q1 : VE de même signe que VC', (VE > 0) === (VC > 0), ctx);

            // Q2 : |VC| > |VE| pour une hausse, l'inverse pour une baisse.
            const gagne = Math.abs(VC) > Math.abs(VE) ? 'vc' : 've';
            verifier('vv Q2 : classement dicté par le sens du prix',
              (gagne === 'vc') === (p1 > p0),
              ctx + ` |VC|=${Math.abs(VC).toFixed(3)} |VE|=${Math.abs(VE).toFixed(3)}`);
            sensVV[gagne]++;
          }
        }
      }
    }
    verifier('vv Q2 : les deux classements sont atteignables',
      sensVV.vc > 0 && sensVV.ve > 0, `vc=${sensVV.vc} ve=${sensVV.ve}`);

    /* -------------------------------------------------------------- */
    /* 8. utilite-esperee : Jensen et étalement à moyenne constante     */
    /* -------------------------------------------------------------- */

    function uCRRA(Z, s) {
      if (Z <= 0) return -Infinity;
      return Math.abs(1 - s) < 1e-6 ? Math.log(Z) : (Math.pow(Z, 1 - s) - 1) / (1 - s);
    }
    function ecCRRA(z1, z2, p, s) {
      const v = p * uCRRA(z1, s) + (1 - p) * uCRRA(z2, s);
      if (Math.abs(1 - s) < 1e-6) return Math.exp(v);
      const base = 1 + (1 - s) * v;
      return base <= 0 ? NaN : Math.pow(base, 1 / (1 - s));
    }

    let combUE = 0;
    for (let z1 = 5; z1 <= 50.001; z1 += 5) {
      for (let z2 = 55; z2 <= 100.001; z2 += 5) {
        for (let p = 0.05; p <= 0.951; p += 0.1) {
          for (let s = 0; s <= 4.001; s += 0.25) {
            combUE++;
            const m = p * z1 + (1 - p) * z2;
            const ec = ecCRRA(z1, z2, p, s);
            const ctx = `Z1=${z1} Z2=${z2} π=${p.toFixed(2)} σ=${s.toFixed(2)}`;
            if (!isFinite(ec)) continue;

            // Q1 : Jensen — EC sous l'espérance dès que σ > 0, égal à σ = 0.
            if (s < 1e-9) {
              verifier('ue Q1 : σ = 0, équivalent certain = espérance',
                proche(ec, m, 1e-9), ctx);
            } else {
              verifier('ue Q1 : σ > 0, équivalent certain sous l\'espérance',
                ec < m - 1e-9, ctx + ` EC=${ec.toFixed(4)} E=${m.toFixed(4)}`);
            }

            // Q2 : étalement à moyenne constante — la prime monte si σ > 0,
            // ne bouge pas si σ = 0. On reproduit exactement le décalage de
            // la page : Z1 − d et Z2 + d·π/(1−π).
            const d = 2;
            const n1 = z1 - d, n2 = z2 + d * p / (1 - p);
            if (n1 <= 0) continue;
            const m2 = p * n1 + (1 - p) * n2;
            verifier('ue Q2 : l\'étalement laisse l\'espérance inchangée',
              proche(m2, m, 1e-9), ctx);
            const ec2 = ecCRRA(n1, n2, p, s);
            if (!isFinite(ec2)) continue;
            const pr1 = m - ec, pr2 = m2 - ec2;
            if (s < 1e-9) {
              verifier('ue Q2 : σ = 0, la prime reste nulle',
                Math.abs(pr2 - pr1) < 1e-9, ctx);
            } else {
              verifier('ue Q2 : σ > 0, l\'étalement fait monter la prime',
                pr2 > pr1 - 1e-12, ctx + ` avant=${pr1.toFixed(5)} après=${pr2.toFixed(5)}`);
            }
          }
        }
      }
    }

    /* -------------------------------------------------------------- */
    /* 9. assurance : couverture complète, partielle, nulle             */
    /* -------------------------------------------------------------- */

    const Was = 100;
    let combAS = 0, vusAS = { complete: 0, partielle: 0, nulle: 0 };

    function koptAs(L, p, lam, s) {
      const g = Math.min(0.9, p * (1 + lam));
      if (s < 1e-6) return (g < p) ? L : 0;
      const R = Math.pow(p * (1 - g) / ((1 - p) * g), 1 / s);
      const K = (R * Was - Was + L) / (1 - g + R * g);
      return Math.max(0, Math.min(L, K));
    }

    for (let L = 20; L <= 80.001; L += 10) {
      for (let p = 0.05; p <= 0.501; p += 0.05) {
        for (let lam = 0; lam <= 0.801; lam += 0.05) {
          for (let s = 0; s <= 4.001; s += 0.25) {
            combAS++;
            const K = koptAs(L, p, lam, s);
            const ctx = `L=${L} p=${p.toFixed(2)} λ=${lam.toFixed(2)} σ=${s.toFixed(2)}`;

            // Q1 : à prime juste et aversion stricte, couverture COMPLÈTE.
            if (lam < 1e-9 && s > 1e-6) {
              verifier('as Q1 : prime juste + riscophobe => couverture complète',
                proche(K, L, 1e-9), ctx + ` K=${K.toFixed(4)}`);
            }
            // Avec chargement et aversion stricte, la couverture est partielle
            // (jamais complète : payer plus que le coût actuariel le dernier
            // dollar de couverture n'en vaut jamais la peine).
            if (lam > 1e-9 && s > 1e-6) {
              verifier('as Q1 : chargement => couverture non complète', K < L - 1e-9, ctx);
            }
            // Neutralité : comparer les valeurs, pas le représentant du solveur.
            if (s < 1e-9) {
              const g = p * (1 + lam);
              const esperance = k => p * (Was - L + (1 - g) * k) +
                                      (1 - p) * (Was - g * k);
              if (lam < 1e-9) {
                for (const k of [0, L / 2, L]) {
                  verifier('as Q2 : prime juste, toute couverture est optimale',
                    proche(esperance(k), Was - p * L), ctx + ' K=' + k);
                }
              } else {
                verifier('as Q2 : chargement, richesse strictement décroissante en K',
                  esperance(0) > esperance(L / 2) && esperance(L / 2) > esperance(L), ctx);
                verifier('as Q2 : chargement, seul K=0 est optimal', proche(K, 0), ctx);
              }
            }
            // La couverture reste dans les bornes économiquement sensées.
            verifier('as : 0 ≤ K* ≤ L', K >= -1e-9 && K <= L + 1e-9, ctx);

            if (K >= L - 1e-6) vusAS.complete++;
            else if (K <= 1e-6) vusAS.nulle++;
            else vusAS.partielle++;
          }
        }
      }
    }
    verifier('as : les trois verdicts sont atteignables',
      vusAS.complete > 0 && vusAS.partielle > 0 && vusAS.nulle > 0,
      `complète=${vusAS.complete} partielle=${vusAS.partielle} nulle=${vusAS.nulle}`);

    /* -------------------------------------------------------------- */
    /* 10. Chapitre 2 : TMS, contrainte budgétaire et choix optimal     */
    /*                                                                  */
    /* Les questions de ces trois outils ne portent que sur la matière   */
    /* du chapitre 2, mais les réponses sont calculées quelle que soit   */
    /* la famille de préférences choisie : il faut donc vérifier que la  */
    /* logique tient aussi sur les familles que les notes ne traitent    */
    /* pas, sans quoi un étudiant qui explore le menu tomberait sur une  */
    /* correction fausse.                                               */
    /* -------------------------------------------------------------- */

    let combCh2 = 0;

    // Utilités marginales analytiques, reprises de indifference-tms.html.
    const UMf = {
      cobb: (X, Y, p) => ({ x: p.a * Math.pow(X, p.a - 1) * Math.pow(Y, 1 - p.a),
                            y: (1 - p.a) * Math.pow(X, p.a) * Math.pow(Y, -p.a) }),
      ces: (X, Y, p) => {
        const u = Econ.pref.ces.u(X, Y, p);
        return { x: p.a * Math.pow(X, p.r - 1) * Math.pow(u, 1 - p.r),
                 y: (1 - p.a) * Math.pow(Y, p.r - 1) * Math.pow(u, 1 - p.r) };
      },
      subs: (X, Y, p) => ({ x: p.a, y: 1 - p.a }),
      quasi: (X, Y, p) => ({ x: p.a / X, y: 1 })
    };

    // --- indifference-tms : TMS = UMx/UMy, et convexité pour les familles
    // strictement convexes (les substituts parfaits ont un TMS constant).
    for (const nomF of ['cobb', 'ces', 'subs', 'quasi']) {
      const F = Econ.pref[nomF];
      for (let a = 0.1; a <= 0.901; a += 0.1) {
        for (let r = -3; r <= 0.901; r += 0.5) {
          for (let X = 1; X <= 18.001; X += 2) {
            for (let Y = 1; Y <= 18.001; Y += 2) {
              combCh2++;
              const p = { a: a, r: r };
              const ctx = `${nomF} a=${a.toFixed(1)} r=${r.toFixed(1)} (${X},${Y})`;
              const t = F.tms(X, Y, p), m = UMf[nomF](X, Y, p);
              if (!isFinite(t) || !isFinite(m.x) || !isFinite(m.y) || m.y === 0) continue;

              // Q2 : l'identité TMS = UMx/UMy, sur laquelle porte la question.
              verifier('it Q2 : TMS = UMx/UMy', proche(t, m.x / m.y, 1e-7),
                ctx + ` TMS=${t.toFixed(6)} rapport=${(m.x / m.y).toFixed(6)}`);

              // Q1 : convexité — en avançant sur la MÊME courbe, le TMS
              // décroît (strictement, sauf substituts parfaits où il est fixe).
              const u0 = F.u(X, Y, p);
              const X1 = X + 1;
              const Y1 = F.yIndiff(X1, u0, p);
              if (Y1 === null || !isFinite(Y1) || Y1 <= 0) continue;
              const t1 = F.tms(X1, Y1, p);
              if (!isFinite(t1)) continue;
              if (nomF === 'subs') {
                verifier('it Q1 : TMS constant pour les substituts parfaits',
                  Math.abs(t1 - t) < 1e-9, ctx);
              } else {
                verifier('it Q1 : TMS décroissant le long de la courbe', t1 < t + 1e-9,
                  ctx + ` t=${t.toFixed(6)} t1=${t1.toFixed(6)}`);
              }
            }
          }
        }
      }
    }

    // --- contrainte-budgetaire : homogénéité, pivot, coût d'opportunité.
    for (let pXb = 2.5; pXb <= 8.001; pXb += 0.5) {
      for (let pYb = 2.5; pYb <= 8.001; pYb += 0.5) {
        for (let Ib = 60; Ib <= 120.001; Ib += 10) {
          for (const tx of [0, 0.25, 0.5, 1]) {
            combCh2++;
            const pXe = pXb * (1 + tx);
            const ctx = `pX=${pXb} pY=${pYb} I=${Ib} t=${tx}`;

            // Q1 : homogénéité de degré zéro — les deux intercepts sont
            // inchangés quand on multiplie prix ET revenu par le même facteur.
            for (const k of [2, 3, 0.5]) {
              verifier('cb Q1 : abscisse invariante par changement d\'échelle',
                proche((k * Ib) / (k * pXb * (1 + tx)), Ib / pXe), ctx + ` k=${k}`);
              verifier('cb Q1 : ordonnée invariante par changement d\'échelle',
                proche((k * Ib) / (k * pYb), Ib / pYb), ctx + ` k=${k}`);
            }

            // Q2 : une hausse de pX seul laisse l'ordonnée fixe et fait
            // reculer l'abscisse — donc un pivot, jamais un déplacement.
            const x0 = Ib / pXe, x1 = Ib / (pXb * 1.25 * (1 + tx));
            verifier('cb Q2 : l\'ordonnée ne bouge pas', proche(Ib / pYb, Ib / pYb), ctx);
            verifier('cb Q2 : l\'abscisse recule', x1 < x0 - 1e-12, ctx);

            // Q3 : le coût d'opportunité est la pente, taxe comprise.
            verifier('cb Q3 : coût d\'opportunité = pX(1+t)/pY',
              proche(pXe / pYb, pXb * (1 + tx) / pYb), ctx);
          }
        }
      }
    }

    // --- choix-optimal : tangence, sens de l'échange, effet d'une hausse.
    for (const nomF of ['cobb', 'ces']) {
      const F = Econ.pref[nomF];
      for (let a = 0.1; a <= 0.901; a += 0.1) {
        for (let r = -3; r <= 0.901; r += 0.5) {
          for (let pXo = 2; pXo <= 10.001; pXo += 1) {
            for (let pYo = 2; pYo <= 10.001; pYo += 2) {
              combCh2++;
              const p = { a: a, r: r }, Io = 100;
              const o = F.demande(pXo, pYo, Io, p);
              const ctx = `${nomF} a=${a.toFixed(1)} r=${r.toFixed(1)} pX=${pXo} pY=${pYo}`;
              if (!(o.X > 0 && o.Y > 0)) continue;

              // Q2 : à l'optimum intérieur, TMS = pX/pY.
              const t = F.tms(o.X, o.Y, p);
              if (isFinite(t)) {
                verifier('co Q2 : TMS = pX/pY à l\'optimum', proche(t, pXo / pYo, 1e-6),
                  ctx + ` TMS=${t.toFixed(6)}`);
              }

              // Q3 : une hausse de pX réduit X* (les deux familles n'ont ici
              // que des biens normaux).
              const o2 = F.demande(pXo * 1.25, pYo, Io, p);
              verifier('co Q3 : X* baisse quand pX monte', o2.X < o.X + 1e-12,
                ctx + ` X*=${o.X.toFixed(4)} -> ${o2.X.toFixed(4)}`);

              // Q1 : hors optimum, le signe de TMS − pX/pY indique bien la
              // direction qui améliore. On teste un point strictement à
              // gauche de l'optimum sur la contrainte : le TMS doit y être
              // plus élevé que le rapport des prix, donc « acheter plus de X ».
              const Xg = o.X * 0.5;
              const Yg = (Io - pXo * Xg) / pYo;
              if (Xg > 0 && Yg > 0) {
                const tg = F.tms(Xg, Yg, p);
                if (isFinite(tg)) {
                  verifier('co Q1 : à gauche de l\'optimum, TMS > pX/pY',
                    tg > pXo / pYo - 1e-9,
                    ctx + ` TMS=${tg.toFixed(5)} prix=${(pXo / pYo).toFixed(5)}`);
                }
              }
            }
          }
        }
      }
    }

    /* -------------------------------------------------------------- */
    /* 11. Chapitre 6 : échange et théorèmes du bien-être               */
    /*                                                                  */
    /* Le point à vérifier n'est pas seulement que les formules sont     */
    /* justes, mais que les DEUX théorèmes tiennent numériquement :      */
    /* l'équilibre égalise les TMS (premier), et une dotation placée sur */
    /* la droite de prix ramène exactement à l'allocation visée          */
    /* (second). C'est ce que les questions affirment.                   */
    /* -------------------------------------------------------------- */

    const W6 = 100;
    let combCh6 = 0, sensEd = { vend: 0, achete: 0 };

    function equilBoite(aAv, aBv, dx, dy) {
      const p = (aAv * dy + aBv * (W6 - dy)) /
                (W6 - aAv * dx - aBv * (W6 - dx));
      const IA = p * dx + dy;
      return { p: p, XA: aAv * IA / p, YA: (1 - aAv) * IA };
    }

    for (let aAv = 0.15; aAv <= 0.851; aAv += 0.05) {
      for (let aBv = 0.15; aBv <= 0.851; aBv += 0.05) {
        for (let dx = 10; dx <= 90.001; dx += 10) {
          for (let dy = 10; dy <= 90.001; dy += 10) {
            combCh6++;
            const e = equilBoite(aAv, aBv, dx, dy);
            const ctx = `aA=${aAv.toFixed(2)} aB=${aBv.toFixed(2)} E=(${dx},${dy})`;
            if (!(e.p > 0 && e.XA > 0 && e.YA > 0)) continue;

            // Faisabilité : ce qui reste à Bruno est positif.
            const XB = W6 - e.XA, YB = W6 - e.YA;
            verifier('ed : allocation d\'équilibre réalisable',
              XB > -1e-9 && YB > -1e-9, ctx);

            // Q2 / premier théorème : les deux TMS s'égalisent au prix.
            const tA = (aAv / (1 - aAv)) * (e.YA / e.XA);
            const tB = (aBv / (1 - aBv)) * (YB / XB);
            verifier('ed Q2 : TMS d\'Anne = TMS de Bruno à l\'équilibre',
              proche(tA, tB, 1e-6), ctx + ` tA=${tA.toFixed(5)} tB=${tB.toFixed(5)}`);
            verifier('ed : et tous deux égaux au prix', proche(tA, e.p, 1e-6), ctx);

            // Q1 : le sens de l'échange est bien défini et les deux sont
            // atteignables sur la grille.
            if (Math.abs(e.XA - dx) > 0.05) {
              if (e.XA < dx) sensEd.vend++; else sensEd.achete++;
            }

            // Loi de Walras : si le marché de X s'équilibre, celui de Y aussi.
            const excesX = (e.XA + XB) - W6, excesY = (e.YA + YB) - W6;
            verifier('ed : loi de Walras (les deux marchés s\'équilibrent)',
              Math.abs(excesX) < 1e-9 && Math.abs(excesY) < 1e-9, ctx);
          }
        }
      }
    }
    verifier('ed Q1 : les deux sens d\'échange sont atteignables',
      sensEd.vend > 0 && sensEd.achete > 0,
      `vend=${sensEd.vend} achète=${sensEd.achete}`);

    // --- Deuxième théorème : décentralisation d'une allocation visée.
    for (let aAv = 0.15; aAv <= 0.851; aAv += 0.05) {
      for (let aBv = 0.15; aBv <= 0.851; aBv += 0.05) {
        for (let cx = 10; cx <= 90.001; cx += 10) {
          combCh6++;
          const kAv = aAv / (1 - aAv), kBv = aBv / (1 - aBv);
          const cy = kBv * cx * W6 / (kAv * W6 + cx * (kBv - kAv));
          const ctx = `aA=${aAv.toFixed(2)} aB=${aBv.toFixed(2)} cible=${cx}`;
          if (!(cy > 0 && cy < W6)) continue;

          // La cible est bien sur la courbe des contrats : TMS égaux.
          const tA = kAv * (cy / cx), tB = kBv * ((W6 - cy) / (W6 - cx));
          verifier('tb : la cible est Pareto-optimale (TMS égaux)',
            proche(tA, tB, 1e-6), ctx);

          // Le prix de soutien est ce TMS commun ; une dotation placée sur
          // la droite correspondante doit ramener EXACTEMENT à la cible.
          const p = tA, R = p * cx + cy;
          let decentralise = true;
          for (const f of [0.4, 0.6, 0.8, 1.2]) {
            const dx = cx * f, dy = R - p * dx;
            if (!(dy > 0 && dy < W6 && dx > 0 && dx < W6)) continue;
            const e = equilBoite(aAv, aBv, dx, dy);
            if (Math.abs(e.XA - cx) > 0.02 || Math.abs(e.YA - cy) > 0.02) {
              decentralise = false;
            }
          }
          verifier('tb : toute dotation sur la droite de prix mène à la cible',
            decentralise, ctx + ` p=${p.toFixed(4)}`);

          // Nouvelle q1 : une dotation HORS de la droite mène ailleurs — sur
          // la courbe des contrats, mais pas à la cible.
          const dyOff = cy > W6 / 2 ? -18 : 18;
          const dyo = Math.min(W6 - 2, Math.max(2, cy + dyOff));
          const eo = equilBoite(aAv, aBv, cx, dyo);
          if (eo.XA > 0 && eo.XA < W6 && eo.YA > 0 && eo.YA < W6) {
            const horsCible = Math.hypot(eo.XA - cx, eo.YA - cy) >= 0.15;
            const tAo = (aAv / (1 - aAv)) * (eo.YA / eo.XA);
            const tBo = (aBv / (1 - aBv)) * ((W6 - eo.YA) / (W6 - eo.XA));
            verifier('tb Q1 : hors de la droite, autre point de la courbe des contrats',
              horsCible && proche(tAo, tBo, 1e-6),
              ctx + ` e=(${eo.XA.toFixed(1)},${eo.YA.toFixed(1)})`);
          }
        }
      }
    }

    {
      // Nouvelle q2 de theoremes : les distracteurs (rapport des goûts,
      // inverse du TMS) ne coïncident pas avec la bonne réponse aux
      // réglages par défaut de la page.
      const kA0 = 0.6 / 0.4, kB0 = 0.35 / 0.65, cx0 = 55;
      const cy0 = kB0 * cx0 * W6 / (kA0 * W6 + cx0 * (kB0 - kA0));
      const t0 = kA0 * (cy0 / cx0);
      verifier('tb Q2 : distracteurs distincts aux réglages par défaut',
        Math.abs(t0 - 0.6 / 0.35) > 0.1 && Math.abs(t0 - 1 / t0) > 0.1,
        `t=${t0.toFixed(3)}`);
    }

    /* -------------------------------------------------------------- */
    /* 12. Chapitre 7 : isoquantes, coût et offre                       */
    /* -------------------------------------------------------------- */

    let combCh7 = 0, vusRend = { croiss: 0, const_: 0, decroiss: 0 };

    for (let al = 0.35; al <= 0.901; al += 0.05) {
      for (let be = 0.35; be <= 0.901; be += 0.05) {
        for (let X = 1; X <= 6.001; X += 1) {
          for (let Z = 1; Z <= 6.001; Z += 1) {
            combCh7++;
            const ctx = `α=${al.toFixed(2)} β=${be.toFixed(2)} (${X},${Z})`;
            const F = (x, z) => Math.pow(x, al) * Math.pow(z, be);

            // Q1 / Q3 : doubler les intrants multiplie par 2^(α+β).
            const f = F(2 * X, 2 * Z) / F(X, Z);
            verifier('pi Q1/Q3 : facteur = 2^(α+β)',
              proche(f, Math.pow(2, al + be), 1e-9), ctx);
            const s = al + be;
            if (Math.abs(s - 1) < 1e-9) { vusRend.const_++; verifier('pi : α+β=1 ⇒ facteur 2', proche(f, 2), ctx); }
            else if (s > 1) { vusRend.croiss++; verifier('pi : α+β>1 ⇒ facteur > 2', f > 2, ctx); }
            else { vusRend.decroiss++; verifier('pi : α+β<1 ⇒ facteur < 2', f < 2, ctx); }

            // Q2 : le TMST décroît le long de l'isoquante (en valeur absolue).
            const Y0 = F(X, Z);
            const X1 = X * 1.15, Z1 = Math.pow(Y0 / Math.pow(X1, al), 1 / be);
            const t0 = (al / be) * (Z / X), t1 = (al / be) * (Z1 / X1);
            verifier('pi Q2 : TMST décroissant le long de l\'isoquante',
              t1 < t0 + 1e-12, ctx + ` t0=${t0.toFixed(5)} t1=${t1.toFixed(5)}`);
          }
        }
      }
    }
    verifier('pi : les trois régimes de rendements sont atteignables',
      vusRend.croiss > 0 && vusRend.const_ > 0 && vusRend.decroiss > 0,
      `+=${vusRend.croiss} 0=${vusRend.const_} -=${vusRend.decroiss}`);

    // --- production-cout : minimisation, TMST = pX/pZ, forme close.
    for (let al = 0.35; al <= 0.801; al += 0.05) {
      for (let be = 0.35; be <= 0.801; be += 0.05) {
        for (let px = 1; px <= 4.001; px += 0.5) {
          for (let pz = 1; pz <= 4.001; pz += 0.5) {
            for (const Y of [1, 4, 8]) {
              combCh7++;
              const ctx = `α=${al.toFixed(2)} β=${be.toFixed(2)} pX=${px} pZ=${pz} Y=${Y}`;
              const Xs = Math.pow(Y * Math.pow(al * pz / (be * px), be), 1 / (al + be));
              const Zs = (be * px / (al * pz)) * Xs;

              // La solution produit bien Y.
              verifier('pc : F(X*, Z*) = Y',
                proche(Math.pow(Xs, al) * Math.pow(Zs, be), Y, 1e-8), ctx);

              // Q1 : au coût minimal, TMST = pX/pZ.
              verifier('pc Q1 : TMST = pX/pZ à l\'optimum',
                proche((al / be) * (Zs / Xs), px / pz, 1e-9), ctx);

              // Le coût par les deux formules coïncide.
              const c1 = px * Xs + pz * Zs, c2 = px * Xs * (al + be) / al;
              verifier('pc Q3 : les deux écritures du coût coïncident',
                proche(c1, c2, 1e-9), ctx);

              // Q2 : une hausse de pX réduit la demande conditionnelle X*.
              const px2 = px * 1.25;
              const Xs2 = Math.pow(Y * Math.pow(al * pz / (be * px2), be), 1 / (al + be));
              verifier('pc Q2 : X* baisse quand pX monte', Xs2 < Xs + 1e-12, ctx);
            }
          }
        }
      }
    }

    // --- couts-offre : trois régimes, seuils, neutralité du coût fixe.
    let vusCO = { profit: 0, perte: 0, ferme: 0 };
    for (let a3 = 0.4; a3 <= 1.201; a3 += 0.2) {
      for (let b2 = 0.5; b2 <= 2.501; b2 += 0.5) {
        for (let d1 = 6; d1 <= 16.001; d1 += 2) {
          for (let Fx = 0; Fx <= 30.001; Fx += 10) {
            for (let p = 0; p <= 45.001; p += 5) {
              combCh7++;
              const ctx = `a=${a3.toFixed(1)} b=${b2.toFixed(1)} d=${d1} F=${Fx} p=${p}`;
              const CVf = (y) => a3 * y * y * y - b2 * y * y + d1 * y;
              const Cmf = (y) => 3 * a3 * y * y - 2 * b2 * y + d1;
              const CVMf = (y) => a3 * y * y - b2 * y + d1;
              const yc = b2 / (2 * a3), mcvm = d1 - b2 * b2 / (4 * a3);

              // Q3 : le minimum du CVM vaut d − b²/(4a), et le Cm y passe.
              verifier('cf Q3 : min CVM = d − b²/(4a)', proche(CVMf(yc), mcvm, 1e-9), ctx);
              verifier('cf : le Cm coupe le CVM en son minimum',
                proche(Cmf(yc), mcvm, 1e-9), ctx);

              // Q2 : la quantité qui maximise le profit ne dépend pas de F.
              // Même convention de départage que la page : exactement au seuil
              // de fermeture, produire et fermer rapportent la même chose, et
              // c'est produire qui l'emporte. Sans cette règle, le bruit de
              // calcul choisirait — le balayage l'a effectivement pris en
              // défaut en a=1, b=2, d=6, où le seuil vaut exactement 5.
              function argmax(Fv) {
                const vFermer = -Fv;
                let best = 0, vbest = -Infinity;
                for (let y = 0.01; y <= 6; y += 0.01) {
                  const v = p * y - (Fv + CVf(y));
                  if (v > vbest) { vbest = v; best = y; }
                }
                return (vbest > vFermer - 1e-9) ? best : 0;
              }
              const yA = argmax(Fx), yB = argmax(Fx + 10);
              verifier('cf Q2 : la quantité offerte ne dépend pas du coût fixe',
                Math.abs(yA - yB) < 1e-9, ctx + ` ${yA.toFixed(3)} vs ${yB.toFixed(3)}`);

              // Q1 : les trois verdicts, et cohérence avec le seuil.
              if (p < mcvm) {
                verifier('cf Q1 : sous le seuil de fermeture, on ferme',
                  yA < 1e-9, ctx);
                vusCO.ferme++;
              } else if (yA > 0) {
                const pi = p * yA - (Fx + CVf(yA));
                if (pi >= 0) vusCO.profit++; else vusCO.perte++;
                // Produire vaut mieux que fermer dès qu'on est au-dessus du seuil.
                verifier('cf Q1 : produire domine la fermeture au-dessus du seuil',
                  pi >= -Fx - 1e-9, ctx);
              }
            }
          }
        }
      }
    }
    verifier('cf Q1 : les trois verdicts sont atteignables',
      vusCO.profit > 0 && vusCO.perte > 0 && vusCO.ferme > 0,
      `profit=${vusCO.profit} perte=${vusCO.perte} fermeture=${vusCO.ferme}`);

    /* -------------------------------------------------------------- */
    /* 13. Chapitres 9 et 10 : temps et travail                         */
    /* -------------------------------------------------------------- */

    let combCh910 = 0, vusCI = { epargne: 0, emprunte: 0 }, vusTL = { hausse: 0, baisse: 0 };

    for (let Y1 = 0; Y1 <= 60.001; Y1 += 10) {
      for (let Y2 = 0; Y2 <= 60.001; Y2 += 10) {
        for (let rr = 0; rr <= 0.501; rr += 0.1) {
          for (let av = 0.5; av <= 0.801; av += 0.1) {
            combCh910++;
            const ctx = `Y1=${Y1} Y2=${Y2} r=${rr.toFixed(2)} a=${av.toFixed(2)}`;
            const VPv = Y1 + Y2 / (1 + rr);
            const C1 = av * VPv, C2 = (1 - av) * (1 + rr) * VPv;
            if (!(C1 > 0 && C2 > 0)) continue;

            // La solution respecte la contrainte intertemporelle.
            verifier('ci Q2 : C1 + C2/(1+r) = VP_W',
              proche(C1 + C2 / (1 + rr), VPv, 1e-9), ctx);
            // Et le TMS y vaut 1+r (condition d'Euler du chapitre 9).
            const tms = (av / (1 - av)) * (C2 / C1);
            verifier('ci : TMS = 1 + r à l\'optimum', proche(tms, 1 + rr, 1e-9), ctx);

            // Q1 : épargnant ou emprunteur, les deux atteignables.
            if (Math.abs(C1 - Y1) > 0.05) {
              if (C1 < Y1) vusCI.epargne++; else vusCI.emprunte++;
            }

            // Q3 : une hausse de r profite à l'épargnant. On compare l'utilité
            // au taux courant et à un taux plus bas, comme le fait la page.
            const r0v = Math.max(0, rr - 0.1);
            if (r0v < rr - 1e-9) {
              const VP0 = Y1 + Y2 / (1 + r0v);
              const c10 = av * VP0, c20 = (1 - av) * (1 + r0v) * VP0;
              const u1 = Math.pow(C1, av) * Math.pow(C2, 1 - av);
              const u0 = Math.pow(c10, av) * Math.pow(c20, 1 - av);
              // Un épargnant au taux BAS voit son bien-être monter avec r.
              if (c10 < Y1 - 0.05) {
                verifier('ci Q3 : l\'épargnant gagne à une hausse de r',
                  u1 > u0 - 1e-9, ctx + ` u0=${u0.toFixed(4)} u1=${u1.toFixed(4)}`);
              }
              // La dotation reste toujours accessible : l'utilité de l'optimum
              // ne peut pas tomber sous celle de la dotation.
              if (Y1 > 0 && Y2 > 0) {
                const uDot = Math.pow(Y1, av) * Math.pow(Y2, 1 - av);
                verifier('ci : l\'optimum vaut au moins la dotation',
                  u1 > uDot - 1e-9, ctx);
              }
            }
          }
        }
      }
    }
    verifier('ci Q1 : épargnant et emprunteur sont tous deux atteignables',
      vusCI.epargne > 0 && vusCI.emprunte > 0,
      `épargne=${vusCI.epargne} emprunte=${vusCI.emprunte}`);

    // --- travail-loisir : pente de l'offre et salaire de réserve.
    for (let wv = 1; wv <= 8.001; wv += 0.5) {
      for (let mv = 0; mv <= 30.001; mv += 5) {
        for (let Tv = 12; Tv <= 20.001; Tv += 2) {
          for (let av = 0.2; av <= 0.801; av += 0.1) {
            for (const c0v of [0, 10, 20, 30]) {
              combCh910++;
              const ctx = `w=${wv} m=${mv} T=${Tv} a=${av.toFixed(1)} c0=${c0v}`;
              const Lof = (ww) => {
                let L = av * (ww * Tv + mv - c0v) / ww;
                if (!isFinite(L) || L < 0) L = 0;
                if (L > Tv) L = Tv;
                return L;
              };
              const H0 = Tv - Lof(wv), H1 = Tv - Lof(wv * 1.25);

              // Q1 : le sens de la pente suit le signe de m − c0 (hors coins).
              if (H0 > 1e-6 && H0 < Tv - 1e-6 && H1 > 1e-6 && H1 < Tv - 1e-6) {
                if (mv > c0v + 1e-9) {
                  verifier('tl Q1 : offre croissante quand m > c0', H1 > H0 - 1e-9, ctx);
                  vusTL.hausse++;
                } else if (mv < c0v - 1e-9) {
                  verifier('tl Q1 : offre à rebroussement quand m < c0', H1 < H0 + 1e-9, ctx);
                  vusTL.baisse++;
                }
              }

              // Q2 : le salaire de réserve croît avec le revenu non salarial.
              const wR = (mm) => av * (mm - c0v) / ((1 - av) * Tv);
              verifier('tl Q2 : le salaire de réserve monte avec m',
                wR(mv + 5) > wR(mv) - 1e-12, ctx);
            }
          }
        }
      }
    }
    verifier('tl Q1 : les deux pentes d\'offre sont atteignables',
      vusTL.hausse > 0 && vusTL.baisse > 0,
      `croissante=${vusTL.hausse} rebroussement=${vusTL.baisse}`);

    return { combinaisons: combinaisons, combinaisonsMono: combMono,
             combinaisonsDT: combDT, combinaisonsDE: combDE,
             combinaisonsVV: combVV, combinaisonsUE: combUE,
             combinaisonsAS: combAS, combinaisonsCh2: combCh2,
             combinaisonsCh6: combCh6, combinaisonsCh7: combCh7,
             combinaisonsCh910: combCh910 };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = controles;
  else racine.controles = controles;
})(typeof globalThis !== 'undefined' ? globalThis : this);
