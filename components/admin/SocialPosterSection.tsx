'use client';

import { useState } from 'react';
import SocialPosterTool from './SocialPosterTool';
import XPostDesigner from './XPostDesigner';

// Admin → Social poster: the existing box-office poster and the X Post
// Designer (X post → Fyre social card), side by side as sub-tools.
export default function SocialPosterSection() {
  const [tool, setTool] = useState<'boxoffice' | 'xpost'>('boxoffice');
  const tab = (on: boolean) => `text-sm font-semibold px-4 py-2 rounded-full border transition ${on ? 'bg-gold/[0.12] border-gold/40 text-gold' : 'border-border text-textDim hover:text-text'}`;
  return (
    <div>
      <div className="flex gap-2 mb-5" role="tablist" aria-label="Social poster tools">
        <button type="button" role="tab" aria-selected={tool === 'boxoffice'} className={tab(tool === 'boxoffice')} onClick={() => setTool('boxoffice')}>
          Box Office Poster
        </button>
        <button type="button" role="tab" aria-selected={tool === 'xpost'} className={tab(tool === 'xpost')} onClick={() => setTool('xpost')}>
          X Post Designer
        </button>
      </div>
      {tool === 'boxoffice' ? <SocialPosterTool /> : <XPostDesigner />}
    </div>
  );
}
