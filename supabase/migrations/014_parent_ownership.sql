-- 014 · a child row belongs to its parent's owner — owner decision 2026-09-24
--
-- 002–009 give each child table a plain foreign key to its parent, and the RLS
-- policies in 012 check the child's user_id only. Together they allowed a row
-- in A's own name that points at B's parent: a habit_log on B's habit, a
-- milestone on B's goal, a challenge on B's action. Nothing of B's is read or
-- changed that way, but server code that trusts the parent id — award points
-- for this habit_id — would act on B's data. The owner ruled it a fault.
--
-- Fixed structurally rather than in a policy: each child references its parent
-- by (id, user_id), so the owner must match or the row cannot exist. That holds
-- for the service role and security-definer code too, which RLS never binds.

-- The parents: (id, user_id) must be a key for a foreign key to target it. id
-- is already unique, so this adds no constraint, only the index.
alter table user_actions add constraint user_actions_id_user_id_key unique (id, user_id);
alter table habits       add constraint habits_id_user_id_key       unique (id, user_id);
alter table goals        add constraint goals_id_user_id_key        unique (id, user_id);

-- The children: replace the single-column key with one that carries the owner.
alter table daily_challenges drop constraint daily_challenges_action_id_fkey;
alter table daily_challenges add constraint daily_challenges_action_owner_fkey
  foreign key (action_id, user_id) references user_actions (id, user_id) on delete cascade;

alter table habit_logs drop constraint habit_logs_habit_id_fkey;
alter table habit_logs add constraint habit_logs_habit_owner_fkey
  foreign key (habit_id, user_id) references habits (id, user_id) on delete cascade;

alter table milestones drop constraint milestones_goal_id_fkey;
alter table milestones add constraint milestones_goal_owner_fkey
  foreign key (goal_id, user_id) references goals (id, user_id) on delete cascade;
