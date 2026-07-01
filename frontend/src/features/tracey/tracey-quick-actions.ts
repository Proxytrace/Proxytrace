import { msg } from '@lingui/core/macro';
import { type MessageDescriptor } from '@lingui/core';

/**
 * Curated prompt presets ("skills") shown as composer starter chips and at the top of the slash
 * menu. A starter chip sends its `prompt` immediately; picking one from the slash menu prefills
 * the composer so the user can edit before sending.
 *
 * `label`/`hint` are shown in the UI, so they are MessageDescriptors resolved with `i18n._()`
 * at the render site. `prompt` is fed to the LLM and stays untranslated.
 */
export interface QuickAction {
  id: string;
  label: MessageDescriptor;
  hint: MessageDescriptor;
  prompt: string;
}

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'list-agents',
    label: msg`List agents`,
    hint: msg`Show the agents in this project`,
    prompt: 'List the agents in this project with their model and last activity.',
  },
  {
    id: 'plot-token-usage',
    label: msg`Plot token usage`,
    hint: msg`Chart token usage per agent`,
    prompt: 'Plot a bar chart of token usage per agent for this project.',
  },
  {
    id: 'improve-failing-runs',
    label: msg`Improve failing runs`,
    hint: msg`Find failing test runs and suggest improvements`,
    prompt: 'Find the most recent failing test runs and suggest concrete improvements.',
  },
  {
    id: 'run-a-suite',
    label: msg`Run a suite`,
    hint: msg`Start a test run`,
    prompt: 'I want to run a test suite against an agent — help me pick and start it.',
  },
  {
    id: 'review-proposals',
    label: msg`Review proposals`,
    hint: msg`Walk through open optimization proposals`,
    prompt: 'Show the open optimization proposals and help me decide on each one.',
  },
  {
    id: 'optimize-agent',
    label: msg`Optimize an agent`,
    hint: msg`Theorize and A/B-test an improvement`,
    prompt: 'Optimize one of my agents: theorize a concrete improvement and A/B-test it.',
  },
];
