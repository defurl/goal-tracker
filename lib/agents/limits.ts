// The agent layer's per-request thresholds, each named once — spec/04-ai-agents.md
// §2 and §6.
//
// An AI call is bounded three ways, and each bound has one home:
//
//   per plan      calls a user may make a day        DAILY_LIMITS, lib/prompts/index.ts (D-24 §7)
//   per prompt    output tokens, temperature, the    the prompt itself, lib/prompts/*.ts — 04 §7
//                 caps on each output field          keeps a prompt and its shape together
//   per request   how long, how big, how many tries  here
//
// Constants, not environment variables, on purpose: 04 §2 fixes the 8 s fetch
// and the 6000 characters, and a deploy-time override would let production
// drift from a LOCKED spec without a line of the spec changing. Change a value
// here and in the spec together.
//
// No imports: the journal form reads entryMaxChars too, so this module is safe
// to reach from the client bundle.

export const AGENT_LIMITS = {
  /** 04 §2: the whole article fetch, every redirect and the body included. */
  fetchTimeoutMs: 8000,
  /** Redirect hops followed; the SSRF guard checks every one. */
  fetchMaxRedirects: 3,
  /** Decompressed bytes read from a page. The model reads sourceMaxChars of it. */
  fetchMaxBytes: 2 * 1024 * 1024,
  /** 04 §2, §6: what the model reads of an article or a paste — "the actual cost control". */
  sourceMaxChars: 6000,
  /** One model call, on its own AbortSignal. */
  providerTimeoutMs: 8000,
  /** 04 §2's failure ladder: the call, and one retry. */
  providerAttempts: 2,
  /** /api/agent/extract refuses a longer URL. */
  urlMaxChars: 2048,
  /** /api/agent/extract refuses longer pasted text; what it accepts is cut to sourceMaxChars. */
  pastedTextMaxChars: 50_000,
  /** FR-3.1: a journal entry is refused above this, never truncated (AC-3.4). */
  entryMaxChars: 2000,
} as const;

/**
 * The longest an agent request can spend inside its own timeouts: the article
 * fetch, then every attempt at the model. Each agent route's maxDuration must
 * exceed it, or the platform ends the request before the fallback ships
 * (FALLBACK-1).
 */
export const WORST_CASE_AGENT_MS =
  AGENT_LIMITS.fetchTimeoutMs + AGENT_LIMITS.providerAttempts * AGENT_LIMITS.providerTimeoutMs;
