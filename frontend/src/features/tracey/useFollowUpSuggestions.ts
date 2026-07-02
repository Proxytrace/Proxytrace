import { useEffect, useRef, useState } from 'react';
import type { useChatRuntime } from '@assistant-ui/react-ai-sdk';
import { latestExchange } from './follow-up-suggestions';

/** Suggestions generated for one specific assistant message (the turn they follow). */
export interface FollowUpState {
  /** Id of the assistant message the suggestions were generated for; the UI only shows them while
   * that message is still the last one in the thread. */
  messageId: string;
  items: string[];
}

type GenerateFollowUps = (
  userText: string,
  assistantText: string,
  signal: AbortSignal,
) => Promise<string[]> | null;

/**
 * Watches the shared Tracey thread and, on each running→idle transition that ends in a completed
 * assistant message with text, asks the transport for follow-up suggestions
 * (`TraceyTransport.generateFollowUps`). In-memory only: a restored/reloaded conversation shows no
 * transition, so no stale generation fires. Starting any new turn aborts an in-flight generation
 * and clears the current suggestions immediately (the chips must vanish the moment a user message
 * is sent); the render side additionally gates on the message id, so suggestions can never show
 * under anything but the exact turn they answer.
 */
export function useFollowUpSuggestions(
  runtime: ReturnType<typeof useChatRuntime>,
  generate: GenerateFollowUps,
): FollowUpState | null {
  const [followUps, setFollowUps] = useState<FollowUpState | null>(null);
  const generateRef = useRef(generate);
  useEffect(() => {
    generateRef.current = generate;
  }, [generate]);

  useEffect(() => {
    const thread = runtime.thread;
    let wasRunning = thread.getState().isRunning;
    let abort: AbortController | null = null;

    const onChange = (): void => {
      const state = thread.getState();
      const prevRunning = wasRunning;
      wasRunning = state.isRunning;
      if (state.isRunning) {
        // A turn started (user message sent / resubmit): drop the chips and cancel any pending
        // generation right away.
        abort?.abort();
        abort = null;
        setFollowUps(current => (current ? null : current));
        return;
      }
      if (!prevRunning) return; // not a turn-finish transition (import, token-less notify, …)
      const last = state.messages.at(-1);
      // Only a cleanly completed turn gets suggestions — not a stopped/errored one, and not the
      // ask_questions pause (`requires-action`), where the user answers inside the card instead.
      if (!last || last.role !== 'assistant' || last.status.type !== 'complete') return;
      const exchange = latestExchange(state.messages);
      if (!exchange) return;
      abort?.abort();
      const controller = new AbortController();
      abort = controller;
      const pending = generateRef.current(exchange.userText, exchange.assistantText, controller.signal);
      if (!pending) return; // transport not ready (no session) — silently skip
      pending
        .then(items => {
          if (controller.signal.aborted || items.length === 0) return;
          setFollowUps({ messageId: last.id, items });
        })
        .catch(() => {
          // Suggestions are a bonus; a failed generation never surfaces an error.
        });
    };

    const unsubscribe = thread.subscribe(onChange);
    return () => {
      abort?.abort();
      unsubscribe();
    };
  }, [runtime]);

  return followUps;
}
