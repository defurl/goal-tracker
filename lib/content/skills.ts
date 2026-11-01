// The Skills library (functional specification §6, SK01) — the seed the CMS
// will take over (D-26 §6). Free, reputable resources, opened at their source
// through an ordinary link: nothing is embedded, downloaded or re-hosted.
// Watching or reading is never treated as proof of a skill.
//
// `checked` is when the link was last confirmed to load (2026-10-30, HTTP 200).

export type Level = 'beginner' | 'intermediate';

export interface SkillResource {
  id: string;
  title: string;
  topic: string;
  source: string;
  url: string;
  language: 'English';
  /** Rough, as the source describes itself. */
  duration: string;
  /** Minutes for one sitting, for the time filter. */
  sitting: number;
  level: Level;
  summary: string;
  status: 'available' | 'unavailable';
  checked: string;
}

const CHECKED = '2026-10-30';

export const SKILLS: readonly SkillResource[] = [
  {
    id: 'learning-how-to-learn',
    title: 'Learning How to Learn',
    topic: 'Learning',
    source: 'Coursera, Deep Teaching Solutions',
    url: 'https://www.coursera.org/learn/learning-how-to-learn',
    language: 'English',
    duration: 'About 15 hours, in short videos',
    sitting: 20,
    level: 'beginner',
    summary: 'How memory and focus work, and practical ways to study, such as spaced practice and short focused sessions.',
    status: 'available',
    checked: CHECKED,
  },
  {
    id: 'science-of-well-being',
    title: 'The Science of Well-Being',
    topic: 'Well-being',
    source: 'Coursera, Yale University',
    url: 'https://www.coursera.org/learn/the-science-of-well-being',
    language: 'English',
    duration: 'About 20 hours',
    sitting: 30,
    level: 'beginner',
    summary: 'What research says about happiness, and small weekly practices to try for yourself.',
    status: 'available',
    checked: CHECKED,
  },
  {
    id: 'personal-finance',
    title: 'Personal finance',
    topic: 'Money',
    source: 'Khan Academy',
    url: 'https://www.khanacademy.org/college-careers-more/personal-finance',
    language: 'English',
    duration: 'Short lessons, self-paced',
    sitting: 10,
    level: 'beginner',
    summary: 'Budgeting, saving, credit and taxes, explained in short lessons with practice.',
    status: 'available',
    checked: CHECKED,
  },
  {
    id: 'statistics',
    title: 'Statistics and probability',
    topic: 'Thinking',
    source: 'Khan Academy',
    url: 'https://www.khanacademy.org/math/statistics-probability',
    language: 'English',
    duration: 'Self-paced units',
    sitting: 15,
    level: 'beginner',
    summary: 'Reading charts, averages and chance: the basics for making sense of numbers in the news.',
    status: 'available',
    checked: CHECKED,
  },
  {
    id: 'grammar',
    title: 'Grammar',
    topic: 'Writing',
    source: 'Khan Academy',
    url: 'https://www.khanacademy.org/humanities/grammar',
    language: 'English',
    duration: 'Short videos and exercises',
    sitting: 10,
    level: 'beginner',
    summary: 'English grammar from parts of speech to punctuation, with quick practice.',
    status: 'available',
    checked: CHECKED,
  },
  {
    id: 'cs50x',
    title: 'CS50x: Introduction to Computer Science',
    topic: 'Programming',
    source: 'Harvard University',
    url: 'https://cs50.harvard.edu/x/',
    language: 'English',
    duration: 'About 10 weeks of lectures and problem sets',
    sitting: 60,
    level: 'beginner',
    summary: 'A thorough first course in programming and computer science, free to follow online.',
    status: 'available',
    checked: CHECKED,
  },
  {
    id: 'mit-python',
    title: 'Introduction to Computer Science and Programming in Python',
    topic: 'Programming',
    source: 'MIT OpenCourseWare',
    url: 'https://ocw.mit.edu/courses/6-0001-introduction-to-computer-science-and-programming-in-python-fall-2016/',
    language: 'English',
    duration: 'A full university course: lectures, notes, problem sets',
    sitting: 60,
    level: 'beginner',
    summary: 'Programming with Python and problem solving, from MIT’s introductory course.',
    status: 'available',
    checked: CHECKED,
  },
  {
    id: 'mdn-web',
    title: 'Learn web development',
    topic: 'Programming',
    source: 'MDN Web Docs, Mozilla',
    url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development',
    language: 'English',
    duration: 'Self-paced modules',
    sitting: 30,
    level: 'beginner',
    summary: 'HTML, CSS and JavaScript from the people who document the web.',
    status: 'available',
    checked: CHECKED,
  },
  {
    id: 'freecodecamp',
    title: 'freeCodeCamp curriculum',
    topic: 'Programming',
    source: 'freeCodeCamp',
    url: 'https://www.freecodecamp.org/learn/',
    language: 'English',
    duration: 'Self-paced certifications',
    sitting: 30,
    level: 'beginner',
    summary: 'Hands-on coding lessons in the browser, building small projects as you go.',
    status: 'available',
    checked: CHECKED,
  },
  {
    id: 'exercism',
    title: 'Practise a programming language',
    topic: 'Programming',
    source: 'Exercism',
    url: 'https://exercism.org/',
    language: 'English',
    duration: 'Small exercises, any time',
    sitting: 20,
    level: 'intermediate',
    summary: 'Short coding exercises in many languages, with optional feedback from volunteer mentors.',
    status: 'available',
    checked: CHECKED,
  },
  {
    id: 'drawabox',
    title: 'Drawabox',
    topic: 'Creativity',
    source: 'Drawabox',
    url: 'https://drawabox.com/',
    language: 'English',
    duration: 'Lessons with homework, self-paced',
    sitting: 30,
    level: 'beginner',
    summary: 'Drawing fundamentals built up from lines and boxes, with a lot of practice.',
    status: 'available',
    checked: CHECKED,
  },
  {
    id: 'ted-ed',
    title: 'TED-Ed lessons',
    topic: 'Curiosity',
    source: 'TED-Ed',
    url: 'https://ed.ted.com/',
    language: 'English',
    duration: 'Animated lessons of about 5 minutes',
    sitting: 5,
    level: 'beginner',
    summary: 'Short animated lessons on science, history, language and more.',
    status: 'available',
    checked: CHECKED,
  },
  {
    id: 'crash-course',
    title: 'Crash Course',
    topic: 'Curiosity',
    source: 'Crash Course on YouTube',
    url: 'https://www.youtube.com/@crashcourse',
    language: 'English',
    duration: 'Series of 10 to 15 minute videos',
    sitting: 15,
    level: 'beginner',
    summary: 'Fast, friendly video series on subjects from biology to economics.',
    status: 'available',
    checked: CHECKED,
  },
  {
    id: 'typing',
    title: 'Learn to touch type',
    topic: 'Everyday skills',
    source: 'TypingClub',
    url: 'https://www.typingclub.com/',
    language: 'English',
    duration: 'Short lessons, self-paced',
    sitting: 10,
    level: 'beginner',
    summary: 'Typing practice in short lessons, building speed without looking at the keys.',
    status: 'available',
    checked: CHECKED,
  },
];

export const TOPICS = [...new Set(SKILLS.map((s) => s.topic))].sort();

export function skill(id: string): SkillResource | undefined {
  return SKILLS.find((s) => s.id === id);
}
