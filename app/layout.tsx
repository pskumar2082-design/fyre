import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import './globals.css';

export const metadata: Metadata = {
  title: 'fyre — All about cinema',
  description: 'Telugu cinema news, reviews, box office and more.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-body">
        <header className="sticky top-0 z-50 bg-gradient-to-b from-bg via-bg/95 to-bg/0 pb-6">
          <div className="max-w-6xl mx-auto flex items-center justify-between px-5 pt-3.5">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo.png" alt="fyre" width={88} height={36} priority className="h-9 w-auto" />
              <span className="hidden sm:inline text-textFaint text-xs">All about cinema</span>
            </Link>
            <nav className="hidden md:flex gap-2 text-sm">
              <Link href="/#news" className="bg-surface border border-border rounded-full px-4 py-1.5 text-textDim hover:text-goldBright hover:border-gold transition">Movie news</Link>
              <Link href="/#boxoffice" className="bg-surface border border-border rounded-full px-4 py-1.5 text-textDim hover:text-goldBright hover:border-gold transition">Box office</Link>
              <Link href="/#reviews" className="bg-surface border border-border rounded-full px-4 py-1.5 text-textDim hover:text-goldBright hover:border-gold transition">Reviews</Link>
              <Link href="/#upcoming" className="bg-surface border border-border rounded-full px-4 py-1.5 text-textDim hover:text-goldBright hover:border-gold transition">Upcoming</Link>
            </nav>
            <Link
              href="/search"
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-gradient-to-r from-brandPurple via-gold to-brandPink rounded-full px-3.5 py-2 hover:opacity-90 transition"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Search
            </Link>
          </div>
        </header>

        <main>{children}</main>

        <footer className="mt-16 border-t border-border bg-bgAlt">
          <div className="max-w-6xl mx-auto px-5 py-8 text-xs text-textFaint flex justify-between flex-wrap gap-2">
            <span>© {new Date().getFullYear()} fyre. All rights reserved.</span>
            <span className="gtext font-semibold">Lights. Camera. fyre.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
