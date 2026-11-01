// Per-feature AI consent (handoff 03 §6: AI off by default, scoped per
// feature, withdrawable). Kept on the device with the account's other
// preferences; turning one off stops future calls for that feature.

export interface Consent {
  /** The Inspiration Inbox may send a link or text to an AI model to draft an action. */
  inboxAi: boolean;
}

export const CONSENT_INITIAL: Consent = { inboxAi: false };
