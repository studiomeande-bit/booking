#!/usr/bin/env node
/* Stamps ?v= on local asset references with a hash of the file's contents.
 *
 * Why: Netlify serves .css/.js with `max-age=31536000, immutable`, so a
 * returning visitor keeps the bundle they already have until the URL
 * changes. The ?v= tags used to be hand-edited, which meant any rebuild
 * where someone forgot to bump them shipped invisibly — the deploy went
 * out and existing visitors never saw it.
 *
 * The hash is derived from content, so this is idempotent: unchanged
 * assets produce no diff, and a changed asset can't be forgotten.
 *
 * Run from the frontend/ directory (npm sets cwd to the package root):
 *   node scripts/stamp-assets.mjs [--check]
 *
 * --check exits non-zero instead of writing, for CI.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const ROOT = process.cwd();
const CHECK_ONLY = process.argv.includes('--check');

/* Only extensions Netlify marks immutable need this. Widen if that changes. */
const STAMPED = new Set(['.css', '.js']);
const SKIP_DIRS = new Set(['node_modules', '.git', '.netlify', 'test-results']);

function walk(dir, hits = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(join(dir, entry.name), hits);
    } else {
      hits.push(join(dir, entry.name));
    }
  }
  return hits;
}

const allFiles = walk(ROOT);
const htmlFiles = allFiles.filter((f) => f.endsWith('.html'));

/* A root-absolute href like "/status/status.min.css" resolves against the
 * site root, which differs per deploy. Each site's root is the directory
 * holding its netlify.toml. */
const siteRoots = allFiles
  .filter((f) => f.endsWith(`${sep}netlify.toml`))
  .map((f) => dirname(f))
  .sort((a, b) => b.length - a.length);

function siteRootFor(htmlPath) {
  return siteRoots.find((r) => htmlPath.startsWith(r + sep)) || ROOT;
}

const hashCache = new Map();
function hashOf(filePath) {
  if (!hashCache.has(filePath)) {
    hashCache.set(filePath, createHash('sha256').update(readFileSync(filePath)).digest('hex').slice(0, 10));
  }
  return hashCache.get(filePath);
}

/* href="..." or src="..." capturing path and any existing query */
const REF = /\b(href|src)="([^"]+?)(\?[^"]*)?"/g;

let changedFiles = 0;
let stamped = 0;
const unresolved = [];

for (const htmlPath of htmlFiles) {
  const original = readFileSync(htmlPath, 'utf8');
  const htmlDir = dirname(htmlPath);
  const siteRoot = siteRootFor(htmlPath);

  const next = original.replace(REF, (whole, attr, rawPath, query = '') => {
    if (/^(https?:)?\/\//.test(rawPath) || /^(mailto|tel|data):/.test(rawPath)) return whole;
    const ext = rawPath.slice(rawPath.lastIndexOf('.')).toLowerCase();
    if (!STAMPED.has(ext)) return whole;

    const base = rawPath.startsWith('/') ? join(siteRoot, rawPath.slice(1)) : resolve(htmlDir, rawPath);
    if (!existsSync(base) || !statSync(base).isFile()) {
      unresolved.push(`${relative(ROOT, htmlPath)} -> ${rawPath}`);
      return whole;
    }

    /* Preserve any other query params; replace only v= */
    const params = new URLSearchParams(query.replace(/^\?/, ''));
    params.set('v', hashOf(base));
    stamped += 1;
    return `${attr}="${rawPath}?${params.toString()}"`;
  });

  if (next !== original) {
    changedFiles += 1;
    if (!CHECK_ONLY) writeFileSync(htmlPath, next);
  }
}

for (const miss of [...new Set(unresolved)]) {
  console.warn(`stamp-assets: unresolved reference — ${miss}`);
}

console.log(
  `stamp-assets: ${stamped} reference(s) across ${htmlFiles.length} page(s); ` +
    `${changedFiles} file(s) ${CHECK_ONLY ? 'would change' : 'updated'}.`
);

if (CHECK_ONLY && changedFiles > 0) {
  console.error('stamp-assets: asset hashes are stale. Run `npm run stamp` and commit the result.');
  process.exit(1);
}
