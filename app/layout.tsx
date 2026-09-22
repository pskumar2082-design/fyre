import type { Metadata } from 'next';
import AppShell from '@/components/AppShell';
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '@/lib/siteConfig';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'fyre — Telugu Box Office Collections, News & Reviews',
    template: '%s | fyre'
  },
  description: SITE_DESCRIPTION,
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
    title: 'fyre — Telugu Box Office Collections, News & Reviews',
    description: SITE_DESCRIPTION,
    locale: 'en_IN',
    images: [{ url: '/logo.png', width: 584, height: 240, alt: SITE_NAME }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'fyre — Telugu Box Office Collections, News & Reviews',
    description: SITE_DESCRIPTION,
    images: ['/logo.png']
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-body">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
