// The support resources shown under a reflection whose support_response is
// true — spec/04-ai-agents.md §3, D-13 (LOCKED).
//
// The model never generates a resource: models misremember these numbers, and
// a hallucinated crisis line is worse than none. This list is static, short,
// and human-verified. Keep it that way — every entry names a service and how
// to reach it, and makes NO claim about what the service will do
// (confidentiality and escalation vary by provider and country).
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │ UNVERIFIED — drafted 2026-09-25 for the owner to check (owner decision). │
// │ Confirm each entry against the service's own site, then set             │
// │ `VERIFIED_ON` and record who checked it. Re-check at least yearly.      │
// └──────────────────────────────────────────────────────────────────────────┘

export interface SupportResource {
  name: string;
  /** How to reach it, in plain words. */
  reach: string;
  href: string;
  /** ISO 3166 regions it serves; empty = everywhere. */
  regions: readonly string[];
}

/** ISO date the list was last checked by a person, or null. */
export const VERIFIED_ON: string | null = null;

export const SUPPORT_RESOURCES: readonly SupportResource[] = [
  { name: '988 Suicide & Crisis Lifeline', reach: 'call or text 988', href: 'tel:988', regions: ['US'] },
  { name: 'Samaritans', reach: 'call 116 123', href: 'tel:116123', regions: ['GB', 'IE'] },
  {
    name: 'Find A Helpline',
    reach: 'findahelpline.com lists services in your country',
    href: 'https://findahelpline.com',
    regions: [],
  },
];

/** The entries for a BCP 47 locale's region, then the worldwide directory. */
export function supportResourcesFor(locale: string): SupportResource[] {
  const region = locale.split('-')[1]?.toUpperCase() ?? '';
  const local = SUPPORT_RESOURCES.filter((r) => r.regions.includes(region));
  const everywhere = SUPPORT_RESOURCES.filter((r) => r.regions.length === 0);
  return [...local, ...everywhere];
}
