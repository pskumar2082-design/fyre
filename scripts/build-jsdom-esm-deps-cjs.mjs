#!/usr/bin/env node
// ---------------------------------------------------------------------
// Regenerates vendor/jsdom-esm-deps-cjs/*.js from whatever version of
// parse5 (jsdom's nested copy), @asamuzakjp/css-color and
// @asamuzakjp/dom-selector are currently installed. Run this after
// bumping jsdom if `npm ls parse5` / `npm ls @asamuzakjp/css-color` /
// `npm ls @asamuzakjp/dom-selector` shows a new version, then commit
// the regenerated files in vendor/jsdom-esm-deps-cjs/.
//
// Requires esbuild's JS API (already a transitive devDependency via
// Next.js/vitest tooling -- `npm install esbuild --no-save` first if
// `node scripts/build-jsdom-esm-deps-cjs.mjs` can't find it).
//
// See vendor/jsdom-esm-deps-cjs/README.md for why this exists and why
// the css-tree onLoad plugin below is needed.
// ---------------------------------------------------------------------
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const outDir = path.join(projectRoot, 'vendor', 'jsdom-esm-deps-cjs');

const cssTreeDataPatchRewrite = `import patch from '../data/patch.json'\nexport default patch\n`;
const cssTreeVersionRewrite = `import pkg from '../package.json'\nexport const { version } = pkg\n`;
const cssTreeDataOriginal =
  "import { createRequire } from 'module';\nimport patch from './data-patch.js';\n\nconst require = createRequire(import.meta.url);\nconst mdnAtrules = require('mdn-data/css/at-rules.json');\nconst mdnProperties = require('mdn-data/css/properties.json');\nconst mdnSyntaxes = require('mdn-data/css/syntaxes.json');";
const cssTreeDataRewrite =
  "import patch from './data-patch.js';\nimport mdnAtrules from 'mdn-data/css/at-rules.json';\nimport mdnProperties from 'mdn-data/css/properties.json';\nimport mdnSyntaxes from 'mdn-data/css/syntaxes.json';";

// See vendor/jsdom-esm-deps-cjs/README.md: css-tree's data.js/
// data-patch.js/version.js load local JSON via
// `createRequire(import.meta.url)`, a pattern esbuild can't statically
// bundle (the `require` there is a local variable, not the bundler's
// recognized global) and that breaks outright once bundled to
// CommonJS (import.meta.url has no CJS equivalent). Rewritten to plain
// `import` statements for the same JSON files instead, which esbuild
// DOES bundle/inline natively -- no data or logic changed.
const fixCssTreeJsonLoading = {
  name: 'fix-css-tree-create-require-json',
  setup(build) {
    build.onLoad({ filter: /css-tree[/\\]lib[/\\]data-patch\.js$/ }, (args) => ({
      contents: cssTreeDataPatchRewrite,
      loader: 'js',
      resolveDir: path.dirname(args.path)
    }));
    build.onLoad({ filter: /css-tree[/\\]lib[/\\]version\.js$/ }, (args) => ({
      contents: cssTreeVersionRewrite,
      loader: 'js',
      resolveDir: path.dirname(args.path)
    }));
    build.onLoad({ filter: /css-tree[/\\]lib[/\\]data\.js$/ }, (args) => {
      const src = fs.readFileSync(args.path, 'utf8');
      if (!src.includes(cssTreeDataOriginal)) {
        throw new Error(
          `css-tree's lib/data.js no longer matches the expected createRequire(import.meta.url) pattern -- ` +
            `it may have changed shape in a newer css-tree version. Update cssTreeDataOriginal/cssTreeDataRewrite ` +
            `in this script to match before re-running.`
        );
      }
      return {
        contents: src.replace(cssTreeDataOriginal, cssTreeDataRewrite),
        loader: 'js',
        resolveDir: path.dirname(args.path)
      };
    });
  }
};

const targets = [
  {
    name: 'parse5',
    entry: path.join(projectRoot, 'node_modules/jsdom/node_modules/parse5/dist/index.js'),
    outfile: path.join(outDir, 'parse5.js')
  },
  {
    name: '@asamuzakjp/css-color',
    entry: path.join(projectRoot, 'node_modules/@asamuzakjp/css-color/dist/esm/index.js'),
    outfile: path.join(outDir, 'css-color.js')
  },
  {
    name: '@asamuzakjp/dom-selector',
    entry: path.join(projectRoot, 'node_modules/@asamuzakjp/dom-selector/src/index.js'),
    outfile: path.join(outDir, 'dom-selector.js')
  }
];

for (const t of targets) {
  if (!fs.existsSync(t.entry)) {
    console.warn(`skip ${t.name}: ${t.entry} not found (not installed?)`);
    continue;
  }
  await esbuild.build({
    entryPoints: [t.entry],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    outfile: t.outfile,
    plugins: [fixCssTreeJsonLoading]
  });
  console.log(`built ${t.name} -> ${path.relative(projectRoot, t.outfile)}`);
}
