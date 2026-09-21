// `puppeteer` (the full package, not puppeteer-core) is only a
// devDependency so scripts/sync-moviemint-local.ts can launch a real local
// Chromium -- see lib/moviemintBrowserRenderer.ts's launchLocalBrowser().
// Vercel installs devDependencies too (it needs typescript/tailwindcss/etc
// for the build step), which would otherwise make every Vercel build
// download a ~150MB Chrome binary that VERCEL=1 guarantees never gets
// used at runtime (launchLocalBrowser() only runs when VERCEL is unset).
// Skip that download specifically on Vercel; keep it everywhere else
// (a developer's own `npm install`) so the local script actually works.
module.exports = {
  skipDownload: !!process.env.VERCEL
};
