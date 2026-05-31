import { createContext, useContext } from 'react';

/**
 * Actions the conversation UI needs but assistant-ui message-part components can't receive as
 * props (they're rendered by the runtime). Provided once at the page root. `sendUserMessage`
 * appends a new user turn (used by interactive tool UIs — choice prompts, forms); `navigate`
 * routes the user into the app (used by entity cards).
 */
export interface TraceyActions {
  sendUserMessage: (text: string) => void;
  navigate: (path: string) => void;
}

const TraceyActionsContext = createContext<TraceyActions | null>(null);

export const TraceyActionsProvider = TraceyActionsContext.Provider;

export function useTraceyActions(): TraceyActions {
  const ctx = useContext(TraceyActionsContext);
  if (!ctx) throw new Error('useTraceyActions must be used within a TraceyActionsProvider');
  return ctx;
}
