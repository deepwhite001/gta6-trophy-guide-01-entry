// GTA VI trophy guide entry (Node 22, standard library only): the guide is this
// directory's app/ folder — plain static files a browser opens at app/index.html,
// offline by design (it loads nothing over the network), and its trophy list and
// guides are app/data/trophies.json. This file hands it in: it checks the entry
// against the scorer's caps, copies app/ and screenshots/ beside this file to
// /output, and writes /output/dossier.json, the summary the judge reads (your
// screenshots, the first load's files and bytes, and your source), with the
// vendored make.fun library. Leave vendor/makefun-frontend.ts as it is: the
// scorer requires dossier.json to be byte for byte what its own copy writes.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps (reference/gate.json): check them here first so a bad
// entry fails loudly on my machine instead of quietly on the server.
const shotDir = join(here, 'screenshots');
const shotNames = existsSync(shotDir) ? readdirSync(shotDir).sort() : [];
if (shotNames.length === 0 || shotNames.length > 4) {
  throw new Error(`expected 1 to 4 screenshots, found ${shotNames.length}`);
}
for (const name of shotNames) {
  const size = statSync(join(shotDir, name)).size;
  if (size > 262144) throw new Error(`screenshot ${name} is ${size} bytes, over the 256 KiB cap`);
}
let appFiles = 0;
let appBytes = 0;
const walk = (dir: string): void => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) walk(join(dir, entry.name));
    else {
      appFiles += 1;
      appBytes += statSync(join(dir, entry.name)).size;
    }
  }
};
walk(join(here, 'app'));
if (appFiles > 993) throw new Error(`app/ holds ${appFiles} files, over the 993 cap`);
if (appBytes > 50331648) throw new Error(`app/ is ${appBytes} bytes, over the 48 MiB cap`);

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotDir)) cpSync(shotDir, join(out, 'screenshots'), { recursive: true });

// Only text_max_bytes shapes the bytes; the other caps refuse an entry the
// scorer would refuse, so they must match the scorer's own numbers.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, app_max_files: 993, app_max_bytes: 50331648 }),
);
