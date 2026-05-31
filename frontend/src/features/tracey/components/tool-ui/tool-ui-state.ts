export type ToolUIState = 'pending' | 'error' | 'ready';

/**
 * Classifies an assistant-ui tool-call part into the three render states a tool UI cares
 * about: still executing, errored, or done with a result to show.
 */
export function toolUiState(
  status: { type: string },
  isError: boolean | undefined,
  hasResult: boolean,
): ToolUIState {
  if (isError || status.type === 'incomplete') return 'error';
  if (!hasResult) return 'pending';
  return 'ready';
}
