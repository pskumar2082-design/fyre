import { supabase } from '@/lib/supabaseClient';

export const revalidate = 30; // re-fetch from Supabase at most every 30s

export default async function UpcomingPage() {
  const { data } = await supabase.from('upcoming').select('*').order('release_date', { ascending: true }).limit(200);
  const upcoming = data ?? [];

  return (
    <div className="max-w-6xl mx-auto px-5 py-8">
      <h1 className="hdisplay text-3xl mb-8">Upcoming releases</h1>

      {upcoming.length === 0 && <p className="text-textFaint text-sm">No upcoming releases yet.</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {upcoming.map((u: any) => {
          const days = Math.max(0, Math.ceil((new Date(u.release_date).getTime() - Date.now()) / 86400000));
          return (
            <div key={u.id} className="bg-surface border border-border rounded-2xl p-4">
              <div className="hdisplay text-3xl gtext">{days}</div>
              <div className="text-xs text-textFaint mb-2">days to go</div>
              <div className="text-sm font-medium">{u.title}</div>
              <div className="text-xs text-textFaint">{u.release_date}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
