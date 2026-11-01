// The Self Care catalogue (functional specification §5) — the seed the CMS
// will take over (D-26 §6). Common, everyday well-being activities, described
// plainly: not treatment, no diagnosis, no mandatory timers, no body-image
// talk. Every activity can be stopped or skipped at any point.
//
// `review` is the editorial state. Everything here is a BBE draft until the
// catalogue's owner (open in D-26) signs it off.

export type Need = 'overwhelmed' | 'bored' | 'restless' | 'tired' | 'play' | 'reset';
export type Energy = 'low' | 'medium' | 'high';
export type Category = 'recharge' | 'space' | 'care' | 'mindset' | 'connection';

export const NEEDS: readonly { value: Need; label: string }[] = [
  { value: 'overwhelmed', label: 'Overwhelmed' },
  { value: 'bored', label: 'Bored' },
  { value: 'restless', label: 'Restless' },
  { value: 'tired', label: 'Tired' },
  { value: 'play', label: 'Want to play' },
  { value: 'reset', label: 'Need to reset' },
];

export const CATEGORIES: readonly { value: Category; label: string }[] = [
  { value: 'recharge', label: 'Recharge and play' },
  { value: 'space', label: 'Reset your space' },
  { value: 'care', label: 'Personal care' },
  { value: 'mindset', label: 'Mindset and emotional reset' },
  { value: 'connection', label: 'Connection and lifestyle' },
];

export interface Activity {
  id: string;
  title: string;
  category: Category;
  purpose: string;
  minutes: number;
  energy: Energy;
  social: 'solo' | 'social';
  place: 'indoor' | 'outdoor' | 'anywhere';
  needs: readonly Need[];
  setup: string | null;
  steps: readonly string[];
  safety: string | null;
  source: string;
  review: 'draft' | 'approved';
}

const BBE = 'Be Better Everyday editorial';

export const ACTIVITIES: readonly Activity[] = [
  {
    id: 'desk-reset',
    title: 'Five-minute desk reset',
    category: 'space',
    purpose: 'A clear surface makes the next thing easier to start.',
    minutes: 5,
    energy: 'low',
    social: 'solo',
    place: 'indoor',
    needs: ['overwhelmed', 'reset'],
    setup: null,
    steps: ['Put away anything that has a home.', 'Gather the rest into one pile.', 'Wipe the surface.', 'Leave out only what you need next.'],
    safety: null,
    source: BBE,
    review: 'draft',
  },
  {
    id: 'clear-one-surface',
    title: 'Clear one surface',
    category: 'space',
    purpose: 'One finished corner beats a half-tidied room.',
    minutes: 10,
    energy: 'medium',
    social: 'solo',
    place: 'indoor',
    needs: ['overwhelmed', 'restless'],
    setup: 'Pick one surface: a table, a shelf, a chair that holds clothes.',
    steps: ['Take everything off it.', 'Put back only what belongs there.', 'Deal with the rest, or box it for later.'],
    safety: null,
    source: BBE,
    review: 'draft',
  },
  {
    id: 'tend-a-plant',
    title: 'Tend a plant',
    category: 'space',
    purpose: 'A small, slow task with something alive.',
    minutes: 5,
    energy: 'low',
    social: 'solo',
    place: 'indoor',
    needs: ['reset', 'tired'],
    setup: null,
    steps: ['Check the soil with a finger.', 'Water if it is dry.', 'Turn the pot a little toward the light.', 'Pick off any dry leaves.'],
    safety: null,
    source: BBE,
    review: 'draft',
  },
  {
    id: 'gentle-stretch',
    title: 'Gentle stretch by a window',
    category: 'care',
    purpose: 'Loosen up after sitting, at whatever pace feels right.',
    minutes: 5,
    energy: 'low',
    social: 'solo',
    place: 'indoor',
    needs: ['tired', 'restless'],
    setup: 'Stand somewhere with a little room, near a window if you can.',
    steps: ['Roll your shoulders slowly, both ways.', 'Reach up, then let your arms fall.', 'Turn your head gently side to side.', 'Shake out your hands.'],
    safety: 'Move only within what is comfortable. Stop if anything hurts.',
    source: BBE,
    review: 'draft',
  },
  {
    id: 'warm-drink',
    title: 'Make a warm drink and sit with it',
    category: 'care',
    purpose: 'Ten minutes that ask nothing of you.',
    minutes: 10,
    energy: 'low',
    social: 'solo',
    place: 'indoor',
    needs: ['tired', 'overwhelmed'],
    setup: null,
    steps: ['Make tea, cocoa, or warm water.', 'Sit somewhere other than where you work.', 'Drink it without a screen, if you can.'],
    safety: null,
    source: BBE,
    review: 'draft',
  },
  {
    id: 'daylight',
    title: 'Step outside for daylight',
    category: 'recharge',
    purpose: 'A few minutes of outside air and light.',
    minutes: 5,
    energy: 'low',
    social: 'solo',
    place: 'outdoor',
    needs: ['tired', 'reset'],
    setup: null,
    steps: ['Step outside, or open a window wide.', 'Look at something far away.', 'Notice the weather on your skin.'],
    safety: null,
    source: BBE,
    review: 'draft',
  },
  {
    id: 'short-walk',
    title: 'A walk around the block',
    category: 'recharge',
    purpose: 'Moving helps when sitting still will not.',
    minutes: 15,
    energy: 'medium',
    social: 'solo',
    place: 'outdoor',
    needs: ['restless', 'overwhelmed', 'tired'],
    setup: 'Shoes on, phone in your pocket.',
    steps: ['Walk at any pace.', 'Take a turn you do not usually take.', 'Notice three things you have not noticed before.'],
    safety: 'Stay where you feel safe. Any distance counts.',
    source: BBE,
    review: 'draft',
  },
  {
    id: 'doodle',
    title: 'Doodle for ten minutes',
    category: 'recharge',
    purpose: 'Play with no result to judge.',
    minutes: 10,
    energy: 'low',
    social: 'solo',
    place: 'indoor',
    needs: ['bored', 'play'],
    setup: 'Any paper and any pen.',
    steps: ['Draw a shape.', 'Add to it until it becomes something.', 'Fill the page. It does not have to be good.'],
    safety: null,
    source: BBE,
    review: 'draft',
  },
  {
    id: 'one-song-dance',
    title: 'Dance to one song',
    category: 'recharge',
    purpose: 'Four minutes of moving for fun.',
    minutes: 5,
    energy: 'high',
    social: 'solo',
    place: 'indoor',
    needs: ['restless', 'play', 'bored'],
    setup: 'Pick a song you like.',
    steps: ['Play it loud enough to feel.', 'Move however you want until it ends.'],
    safety: 'Clear a little space first.',
    source: BBE,
    review: 'draft',
  },
  {
    id: 'write-it-down',
    title: 'Write it down, then set it aside',
    category: 'mindset',
    purpose: 'Get the loop out of your head and onto paper.',
    minutes: 5,
    energy: 'low',
    social: 'solo',
    place: 'anywhere',
    needs: ['overwhelmed'],
    setup: 'The journal’s Brain dump, or any paper.',
    steps: ['Write everything on your mind, in any order.', 'Circle one thing you can do today.', 'Close the page.'],
    safety: null,
    source: BBE,
    review: 'draft',
  },
  {
    id: 'five-things',
    title: 'Name five things you can see',
    category: 'mindset',
    purpose: 'Bring your attention back to the room you are in.',
    minutes: 2,
    energy: 'low',
    social: 'solo',
    place: 'anywhere',
    needs: ['overwhelmed', 'restless'],
    setup: null,
    steps: ['Name five things you can see.', 'Four you can touch.', 'Three you can hear.', 'Then carry on with your day.'],
    safety: null,
    source: BBE,
    review: 'draft',
  },
  {
    id: 'slow-breaths',
    title: 'A few slow breaths, your own pace',
    category: 'mindset',
    purpose: 'A short pause before the next thing.',
    minutes: 2,
    energy: 'low',
    social: 'solo',
    place: 'anywhere',
    needs: ['overwhelmed', 'restless'],
    setup: null,
    steps: ['Breathe in through your nose, at a comfortable pace.', 'Let the out-breath be a little longer.', 'Repeat a few times. There is no count to hit.'],
    safety: 'If focusing on breathing feels uncomfortable, stop and try “Name five things you can see” instead.',
    source: BBE,
    review: 'draft',
  },
  {
    id: 'message-someone',
    title: 'Message someone you miss',
    category: 'connection',
    purpose: 'A small reach toward someone.',
    minutes: 5,
    energy: 'low',
    social: 'social',
    place: 'anywhere',
    needs: ['bored', 'reset'],
    setup: null,
    steps: ['Think of someone you have not talked to in a while.', 'Send one line: a memory, a photo, a question.', 'No need to wait for the reply.'],
    safety: null,
    source: BBE,
    review: 'draft',
  },
  {
    id: 'cook-together',
    title: 'Cook something simple with someone',
    category: 'connection',
    purpose: 'Shared time with something to show for it.',
    minutes: 30,
    energy: 'medium',
    social: 'social',
    place: 'indoor',
    needs: ['bored', 'play'],
    setup: 'A simple recipe and whoever is around.',
    steps: ['Pick something with few steps.', 'Split the jobs.', 'Eat it together, away from screens.'],
    safety: 'Mind hot surfaces and knives.',
    source: BBE,
    review: 'draft',
  },
  {
    id: 'quick-game',
    title: 'Play a quick game with a friend',
    category: 'connection',
    purpose: 'Play for its own sake.',
    minutes: 20,
    energy: 'medium',
    social: 'social',
    place: 'indoor',
    needs: ['bored', 'play'],
    setup: 'A card game, a board game, or one online.',
    steps: ['Pick something short.', 'Play one round.', 'Stop while it is still fun.'],
    safety: null,
    source: BBE,
    review: 'draft',
  },
];

export interface ExternalResource {
  id: string;
  title: string;
  url: string;
  source: string;
  description: string;
  minutes: number;
  /** Last time the link was checked to load (SC05). */
  checked: string;
}

/** SC05: a short, curated list. Opens outside; no feed. */
export const EXTERNAL: readonly ExternalResource[] = [
  {
    id: 'arts-culture',
    title: 'Wander a museum',
    url: 'https://artsandculture.google.com/',
    source: 'Google Arts & Culture',
    description: 'Zoom into paintings and walk through collections from museums around the world.',
    minutes: 15,
    checked: '2026-10-30',
  },
  {
    id: 'radio-garden',
    title: 'Listen to radio from somewhere else',
    url: 'https://radio.garden/',
    source: 'Radio Garden',
    description: 'Spin a globe and tune into live local radio stations.',
    minutes: 10,
    checked: '2026-10-30',
  },
  {
    id: 'music-lab',
    title: 'Make a little music',
    url: 'https://musiclab.chromeexperiments.com/',
    source: 'Chrome Music Lab',
    description: 'Playful experiments for making sounds and rhythms. No skill needed.',
    minutes: 10,
    checked: '2026-10-30',
  },
  {
    id: 'nasa-image',
    title: 'Look at today’s space picture',
    url: 'https://www.nasa.gov/image-of-the-day/',
    source: 'NASA',
    description: 'One striking image from space and science, with a short story behind it.',
    minutes: 5,
    checked: '2026-10-30',
  },
  {
    id: 'random-article',
    title: 'Read one random article',
    url: 'https://en.wikipedia.org/wiki/Special:Random',
    source: 'Wikipedia',
    description: 'Learn about something you would never have searched for.',
    minutes: 10,
    checked: '2026-10-30',
  },
  {
    id: 'gutenberg',
    title: 'Start a free classic book',
    url: 'https://www.gutenberg.org/',
    source: 'Project Gutenberg',
    description: 'Tens of thousands of free books whose copyright has expired.',
    minutes: 20,
    checked: '2026-10-30',
  },
];

export const DURATIONS = [
  { value: '2', label: '2 min', max: 2 },
  { value: '5', label: '5 min', max: 5 },
  { value: '10', label: '10 min', max: 10 },
  { value: '20', label: '20+ min', max: Infinity },
] as const;

export interface Filters {
  need: Need | null;
  maxMinutes: number | null;
  energy: Energy | null;
  social: 'solo' | 'social' | null;
  place: 'indoor' | 'outdoor' | null;
}

/**
 * SC01: rule-based recommendations. Hard filters first; then activities
 * marked helpful rank up and not-helpful rank down. Always returns the next
 * alternatives, so there is a choice.
 */
export function recommend(
  filters: Filters,
  feedback: Readonly<Record<string, 'helpful' | 'neutral' | 'not-helpful'>> = {},
): Activity[] {
  const score = (a: Activity) => (feedback[a.id] === 'helpful' ? 1 : feedback[a.id] === 'not-helpful' ? -1 : 0);
  return ACTIVITIES.filter(
    (a) =>
      (!filters.need || a.needs.includes(filters.need)) &&
      (filters.maxMinutes === null || a.minutes <= filters.maxMinutes || filters.maxMinutes === Infinity) &&
      (!filters.energy || a.energy === filters.energy) &&
      (!filters.social || a.social === filters.social) &&
      (!filters.place || a.place === filters.place || a.place === 'anywhere'),
  ).sort((a, b) => score(b) - score(a) || a.minutes - b.minutes);
}

export function activity(id: string): Activity | undefined {
  return ACTIVITIES.find((a) => a.id === id);
}
