'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type Review = { id: string; rating: string; excerpt: string } | null;
type BoxOffice = { sub: string; amt: number } | null;

export type NowShowingMovie = {
  id: string;
  title: string;
  status: string | null;
  amt: string | null;
  image_url: string | null;
  review: Review;
  boxOffice: BoxOffice;
};

export default function NowShowing({ movies }: { movies: NowShowingMovie[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = movies.find((m) => m.id === selectedId) ?? null;

  return (
    <div>
      <div className="flex gap-4 overflow-x-auto pb-3">
        {movies.length === 0 && (
          <p className="text-textFaint text-sm">No entries yet — add some from the admin panel.</p>
        )}
        {movies.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setSelectedId(m.id === selectedId ? null : m.id)}
            className="flex-none w-36 text-left"
          >
            <div
              className={`w-36 h-52 rounded-lg bg-surface2 border relative overflow-hidden flex items-end p-2 transition ${
                m.id === selectedId ? 'border-gold' : 'border-border'
              }`}
            >
              {m.image_url && <Image src={m.image_url} alt="" fill className="object-cover object-top" />}
              {m.status && (
                <span className="relative text-xs font-bold bg-black/60 text-white px-2 py-1 rounded">
                  {m.status}
                </span>
              )}
            </div>
            <div className="text-sm mt-2">{m.title}</div>
            {m.amt && <div className="text-xs text-goldBright">{m.amt}</div>}
          </button>
        ))}
      </div>

      {selected && (
        <div className="mt-5 bg-surface border border-border rounded-xl p-5 max-w-md">
          <div className="flex justify-between items-start gap-3 mb-3">
            <h3 className="hdisplay text-xl">{selected.title}</h3>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="text-textFaint text-xs border border-border rounded-full px-2 py-1"
            >
              Close
            </button>
          </div>

          <div className="text-sm mb-3">
            <span className="text-textFaint">Collections: </span>
            {selected.boxOffice ? (
              <span className="text-goldBright font-semibold">
                ₹{Number(selected.boxOffice.amt).toFixed(1)} Cr{' '}
                <span className="text-textFaint font-normal">· {selected.boxOffice.sub}</span>
              </span>
            ) : selected.amt ? (
              <span className="text-goldBright font-semibold">{selected.amt}</span>
            ) : (
              <span className="text-textFaint">Not tracked yet</span>
            )}
          </div>

          <div className="pt-3 border-t border-border">
            {selected.review ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-gold text-white text-xs font-bold px-2 py-1 rounded">
                    {selected.review.rating} / 5
                  </span>
                  <span className="text-goldBright text-xs">★★★★★</span>
                </div>
                <p className="text-sm text-textDim mb-2">{selected.review.excerpt}</p>
                <Link href={`/reviews/${selected.review.id}`} className="text-goldBright text-xs font-semibold">
                  Read full review →
                </Link>
              </>
            ) : (
              <p className="text-textFaint text-sm">No review yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
