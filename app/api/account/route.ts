// DELETE /api/account — the signed-in user deletes their own account (B5.2,
// D-24 §2). The control is AccountControl's arm-then-fire button (D-22 §5).
//
// The id comes from the verified session, never from the request, so this can
// only ever delete the caller. DELETE rather than POST: a cross-site page
// cannot send one without a CORS preflight this route never answers, so a form
// elsewhere cannot delete someone's account.
//
// The service role deletes the auth user and the schema removes the rest —
// every user table cascades, and agent_logs keeps its rows with no user
// (supabase/tests/account.test.ts). Nothing is logged.

import { json, serviceClient, signedInUser } from '../_lib/server.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE() {
  const caller = await signedInUser();
  if (!caller) return json({ error: 'signed_out' }, 401);

  const { error } = await serviceClient().auth.admin.deleteUser(caller.userId);
  if (error) return json({ error: 'unavailable' }, 503);

  // The user is gone; this clears the session cookies on the way out. A deleted
  // user's logout is refused upstream, which signOut() tolerates.
  await caller.db.auth.signOut().catch(() => undefined);
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
