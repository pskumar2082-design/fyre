'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { House, Film, ChartNoAxesColumnIncreasing, CalendarDays, Newspaper, Star, Search, GitCompareArrows, Menu, X, Trophy, Landmark, Radio } from 'lucide-react';

// App shell -- compact horizontal header measured from the frameXTV
// reference: black bar, Fyre logo, white active pill (black text), zinc
// inactive items, bordered utility pills on the right (Search with a "/"
// key hint, Compare). Below lg the nav collapses into a left drawer with
// the same pill treatment. Lucide icons throughout, stroke 2.
const NAV_V1 = [
  { href: '/', label: 'Home', icon: House, exact: true },
  { href: '/now-showing', label: 'Now showing', icon: Film },
  { href: '/box-office', label: 'Box office', icon: ChartNoAxesColumnIncreasing },
  { href: '/upcoming', label: 'Upcoming', icon: CalendarDays },
  { href: '/news', label: 'News', icon: Newspaper },
  { href: '/reviews', label: 'Reviews', icon: Star }
];

// Fyre v2 (NEXT_PUBLIC_FYRE_V2=1): four sections, Home on the logo. The
// Movies hub links on to Box Office, Upcoming and Reviews.
const V2 = process.env.NEXT_PUBLIC_FYRE_V2 === '1';
const NAV_V2 = [
  { href: '/movies', label: 'Movies', icon: Film, exact: false },
  { href: '/sports', label: 'Sports', icon: Trophy, exact: false },
  { href: '/news', label: 'Latest News', icon: Newspaper, exact: false },
  { href: '/politics', label: 'Politics', icon: Landmark, exact: false }
];
const NAV = V2 ? NAV_V2 : NAV_V1;

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  if (V2 && href === '/sports' && pathname.startsWith('/live-scores')) return true;
  return pathname === href || pathname.startsWith(href + '/');
}

// Header item sizes: h-9 / 15px up to 1535px, the reference's measured
// h-10 / 17px at 2xl. Icons appear from xl so the row fits at 1024-1279.
const ITEM = 'inline-flex items-center gap-2 2xl:gap-2.5 h-9 2xl:h-10 px-3 2xl:px-[18px] rounded-lg text-[15px] 2xl:text-[17px] font-semibold whitespace-nowrap transition-colors';
const ICON = 'hidden xl:block w-4 h-4 2xl:w-[18px] 2xl:h-[18px] flex-none';
const UTILITY = `${ITEM} bg-surface border border-border text-text hover:border-borderStrong hover:bg-surface2`;

function Logo({ className = '' }: { className?: string }) {
  return (
    <Link href="/" aria-label="fyre home" className={`flex items-center flex-none ${className}`}>
      <Image src="/logo.png" alt="fyre" width={73} height={30} className="h-[26px] w-auto 2xl:h-[30px]" priority />
    </Link>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // "/" jumps to search (reference: the Search pill's key hint).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      e.preventDefault();
      router.push('/search');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {process.env.NEXT_PUBLIC_FYRE_PREVIEW_SANDBOX === '1' && (
        <div className="bg-amber text-black text-center text-xs font-semibold py-1 px-3">
          Fyre v2 Preview: test data only. Not the live site, nothing here is saved.
        </div>
      )}
      <header className="sticky top-0 z-40 bg-black/90 backdrop-blur-md border-b border-surface2">
        <div className="fx-container h-16 2xl:h-[76px] flex items-center gap-3">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg bg-surface border border-border text-text"
          >
            <Menu className="w-[18px] h-[18px]" />
          </button>
          <Logo className="mr-2 2xl:mr-4" />

          <nav className="hidden lg:flex items-center gap-1 min-w-0" aria-label="Main">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href, item.exact);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`${ITEM} ${active ? 'bg-white text-black' : 'text-textDim hover:text-white hover:bg-surface2/70'}`}
                >
                  <Icon className={ICON} strokeWidth={2} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2 2xl:gap-3">
            <Link href="/search" className={`${UTILITY} hidden sm:inline-flex`} aria-label="Search (press /)">
              <Search className="w-4 h-4 2xl:w-[18px] 2xl:h-[18px] flex-none text-textDim" strokeWidth={2} />
              <span>Search</span>
              <kbd className="ml-1 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-md border border-borderStrong font-mono text-xs text-textDim">/</kbd>
            </Link>
            <Link href="/search" aria-label="Search" className="sm:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg bg-surface border border-border text-text">
              <Search className="w-[18px] h-[18px]" />
            </Link>
            {V2 ? (
              <Link href="/live-scores" aria-current={isActive(pathname, '/live-scores') ? 'page' : undefined} className={`${UTILITY} hidden md:inline-flex`}>
                <span className="w-2 h-2 rounded-full bg-red animate-pulse flex-none" />
                Live scores
              </Link>
            ) : (
              <Link
                href="/compare"
                aria-current={isActive(pathname, '/compare') ? 'page' : undefined}
                className={`${UTILITY} hidden md:inline-flex ${isActive(pathname, '/compare') ? '!bg-white !text-black !border-white' : ''}`}
              >
                <GitCompareArrows className="w-4 h-4 2xl:w-[18px] 2xl:h-[18px] flex-none" strokeWidth={2} />
                Compare
              </Link>
            )}
          </div>
        </div>
      </header>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <aside className="absolute left-0 top-0 h-full w-[280px] max-w-[85vw] bg-black border-r border-border flex flex-col">
            <div className="flex items-center justify-between px-4 h-16 border-b border-surface2">
              <Logo />
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-surface border border-border text-textDim"
              >
                <X className="w-[18px] h-[18px]" />
              </button>
            </div>
            <nav className="p-3 flex flex-col gap-1" aria-label="Main">
              {(V2 ? [{ href: '/', label: 'Home', icon: House, exact: true }, ...NAV, { href: '/live-scores', label: 'Live scores', icon: Radio, exact: false }] : [...NAV, { href: '/compare', label: 'Compare', icon: GitCompareArrows, exact: false }]).map((item) => {
                const active = isActive(pathname, item.href, item.exact);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 h-11 px-3.5 rounded-lg text-[15px] font-semibold transition-colors ${
                      active ? 'bg-white text-black' : 'text-textDim hover:text-white hover:bg-surface2'
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px]" strokeWidth={2} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      <main className="flex-1">{children}</main>

      <footer className="border-t border-surface2 mt-16">
        <div className="fx-container py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="fyre" width={58} height={24} className="h-6 w-auto opacity-90" />
            <span className="font-mono text-xs text-textFaint">© {new Date().getFullYear()} fyre</span>
          </div>
          <nav className="flex items-center flex-wrap justify-center gap-x-5 gap-y-2" aria-label="Footer">
            {(V2 ? [...NAV, { href: '/live-scores', label: 'Live scores' }, { href: '/editorial-policy', label: 'Editorial policy' }] : [...NAV, { href: '/compare', label: 'Compare' }]).map((item) => (
              <Link key={item.href} href={item.href} className="text-sm text-textFaint hover:text-white transition-colors">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
