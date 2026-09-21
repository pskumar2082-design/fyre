'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Flame,
  Home,
  Newspaper,
  Film,
  TrendingUp,
  Star,
  CalendarRange,
  Search,
  Menu,
  X,
  Radio
} from 'lucide-react';

// BankDash-style app shell: a fixed 250px white sidebar with icon nav +
// active accent bar, a 100px white header with a page title / search pill,
// and a #F5F7FA content well -- replacing fyre's old horizontal pill-nav
// top bar. Wraps every public route via app/layout.tsx. /admin is reachable
// directly by URL but intentionally left off the public nav -- it's not a
// section a visitor should be browsing to.

const NAV = [
  { href: '/', label: 'Home', icon: Home, exact: true },
  { href: '/news', label: 'Movie news', icon: Newspaper },
  { href: '/now-showing', label: 'Now showing', icon: Film },
  { href: '/box-office', label: 'Box office', icon: TrendingUp },
  { href: '/tracktollywood', label: 'TrackTollywood', icon: Radio },
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
            className="relative flex items-center gap-4 h-[60px] px-8 text-[15px] font-medium transition"
          >
            {active && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-[60px] bg-gold rounded-r-[10px]" />
            )}
            <Icon size={22} strokeWidth={2} className={active ? 'text-gold' : 'text-textFaint'} />
            <span className={active ? 'text-gold' : 'text-textFaint'}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 px-8 h-[100px] flex-none flex-shrink-0">
      <Flame size={26} className="text-gold flex-none" fill="currentColor" />
      <span className="hdisplay text-2xl text-gold">fyre</span>
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
      <aside className="hidden md:flex md:flex-col w-[250px] flex-none bg-surface border-r border-border sticky top-0 h-screen overflow-y-auto">
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
            className="absolute inset-0 bg-text/30 backdrop-blur-sm"
          />
          <aside className="absolute left-0 top-0 h-full w-[250px] bg-surface flex flex-col shadow-card">
            <div className="flex items-center justify-between px-6 h-[100px] flex-none border-b border-border">
              <span className="flex items-center gap-2">
                <Flame size={24} className="text-gold flex-none" fill="currentColor" />
                <span className="hdisplay text-xl text-gold">fyre</span>
              </span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-bg text-textDim"
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
        <header className="sticky top-0 z-30 h-[100px] flex-none bg-surface border-b border-border flex items-center justify-between gap-4 px-5 md:px-10">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-full bg-bg text-textDim flex-none"
            >
              <Menu size={18} />
            </button>
            <h1 className="hdisplay text-xl md:text-[28px] truncate">{current?.label ?? 'fyre'}</h1>
          </div>

          <div className="flex items-center gap-3 flex-none">
            <form action="/search" className="hidden lg:block">
              <div className="flex items-center gap-2 bg-bg rounded-full h-[50px] w-[255px] px-5">
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
              className="lg:hidden flex items-center justify-center w-10 h-10 rounded-full bg-bg text-textDim"
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
