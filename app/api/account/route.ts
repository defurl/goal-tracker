// DELETE /api/account — the signed-in user deletes their own account (B5.2,
// D-24 §2). The control is AccountControl's arm-then-fire button (D-22 §5).
//
// The id comes from the verified session, never from the request, so this can
// only ever delete the caller. DELETE rather than POST: a cross-site page
// cannot send one without a CORS preflight this route never answers, so a form
// elsewhere cannot delete someone's account — and screen() refuses one that
// names another origin, or none (lib/security/requestGuard.ts).
//
// The service role deletes the auth user and the schema removes the rest —
// every user table cascades, and agent_logs keeps its rows with no user
// (supabase/tests/account.test.ts). One security event records the deletion,
// done or not: the outcome, the user id, the address and browser
// (lib/security/securityLog.ts). It lasts as long as the host keeps its logs.

import { GUARDED, screen } from '../../../lib/security/requestGuard.ts';
import { logSecurityEvent } from '../../../lib/security/securityLog.ts';
import { json, serviceClient, signedInUser } from '../_lib/server.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Three auth calls. A ceiling well under the platform's 300 s default.
export const maxDuration = 30;

const ROUTE = GUARDED.account;

export async function DELETE(request: Request) {
  const refused = screen(request, ROUTE);
  if (refused) return refused;

  const caller = await signedInUser();
  if (!caller) return json({ error: 'signed_out' }, 401);

  const { error } = await serviceClient().auth.admin.deleteUser(caller.userId);
  logSecurityEvent(request, {
    event: 'account.deletion',
    route: ROUTE.route,
    outcome: error ? 'failed' : 'succeeded',
    status: error ? 503 : 204,
    userId: caller.userId,
  });
  if (error) return json({ error: 'unavailable' }, 503);

  // The user is gone; this clears the session cookies on the way out. A deleted
  // user's logout is refused upstream, which signOut() tolerates.
  await caller.db.auth.signOut().catch(() => undefined);
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
