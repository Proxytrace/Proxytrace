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

  it('rejects on the first poll failure by default', async () => {
    const clock = fakeClock();
    const poll = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(
      pollUntilTerminal(poll, (s: { done: boolean }) => s.done, {
        intervalMs: 3000, timeoutMs: 60000, ...clock,
      }),
    ).rejects.toThrow('boom');
    expect(poll).toHaveBeenCalledTimes(1);
  });

  it('retries transient poll failures within the tolerance and still resolves', async () => {
    const clock = fakeClock();
    const poll = vi
      .fn()
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce({ done: false })
      .mockRejectedValueOnce(new Error('another blip'))
      .mockResolvedValueOnce({ done: true });
    const res = await pollUntilTerminal(poll, (s: { done: boolean }) => s.done, {
      intervalMs: 3000, timeoutMs: 60000, maxConsecutiveFailures: 1, ...clock,
    });
    expect(res).toEqual({ snapshot: { done: true }, timedOut: false });
    expect(poll).toHaveBeenCalledTimes(4);
  });

  it('resets the failure counter on a successful poll', async () => {
    const clock = fakeClock();
    // Two total failures but never two in a row — must survive with a tolerance of 1.
    const poll = vi
      .fn()
      .mockRejectedValueOnce(new Error('blip 1'))
      .mockResolvedValueOnce({ done: false })
      .mockRejectedValueOnce(new Error('blip 2'))
      .mockResolvedValueOnce({ done: true });
    const res = await pollUntilTerminal(poll, (s: { done: boolean }) => s.done, {
      intervalMs: 3000, timeoutMs: 60000, maxConsecutiveFailures: 1, ...clock,
    });
    expect(res.timedOut).toBe(false);
  });

  it('rethrows once consecutive failures exceed the tolerance', async () => {
    const clock = fakeClock();
    const poll = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockRejectedValueOnce(new Error('fail 3'));
    await expect(
      pollUntilTerminal(poll, (s: { done: boolean }) => s.done, {
        intervalMs: 3000, timeoutMs: 60000, maxConsecutiveFailures: 2, ...clock,
      }),
    ).rejects.toThrow('fail 3');
    expect(poll).toHaveBeenCalledTimes(3);
  });

  it('rethrows the last error when the cap elapses with no snapshot ever seen', async () => {
    const clock = fakeClock();
    const poll = vi.fn().mockRejectedValue(new Error('always down'));
    await expect(
      pollUntilTerminal(poll, (s: { done: boolean }) => s.done, {
        intervalMs: 3000, timeoutMs: 3000, maxConsecutiveFailures: 100, ...clock,
      }),
    ).rejects.toThrow('always down');
  });

  it('returns the last good snapshot with timedOut when trailing polls fail within tolerance', async () => {
    const clock = fakeClock();
    const poll = vi
      .fn()
      .mockResolvedValueOnce({ done: false })
      .mockRejectedValue(new Error('down'));
    const res = await pollUntilTerminal(poll, (s: { done: boolean }) => s.done, {
      intervalMs: 3000, timeoutMs: 6000, maxConsecutiveFailures: 100, ...clock,
    });
    expect(res).toEqual({ snapshot: { done: false }, timedOut: true });
  });

  it('does not treat an abort as a retryable failure', async () => {
    const clock = fakeClock();
    const poll = vi.fn().mockRejectedValue(new DOMException('stopped', 'AbortError'));
    await expect(
      pollUntilTerminal(poll, (s: { done: boolean }) => s.done, {
        intervalMs: 3000, timeoutMs: 60000, maxConsecutiveFailures: 5, ...clock,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(poll).toHaveBeenCalledTimes(1);
  });
});
