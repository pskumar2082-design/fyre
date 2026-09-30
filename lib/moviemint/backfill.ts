// Imports a newly tracked movie's history from BFILMY (resumable across
// cron runs). Only that movie's rows are read from each BFILMY file; every
// other title in the file is ignored.
//   - core daily totals (summary file): every date since its first shows
//     (skipped when they are already stored)
//   - breakdowns (show-level file): dates within the breakdown retention
//     window (default 90 days)
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchAliases } from "@/lib/bfilmy/fetch";
import { buildAliasMap } from "@/lib/bfilmy/normalize";
import {
  dateRange,
  istDate,
  syncBfilmy,
  type SyncTarget,
} from "@/lib/bfilmy/sync";
import { syncDetail } from "@/lib/bfilmy/detailSync";
import { trackedKeys } from "@/lib/tracking";

import { BREAKDOWN_DAYS } from '@/lib/retention';

type Cursor = {
  phase: "summary" | "detail" | "done";
  next: string | null;
  from: string;
  slug: string;
};

async function getCursor(id: string): Promise<Cursor | null> {
  const { data } = await supabaseAdmin
    .from("bf_sync_state")
    .select("value")
    .eq("key", `backfill:${id}`)
    .maybeSingle();
  return (data?.value as Cursor) ?? null;
}
async function setCursor(id: string, c: Cursor | null) {
  if (!c)
    await supabaseAdmin
      .from("bf_sync_state")
      .delete()
      .eq("key", `backfill:${id}`);
  else
    await supabaseAdmin
      .from("bf_sync_state")
      .upsert(
        {
          key: `backfill:${id}`,
          value: c,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
}

function addDays(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export async function processBackfills(
  deadline: number,
  onlyIds?: string[],
): Promise<{ id: string; status: string; next?: string | null }[]> {
  let q = supabaseAdmin
    .from("fyre_tracked_movie")
    .select("moviemint_id,bf_slug,backfill_status")
    .eq("match_status", "matched")
    .not("bf_slug", "is", null);
  q = onlyIds
    ? q.in("moviemint_id", onlyIds)
    : q.in("backfill_status", ["requested", "running"]);
  const { data: rows, error } = await q;
  if (error) throw new Error(`fyre_tracked_movie: ${error.message}`);
  const out: { id: string; status: string; next?: string | null }[] = [];
  if (!rows?.length) return out;
  const aliasMap = buildAliasMap(await fetchAliases());
  const today = istDate(0);

  for (const row of rows as any[]) {
    if (Date.now() > deadline) break;
    const id = row.moviemint_id as string;
    const slug = row.bf_slug as string;
    try {
      let cur = await getCursor(id);
      if (!cur || cur.slug !== slug) {
        const { data: mm } = await supabaseAdmin
          .from("mm_movie")
          .select("release_date")
          .eq("moviemint_id", id)
          .maybeSingle();
        const { data: movie } = await supabaseAdmin
          .from("bf_movie")
          .select("first_date")
          .eq("slug", slug)
          .maybeSingle();
        const start =
          movie?.first_date ??
          (mm?.release_date
            ? addDays(mm.release_date, -3)
            : addDays(today, -30));
        cur = {
          phase: movie ? "detail" : "summary",
          next: movie ? null : start,
          from: start,
          slug,
        };
      }
      await supabaseAdmin
        .from("fyre_tracked_movie")
        .update({ backfill_status: "running" })
        .eq("moviemint_id", id);
      const { keys } = await trackedKeys(supabaseAdmin as any, [slug]);
      const scope = new Set([slug]);

      // Phase 1: core daily totals for a movie never imported before.
      if (cur.phase === "summary") {
        const dates = dateRange(cur.next ?? cur.from, today);
        for (const date of dates) {
          if (Date.now() > deadline) break;
          const targets: SyncTarget[] = [
            { kind: "boxoffice", date },
            { kind: "advance", date },
          ];
          await syncBfilmy(targets, {
            posters: date === today,
            prune: false,
            recordState: false,
            tracked: keys.size ? keys : undefined,
          });
          cur.next = addDays(date, 1);
        }
        if (cur.next && cur.next > today)
          cur = { ...cur, phase: "detail", next: null };
      }

      // Phase 2: breakdowns for the dates inside the retention window.
      if (cur.phase === "detail" && Date.now() < deadline) {
        const windowStart = addDays(today, -BREAKDOWN_DAYS + 1);
        const { data: have } = await supabaseAdmin
          .from("bf_movie_day")
          .select("kind,date")
          .eq("slug", slug)
          .gte("date", windowStart);
        const { data: done } = await supabaseAdmin
          .from("bf_movie_day_detail")
          .select("kind,date")
          .eq("slug", slug)
          .gte("date", windowStart);
        const doneSet = new Set(
          (done ?? []).map((d: any) => `${d.kind}:${d.date}`),
        );
        const todo = (have ?? [])
          .filter(
            (d: any) =>
              !doneSet.has(`${d.kind}:${d.date}`) &&
              (!cur!.next || d.date >= cur!.next),
          )
          .sort((a: any, b: any) => a.date.localeCompare(b.date));
        const { keys: k2 } = await trackedKeys(supabaseAdmin as any, [slug]);
        let processed = 0;
        for (const d of todo as any[]) {
          if (Date.now() > deadline) break;
          const [r] = await syncDetail(
            [{ kind: d.kind, date: d.date }],
            aliasMap,
            { tracked: k2, scopeSlugs: scope, partial: true },
          );
          if (r?.status === "error")
            throw new Error(`detail ${d.kind} ${d.date}: ${r.error}`);
          cur.next = d.date;
          processed++;
        }
        if (processed === todo.length) cur = { ...cur, phase: "done" };
      }

      if (cur.phase === "done") {
        await setCursor(id, null);
        await supabaseAdmin
          .from("fyre_tracked_movie")
          .update({
            backfill_status: "done",
            backfill_done_at: new Date().toISOString(),
          })
          .eq("moviemint_id", id);
        out.push({ id, status: "done" });
      } else {
        await setCursor(id, cur);
        out.push({ id, status: cur.phase, next: cur.next });
      }
    } catch (err: any) {
      const message = String(err?.message ?? err).slice(0, 300);
      await supabaseAdmin
        .from("fyre_tracked_movie")
        .update({ backfill_status: "error" })
        .eq("moviemint_id", id);
      out.push({ id, status: `error: ${message}` });
    }
  }
  return out;
}
