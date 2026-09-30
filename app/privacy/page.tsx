// The Privacy Policy (build plan 4.6). Its first job is FR-3.6, stated plainly:
// journal entries are never stored and cannot be read back, by anyone.
//
// Every claim here is a claim about the code, and must stay true of it:
//   - journal_entries has no column for entry text (supabase/migrations/007)
//   - with AI Reflect off, saving sends mood and tags only (lib/data/journal.ts)
//   - agent_logs holds token counts and error codes, never content (010)
//   - the import agent sends the article to Gemini (lib/agents/extract.ts)
//   - signing out clears the device snapshot (AccountControl, lib/data/hydrate)
//   - deleting the auth user cascades to every table; agent_logs rows are kept
//     with user_id set to null (the `on delete` clauses in the migrations)
// If one of those changes, this page changes in the same commit.
//
// The AI Reflect paragraph follows the same flag the button does, so the page
// cannot describe a journal agent that is off as on, or the reverse.
//
// A document, not a feature: outside the (app) group, so it loads no session
// and no store. Plain DOM in /text's voice.

import type { Metadata } from 'next';
import Link from 'next/link';

import { aiReflectEnabled } from '../../lib/flags';

import styles from '../(app)/text/text.module.css';

export const metadata: Metadata = {
  title: 'Privacy · Be Better Everyday',
};

const UPDATED = '30 September 2026';

/** Where data requests go, until the app can delete an account itself (D-22). */
const CONTACT = 'amorelyn.work@gmail.com';

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Privacy</h1>
        <p className={styles.label}>updated {UPDATED}</p>
      </header>

      <section className={styles.section} aria-labelledby="journal">
        <h2 id="journal" className={styles.heading}>
          Your journal entries are never stored
        </h2>
        <p className={styles.prose}>
          What you write in the journal is not kept — not in the database, not in a log, not in a backup. The table
          that holds your journal has no place to put it.
        </p>
        <p className={styles.prose}>
          So an entry cannot be read again later: not by you, not by us, and not by anyone who ever got into the
          database. There is nothing there to read.
        </p>
        <p className={styles.quiet}>
          For each day, what is kept is the mood you chose, the topics you tagged and — only if you asked for one —
          the AI reflection: a short summary, one strength it noticed and one next step.
        </p>
        {aiReflectEnabled ? (
          <p className={styles.quiet}>
            When you ask for a reflection, your entry goes to our server over an encrypted connection and from there to
            Google&rsquo;s Gemini API, which writes the reflection. It is held only for the length of that request and
            is never written down, logged or retried. Nothing is sent unless you press the button.
          </p>
        ) : (
          <p className={styles.quiet}>
            AI reflections are switched off at the moment, so saving an entry sends only the mood and the tags. The
            words you type never leave your device.
          </p>
        )}
      </section>

      <section className={styles.section} aria-labelledby="kept">
        <h2 id="kept" className={styles.heading}>
          What is kept
        </h2>
        <ul className={`${styles.list} ${styles.sentences}`}>
          <li className={styles.quiet}>Your email address and sign-in, held by Supabase, which runs the database.</li>
          <li className={styles.quiet}>Your time zone, so the day starts at your midnight.</li>
          <li className={styles.quiet}>
            For each article you import: the action it became, its link if you gave one, and a short summary.
          </li>
          <li className={styles.quiet}>Your daily challenges, habits and the days you kept them, and your points.</li>
          <li className={styles.quiet}>Your goals and their milestones.</li>
          <li className={styles.quiet}>Your journal days, as described above.</li>
          <li className={styles.quiet}>
            A count of how often you used the AI helpers, so each has a daily limit, and a record of each call&rsquo;s
            size, speed and whether it worked. Never what was sent or what came back.
          </li>
        </ul>
        <p className={styles.quiet}>
          This device also keeps a copy of your last loaded room so it can open without a connection. Signing out
          removes it.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="shared">
        <h2 id="shared" className={styles.heading}>
          Who else sees it
        </h2>
        <p className={styles.quiet}>
          Supabase stores your data, and Vercel serves the app. When you import an article, its link or text goes to
          Google&rsquo;s Gemini API to become an action. That runs on Gemini&rsquo;s free tier, whose terms let Google
          use what is sent to improve its products and have people review it — so import only what you would be
          happy for anyone to read. An article is public; that is why this is allowed for imports and not for your
          journal.
        </p>
        <p className={styles.quiet}>
          There is no advertising, no analytics and no session recording, and nothing is sold.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="yours">
        <h2 id="yours" className={styles.heading}>
          Seeing or deleting it
        </h2>
        <p className={styles.quiet}>
          To see what is kept about you, or to have your account deleted, email{' '}
          <a href={`mailto:${CONTACT}`} className={styles.label}>
            {CONTACT}
          </a>
          . Deleting an account removes everything that belongs to it. The records of AI calls keep only their size
          and speed, and no longer point to you.
        </p>
      </section>

      <p className={styles.quiet}>
        <Link href="/text" className={styles.label}>
          back
        </Link>
      </p>
    </main>
  );
}
