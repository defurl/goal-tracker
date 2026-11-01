// Guided journal modes (functional specification J03) and the quick prompts
// Today offers. No forced positivity: every mode accepts a hard day. A saved
// entry keeps the prompt's id and version, so a later rewrite of the wording
// never changes what an old entry answered.

export const GUIDED_VERSION = 1;

export interface GuidedMode {
  id: string;
  title: string;
  /** One line under the title. */
  intro: string;
  /** The questions, answered in one body of text. */
  questions: readonly string[];
}

export const GUIDED_MODES: readonly GuidedMode[] = [
  {
    id: 'brain-dump',
    title: 'Brain dump',
    intro: 'Empty your head onto the page. No order, no grammar.',
    questions: ['What is on your mind right now?'],
  },
  {
    id: 'one-good-thing',
    title: 'One good thing',
    intro: 'Small counts. A warm drink counts.',
    questions: ['What is one good thing that happened today?', 'Why did it matter to you?'],
  },
  {
    id: 'difficult-moment',
    title: 'A difficult moment',
    intro: 'Write it as it was. You do not have to fix it here.',
    questions: ['What happened?', 'What did you feel, and where did you feel it?', 'What do you need now?'],
  },
  {
    id: 'self-compassion',
    title: 'Self-compassion',
    intro: 'Talk to yourself the way you would talk to a friend.',
    questions: [
      'What are you being hard on yourself about?',
      'What would you say to a friend in the same place?',
      'Can you say a little of that to yourself?',
    ],
  },
  {
    id: 'control-check',
    title: 'Control check',
    intro: 'Sort what is yours to act on from what is not.',
    questions: ['What is worrying you?', 'Which parts can you influence?', 'Which parts can you let be, for today?'],
  },
  {
    id: 'future-reflection',
    title: 'Future reflection',
    intro: 'Look a little ahead, kindly.',
    questions: ['A month from now, what would you like to be true?', 'What is one small step toward it?'],
  },
  {
    id: 'grateful',
    title: 'Grateful for',
    intro: 'Anything at all, however small.',
    questions: ['What am I grateful for today?'],
  },
  {
    id: 'learned',
    title: 'Something learned',
    intro: 'About the world, about work, about yourself.',
    questions: ['What did I learn today?'],
  },
  {
    id: 'tomorrow',
    title: 'Tomorrow, a little better',
    intro: 'One thing, not a plan.',
    questions: ['What can I do tomorrow, a little better?'],
  },
  {
    id: 'weekly',
    title: 'Weekly reflection',
    intro: 'Your own words about the week. The numbers beside it are only counts.',
    questions: ['What stood out this week?', 'What helped?', 'What would you like more of next week?'],
  },
];

export function guidedMode(id: string | null | undefined): GuidedMode | undefined {
  return GUIDED_MODES.find((m) => m.id === id);
}

/** The six modes of J03, in the order the board shows them. */
export const J03_MODES = [
  'brain-dump',
  'one-good-thing',
  'difficult-moment',
  'self-compassion',
  'control-check',
  'future-reflection',
] as const;

/** The quick check-in's four questions (J01), keyed as `DeviceEntry.fields`. */
export const CHECK_IN_QUESTIONS = {
  positive: 'Something good, however small',
  difficult: 'Something difficult',
  lesson: 'Something you learned',
  tomorrow: 'A note for tomorrow',
} as const;
