#!/usr/bin/env node
/**
 * /clone-web Phase 2 — Asset downloader
 * Usage: node download-assets.js recon/assets.json [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const assetsFile = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

if (!assetsFile) {
  console.error('Usage: node download-assets.js <assets.json> [--dry-run]');
  process.exit(1);
}

const assets = JSON.parse(fs.readFileSync(assetsFile, 'utf8'));
const errors = [];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) {
      console.log(`[skip] already exists: ${dest}`);
      return resolve({ skipped: true });
    }

    fs.mkdirSync(path.dirname(dest), { recursive: true });

    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);

    proto.get(url, { headers: { 'User-Agent': 'clone-web/1.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve({ size: fs.statSync(dest).size }); });
    }).on('error', err => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function run() {
  console.log(`[download-assets] ${assets.length} assets to process${dryRun ? ' (dry run)' : ''}`);

  for (const asset of assets) {
    if (!asset.src.startsWith('http')) {
      console.log(`[skip] relative/data URL: ${asset.src.slice(0, 60)}`);
      continue;
    }

    if (dryRun) {
      console.log(`[dry] would download ${asset.src} → ${asset.localPath}`);
      continue;
    }

    try {
      const result = await download(asset.src, asset.localPath);
      if (result.skipped) continue;
      console.log(`[ok] ${asset.localPath} (${(result.size / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.error(`[err] ${asset.src}: ${err.message}`);
      errors.push({ src: asset.src, localPath: asset.localPath, error: err.message });
    }
  }

  if (errors.length) {
    fs.writeFileSync('recon/download-errors.json', JSON.stringify(errors, null, 2));
    console.error(`\n[download-assets] ${errors.length} errors — see recon/download-errors.json`);
    console.error('For failed assets, add placeholder files or use external URLs as fallback.');
  } else {
    console.log('\n[download-assets] All assets downloaded successfully.');
  }
}

run().catch(err => {
  console.error('[download-assets] Fatal:', err.message);
  process.exit(1);
});
