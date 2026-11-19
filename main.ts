// GTA VI trophy guide entry (Node 22, standard library only). The guide itself
// is the static site in app/ — open app/index.html in a browser, no build step,
// no network at run time. This file is only the hand-in: it checks the entry
// against the scorer's caps, copies app/ and screenshots/ into the output
// directory, and writes /output/dossier.json with the vendored make.fun
// library. Do not touch vendor/makefun-frontend.ts: the scorer rebuilds the
// dossier with its own copy of that library and compares the two byte for
// byte, so this file must call it exactly as the starter does.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const shotDir = join(root, 'screenshots');
const appDir = join(root, 'app');

// The scorer's caps (reference/gate.json). Fail loudly here, on my machine,
// rather than quietly on the server.
const MAX_SHOTS = 4;
const MAX_SHOT_BYTES = 262144;
const MAX_APP_FILES = 993;
const MAX_APP_BYTES = 50331648;

function fail(message: string): never {
  throw new Error(message);
}

const shots = existsSync(shotDir) ? readdirSync(shotDir).sort() : [];
if (shots.length === 0 || shots.length > MAX_SHOTS) {
  fail(`expected 1 to ${MAX_SHOTS} screenshots, found ${shots.length}`);
}
for (const name of shots) {
  const bytes = statSync(join(shotDir, name)).size;
  if (bytes > MAX_SHOT_BYTES) fail(`screenshot ${name} is ${bytes} bytes, over the 256 KiB cap`);
}

let fileCount = 0;
let byteCount = 0;
function countFiles(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) countFiles(path);
    else {
      fileCount += 1;
      byteCount += statSync(path).size;
    }
  }
}
countFiles(appDir);
if (fileCount > MAX_APP_FILES) fail(`app/ holds ${fileCount} files, over the 993 cap`);
if (byteCount > MAX_APP_BYTES) fail(`app/ is ${byteCount} bytes, over the 48 MiB cap`);

// The guide is only as good as its data: the trophy file must parse, hold
// exactly 55 trophies in list order, and match the official grade split.
// A short or corrupt list must fail here, not on the server.
const trophiesDoc = JSON.parse(readFileSync(join(appDir, 'data', 'trophies.json'), 'utf8'));
const trophies = trophiesDoc.trophies;
if (!Array.isArray(trophies) || trophies.length !== 55) {
  fail(`trophies.json holds ${Array.isArray(trophies) ? trophies.length : 'no'} trophies, expected 55`);
}
const grades: Record<string, number> = {};
for (const [index, trophy] of trophies.entries()) {
  if (trophy.id !== index + 1) fail(`trophy at position ${index} has id ${trophy.id}, expected ${index + 1}`);
  if (!trophy.name || !trophy.description || !trophy.guide || !trophy.source_url) {
    fail(`trophy ${trophy.id} is missing a name, description, guide or source`);
  }
  grades[trophy.grade] = (grades[trophy.grade] || 0) + 1;
}
if (grades.platinum !== 1 || grades.gold !== 2 || grades.silver !== 6 || grades.bronze !== 46) {
  fail(`grade split is ${JSON.stringify(grades)}, expected 1 platinum, 2 gold, 6 silver, 46 bronze`);
}

mkdirSync(outDir, { recursive: true });
cpSync(appDir, join(outDir, 'app'), { recursive: true });
cpSync(shotDir, join(outDir, 'screenshots'), { recursive: true });

// The caps below must match the scorer's own numbers: only text_max_bytes
// shapes the bytes, the rest refuse an entry the scorer would refuse.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: MAX_SHOTS, max_bytes: MAX_SHOT_BYTES },
    app_max_files: MAX_APP_FILES,
    app_max_bytes: MAX_APP_BYTES,
  }),
);
console.log(`dossier written to ${join(outDir, 'dossier.json')}`);
