import { describe, it, expect } from 'vitest';
import type { AgentCallListItemDto } from '../api/models';
import { tracePreview } from './trace';

// Only messagePreview is read by tracePreview; a minimal fixture keeps the intent clear.
function trace(messagePreview: string | null): AgentCallListItemDto {
  return { id: 'a', messagePreview } as Partial<AgentCallListItemDto> as AgentCallListItemDto;
}

describe('tracePreview', () => {
  it('returns the preview text when present', () => {
    expect(tracePreview(trace('Where is my order #18342?'))).toBe('Where is my order #18342?');
  });

  it('returns null when the backend has no preview (renders an em-dash placeholder)', () => {
    expect(tracePreview(trace(null))).toBeNull();
  });

  // A request with no user message is stored by the preview backfill as an empty string, not null.
  // tracePreview must coerce that to null so the row still renders the em-dash placeholder rather
  // than a blank cell.
  it('coerces the empty-string backfill marker to null', () => {
    expect(tracePreview(trace(''))).toBeNull();
  });
});
