'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Horizontal card rail (reference: "Trending Now" / "Cast & Characters").
// Native scroll with snap and a hidden scrollbar; on pointer devices two
// round chevron buttons appear on hover and page the rail by ~85% of its
// width. Cards are clipped at the content edge, as in the reference.
export default function Rail({ children, label, className = '' }: { children: React.ReactNode; label: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update]);

  const page = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: 'smooth' });
  const btn =
    'hidden md:flex absolute top-[38%] -translate-y-1/2 z-10 w-11 h-11 items-center justify-center rounded-full bg-black/85 border border-borderStrong text-white backdrop-blur transition-opacity duration-200 hover:bg-surface2 disabled:opacity-0 opacity-0 group-hover/rail:opacity-100';

  return (
    <div className={`relative group/rail ${className}`}>
      <div ref={ref} onScroll={update} role="list" aria-label={label} className="flex gap-3 sm:gap-6 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth">
        {children}
      </div>
      <button type="button" aria-label={`Scroll ${label} left`} onClick={() => page(-1)} disabled={edges.start} className={`${btn} left-2`}>
        <ChevronLeft className="w-5 h-5" strokeWidth={2} />
      </button>
      <button type="button" aria-label={`Scroll ${label} right`} onClick={() => page(1)} disabled={edges.end} className={`${btn} right-2`}>
        <ChevronRight className="w-5 h-5" strokeWidth={2} />
      </button>
    </div>
  );
}
