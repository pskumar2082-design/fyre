'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Home,
  Newspaper,
  Film,
  TrendingUp,
  Star,
  CalendarRange,
  Search,
  Menu,
  X
} from 'lucide-react';

// Dark app shell: a fixed 250px near-black sidebar with icon nav + a
// green active accent bar, a matching header with a page title / search
// pill, and a #0C0B0A content well. Wraps every public route via
// app/layout.tsx. /admin is reachable directly by URL but intentionally
// left off the public nav -- it's not a section a visitor should be
// browsing to.

const NAV = [
  { href: '/', label: 'Home', icon: Home, exact: true },
  { href: '/news', label: 'Movie news', icon: Newspaper },
  { href: '/now-showing', label: 'Now showing', icon: Film },
  { href: '/box-office', label: 'Box office', icon: TrendingUp },
  { href: '/reviews', label: 'Reviews', icon: Star },
  { href: '/upcoming', label: 'Upcoming', icon: CalendarRange }
];

function isActive(pathname: string, item: (typeof NAV)[number]) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + '/');
}

function SidebarLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 py-2">
      {NAV.map((item) => {
        const active = isActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className="relative flex items-center gap-4 h-[60px] px-8 text-[15px] font-medium transition hover:text-text"
          >
            {active && (
              <>
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-[60px] bg-gold rounded-r-[10px] shadow-[0_0_16px_rgba(187,134,252,0.6)]" />
                <span className="absolute inset-y-1 left-2 right-2 bg-gold/10 rounded-xl" />
              </>
            )}
            <Icon size={22} strokeWidth={2} className={`relative ${active ? 'text-gold' : 'text-textFaint'}`} />
            <span className={`relative ${active ? 'text-text' : 'text-textFaint'}`}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// The real fyre wordmark -- a white flame + "fyre" PNG designed to sit on
// a dark surface (public/logo.png). It was invisible under the site's
// previous light theme, which is why the shell used a placeholder icon
// instead; now that the shell is dark again, the actual purchased asset
// is what renders here.
function Logo({ height = 34 }: { height?: number }) {
  return (
    <Link href="/" className="flex items-center px-8 h-[100px] flex-none flex-shrink-0">
      <Image src="/logo.png" alt="fyre" width={height * 2.43} height={height} className="flex-none" priority />
    </Link>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = NAV.find((item) => isActive(pathname, item));

  return (
    <div className="min-h-screen flex bg-bg">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-[250px] flex-none bg-bgAlt border-r border-border sticky top-0 h-screen overflow-y-auto">
        <Logo />
        <SidebarLinks pathname={pathname} />
        <div className="px-8 py-6 text-[11px] text-textFaint border-t border-border mt-auto">
          © {new Date().getFullYear()} fyre
        </div>
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <aside className="absolute left-0 top-0 h-full w-[250px] bg-surfaceTop flex flex-col shadow-card">
            <div className="flex items-center justify-between px-6 h-[100px] flex-none border-b border-border">
              <Link href="/" className="flex items-center">
                <Image src="/logo.png" alt="fyre" width={78} height={32} />
              </Link>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-surface text-textDim border border-border"
              >
                <X size={18} />
              </button>
            </div>
            <SidebarLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 h-[100px] flex-none bg-surfaceHigh/95 backdrop-blur border-b border-border flex items-center justify-between gap-4 px-5 md:px-10">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-full bg-surface text-textDim border border-border flex-none"
            >
              <Menu size={18} />
            </button>
            <h1 className="hdisplay text-xl md:text-[28px] truncate">{current?.label ?? 'fyre'}</h1>
          </div>

          <div className="flex items-center gap-3 flex-none">
            <form action="/search" className="hidden lg:block">
              <div className="flex items-center gap-2 bg-surface border border-border rounded-full h-[50px] w-[255px] px-5 focus-within:border-gold/50 transition">
                <Search size={17} className="text-textFaint flex-none" />
                <input
                  type="text"
                  name="q"
                  placeholder="Search for something"
                  className="bg-transparent outline-none text-sm text-text placeholder:text-textFaint w-full"
                />
              </div>
            </form>
            <Link
              href="/search"
              aria-label="Search"
              className="lg:hidden flex items-center justify-center w-10 h-10 rounded-full bg-surface text-textDim border border-border"
            >
              <Search size={18} />
            </Link>
          </div>
        </header>

        <main className="flex-1 bg-bg">{children}</main>
      </div>
    </div>
  );
}
