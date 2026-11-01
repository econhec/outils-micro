/* Test du rendu et des interactions réelles (facultatif : npm install playwright).
   node test/navigateur.js
   Navigateur Chromium installé par Playwright, ou BROWSER_CHANNEL=msedge/chrome.
   TOOLBOX_SCREENSHOTS : dossier facultatif de captures. Aucun accès réseau externe.
   Le serveur local et le navigateur sont fermés à la fin, y compris sur échec. */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const racine = path.resolve(__dirname, '..');
const captures = process.env.TOOLBOX_SCREENSHOTS;

async function main() {
  const server = http.createServer((req, res) => {
    const file = path.resolve(racine, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!file.startsWith(racine + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); res.end(); return;
    }
    const types = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css' };
    res.setHeader('Content-Type', (types[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8');
    res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || undefined });
    const context = await browser.newContext({ viewport: { width: 1400, height: 1100 } });
    const errors = [];
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on('pageerror', err => errors.push(err.message));
    if (captures) fs.mkdirSync(captures, { recursive: true });
    async function ouvrir(nom, sliders, famille, xy) {
      await page.goto(base + '/' + nom + '.html');
      await page.evaluate(() => sessionStorage.clear());
      await page.reload();
      if (famille) await page.locator('select').selectOption(famille);
      await page.locator('input[type=range]').evaluateAll((inputs, values) => {
        values.forEach((v, i) => { inputs[i].value = v; inputs[i].dispatchEvent(new Event('input', {bubbles:true})); });
      }, sliders);
      if (xy) await page.evaluate(xy => {
        const b = Object.values(JXG.boards)[0];
        b.objectsList.find(o => o.elType === 'glider').moveTo(xy); b.update();
      }, xy);
      assert.equal(await page.locator('.resultats').isVisible(), false, 'résultats masqués au départ');
      assert((await page.locator('.resultats').innerText()).includes('···'), 'valeurs retenues');
    }
    async function repondre(value, mode='correct') {
      if (mode === 'skip') await page.locator('.pred-passer').click();
      else {
        const number = page.locator('.pred-nombre');
        if (await number.count()) await number.fill(String(value));
        else await page.locator('input[type=radio][value="' + value + '"]').check();
        await page.locator('.pred-valider').click();
      }
      const text = await page.locator('.pred-retour').innerText();
      assert(text.includes(mode === 'skip' ? 'Question passée' : mode === 'wrong' ? 'Inexact' : 'Exact.'), text);
      assert((await page.locator('.pred-explication').innerText()).length > 80, 'explication visible');
      return text;
    }
    async function suite(retenus = true) {
      assert.equal(await page.locator('.resultats').isVisible(), !retenus, 'rétention conforme au mode');
      await page.getByRole('button', {name:'Question suivante',exact:true}).click();
    }
    const scenarios = [
      ['assurance-neutre','assurance',[60,.25,0,0],null,null,[3,3,0],/Toutes les couvertures/],
      ['assurance-riscophobe','assurance',[60,.25,0,2],null,null,[0,3,15],/60,0/],
      ['assurance-chargee','assurance',[60,.25,.2,0],null,null,[2,2,0],/aucune assurance/],
      ['cobb','choix-optimal',[.5,-1,5,4,100],'cobb',[10,12.5],[2,0,1],/1,25/],
      ['ces','choix-optimal',[.5,-1,5,4,100],'ces',null,['skip',0,1],/1,25/],
      ['complements','choix-optimal',[.5,-1,5,4,100],'compl',[100/9,100/9],[2,3,1],/non défini/],
      ['substituts','choix-optimal',[.5,-1,5,4,100],'subs',[0,25],[2,1,2],/1,00/],
      ['substituts-egalite','choix-optimal',[.5,-1,4,4,100],'subs',[12.5,12.5],[2,0,1],/1,00/],
      ['quasi-interieur','choix-optimal',[6,-1,5,4,100],'quasi',[4.8,19],[2,0,1],/1,25/],
      ['quasi-coin','choix-optimal',[12,-1,5,10,60],'quasi',[12,0],[2,2,1],/1,00/],
      ['monopole-inactif','monopole',[14,1.5,20,0],null,null,[3,3,0],/ne produit rien/],
      ['monopole-seuil','monopole',[14,1.5,14,0],null,null,[3,3,0],/ne produit rien/],
      ['monopole-actif','monopole',[24,1.5,6,0],null,null,[0,2,27],/27,00/],
      ['monopole-unitaire','monopole',[24,1.5,0,0],null,null,[2,2,48],/1,000/],
      ['monopole-proche-seuil','monopole',[14,1.5,13.5,0],null,null,[0,2,1/48],/0,02/]
    ];
    for (const [nom, fichier, sliders, famille, xy, answers, result] of scenarios) {
      await ouvrir(fichier, sliders, famille, xy);
      for (let i=0;i<3;i++) {
        await repondre(answers[i], answers[i] === 'skip' ? 'skip' : 'correct');
        if (i<2) await suite();
      }
      assert.equal(await page.locator('.resultats').isVisible(), true);
      assert.match(await page.locator('.resultats').innerText(), result);
      if (captures && ['assurance-neutre','complements','monopole-inactif'].includes(nom))
        await page.screenshot({path:path.join(captures,nom+'.png'),fullPage:true});
      console.log('OK '+nom);
    }
    // Corrections après erreur, puis recommencer avec des paramètres différents.
    await ouvrir('assurance',[60,.25,0,0]);
    assert.match(await repondre(0,'wrong'), /toutes les couvertures/);
    await suite(); assert.match(await repondre(2,'wrong'), /toutes les couvertures/);
    await suite(); await repondre(15,'wrong');
    await page.getByRole('button',{name:'Réduire',exact:true}).click();
    await page.getByRole('button',{name:'Recommencer',exact:true}).click();
    await page.locator('input[type=range]').nth(2).evaluate(el=>{el.value=.2;el.dispatchEvent(new Event('input',{bubbles:true}));});
    // Recommencer est volontairement un mode de révision avec résultats visibles.
    await repondre(2); await suite(false); await repondre(2); await suite(false); await repondre(0);
    await ouvrir('choix-optimal',[.5,-1,5,4,100],'compl',[100/9,100/9]);
    await repondre('skip','skip'); await suite();
    assert.match(await repondre(0,'wrong'), /pas défini au coude/);
    await suite(); await repondre(2,'wrong');
    await ouvrir('monopole',[14,1.5,20,0]);
    assert.match(await repondre(0,'wrong'), /aucune production/);
    await suite(); assert.match(await repondre(2,'wrong'), /aucune vente/);
    await suite(); await repondre(3,'wrong');
    // Fumée sur toute la collection, pas seulement les pages modifiées.
    for (const f of fs.readdirSync(racine).filter(f=>f.endsWith('.html'))) {
      await page.goto(base+'/'+f);
      await page.waitForTimeout(30);
    }
    assert.deepEqual(errors, [], 'erreurs JavaScript navigateur');
    console.log('15 scénarios, corrections erronées/passage/reprise et 19 pages : OK.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(err=>{console.error(err);process.exitCode=1;});
