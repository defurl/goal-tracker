// Feature switches the owner turns on in the env, not in code.
//
// Read as a literal `process.env.NEXT_PUBLIC_*` expression so Next inlines it
// into the client bundle, and the server reads the same value — the button
// and the route cannot disagree.

/**
 * AI Reflect — OFF unless NEXT_PUBLIC_AI_REFLECT=on. Owner decision
 * 2026-09-25: the live provider is Gemini's free tier, whose terms allow
 * inputs to be used to improve Google's products and read by reviewers. A
 * journal entry must not go there, so until a provider without that is set up
 * (Gemini's paid tier, for one), the journal saves mood and tags only and the
 * route never calls a model. Imports are unaffected: an article is not private.
 */
export const aiReflectEnabled = process.env.NEXT_PUBLIC_AI_REFLECT === 'on';
