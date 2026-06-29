import { type ToolCallMessagePartComponent, useThread } from '@assistant-ui/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { msg, plural } from '@lingui/core/macro';
import { type I18n, type MessageDescriptor } from '@lingui/core';
import { ClockIcon } from '../../../../components/icons';
import { Badge } from '../../../../components/ui/Badge';
import { Spinner } from '../../../../components/ui/Spinner';
import type { TestRunStatus, TheoryStatus } from '../../../../api/models';
import type { AwaitError, AwaitKind, AwaitResult } from '../../tools/await';
import { ToolUIFrame } from './ToolUIFrame';
import { RUN_STATUS_VARIANT, THEORY_STATUS_VARIANT } from './badge-variants';

interface AwaitActionsArgs {
  handles?: { kind?: AwaitKind; id?: string }[];
}

interface AwaitActionsResult {
  results: (AwaitResult & { suiteName?: string; agentName?: string })[];
  errors?: AwaitError[];
  anyTimedOut: boolean;
}

const KIND_LABEL: Record<AwaitKind, MessageDescriptor> = { 'test-run': msg`Test run`, theory: msg`Theory` };

function rowLabel(i18n: I18n, item: { kind: AwaitKind; id: string; suiteName?: string; agentName?: string }): string {
  const kindLabel = i18n._(KIND_LABEL[item.kind]);
  const detail = [item.suiteName, item.agentName].filter(Boolean).join(' · ');
  return detail ? `${kindLabel} · ${detail}` : kindLabel;
}

function statusVariant(item: AwaitResult) {
  return item.kind === 'test-run'
    ? RUN_STATUS_VARIANT[item.status as TestRunStatus]
    : THEORY_STATUS_VARIANT[item.status as TheoryStatus];
}

/**
 * Inline renderer for the `await_actions` tool. While the wait runs it lists the awaited handles
 * with a spinner; once resolved it shows one row per action with its terminal status (plus
 * timed-out / failed-handle markers). The per-action live cards above stream the detailed
 * progress — this card only summarizes what the wait returned.
 */
export const AwaitActionsToolUI: ToolCallMessagePartComponent = ({ args, result, status, isError }) => {
  const { t, i18n } = useLingui();
  const threadRunning = useThread((thread) => thread.isRunning);
  const resolved = result as AwaitActionsResult | undefined;
  // User hit Stop while the wait was polling: the poll aborts, but the test run / theory keeps
  // running on the backend — so this is a calm "stopped", not a red error. Two shapes reach here:
  // assistant-ui sometimes finalizes the part as `incomplete/cancelled`, but when Stop lands mid
  // `execute` the aborted tool call leaves no terminal delta, so the part is orphaned with no
  // result (status stays `running`/`complete`). Once the thread is idle a result-less wait can
  // never resolve, so treat any non-error part with no result on an idle thread as stopped —
  // otherwise it spins on "Waiting for N actions" forever.
  const stopped =
    (status.type === 'incomplete' && status.reason === 'cancelled') ||
    (status.type !== 'incomplete' && !resolved && !threadRunning);
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
        testId="tracey-await-card"
      >
        <div className="flex flex-col gap-1.5" aria-busy="true">
          {pending.map((handle) => (
            <div key={`${handle.kind}:${handle.id}`} className="flex items-center gap-2 text-body-sm text-muted">
              <Spinner size={12} className="shrink-0" />
              <span className="shrink-0">{i18n._(KIND_LABEL[handle.kind])}</span>
              <span className="min-w-0 flex-1 truncate font-mono">{handle.id}</span>
            </div>
          ))}
        </div>
      </ToolUIFrame>
    );
  }

  return (
    <ToolUIFrame
      state="ready"
      icon={<ClockIcon size={14} />}
      title={t`Awaited actions`}
      testId="tracey-await-card"
    >
      <div className="flex flex-col gap-1.5">
        {resolved.results.map((item) => (
          <div key={`${item.kind}:${item.id}`} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-body-sm text-secondary">{rowLabel(i18n, item)}</span>
            {item.timedOut ? (
              <Badge label={t`Still running`} variant="warn" size="sm" />
            ) : (
              <Badge label={item.status} variant={statusVariant(item)} size="sm" />
            )}
          </div>
        ))}
        {(resolved.errors ?? []).map((item) => (
          <div key={`${item.kind}:${item.id}`} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-body-sm text-secondary">
              {i18n._(KIND_LABEL[item.kind])} <span className="font-mono text-muted">{item.id}</span>
            </span>
            <Badge label={t`Failed to check`} variant="danger" size="sm" title={item.error} />
          </div>
        ))}
      </div>
    </ToolUIFrame>
  );
};
