import { createContext, useContext } from 'react';
import type { TraceyChat } from './useTraceyChat';

/**
 * Shares a single Tracey chat (runtime + conversation) across the whole authenticated app.
 *
 * The runtime is created once, high in the tree (above the router `Outlet`), so navigating
 * between routes never unmounts it — the in-memory conversation survives navigation. The
 * `localStorage` snapshot in `useTraceyChat` is then only needed to survive a full page reload.
 */
const TraceyChatContext = createContext<TraceyChat | null>(null);

export const TraceyChatProvider = TraceyChatContext.Provider;

export function useTraceyChatContext(): TraceyChat {
  const ctx = useContext(TraceyChatContext);
  if (!ctx) throw new Error('useTraceyChatContext must be used within a TraceyChatProvider');
  return ctx;
}
