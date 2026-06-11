import { describe, it, expect, vi } from 'vitest';
import { pollUntilTerminal } from './poll-until-terminal';

/** A fake clock whose `sleep` advances `now` instantly, so tests never really wait. */
function fakeClock() {
  let t = 0;
  return {
    now: () => t,
    sleep: vi.fn((ms: number) => {
      t += ms;
      return Promise.resolve();
    }),
  };
}

describe('pollUntilTerminal', () => {
  it('returns immediately when the first snapshot is terminal', async () => {
    const clock = fakeClock();
    const poll = vi.fn().mockResolvedValue({ done: true });
    const res = await pollUntilTerminal(poll, (s: { done: boolean }) => s.done, {
      intervalMs: 3000, timeoutMs: 60000, ...clock,
    });
    expect(res).toEqual({ snapshot: { done: true }, timedOut: false });
    expect(poll).toHaveBeenCalledTimes(1);
    expect(clock.sleep).not.toHaveBeenCalled();
  });

  it('polls until a snapshot is terminal', async () => {
    const clock = fakeClock();
    const poll = vi
      .fn()
      .mockResolvedValueOnce({ done: false })
      .mockResolvedValueOnce({ done: false })
      .mockResolvedValueOnce({ done: true });
    const res = await pollUntilTerminal(poll, (s: { done: boolean }) => s.done, {
      intervalMs: 3000, timeoutMs: 60000, ...clock,
    });
    expect(res.timedOut).toBe(false);
    expect(res.snapshot).toEqual({ done: true });
    expect(poll).toHaveBeenCalledTimes(3);
    expect(clock.sleep).toHaveBeenCalledTimes(2);
  });

  it('gives up with timedOut once the cap is exceeded', async () => {
    const clock = fakeClock();
    const poll = vi.fn().mockResolvedValue({ done: false });
    const res = await pollUntilTerminal(poll, (s: { done: boolean }) => s.done, {
      intervalMs: 3000, timeoutMs: 9000, ...clock,
    });
    expect(res.timedOut).toBe(true);
    expect(res.snapshot).toEqual({ done: false });
    expect(poll).toHaveBeenCalledTimes(4);
    expect(clock.sleep).toHaveBeenCalledTimes(3);
  });

  it('throws AbortError without polling when the signal is already aborted', async () => {
    const clock = fakeClock();
    const poll = vi.fn().mockResolvedValue({ done: false });
    const controller = new AbortController();
    controller.abort();
    await expect(
      pollUntilTerminal(poll, (s: { done: boolean }) => s.done, {
        intervalMs: 3000, timeoutMs: 60000, ...clock, signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(poll).not.toHaveBeenCalled();
  });

  it('stops polling when aborted between sleeps', async () => {
    const clock = fakeClock();
    const controller = new AbortController();
    const poll = vi.fn().mockImplementation(() => {
      controller.abort();
      return Promise.resolve({ done: false });
    });
    await expect(
      pollUntilTerminal(poll, (s: { done: boolean }) => s.done, {
        intervalMs: 3000, timeoutMs: 60000, ...clock, signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(poll).toHaveBeenCalledTimes(1);
  });
});
