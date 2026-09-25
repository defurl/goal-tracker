// The two client-visible Supabase values. The anon key is safe in the bundle —
// it is RLS-constrained — but it is not committed: it lives in .env.local.
//
// Read as literal `process.env.NEXT_PUBLIC_*` expressions so Next inlines them
// into the client bundle; a dynamic lookup would come back undefined there.

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * False on a checkout without .env.local — including CI's build-and-capture
 * job, which renders the room with no backend. Callers degrade to the empty
 * room (spec/05 §7) instead of throwing: a new user and a signed-out one see
 * the same place.
 */
export const supabaseConfigured = supabaseUrl !== '' && supabaseAnonKey !== '';

/**
 * Google sign-in is offered only once its provider is enabled on the project.
 * Until then the button would lead to a provider error, so it is not shown.
 * Set NEXT_PUBLIC_AUTH_GOOGLE=on after following the README's Google section.
 */
export const googleAuthEnabled = process.env.NEXT_PUBLIC_AUTH_GOOGLE === 'on';
