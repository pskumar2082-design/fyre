import type { Metadata } from 'next';
import AppShell from '@/components/AppShell';
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '@/lib/siteConfig';
import BreakingBanner from '@/components/newsroom/BreakingBanner';
import { fyreV2 } from '@/lib/v2/flags';

// v2 title and description apply only when the v2 switch is on.
const V2_TITLE = 'fyre — Movies, Live Cricket Scores, News & Politics';
const V2_DESCRIPTION = 'Telugu box office, live cricket scores, and Fyre’s own reporting on news and politics from Andhra Pradesh, Telangana, India and the world.';
const TITLE = fyreV2() ? V2_TITLE : 'fyre — Telugu Box Office Collections, News & Reviews';
const DESCRIPTION = fyreV2() ? V2_DESCRIPTION : SITE_DESCRIPTION;
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s | fyre'
  },
  description: DESCRIPTION,
  keywords: [
    'Telugu box office',
    'Tollywood box office collection',
    'Telugu movie box office today',
    'Telugu cinema news',
    'Telugu movie reviews',
    'Tollywood upcoming movies',
    'box office collection tracker'
  ],
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
    locale: 'en_IN',
    images: [{ url: '/logo.png', width: 584, height: 240, alt: SITE_NAME }]
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/logo.png']
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-body">
        <AppShell>
          <BreakingBanner />
          {children}
        </AppShell>
      </body>
    </html>
  );
}
