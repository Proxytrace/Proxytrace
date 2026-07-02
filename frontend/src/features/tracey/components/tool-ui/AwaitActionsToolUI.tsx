import { type ToolCallMessagePartComponent, useThread } from '@assistant-ui/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { plural } from '@lingui/core/macro';
import { ClockIcon } from '../../../../components/icons';
import { Badge } from '../../../../components/ui/Badge';
import type { AnyAwaitResult, AwaitError, AwaitKind } from '../../tools/await';
import { ToolUIFrame } from './ToolUIFrame';
import { AwaitPendingRow, AwaitResultRow } from './AwaitActionRows';
import { awaitOutcome, fmtElapsed } from './await-card-logic';
import { useElapsedSeconds } from './useElapsedSeconds';

interface AwaitActionsArgs {
  handles?: { kind?: AwaitKind; id?: string }[];
}

interface AwaitActionsResult {
  results: AnyAwaitResult[];
  errors?: AwaitError[];
  anyTimedOut: boolean;
}

/**
 * Inline renderer for the `await_actions` tool. While the wait runs it shows one live row per
 * handle — real backend status, case progress for runs, the A/B phase for theories — plus an
 * elapsed stopwatch and the streaming ring. Once resolved it settles into one outcome row per
 * action (with per-case counts and timed-out / failed-handle markers) under a summary verdict.
 * The per-action live cards above stream the fully detailed progress.
 */
export const AwaitActionsToolUI: ToolCallMessagePartComponent = ({ args, result, status, isError }) => {
  const { t } = useLingui();
  const threadRunning = useThread((thread) => thread.isRunning);
  const resolved = result as AwaitActionsResult | undefined;
  // User hit Stop while the wait was polling: the poll aborts, but the test run / theory keeps
  // running on the backend — so this is a calm "stopped", not a red error. Two shapes reach here:
  // assistant-ui sometimes finalizes the part as `incomplete/cancelled`, but when Stop lands mid
  // `execute` the aborted tool call leaves no terminal delta, so the part is orphaned with no
  // result (status stays `running`/`complete`). Once the thread is idle a result-less wait can
  // never resolve, so treat any non-error part with no result on an idle thread as stopped —
  // otherwise it would spin on "Waiting for N actions" forever.
  const stopped =
    (status.type === 'incomplete' && status.reason === 'cancelled') ||
    (status.type !== 'incomplete' && !resolved && !threadRunning);
  const waiting = !stopped && !isError && status.type !== 'incomplete' && !resolved;
  const elapsed = useElapsedSeconds(waiting);

  if (stopped) {
    return (
      <ToolUIFrame state="ready" icon={<ClockIcon size={14} />} title={t`Wait stopped`} testId="tracey-await-card">
        <span className="text-body-sm text-muted">
          <Trans>You stopped before these finished — they keep running in the background.</Trans>
        </span>
      </ToolUIFrame>
    );
  }
  if (isError || status.type === 'incomplete') {
    return <ToolUIFrame state="error" testId="tracey-await-card" />;
  }

  const { handles } = args as AwaitActionsArgs;

  if (!resolved) {
    const pending = (handles ?? []).filter((h): h is { kind: AwaitKind; id: string } => !!h.kind && !!h.id);
    const waitingTitle = pending.length
      ? plural(pending.length, { one: 'Waiting for # action', other: 'Waiting for # actions' })
      : t`Waiting for … actions`;
    return (
      <ToolUIFrame
        state="ready"
        icon={<ClockIcon size={14} />}
        title={waitingTitle}
        live
        cornerAccessory={
          <span className="font-mono text-caption tabular-nums text-muted" title={t`Time waited`}>
            {fmtElapsed(elapsed)}
          </span>
        }
        testId="tracey-await-card"
      >
        <div className="flex flex-col gap-2" aria-busy="true">
          {pending.map((handle) => (
            <AwaitPendingRow key={`${handle.kind}:${handle.id}`} kind={handle.kind} id={handle.id} />
          ))}
          <span className="border-t border-hairline pt-2 text-caption text-muted">
            <Trans>Tracey picks up the moment everything finishes.</Trans>
          </span>
        </div>
      </ToolUIFrame>
    );
  }

  const outcome = awaitOutcome(resolved.results, resolved.errors, resolved.anyTimedOut);
  const outcomeLabel =
    outcome === 'success' ? t`All done` : outcome === 'warn' ? t`Still running` : t`Needs a look`;
  return (
    <ToolUIFrame
      state="ready"
      icon={<ClockIcon size={14} />}
      title={t`Awaited actions`}
      cornerAccessory={<Badge label={outcomeLabel} variant={outcome} size="sm" />}
      testId="tracey-await-card"
    >
      <div className="flex flex-col gap-2">
        {resolved.results.map((item, index) => (
          <AwaitResultRow key={`${item.kind}:${item.id}`} item={item} index={index} />
        ))}
        {(resolved.errors ?? []).map((item, index) => (
          <div
            key={`${item.kind}:${item.id}`}
            className="fade-up flex items-center gap-2"
            style={{ animationDelay: `${(resolved.results.length + index) * 60}ms` }}
          >
            <span className="min-w-0 flex-1 truncate text-body-sm text-secondary">
              {item.kind === 'test-run' ? <Trans>Test run</Trans> : <Trans>Theory</Trans>}{' '}
              <span className="font-mono text-muted">{item.id}</span>
            </span>
            <Badge label={t`Failed to check`} variant="danger" size="sm" title={item.error} />
          </div>
        ))}
      </div>
    </ToolUIFrame>
  );
};
