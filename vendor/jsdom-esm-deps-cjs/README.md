# Local CommonJS rebuilds of jsdom's ESM-only dependencies

## Why this exists

See `vendor/exodus-bytes-cjs/README.md` first for the full background
on why any of this is necessary at all (Vercel's deployed Function
runtime throws `ERR_REQUIRE_ESM` on a plain `require()` of an ESM-only
package, even though the exact same code works fine in `next dev`,
`next start`, and a modern local Node.js).

`@exodus/bytes` turned out not to be the only ESM-only package reachable
this way. A static scan of every `require()` call site anywhere in this
project's full `node_modules` tree (resolving each one and checking the
nearest `package.json`'s `"type"` field) turned up three more, all
inside jsdom's own dependency tree and all genuinely core -- not edge
cases:

- **`parse5`** (jsdom's own *nested* copy, a newer major version than
  the dual-mode `parse5` at the top level used by vite/cheerio) --
  jsdom's actual HTML parser and serializer. `lib/jsdom/browser/parser/
  html.js` and `lib/jsdom/living/domparsing/serialization.js` both
  `require()` it directly. There is no parsing or serializing an HTML
  string without this.
- **`@asamuzakjp/css-color`** -- required by `lib/jsdom/living/css/
  helpers/css-values.js`, used whenever jsdom evaluates a CSS color
  value (which this project's articles do: curated `style="color:
  ..."` spans).
- **`@asamuzakjp/dom-selector`** -- required by `lib/jsdom/living/
  nodes/Document-impl.js`, jsdom's CSS-selector engine (`querySelector`
  and relatives, used internally by jsdom itself in various places
  regardless of whether *this* project ever calls `querySelector`).

## What this actually is

The real, unmodified upstream source of each package's actual entry
point, bundled into a single standalone CommonJS file with esbuild:

    npx esbuild --bundle --platform=node --format=cjs --target=node18 \
      <path-to-the-real-entry-point> --outfile=<name>.js

One wrinkle: `@asamuzakjp/dom-selector` pulls in `css-tree`, three of
whose files (`lib/data.js`, `lib/data-patch.js`, `lib/version.js`) load
local JSON data via `createRequire(import.meta.url)`. That's an
ordinary, common ESM idiom for reading a JSON file relative to the
current module -- but esbuild can't see through it when bundling to
CommonJS (the `require` identifier there is a *local* variable holding
whatever `createRequire()` returned, not the bundler-recognized global
`require`, so esbuild can't statically resolve/inline the JSON the way
it does for an ordinary `require("./foo.json")` or `import foo from
"./foo.json"`), and CommonJS has no working `import.meta.url` to give
`createRequire` a base path from in the first place. Rather than fight
that, the three call sites were rewritten (via a small esbuild
`onLoad` plugin, not by hand-editing anything in `node_modules`) to
plain `import` statements for the exact same JSON files, which esbuild
bundles/inlines natively -- same data, no logic changed, just a form
the bundler can actually see through.

No other logic was reimplemented anywhere in any of these three
bundles. Verified with `node --no-experimental-require-module` (which
reproduces Vercel's stricter, non-require(esm) behavior locally) that
each one behaves identically to the real package for this project's
actual usage (parsing/serializing HTML with jsdom, resolving a curated
`rgb()`/hex color, constructing `DOMSelector`).

## How it's wired in

`scripts/patch-esm-only-deps.js` (run automatically via package.json's
`postinstall` script on every `npm install`, including Vercel's own
build-time install) finds every install of each of these packages
anywhere in the dependency tree -- including nested/deduped copies --
and, **only if that particular install is genuinely ESM-only** (its own
`package.json` says `"type": "module"`), overwrites its real entry
point with the matching file here and strips that `"type"` field so
Node reads the replacement as CommonJS. A package installed elsewhere
in the tree that already has a real working CommonJS build (like the
top-level `parse5`) is left completely alone -- the check is
self-verifying rather than a hardcoded path, so it keeps working even
if a future `npm install` reshuffles how these get deduped.

## Regenerating this if one of these packages is ever upgraded

    cd vendor/jsdom-esm-deps-cjs
    npm install esbuild --no-save   # if not already available
    node ../../scripts/build-jsdom-esm-deps-cjs.mjs   # see that file for the exact esbuild-plugin setup
