import { CalendarRange } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Card, IconBadge, SectionHeading, EmptyState } from '@/components/ui';

export const revalidate = 30; // re-fetch from Supabase at most every 30s

export default async function UpcomingPage() {
  const { data } = await supabase.from('upcoming').select('*').order('release_date', { ascending: true }).limit(200);
  const upcoming = data ?? [];

  return (
    <div className="px-5 md:px-10 py-8">
      <SectionHeading title="Upcoming releases" />

      {upcoming.length === 0 ? (
        <EmptyState>No upcoming releases yet.</EmptyState>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {upcoming.map((u: any) => {
            const days = Math.max(0, Math.ceil((new Date(u.release_date).getTime() - Date.now()) / 86400000));
            return (
              <Card key={u.id} className="p-5">
                <IconBadge icon={CalendarRange} tint="yellow" size={44} />
                <div className="hdisplay text-3xl gtext mt-3">{days}</div>
                <div className="text-xs text-textFaint mb-2">days to go</div>
                <div className="text-sm font-medium">{u.title}</div>
                <div className="text-xs text-textFaint">{u.release_date}</div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
