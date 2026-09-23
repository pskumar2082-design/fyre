# Local CommonJS rebuild of @exodus/bytes

## Why this exists

jsdom (via isomorphic-dompurify, used to sanitize article HTML -- see
`lib/richText/sanitize.ts`) depends on the real `@exodus/bytes` package
for its text-encoding and URL-percent-encoding utilities. The real
package is published **ESM-only** (`"type": "module"`, no CommonJS
entry point at all), while jsdom's own internals -- and several of
jsdom's *other* dependencies (`html-encoding-sniffer`, `whatwg-url`) --
all `require("@exodus/bytes/...")` it as plain CommonJS.

That mismatch is silently absorbed by webpack whenever jsdom gets
bundled for the browser or for `next dev`/`next start` locally, and
even by a modern local Node.js (22.12+, since `require()` of an ESM
module started working transparently there). It is **not** absorbed
by Vercel's actual serverless Function runtime: regardless of which
Node.js "version" is selected in Vercel's Project Settings (confirmed
directly -- this project is set to 24.x and the crash is identical),
`require()` of an ESM module throws there:

    Error [ERR_REQUIRE_ESM]: require() of ES Module
    .../node_modules/@exodus/bytes/encoding-lite.js from
    .../node_modules/html-encoding-sniffer/lib/html-encoding-sniffer.js
    not supported.

`jsdom` is marked as a `serverComponentsExternalPackages` entry in
`next.config.js` (for an unrelated, real bug -- see the comment there),
which means it's loaded via a plain Node `require()` on Vercel instead
of being processed by webpack, so this ESM/CommonJS mismatch is no
longer hidden there. Downgrading jsdom doesn't dodge it either --
`@exodus/bytes` was introduced mid-way through jsdom's own 27.x line,
and an unrelated *second* ESM-only dependency (`@csstools/css-calc`,
pulled in via jsdom's CSS color parsing) already exists even further
back. This is an ecosystem-wide trend (actively maintained packages
increasingly publishing ESM-only), not a one-off incompatibility, so
patching around individual call sites isn't durable.

## What this actually is

The **exact same, unmodified upstream source** of the real
`@exodus/bytes@1.16.0`, for only the four entry points anything in this
project's dependency tree actually imports (`encoding.js`,
`encoding-lite.js`, `base64.js`, `whatwg.js`) -- bundled into
standalone CommonJS files with esbuild:

    npx esbuild --bundle --platform=node --format=cjs --target=node18 \
      node_modules/@exodus/bytes/<entry>.js --outfile=<entry>.js

No logic was reimplemented or altered -- this is the real package's own
code, just packaged in a format Vercel's Function runtime can actually
`require()`. Verified with `node --no-experimental-require-module`
(which reproduces Vercel's stricter, non-require(esm) behavior locally)
that every function jsdom/whatwg-url/html-encoding-sniffer actually
call (`getBOMEncoding`, `labelToName`, `legacyHookDecode`,
`TextEncoder`, `TextDecoder`, `toBase64`, `percentEncodeAfterEncoding`)
produces identical output to the real package.

## How it's wired in

`package.json`'s top-level `overrides` field points the `@exodus/bytes`
package name at this folder (`"@exodus/bytes": "file:./vendor/exodus-bytes-cjs"`)
for the *entire* dependency tree, so every consumer -- jsdom's own
internals, `whatwg-url`, `html-encoding-sniffer` -- resolves to this
CommonJS build automatically. Nothing in any of those consuming files
was patched; this is a single, central substitution point instead of
patching a dozen individual call sites (and it keeps working
automatically if jsdom adds or removes a call site in a future
version, unlike a per-file patch would).

## Regenerating this if @exodus/bytes is ever upgraded

If `npm outdated` ever shows a newer `@exodus/bytes` and it's worth
picking up:

    npm install @exodus/bytes@latest --no-save   # temporarily, to get the new source
    cd vendor/exodus-bytes-cjs
    for f in encoding encoding-lite base64 whatwg; do
      npx esbuild --bundle --platform=node --format=cjs --target=node18 \
        ../../node_modules/@exodus/bytes/$f.js --outfile=$f.js
    done
    # bump "version" in this folder's package.json to match, then
    npm install
