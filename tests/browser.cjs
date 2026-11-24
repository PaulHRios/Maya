/* Run with a served localhost checkout: node tests/browser.cjs. External requests
   are intercepted. Requires Playwright and Chromium; never reads private data. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.MAYA_BASE_URL || 'http://127.0.0.1:9753';
const login = page => page.addInitScript(() => {
  if (localStorage.getItem('test.maya.initialized')) return;
  localStorage.setItem('test.maya.initialized', '1');
  localStorage.setItem('maya.session.v1', 'ok');
  localStorage.setItem('maya.sesion-activa.v1', '{"familia":"fixture","email":"nobody@example.invalid","quien":"papa"}');
  localStorage.setItem('maya.dispositivo.v1', 'papa');
  localStorage.setItem('maya.tema.v1', 'pink');
  localStorage.setItem('maya.idioma.v1', 'es');
  localStorage.setItem('maya.avisos-etapa.fixture-baby', '["reflejos","brotes","piel","colicos","vacunas2m"]');
  localStorage.setItem('maya.bebe-activo.v1', 'fixture-baby');
  localStorage.setItem('maya.bebes.v1', '[{"familia":"fixture","id":"fixture-baby","nombre":"Luna"}]');
  localStorage.setItem('maya.config.v1.fixture', '{"owner":"fake","repo":"not-real","branch":"main","token":"mock-only","autoSync":false}');
  const d = new Date();
  d.setDate(d.getDate() - 38);
  const isoAgo = mins => new Date(Date.now() - mins * 60000).toISOString();
  localStorage.setItem('maya.data.v1.fixture-baby', JSON.stringify({
    version: 1, bebe: {nombre:'Luna', nacimiento:d.toISOString().slice(0,10)},
    tomas:[{id:'feed', inicio:isoAgo(251), tipo:'donante', ml:65}],
    panales:[{id:'poop', hora:isoAgo(1500), tipo:'popo'}],
    suenos:[{id:'nap', inicio:isoAgo(145), fin:isoAgo(99)}],
    fotos: ['front', 'flaky', 'legacy'].map((id,i) => ({ id, fecha:isoAgo(100+i), archivo:id+'.jpg',
      titulo:id, miniatura:i<2, sincronizada:true, updatedAt:isoAgo(100+i) })),
  }));
});
(async () => {
  const browser = await chromium.launch({ headless:true, executablePath:process.env.CHROMIUM || '/usr/bin/chromium', args:['--no-sandbox'] });
  try {
    const page = await browser.newPage({ serviceWorkers:'block', viewport:{width:390,height:844} });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await login(page);
    let full, thumb;
    const counts = new Map(), puts = new Map(), deletes = new Set();
    let active = 0, max = 0;
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(base).origin) return route.continue();
      if (url.hostname !== 'api.github.com' || !url.pathname.startsWith('/repos/fake/not-real/contents/')) return route.abort();
      const path = url.pathname.split('/contents/')[1];
      const method = route.request().method();
      if (method === 'PUT') {
        puts.set(path, route.request().postDataJSON());
        return route.fulfill({ json:{sha:'fake'} });
      }
      if (method === 'DELETE') { deletes.add(path); return route.fulfill({ json:{} }); }
      counts.set(path, (counts.get(path) || 0) + 1);
      if (!path.includes('.jpg') || path.includes('avatar')) return route.fulfill({ status:404, json:{} });
      active++; max = Math.max(max, active);
      await new Promise(r => setTimeout(r, 70));
      active--;
      if (path.includes('flaky') && counts.get(path) === 1) return route.fulfill({ status:503, json:{} });
      return route.fulfill({ json: { content: path.includes('miniaturas') ? thumb : full, sha:'fake' } });
    });
    await page.goto(base + '/index.html?login=1');
    [full, thumb] = await page.evaluate(() => [1280,300].map(n => {
      const c = document.createElement('canvas'); c.width=n; c.height=n;
      const x=c.getContext('2d'); x.fillStyle='#ecb5bd'; x.fillRect(0,0,n,n);
      return c.toDataURL('image/jpeg').split(',')[1];
    }));
    await page.locator('[data-tab=mas]').click();
    await page.locator('[data-vista=ajustes]').click();
    const r = page.locator('#rem-settings');
    await r.locator('input[name=feed]').check();
    await r.locator('input[name=poop]').check();
    await r.locator('input[name=photo]').check();
    await r.locator('input[name=quiet]').uncheck();
    await r.locator('[type=submit]').click();
    await page.locator('#care-reminders').getByText(/no registras una toma de Luna/).waitFor();
    await page.locator('#care-reminders').getByText(/Falta la foto de Luna de la semana/).waitFor();
    await r.locator('input[name=quiet]').check();
    await r.locator('input[name=from]').fill('00:00');
    await r.locator('input[name=to]').fill('00:00');
    await r.locator('[type=submit]').click();
    assert.equal(await page.locator('#care-reminders').isVisible(), false);
    await page.locator('[data-tab=inicio]').click();
    await page.locator('[data-tab=mas]').click();
    await page.locator('[data-vista=fotos]').click();
    await page.locator('.photo-tile.foto-lista').first().waitFor();
    await page.evaluate(() => window.fixtureFront = document.querySelector('.photo-tile[data-i="0"]'));
    await page.waitForFunction(() => document.querySelectorAll('.photo-tile.foto-lista').length === 3);
    assert.ok(max <= 3, 'Preview request concurrency bounded');
    assert.equal(counts.get('fotos/front.jpg'), undefined, 'Existing new sidecar avoids downloading its original');
    assert.equal(counts.get('fotos/miniaturas/front.jpg'), 1, 'successful tile not retried');
    assert.equal(counts.get('fotos/miniaturas/flaky.jpg'), 2, 'failed tile reattempted');
    assert.equal(counts.get('fotos/legacy.jpg'), 1, 'legacy original downloaded once to make preview');
    assert.ok(await page.evaluate(() => window.fixtureFront === document.querySelector('.photo-tile[data-i="0"]')));
    const sizes = await page.locator('.photo-tile img').evaluateAll(imgs => imgs.map(i => i.naturalWidth));
    assert.deepEqual(sizes,[300,300,300]);
    await page.locator('.photo-tile').first().click();
    await page.waitForFunction(() => document.querySelector('.photo-viewer img')?.naturalWidth === 1280);
    assert.equal(counts.get('fotos/front.jpg'), 1, 'first full-size fetch was opening the viewer');
    await page.locator('#pv-close').click();
    // Reload the app, enter album again, and ensure the legacy cache persisted.
    await page.reload();
    await page.locator('[data-tab=mas]').click();
    await page.locator('[data-vista=fotos]').click();
    await page.waitForFunction(() => document.querySelectorAll('.photo-tile.foto-lista').length === 3);
    assert.equal(counts.get('fotos/legacy.jpg'), 1);
    assert.equal(counts.get('fotos/miniaturas/front.jpg'), 1);
    await page.locator('.photo-tile').first().click();
    page.once('dialog', d => d.accept());
    await page.locator('#pv-del').click();
    await page.evaluate(() => Store.syncNow());
    assert.ok(deletes.has('fotos/miniaturas/front.jpg'));
    assert.ok(!deletes.has('fotos/front.jpg'), 'original retention policy unchanged');
    assert.deepEqual(errors, []);
    console.log('PASS: named opt-in/quiet reminders; bounded gallery; original on open; retry; persisted legacy preview; sidecar logical deletion.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
