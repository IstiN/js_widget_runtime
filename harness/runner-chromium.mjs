// `run --engine chromium`: Playwright page, real timers driven host-side.
// Playwright is a devDependency of the integration lane; import lazily so
// compare/coverage/mock work without it.
import { bootItems } from './boot.mjs';
import { createHost, assembleResult } from './host.mjs';
import { HarnessError } from './fixtures.mjs';

export class ChromiumUnavailable extends HarnessError {}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    throw new ChromiumUnavailable('run --engine chromium needs playwright (devDependency) and its browser');
  }
}

export async function runWithChromium(fixture, { settleMs = 1000, ...bootOpts } = {}) {
  const { chromium } = await loadPlaywright();
  const items = bootItems(fixture, bootOpts);
  const browser = await chromium.launch();
  const pendingById = new Map();
  const start = Date.now();
  let error = null;
  try {
    const page = await browser.newPage();
    const host = createHost({
      fixtureDir: fixture.dir,
      mock: fixture.meta.mock ?? {},
      fire(action) {
        if (action.type === 'resolve') {
          callInPage(`__jsrResolve(${JSON.stringify(action.id)}, ${JSON.stringify(action.value) ?? 'undefined'})`);
        } else if (action.type === 'interval') {
          schedule(action.id, action.ms, `__jsrInterval(${JSON.stringify(action.id)})`);
        } else if (action.type === 'raf') {
          schedule(action.id, 16, `__jsrRaf(${JSON.stringify(action.id)}, ${Date.now() - start})`);
        } else if (action.type === 'cancel') {
          const t = pendingById.get(action.id);
          if (t) { clearTimeout(t); pendingById.delete(action.id); }
        }
      },
    });
    function callInPage(code) {
      page.evaluate(code).catch((e) => {
        if (!error) error = `host call failed: ${e.message}`;
      });
    }
    function schedule(id, ms, code) {
      const t = setTimeout(() => {
        pendingById.delete(id);
        host.markFired(id);
        callInPage(code);
      }, ms);
      pendingById.set(id, t);
    }
    await page.goto('about:blank');
    await page.exposeFunction('__jsrHostSend', (channel, payload) => host.handle(channel, payload));
    // the bootstrap's __send calls window.sendMessage — define it before any
    // boot code runs, the way the node and quickjs runners inject it
    await page.addScriptTag({ content: 'window.sendMessage = (channel, payload) => window.__jsrHostSend(channel, payload);' });
    for (const item of items) {
      try {
        await page.addScriptTag({ content: item.code });
      } catch (e) {
        if (!error) error = `${item.name}: ${e.message}`;
        break;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, settleMs));
    for (const t of pendingById.values()) clearTimeout(t);
    return assembleResult({ fixture: fixture.id, platform: 'web', host, error });
  } finally {
    await browser.close();
  }
}
