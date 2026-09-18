// Conventional commits (CLAUDE.md, "Commit conventions"). Imperative mood, and a
// body that explains WHY rather than restating the diff.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'refactor', 'chore', 'test', 'perf', 'build', 'ci', 'revert'],
    ],
  },
};
