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

// Light app shell, matching the "Car Rent" dashboard reference: a dark
// navy sidebar (the one part of the page that stays dark) with icon nav +
// a solid blue active pill, a white header with a page title / search
// pill, and a white content well. Wraps every public route via
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
    <nav className="flex-1 py-2 px-4">
      {NAV.map((item) => {
        const active = isActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`relative flex items-center gap-3 h-[52px] px-4 mb-1 rounded-xl text-[15px] font-medium transition ${
              active ? 'bg-gold text-white' : 'text-white/60 hover:bg-navyAlt hover:text-white'
            }`}
          >
            {active && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-1 h-[22px] rounded-full bg-white" />}
            <Icon size={20} strokeWidth={2} className={active ? 'ml-2.5' : ''} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// The real fyre wordmark -- a white flame + "fyre" PNG, designed to sit
// on a dark surface (public/logo.png), which is exactly what the
// permanent navy sidebar still is in this theme.
function Logo({ height = 34, className = 'px-8 h-[100px]' }: { height?: number; className?: string }) {
  return (
    <Link href="/" aria-label="fyre home" className={`flex items-center flex-none flex-shrink-0 ${className}`}>
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
      {/* Desktop sidebar -- stays dark navy regardless of theme */}
      <aside className="hidden md:flex md:flex-col w-[250px] flex-none bg-navy sticky top-0 h-screen overflow-y-auto">
        <Logo />
        <SidebarLinks pathname={pathname} />
        <div className="px-8 py-6 text-[11px] text-white/40 border-t border-white/10 mt-auto">
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
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <aside className="absolute left-0 top-0 h-full w-[250px] bg-navy flex flex-col shadow-card">
            <div className="flex items-center justify-between px-6 h-[100px] flex-none border-b border-white/10">
              <Link href="/" className="flex items-center">
                <Image src="/logo.png" alt="fyre" width={78} height={32} />
              </Link>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-navyAlt text-white/70 border border-white/10"
              >
                <X size={18} />
              </button>
            </div>
            <SidebarLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header -- white, matching the main content behind it */}
        <header className="sticky top-0 z-30 h-[100px] flex-none bg-bg/95 backdrop-blur border-b border-border flex items-center justify-between gap-4 px-5 md:px-10">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-full bg-surface2 text-textDim border border-border flex-none"
            >
              <Menu size={18} />
            </button>
            <Logo height={20} className="md:hidden h-9 px-3 rounded-full bg-navy" />
            <h1 className="hdisplay text-xl md:text-[28px] truncate text-text">{current?.label ?? 'fyre'}</h1>
          </div>

          <div className="flex items-center gap-3 flex-none">
            <form action="/search" className="hidden lg:block">
              <div className="flex items-center gap-2 bg-surface2 border border-border rounded-full h-[50px] w-[280px] px-5 focus-within:border-gold/50 transition">
                <Search size={17} className="text-textFaint flex-none" />
                <input
                  type="text"
                  name="q"
                  placeholder="Search here"
                  className="bg-transparent outline-none text-sm text-text placeholder:text-textFaint w-full"
                />
              </div>
            </form>
            <Link
              href="/search"
              aria-label="Search"
              className="lg:hidden flex items-center justify-center w-10 h-10 rounded-full bg-surface2 text-textDim border border-border"
            >
              <Search size={18} />
            </Link>
          </div>
        </header>

        <main className="flex-1 bg-bg">{children}</main>

        <footer className="bg-bg border-t border-border px-5 md:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <span className="text-xs text-textFaint">&copy; {new Date().getFullYear()} fyre. All rights reserved.</span>
          <nav className="flex items-center flex-wrap justify-center gap-x-4 gap-y-1">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-xs text-textFaint hover:text-text transition">
                {item.label}
              </Link>
            ))}
          </nav>
        </footer>
      </div>
    </div>
  );
}
