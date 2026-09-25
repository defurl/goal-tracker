// Feature 4 — goals and milestones.
//
// The store carries the summary the room needs (spec/05 §2); the milestone
// list lives in the panel that shows it and is loaded on demand. A milestone
// is completed through set_milestone() (021), which awards the goal's +100 in
// the database, once per goal (AC-4.2).

import type { GoalCategory, GoalSummary } from '../stores/app';
import { loadPoints } from './points';
import { getSession, today, type DataSession } from './session';
import { write } from './write';

export const MILESTONE_CAP = 5; // FR-4.2

export interface Milestone {
  id: string;
  title: string;
  dueDate: string | null;
  complete: boolean;
}

export interface GoalDetail extends GoalSummary {
  description: string | null;
  complete: boolean;
  milestones: Milestone[];
}

async function query(session: DataSession): Promise<GoalDetail[]> {
  const { data, error } = await session.supabase
    .from('goals')
    .select('id, title, category, description, start_date, target_date, completed_at, milestones(id, title, due_date, completed_at, sort_order)')
    .eq('user_id', session.userId)
    .order('target_date');
  if (error) throw error;

  return (data ?? []).map((g) => {
    const milestones = [...(g.milestones ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => ({ id: m.id, title: m.title, dueDate: m.due_date, complete: m.completed_at !== null }));
    const done = milestones.filter((m) => m.complete).length;
    return {
      id: g.id,
      title: g.title,
      category: g.category,
      description: g.description,
      startDate: g.start_date,
      targetDate: g.target_date,
      complete: g.completed_at !== null,
      progress: milestones.length === 0 ? 0 : done / milestones.length,
      milestones,
    };
  });
}

export async function loadGoals(session: DataSession): Promise<GoalSummary[]> {
  return (await query(session)).map(({ id, title, category, progress, startDate, targetDate }) => ({
    id, title, category, progress, startDate, targetDate,
  }));
}

/** For the panel and /text: the goals with their milestones. Not in the store. */
export async function loadGoalDetails(): Promise<GoalDetail[]> {
  const session = getSession();
  return session ? query(session) : [];
}

async function refresh(session: DataSession): Promise<void> {
  const [goals, points] = await Promise.all([
    loadGoals(session),
    loadPoints(session.supabase, session.userId, today(session)),
  ]);
  write({ goals, points });
}

export type CreateGoalOutcome = 'created' | 'invalid_dates' | 'invalid' | 'unavailable' | 'signed_out';

export async function createGoal(input: {
  title: string;
  category: GoalCategory;
  description: string;
  startDate: string;
  targetDate: string;
  milestones: string[];
}): Promise<CreateGoalOutcome> {
  const session = getSession();
  if (!session) return 'signed_out';

  const title = input.title.trim();
  const milestones = input.milestones.map((m) => m.trim()).filter(Boolean);
  if (!title || title.length > 120 || milestones.length < 1 || milestones.length > MILESTONE_CAP) return 'invalid';
  if (!input.startDate || !input.targetDate) return 'invalid';
  // AC-4.1, checked here for the message; the table's check constraint is the rule.
  if (input.targetDate < input.startDate) return 'invalid_dates';

  const { data: goal, error } = await session.supabase
    .from('goals')
    .insert({
      user_id: session.userId,
      title,
      category: input.category,
      description: input.description.trim() || null,
      start_date: input.startDate,
      target_date: input.targetDate,
    })
    .select('id')
    .single();
  if (error || !goal) return 'unavailable';

  const { error: milestoneError } = await session.supabase.from('milestones').insert(
    milestones.map((m, i) => ({ goal_id: goal.id, user_id: session.userId, title: m.slice(0, 120), sort_order: i })),
  );
  await refresh(session);
  return milestoneError ? 'unavailable' : 'created';
}

export async function setMilestone(id: string, complete: boolean): Promise<void> {
  const session = getSession();
  if (!session) return;
  await session.supabase.rpc('set_milestone', { p_milestone_id: id, p_complete: complete });
  await refresh(session);
}
