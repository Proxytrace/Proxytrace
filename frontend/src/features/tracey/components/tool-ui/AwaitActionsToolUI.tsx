import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
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

const KIND_LABEL: Record<AwaitKind, string> = { 'test-run': 'Test run', theory: 'Theory' };

function rowLabel(item: { kind: AwaitKind; id: string; suiteName?: string; agentName?: string }): string {
  const detail = [item.suiteName, item.agentName].filter(Boolean).join(' · ');
  return detail ? `${KIND_LABEL[item.kind]} · ${detail}` : KIND_LABEL[item.kind];
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
  // User hit Stop while the wait was polling: the poll aborts, but the test run / theory keeps
  // running on the backend — so this is a calm "stopped", not a red error.
  if (status.type === 'incomplete' && status.reason === 'cancelled') {
    return (
      <ToolUIFrame state="ready" icon={<ClockIcon size={14} />} title="Wait stopped" testId="tracey-await-card">
        <span className="text-body-sm text-muted">
          You stopped before these finished — they keep running in the background.
        </span>
      </ToolUIFrame>
    );
  }
  if (isError || status.type === 'incomplete') {
    return <ToolUIFrame state="error" testId="tracey-await-card" />;
  }

  const { handles } = args as AwaitActionsArgs;
  const resolved = result as AwaitActionsResult | undefined;

  if (!resolved) {
    const pending = (handles ?? []).filter((h): h is { kind: AwaitKind; id: string } => !!h.kind && !!h.id);
    return (
      <ToolUIFrame
        state="ready"
        icon={<ClockIcon size={14} />}
        title={`Waiting for ${pending.length || '…'} action${pending.length === 1 ? '' : 's'}`}
        testId="tracey-await-card"
      >
        <div className="flex flex-col gap-1.5" aria-busy="true">
          {pending.map((handle) => (
            <div key={`${handle.kind}:${handle.id}`} className="flex items-center gap-2 text-body-sm text-muted">
              <Spinner size={12} />
              <span>{KIND_LABEL[handle.kind]}</span>
              <span className="truncate font-mono">{handle.id}</span>
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
      title="Awaited actions"
      testId="tracey-await-card"
    >
      <div className="flex flex-col gap-1.5">
        {resolved.results.map((item) => (
          <div key={`${item.kind}:${item.id}`} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-body-sm text-secondary">{rowLabel(item)}</span>
            {item.timedOut ? (
              <Badge label="Still running" variant="warn" size="sm" />
            ) : (
              <Badge label={item.status} variant={statusVariant(item)} size="sm" />
            )}
          </div>
        ))}
        {(resolved.errors ?? []).map((item) => (
          <div key={`${item.kind}:${item.id}`} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-body-sm text-secondary">
              {KIND_LABEL[item.kind]} <span className="font-mono text-muted">{item.id}</span>
            </span>
            <Badge label="Failed to check" variant="danger" size="sm" title={item.error} />
          </div>
        ))}
      </div>
    </ToolUIFrame>
  );
};
