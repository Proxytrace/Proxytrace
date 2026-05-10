import type { ModelParametersDto } from './models';

export interface PlaygroundToolArgumentPayload {
  name: string;
  description: string | null;
  type: string;
  isRequired: boolean;
}

export interface PlaygroundToolPayload {
  name: string;
  description: string;
  arguments: PlaygroundToolArgumentPayload[];
}

export interface PlaygroundMessagePayload {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolRequests: { id: string; name: string; arguments: string }[];
  toolCallId: string | null;
  toolSucceeded: boolean;
  toolError: string | null;
}

export interface PlaygroundCompletePayload {
  agentId: string;
  endpointId: string;
  systemPrompt: string;
  parameters: ModelParametersDto;
  tools: PlaygroundToolPayload[];
  messages: PlaygroundMessagePayload[];
}

export type PlaygroundStreamEvent =
  | { type: 'token'; delta: string }
  | { type: 'tool-request'; id: string; name: string; arguments: string }
  | {
      type: 'done';
      inputTokens: number;
      outputTokens: number;
      latencyMs: number;
      costEur: number | null;
      finishReason: string | null;
    }
  | { type: 'error'; message: string };

/**
 * Streams /api/playground/complete via fetch + SSE parsing.
 * Returns an abort handle.
 */
export function streamPlaygroundCompletion(
  payload: PlaygroundCompletePayload,
  onEvent: (e: PlaygroundStreamEvent) => void,
): { abort: () => void } {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch('/api/playground/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        onEvent({ type: 'error', message: `${res.status} ${res.statusText}${text ? ': ' + text : ''}` });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by "\n\n"
        let sep: number;
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const event = parseFrame(frame);
          if (event) onEvent(event);
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      onEvent({ type: 'error', message: (err as Error).message });
    }
  })();

  return { abort: () => controller.abort() };
}

function parseFrame(frame: string): PlaygroundStreamEvent | null {
  let eventName = 'message';
  let dataLine = '';
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) eventName = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLine += line.slice(5).trim();
  }
  if (!dataLine) return null;
  try {
    const data = JSON.parse(dataLine);
    return { type: eventName, ...data } as PlaygroundStreamEvent;
  } catch {
    return null;
  }
}
