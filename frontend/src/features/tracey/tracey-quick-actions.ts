/**
 * Curated prompt presets ("skills") shown as composer chips and at the top of the slash menu.
 * Selecting one prefills the composer with `prompt`; the user can edit before sending.
 */
export interface QuickAction {
  id: string;
  label: string;
  hint: string;
  prompt: string;
}

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'list-agents',
    label: 'List agents',
    hint: 'Show the agents in this project',
    prompt: 'List the agents in this project with their model and last activity.',
  },
  {
    id: 'plot-token-usage',
    label: 'Plot token usage',
    hint: 'Chart token usage per agent',
    prompt: 'Plot a bar chart of token usage per agent for this project.',
  },
  {
    id: 'improve-failing-runs',
    label: 'Improve failing runs',
    hint: 'Find failing test runs and suggest improvements',
    prompt: 'Find the most recent failing test runs and suggest concrete improvements.',
  },
  {
    id: 'run-a-suite',
    label: 'Run a suite',
    hint: 'Start a test run',
    prompt: 'I want to run a test suite against an agent — help me pick and start it.',
  },
  {
    id: 'review-proposals',
    label: 'Review proposals',
    hint: 'Walk through open optimization proposals',
    prompt: 'Show the open optimization proposals and help me decide on each one.',
  },
  {
    id: 'optimize-agent',
    label: 'Optimize an agent',
    hint: 'Theorize and A/B-test an improvement',
    prompt: 'Optimize one of my agents: theorize a concrete improvement and A/B-test it.',
  },
];
