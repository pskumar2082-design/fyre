import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { newsroomEnabled } from '@/lib/v2/flags';
import { SITE_URL } from '@/lib/siteConfig';

export const metadata: Metadata = {
  title: 'Editorial policy',
  description: 'How Fyre reports news and politics: sourcing, fact-checking, labels, corrections and images.',
  alternates: { canonical: `${SITE_URL}/editorial-policy` }
};

const RULES: [string, string][] = [
  ['We write our own stories', 'Fyre articles are written by Fyre editors. We do not copy other outlets’ articles. Short quotes are attributed to the person or outlet that said or published them.'],
  ['We name our sources', 'When a story relies on another outlet, an official document or an announcement, it is listed in the Sources box at the end of the article, with a link and the date we checked it.'],
  ['Politics is fact-checked before it is published', 'Every politics article lists at least one source and names the editor who checked the facts. Election and government figures link to the official source, such as the Election Commission of India, PIB or state government portals.'],
  ['Reporting and opinion are labelled', 'Each article carries one label: Report, Analysis, Opinion or Explainer. Opinion pieces carry the author’s name. Headlines describe events neutrally.'],
  ['We correct mistakes openly', 'When we get something wrong we fix it and add a dated correction note at the end of the article.'],
  ['Images are credited', 'Photos are Fyre’s own, licensed, or official handouts, and each carries a credit.'],
  ['No AI-written news', 'Fyre does not publish AI-generated text as news.'],
  ['Box office figures are labelled', 'Collection figures are labelled Estimate, Early estimate or Reported, show when they were updated, and are never added across different sources.'],
  ['Live scores show their time', 'Every live score shows when it was last updated. If the feed is late, the score is marked Delayed rather than guessed.']
];

export default function EditorialPolicyPage() {
  if (!newsroomEnabled()) notFound();
  return (
    <div className="fx-container py-8 sm:py-12 max-w-3xl">
      <h1 className="hdisplay font-extrabold text-3xl sm:text-4xl text-text">Editorial policy</h1>
      <p className="text-textDim mt-3 text-lg">How Fyre reports movies, sport, news and politics.</p>
      <div className="mt-8 space-y-6">
        {RULES.map(([title, body]) => (
          <section key={title}>
            <h2 className="font-bold text-lg text-text">{title}</h2>
            <p className="text-textDim mt-1 leading-relaxed">{body}</p>
          </section>
        ))}
      </div>
      <p className="mt-10 text-sm text-textFaint">To report an error, contact Fyre through our social channels. We review every report.</p>
    </div>
  );
}
