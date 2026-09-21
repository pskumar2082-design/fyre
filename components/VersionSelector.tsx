import { Card } from '@/components/ui';

export type VersionRow = {
  id: string;
  language: string;
  net_collection: string | null;
  verdict: string | null;
};

// Shows every language version's collection totals at once -- previously a
// dropdown that only showed one language at a time, which hid the other
// versions from view for no real reason.
export default function VersionSelector({ versions }: { versions: VersionRow[] }) {
  if (versions.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
      {versions.map((v) => (
        <Card key={v.id} className="p-4 bg-tintBlue">
          <div className="text-gold/70 text-[10px] uppercase mb-1 capitalize">{v.language}</div>
          <div className="hdisplay text-xl text-gold">{v.net_collection ?? '—'}</div>
          {v.verdict && <div className="text-xs text-textDim mt-1">{v.verdict}</div>}
        </Card>
      ))}
    </div>
  );
}
