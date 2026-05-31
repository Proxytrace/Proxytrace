import { createContext, useContext } from 'react';
import type { TraceyArtifactInput } from './tracey-artifacts';

/**
 * Actions the conversation UI needs but assistant-ui message-part components can't receive as
 * props (they're rendered by the runtime). Provided once at the page root.
 */
export interface TraceyActions {
  showArtifact: (artifact: TraceyArtifactInput) => void;
}

const TraceyActionsContext = createContext<TraceyActions | null>(null);

export const TraceyActionsProvider = TraceyActionsContext.Provider;

export function useTraceyActions(): TraceyActions {
  const ctx = useContext(TraceyActionsContext);
  if (!ctx) throw new Error('useTraceyActions must be used within a TraceyActionsProvider');
  return ctx;
}
