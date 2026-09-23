#!/usr/bin/env node
'use strict';

// ---------------------------------------------------------------------
// Runs on every `npm install` (the "postinstall" script). See
// vendor/exodus-bytes-cjs/README.md and vendor/jsdom-esm-deps-cjs/README.md
// for the full story. In short: jsdom (via isomorphic-dompurify, used
// to sanitize article HTML -- lib/richText/sanitize.ts) transitively
// depends on several packages that publish ESM-only, with no working
// CommonJS entry point at all: @exodus/bytes, and (nested inside
// jsdom's own dependency tree) parse5, @asamuzakjp/css-color and
// @asamuzakjp/dom-selector. Various files across jsdom's own internals
// and its other dependencies (html-encoding-sniffer, whatwg-url) all
// `require()` these as if they were CommonJS.
//
// That mismatch is silently absorbed by webpack whenever this code is
// bundled (`next dev`, `next start` locally) and even by a modern local
// Node.js (22.12+, where `require()` of an ESM module just works). It
// is NOT absorbed by Vercel's actual deployed Function runtime, which
// throws ERR_REQUIRE_ESM regardless of which Node.js "version" is
// selected in Project Settings (confirmed directly against this
// project). Patching around one call site at a time turned out not to
// be durable -- discovering each new one only by watching it crash in
// production isn't a fix, it's a queue -- so instead every ESM-only
// package actually reachable from a CommonJS require() anywhere in
// this dependency tree was found with a real static-analysis scan
// (walk node_modules, find every require() call site, resolve it, and
// check the nearest package.json's "type" field), each one's *real*
// upstream source was bundled into a standalone CommonJS file with
// esbuild (no logic reimplemented -- see each vendor/*/README.md for
// exactly how and why), and this script replaces the broken install
// with that bundle -- wherever npm happened to put it -- every time
// dependencies are installed.
//
// Each entry below is only patched if the package installed there is
// GENUINELY ESM-only ("type": "module" with no working CommonJS
// entry) -- e.g. the top-level `parse5` package (used by vite/cheerio)
// ships a real dual ESM+CommonJS build and is left completely alone;
// only jsdom's own *nested* copy (a newer, ESM-only major version) is
// ESM-only and gets patched. This makes the check self-verifying
// rather than hardcoding a specific nested path that could shift
// after a future `npm install` reshuffles how things get deduped.
// ---------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const nodeModulesRoot = path.join(projectRoot, 'node_modules');

const REPLACEMENTS = [
  {
    // Package dir name to search for (as it appears under any
    // node_modules/ -- for a scoped package this is "scope/name").
    packageDirName: '@exodus/bytes',
    vendorDir: path.join(projectRoot, 'vendor', 'exodus-bytes-cjs'),
    // [installed-relative-path, vendor-filename] pairs -- @exodus/bytes
    // has several real entry points actually used across the tree.
    files: [
      ['encoding.js', 'encoding.js'],
      ['encoding-lite.js', 'encoding-lite.js'],
      ['base64.js', 'base64.js'],
      ['whatwg.js', 'whatwg.js']
    ]
  },
  {
    packageDirName: 'parse5',
    vendorDir: path.join(projectRoot, 'vendor', 'jsdom-esm-deps-cjs'),
    // parse5's package.json "exports" only ever points at dist/index.js
    // (see its own exports map) -- overwrite that exact file so every
    // consumer's `require("parse5")` keeps resolving the same way.
    files: [['dist/index.js', 'parse5.js']]
  },
  {
    packageDirName: '@asamuzakjp/css-color',
    vendorDir: path.join(projectRoot, 'vendor', 'jsdom-esm-deps-cjs'),
    files: [['dist/esm/index.js', 'css-color.js']]
  },
  {
    packageDirName: '@asamuzakjp/dom-selector',
    vendorDir: path.join(projectRoot, 'vendor', 'jsdom-esm-deps-cjs'),
    files: [['src/index.js', 'dom-selector.js']]
  }
];

function findPackageDirs(dir, targetDirName, found, depth) {
  if (depth > 14) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  const [scope, name] = targetDirName.includes('/') ? targetDirName.split('/') : [null, targetDirName];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);

    if (scope && entry.name === scope) {
      const candidate = path.join(full, name);
      if (fs.existsSync(candidate)) found.push(candidate);
      // A scope directory (e.g. "@exodus") never itself contains
      // another node_modules -- no need to recurse further into it.
      continue;
    }
    if (!scope && entry.name === name) {
      found.push(full);
      // fall through -- this package could still have its own nested
      // node_modules with an unrelated same-named dependency, keep looking
    }

    if (entry.name === 'node_modules') {
      findPackageDirs(full, targetDirName, found, depth + 1);
    } else if (entry.name !== '.bin') {
      const nested = path.join(full, 'node_modules');
      if (fs.existsSync(nested)) findPackageDirs(nested, targetDirName, found, depth + 1);
    }
  }
}

function isGenuinelyEsmOnly(pkgDir) {
  const pkgJsonPath = path.join(pkgDir, 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    return pkg.type === 'module';
  } catch {
    return false;
  }
}

if (!fs.existsSync(nodeModulesRoot)) {
  process.exit(0);
}

let totalPatched = 0;

for (const replacement of REPLACEMENTS) {
  const found = [];
  findPackageDirs(nodeModulesRoot, replacement.packageDirName, found, 0);

  for (const pkgDir of found) {
    if (!isGenuinelyEsmOnly(pkgDir)) continue; // a real working dual/CJS build -- leave it alone

    for (const [installedRelPath, vendorFileName] of replacement.files) {
      const dest = path.join(pkgDir, installedRelPath);
      const src = path.join(replacement.vendorDir, vendorFileName);
      if (!fs.existsSync(src)) {
        console.warn(`patch-esm-only-deps: missing vendor file ${src}, skipping`);
        continue;
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }

    // Our copied-in content is CommonJS; the package's own package.json
    // still says "type": "module", which would make Node parse it as
    // an ES module regardless of content. Strip that.
    const pkgJsonPath = path.join(pkgDir, 'package.json');
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      delete pkg.type;
      fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n');
    } catch (err) {
      console.warn(`patch-esm-only-deps: could not update ${pkgJsonPath}:`, err.message);
    }

    totalPatched++;
  }
}

if (totalPatched > 0) {
  console.log(`patch-esm-only-deps: replaced ${totalPatched} ESM-only package install(s) with CommonJS rebuilds.`);
}
