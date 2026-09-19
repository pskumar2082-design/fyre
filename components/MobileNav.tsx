'use client';

import Link from 'next/link';
import { useState } from 'react';

const LINKS = [
  { href: '/news', label: 'Movie news' },
  { href: '/now-showing', label: 'Now showing' },
  { href: '/box-office', label: 'Box office' },
  { href: '/reviews', label: 'Reviews' },
  { href: '/upcoming', label: 'Upcoming' }
];

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        className="flex items-center justify-center w-9 h-9 rounded-full bg-surface border border-border text-textDim hover:text-goldBright hover:border-gold transition"
      >
        {open ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full px-5 pb-4 z-50">
          <nav className="max-w-6xl mx-auto flex flex-col gap-1 bg-surface border border-border rounded-2xl p-2 text-sm shadow-xl">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="px-3 py-2.5 rounded-xl text-textDim hover:text-goldBright hover:bg-surface2 transition"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
