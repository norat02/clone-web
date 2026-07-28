#!/usr/bin/env node
/**
 * /clone-web Phase 1 — Reconnaissance
 * Usage: node recon.js <url> [--out <dir>] [--wait <ms>] [--interact]
 *
 * Requires: npm install puppeteer
 * Falls back to web_fetch + manual notes if puppeteer is unavailable.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const url = args[0];
const outDir = args[args.indexOf('--out') + 1] || 'recon';
const waitMs = parseInt(args[args.indexOf('--wait') + 1]) || 2000;
const doInteract = args.includes('--interact');

// Platform detection — Replit requires --no-sandbox due to container constraints.
// Pass --no-sandbox explicitly, or set CLONE_WEB_NO_SANDBOX=1 in your environment.
const noSandbox = args.includes('--no-sandbox') || process.env.CLONE_WEB_NO_SANDBOX === '1' || !!process.env.REPL_ID;

if (!url) {
  console.error('Usage: node recon.js <url> [--out <dir>] [--wait <ms>] [--interact]');
  process.exit(1);
}

const viewports = [
  { name: '1440', width: 1440, height: 900 },
  { name: '768', width: 768, height: 1024 },
  { name: '375', width: 375, height: 812 },
];

async function run() {
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch {
    console.error('[recon] puppeteer not installed. Run: npm install puppeteer');
    console.error('[recon] Falling back: use web_fetch and document findings manually in recon/manual-notes.md');
    process.exit(1);
  }

  fs.mkdirSync(path.join(outDir, 'screenshots'), { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: noSandbox ? ['--no-sandbox', '--disable-setuid-sandbox'] : [],
  });
  const page = await browser.newPage();

  // ── Screenshots at each viewport ─────────────────────────────────────────
  console.log('[recon] Taking screenshots...');
  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForTimeout(waitMs);
    const shot = path.join(outDir, 'screenshots', `full-${vp.name}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    console.log(`[recon] Screenshot saved: ${shot}`);
  }

  // ── Set viewport to 1440 for extraction ──────────────────────────────────
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForTimeout(waitMs);

  // ── Design tokens ─────────────────────────────────────────────────────────
  console.log('[recon] Extracting design tokens...');
  const tokens = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const colors = {};
    const typography = {};
    const spacing = {};
    const radius = {};

    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText === ':root' || rule.selectorText === 'html') {
            for (const prop of rule.style) {
              const val = rule.style.getPropertyValue(prop).trim();
              if (prop.includes('color') || prop.includes('bg') || prop.includes('fill')) {
                colors[prop] = val;
              } else if (prop.includes('font') || prop.includes('text') || prop.includes('leading')) {
                typography[prop] = val;
              } else if (prop.includes('space') || prop.includes('gap') || prop.includes('padding') || prop.includes('margin')) {
                spacing[prop] = val;
              } else if (prop.includes('radius') || prop.includes('rounded')) {
                radius[prop] = val;
              }
            }
          }
        }
      } catch { /* cross-origin sheet */ }
    }

    // Also extract used computed values from body
    const bodyStyles = getComputedStyle(document.body);
    typography['--font-family-computed'] = bodyStyles.fontFamily;
    typography['--font-size-computed'] = bodyStyles.fontSize;
    colors['--color-bg-computed'] = bodyStyles.backgroundColor;
    colors['--color-text-computed'] = bodyStyles.color;

    return { colors, typography, spacing, radius };
  });

  fs.writeFileSync(path.join(outDir, 'tokens.json'), JSON.stringify(tokens, null, 2));
  console.log('[recon] tokens.json written');

  // ── Assets ────────────────────────────────────────────────────────────────
  console.log('[recon] Collecting assets...');
  const assets = await page.evaluate(() => {
    const results = [];
    const seen = new Set();

    document.querySelectorAll('img[src]').forEach(img => {
      if (!seen.has(img.src)) {
        seen.add(img.src);
        const rect = img.getBoundingClientRect();
        results.push({
          src: img.src,
          localPath: 'public/assets/' + img.src.split('/').pop().split('?')[0],
          type: img.src.match(/\.svg/i) ? 'svg' : 'image',
          inline: img.src.match(/\.svg/i) && img.clientWidth < 100,
          dimensions: { width: Math.round(rect.width), height: Math.round(rect.height) },
          usedIn: [],
        });
      }
    });

    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
      if (!seen.has(link.href)) {
        seen.add(link.href);
        results.push({ src: link.href, localPath: 'public/assets/css/' + link.href.split('/').pop(), type: 'css', inline: false, usedIn: [] });
      }
    });

    return results;
  });

  fs.writeFileSync(path.join(outDir, 'assets.json'), JSON.stringify(assets, null, 2));
  console.log(`[recon] assets.json written (${assets.length} assets)`);

  // ── Structure ─────────────────────────────────────────────────────────────
  console.log('[recon] Extracting page structure...');
  const structure = await page.evaluate(() => {
    const sections = [];
    const candidates = document.querySelectorAll('header, footer, main, section, [class*="section"], [class*="hero"], [class*="feature"], [class*="pricing"], [class*="cta"], [class*="testimonial"], [class*="faq"]');

    let order = 0;
    candidates.forEach(el => {
      if (el.parentElement && el.parentElement.tagName !== 'BODY' && el.parentElement.tagName !== 'MAIN') return;
      const rect = el.getBoundingClientRect();
      const scrollTop = window.pageYOffset;
      sections.push({
        name: el.id || el.className.split(' ').find(c => c.length > 2) || el.tagName.toLowerCase() + order,
        selector: el.tagName.toLowerCase() + (el.id ? '#' + el.id : el.className ? '.' + el.className.split(' ')[0] : ''),
        order: order++,
        screenshotCrop: {
          x: 0,
          y: Math.round(rect.top + scrollTop),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        hasSticky: getComputedStyle(el).position === 'sticky' || getComputedStyle(el).position === 'fixed',
        tagName: el.tagName.toLowerCase(),
      });
    });

    return { components: sections, totalHeight: document.body.scrollHeight };
  });

  fs.writeFileSync(path.join(outDir, 'structure.json'), JSON.stringify(structure, null, 2));
  console.log(`[recon] structure.json written (${structure.components.length} components)`);

  // ── Interactions (optional) ───────────────────────────────────────────────
  if (doInteract) {
    console.log('[recon] Sweeping interactions...');
    const interactions = await page.evaluate(() => {
      const results = {};
      document.querySelectorAll('a, button, [onclick], [class*="btn"], [class*="toggle"], [class*="accordion"], [class*="tab"]').forEach(el => {
        const cs = getComputedStyle(el);
        if (cs.transition && cs.transition !== 'all 0s ease 0s') {
          results[el.tagName + '.' + el.className.split(' ')[0]] = {
            transition: cs.transition,
            cursor: cs.cursor,
          };
        }
      });
      return results;
    });
    fs.writeFileSync(path.join(outDir, 'interactions.json'), JSON.stringify(interactions, null, 2));
    console.log('[recon] interactions.json written');
  }

  await browser.close();

  // ── Summary ───────────────────────────────────────────────────────────────
  const summary = {
    url,
    timestamp: new Date().toISOString(),
    viewportsScreenshotted: viewports.map(v => v.name),
    tokenCount: Object.values(tokens).reduce((a, b) => a + Object.keys(b).length, 0),
    assetCount: assets.length,
    componentCount: structure.components.length,
    nextSteps: [
      'Review recon/structure.json — rename generic component names to semantic ones',
      'Check recon/assets.json — mark SVGs as inline:true if they should be embedded',
      'Run scripts/download-assets.js to fetch all assets locally',
      'Proceed to Phase 2 — Foundation',
    ],
  };

  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log('\n[recon] Complete!');
  console.log(JSON.stringify(summary, null, 2));
}

run().catch(err => {
  console.error('[recon] Fatal error:', err.message);
  process.exit(1);
});
