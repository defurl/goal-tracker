// points.total, points.today and the leaf count derived from them.
//
// Read-only. Points are awarded server-side only, through award_points() (X-6);
// the browser cannot write the ledger and this module does not try.

import type { SupabaseClient } from '@supabase/supabase-js';

import { leafCountForPoints } from '../growth';
import type { AppState } from '../stores/app';
import type { Database } from '../supabase/database.types';

export async function loadPoints(
  supabase: SupabaseClient<Database>,
  userId: string,
  today: string,
): Promise<AppState['points']> {
  const [totalResult, todayResult] = await Promise.all([
    supabase.from('glow_points').select('total').eq('user_id', userId).maybeSingle(),
    // No "today" column: today's points are a query (03-data-model.md §4).
    supabase.from('point_ledger').select('points').eq('user_id', userId).eq('date', today),
  ]);
  if (totalResult.error) throw totalResult.error;
  if (todayResult.error) throw todayResult.error;

  // No glow_points row yet means nothing has been awarded: zero, not an error.
  const total: number = totalResult.data?.total ?? 0;
  const todayPoints = (todayResult.data ?? []).reduce(
    (sum: number, row: { points: number }) => sum + row.points,
    0,
  );

  // leafCount is DERIVED, in exactly one place (spec/05 §4).
  return { total, today: todayPoints, leafCount: leafCountForPoints(total) };
}
