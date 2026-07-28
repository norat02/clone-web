#!/usr/bin/env node
/**
 * /clone-web Phase 5 — Visual diff
 * Usage: node visual-diff.js --original recon/screenshots/ --clone http://localhost:3000 --out qa/diff-report.html
 *
 * Requires: npm install puppeteer pixelmatch pngjs
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const get = key => { const i = args.indexOf(key); return i !== -1 ? args[i + 1] : null; };

const originalDir = get('--original');
const cloneUrl    = get('--clone');
const outFile     = get('--out') || 'qa/diff-report.html';
const threshold   = parseFloat(get('--threshold') || '90');
const noSandbox   = args.includes('--no-sandbox') || process.env.CLONE_WEB_NO_SANDBOX === '1' || !!process.env.REPL_ID;

if (!originalDir || !cloneUrl) {
  console.error('Usage: node visual-diff.js --original <dir> --clone <url> --out <html> [--threshold 90]');
  process.exit(1);
}

const viewports = [
  { name: '1440', width: 1440, height: 900 },
  { name: '768',  width: 768,  height: 1024 },
  { name: '375',  width: 375,  height: 812 },
];

async function run() {
  let puppeteer, { PNG } = {}, pixelmatch;
  try {
    puppeteer = require('puppeteer');
    ({ PNG } = require('pngjs'));
    pixelmatch = require('pixelmatch');
  } catch {
    console.error('[visual-diff] Missing deps. Run: npm install puppeteer pixelmatch pngjs');
    process.exit(1);
  }

  fs.mkdirSync('qa/screenshots', { recursive: true });
  fs.mkdirSync('qa/diffs', { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: noSandbox ? ['--no-sandbox', '--disable-setuid-sandbox'] : [],
  });
  const page = await browser.newPage();
  const results = [];

  for (const vp of viewports) {
    const origPath = path.join(originalDir, `full-${vp.name}.png`);
    if (!fs.existsSync(origPath)) {
      console.log(`[visual-diff] No original for ${vp.name}px — skipping`);
      continue;
    }

    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto(cloneUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForTimeout(1000);

    const clonePath = `qa/screenshots/clone-${vp.name}.png`;
    await page.screenshot({ path: clonePath, fullPage: true });

    // Compare
    const origImg  = PNG.sync.read(fs.readFileSync(origPath));
    const cloneImg = PNG.sync.read(fs.readFileSync(clonePath));

    // Crop to same height
    const h = Math.min(origImg.height, cloneImg.height);
    const w = vp.width;
    const diff = new PNG({ width: w, height: h });
    const numDiffPixels = pixelmatch(origImg.data, cloneImg.data, diff.data, w, h, { threshold: 0.1 });
    const totalPixels = w * h;
    const similarity = ((1 - numDiffPixels / totalPixels) * 100).toFixed(1);

    const diffPath = `qa/diffs/diff-${vp.name}.png`;
    fs.writeFileSync(diffPath, PNG.sync.write(diff));

    results.push({ viewport: vp.name, similarity: parseFloat(similarity), diffPath, origPath, clonePath, pass: parseFloat(similarity) >= threshold });
    console.log(`[visual-diff] ${vp.name}px: ${similarity}% similarity (${numDiffPixels} diff pixels) — ${parseFloat(similarity) >= threshold ? 'PASS' : 'FAIL'}`);
  }

  await browser.close();

  // ── HTML report ───────────────────────────────────────────────────────────
  const rows = results.map(r => `
    <tr class="${r.pass ? 'pass' : 'fail'}">
      <td>${r.viewport}px</td>
      <td>${r.similarity}%</td>
      <td>${r.pass ? '✓ Pass' : '✗ Fail'}</td>
    </tr>
    <tr>
      <td colspan="3">
        <div class="imgs">
          <figure><figcaption>Original</figcaption><img src="../${r.origPath}" alt="Original"></figure>
          <figure><figcaption>Clone</figcaption><img src="../${r.clonePath}" alt="Clone"></figure>
          <figure><figcaption>Diff (red = mismatch)</figcaption><img src="../${r.diffPath}" alt="Diff"></figure>
        </div>
      </td>
    </tr>`).join('');

  const allPass = results.every(r => r.pass);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Visual diff report — clone-web</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 1400px; margin: 2rem auto; padding: 0 1rem; background: #f5f5f5; color: #111; }
  h1 { font-size: 1.5rem; margin-bottom: 1rem; }
  .summary { padding: .75rem 1rem; border-radius: 8px; margin-bottom: 1.5rem; font-weight: 500; }
  .summary.pass { background: #d1fae5; color: #065f46; }
  .summary.fail { background: #fee2e2; color: #7f1d1d; }
  table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; }
  th { background: #1a1a1a; color: white; padding: .5rem .75rem; text-align: left; font-size: .85rem; }
  td { padding: .5rem .75rem; font-size: .9rem; border-bottom: 1px solid #eee; }
  tr.pass td:nth-child(3) { color: #065f46; font-weight: 500; }
  tr.fail td:nth-child(3) { color: #7f1d1d; font-weight: 500; }
  .imgs { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; padding: .5rem 0 1rem; }
  figure { display: flex; flex-direction: column; gap: .25rem; }
  figcaption { font-size: .75rem; color: #666; }
  img { width: 100%; border: 1px solid #ddd; border-radius: 4px; }
  .threshold { color: #666; font-size: .85rem; }
</style>
</head>
<body>
<h1>Visual diff report</h1>
<p class="threshold">Pass threshold: ${threshold}% similarity</p>
<div class="summary ${allPass ? 'pass' : 'fail'}">
  ${allPass ? '✓ All viewports pass' : '✗ Some viewports below threshold — review diff images'}
</div>
<table>
  <thead><tr><th>Viewport</th><th>Similarity</th><th>Result</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body>
</html>`;

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html);
  console.log(`\n[visual-diff] Report: ${outFile}`);

  if (!allPass) {
    console.error('[visual-diff] Some viewports failed. Fix and re-run.');
    process.exit(1);
  }
}

run().catch(err => {
  console.error('[visual-diff] Fatal:', err.message);
  process.exit(1);
});
