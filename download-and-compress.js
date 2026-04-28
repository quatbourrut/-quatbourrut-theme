#!/usr/bin/env node
'use strict';

const sharp  = require('sharp');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');

// ── Config ────────────────────────────────────────────────────────────────────
const SRC_DIR = path.join(__dirname, 'assets');
const OUT_DIR = path.join(os.homedir(), 'Desktop', 'images-optimisees');
const QUALITY = 80;
const MAX_WIDTH = 1200;
const EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);

// ── ANSI colors ───────────────────────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  dim:    '\x1b[2m',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function humanSize(bytes) {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} Mo`;
  if (bytes >= 1_024)     return `${(bytes / 1_024).toFixed(1)} Ko`;
  return `${bytes} o`;
}

function pct(before, after) {
  return before > 0 ? Math.round((before - after) * 100 / before) : 0;
}

function line(char = '─', len = 72) {
  return char.repeat(len);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // Ensure output dir exists
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Collect source images
  let files = [];
  if (fs.existsSync(SRC_DIR)) {
    files = fs.readdirSync(SRC_DIR)
      .filter(f => EXTENSIONS.has(path.extname(f).toLowerCase()))
      .map(f => path.join(SRC_DIR, f))
      .sort();
  }

  // Header
  const now = new Date().toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  console.log(`\n${c.bold}Compression WebP — ${now}${c.reset}`);
  console.log(`  Source  : ${SRC_DIR}`);
  console.log(`  Sortie  : ${OUT_DIR}`);
  console.log(`  Options : WebP q${QUALITY} · max ${MAX_WIDTH}px · sans agrandissement`);
  console.log();

  if (files.length === 0) {
    console.log(line());
    console.log(`\n${c.yellow}Aucune image JPG/JPEG/PNG trouvée dans :${c.reset}`);
    console.log(`  ${SRC_DIR}\n`);
    console.log(`${c.dim}Pour utiliser ce script :${c.reset}`);
    console.log(`  1. Dépose tes images JPG/PNG dans le dossier assets/`);
    console.log(`  2. Relance : node download-and-compress.js\n`);
    console.log(`${c.dim}Ou modifie SRC_DIR en haut du fichier pour pointer`);
    console.log(`vers un autre dossier (ex: ~/Downloads/images-produits).${c.reset}\n`);
    process.exit(0);
  }

  console.log(line());

  let totalBefore = 0;
  let totalAfter  = 0;
  let countOk     = 0;
  let countErr    = 0;

  for (const srcPath of files) {
    const stem    = path.basename(srcPath, path.extname(srcPath));
    const outPath = path.join(OUT_DIR, `${stem}.webp`);
    const before  = fs.statSync(srcPath).size;

    try {
      const meta = await sharp(srcPath).metadata();
      const needsResize = meta.width > MAX_WIDTH;

      const pipeline = sharp(srcPath);

      if (needsResize) {
        pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
      }

      await pipeline
        .webp({ quality: QUALITY, effort: 4 })
        .toFile(outPath);

      const after = fs.statSync(outPath).size;
      const saved = before - after;
      const gain  = pct(before, after);

      totalBefore += before;
      totalAfter  += after;
      countOk++;

      const sizeInfo = `${humanSize(before)} → ${humanSize(after)}`;
      const resizeTag = needsResize
        ? `${c.dim}(redim. ${meta.width}px → ${MAX_WIDTH}px)${c.reset}`
        : `${c.dim}(${meta.width}px, pas de redim.)${c.reset}`;

      if (saved >= 0) {
        console.log(`  ${c.green}✓${c.reset} ${c.bold}${stem}.webp${c.reset} ${resizeTag}`);
        console.log(`    ${sizeInfo}   ${c.green}−${gain}% (${humanSize(saved)} économisés)${c.reset}`);
      } else {
        console.log(`  ${c.yellow}~${c.reset} ${c.bold}${stem}.webp${c.reset} ${resizeTag}`);
        console.log(`    ${sizeInfo}   ${c.yellow}résultat plus lourd en WebP (fichier conservé)${c.reset}`);
      }

    } catch (err) {
      console.log(`  ${c.red}✗${c.reset} ${c.bold}${path.basename(srcPath)}${c.reset}`);
      console.log(`    ${c.red}${err.message}${c.reset}`);
      countErr++;
    }
  }

  // Summary
  const totalSaved = totalBefore - totalAfter;
  const totalGain  = pct(totalBefore, totalAfter);

  console.log(line());
  console.log(`\n${c.bold}Résumé${c.reset}`);
  console.log(`  Images traitées : ${countOk}   Erreurs : ${countErr}`);
  console.log(`  Poids avant     : ${humanSize(totalBefore)}`);
  console.log(`  Poids après     : ${humanSize(totalAfter)}`);
  console.log(`  ${c.bold}${c.green}Gain total      : ${humanSize(totalSaved)} (${totalGain}% de réduction)${c.reset}`);
  console.log(`\n  Fichiers WebP dans : ${OUT_DIR}\n`);
}

main().catch(err => {
  console.error(`\n${c.red}Erreur fatale :${c.reset}`, err.message);
  process.exit(1);
});
