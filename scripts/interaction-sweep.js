#!/usr/bin/env node
/**
 * /clone-web Phase 1 — Interaction sweep
 * Usage: node interaction-sweep.js <url> --selector "section.hero" --events hover,scroll,click --out recon/interactions/hero.json
 *
 * Requires: npm install puppeteer
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const url      = args[0];
const selector = args[args.indexOf('--selector') + 1] || '*';
const events   = (args[args.indexOf('--events') + 1] || 'hover,scroll').split(',');
const outFile  = args[args.indexOf('--out') + 1] || 'recon/interactions/sweep.json';
const noSandbox = args.includes('--no-sandbox') || process.env.CLONE_WEB_NO_SANDBOX === '1' || !!process.env.REPL_ID;

if (!url) { console.error('Usage: node interaction-sweep.js <url> ...'); process.exit(1); }

async function run() {
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: noSandbox ? ['--no-sandbox', '--disable-setuid-sandbox'] : [],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForTimeout(1500);

  const result = { url, selector, timestamp: new Date().toISOString(), interactions: {} };

  // ── Hover states ──────────────────────────────────────────────────────────
  if (events.includes('hover')) {
    const hoverTargets = await page.evaluate((sel) => {
      const container = document.querySelector(sel) || document.body;
      const targets = container.querySelectorAll('a, button, [class*="btn"], [class*="card"], [class*="link"], [class*="cta"]');
      return Array.from(targets).slice(0, 20).map(el => ({
        selector: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className ? '.' + el.className.trim().split(/\s+/)[0] : ''),
        transition: getComputedStyle(el).transition,
        cursor: getComputedStyle(el).cursor,
        text: el.textContent.trim().slice(0, 40),
      }));
    }, selector);

    for (const target of hoverTargets) {
      if (!target.transition || target.transition === 'all 0s ease 0s') continue;
      const before = await page.evaluate(sel => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { color: cs.color, bg: cs.backgroundColor, border: cs.border, transform: cs.transform, opacity: cs.opacity };
      }, target.selector);

      if (!before) continue;
      await page.hover(target.selector).catch(() => {});
      await page.waitForTimeout(300);

      const after = await page.evaluate(sel => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { color: cs.color, bg: cs.backgroundColor, border: cs.border, transform: cs.transform, opacity: cs.opacity };
      }, target.selector);

      if (!after) continue;
      const changed = {};
      for (const k of Object.keys(before)) {
        if (before[k] !== after[k]) changed[k] = { from: before[k], to: after[k] };
      }
      if (Object.keys(changed).length) {
        result.interactions[target.selector] = {
          type: 'hover',
          text: target.text,
          transition: target.transition,
          changes: changed,
        };
      }
    }
  }

  // ── Scroll animations ─────────────────────────────────────────────────────
  if (events.includes('scroll')) {
    const scrollTargets = await page.evaluate((sel) => {
      const container = document.querySelector(sel) || document.body;
      const candidates = container.querySelectorAll('[class*="animate"], [class*="fade"], [class*="slide"], [class*="reveal"], [data-aos], [data-animate]');
      return Array.from(candidates).slice(0, 20).map(el => ({
        selector: el.tagName.toLowerCase() + '.' + (el.className.trim().split(/\s+/)[0] || ''),
        hasAos: el.hasAttribute('data-aos'),
        hasDataAnimate: el.hasAttribute('data-animate'),
        initialOpacity: getComputedStyle(el).opacity,
        initialTransform: getComputedStyle(el).transform,
        transition: getComputedStyle(el).transition,
        animation: getComputedStyle(el).animation,
      }));
    }, selector);

    result.interactions.scroll = {
      type: 'scroll-trigger',
      candidates: scrollTargets.filter(t => t.initialOpacity === '0' || t.hasAos || t.hasDataAnimate),
    };
  }

  // ── Click behaviors ───────────────────────────────────────────────────────
  if (events.includes('click')) {
    const clickTargets = await page.evaluate((sel) => {
      const container = document.querySelector(sel) || document.body;
      const candidates = container.querySelectorAll('[class*="accordion"], [class*="toggle"], [class*="tab"], [aria-expanded]');
      return Array.from(candidates).slice(0, 10).map(el => ({
        selector: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '.' + (el.className.trim().split(/\s+/)[0] || ''),
        ariaExpanded: el.getAttribute('aria-expanded'),
        role: el.getAttribute('role'),
        text: el.textContent.trim().slice(0, 40),
      }));
    }, selector);

    result.interactions.click = { type: 'click', candidates: clickTargets };
  }

  await browser.close();

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  console.log(`[interaction-sweep] Written: ${outFile}`);
  console.log(`[interaction-sweep] Found ${Object.keys(result.interactions).length} interaction categories`);
}

run().catch(err => {
  console.error('[interaction-sweep] Fatal:', err.message);
  process.exit(1);
});
