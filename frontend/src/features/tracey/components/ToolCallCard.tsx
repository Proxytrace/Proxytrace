import { useEffect, useRef, useState } from 'react';
import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { CheckIcon, ChevronRightIcon, ExpandIcon, XIcon } from '../../../components/icons';
import { cn } from '../../../lib/cn';
import { useTraceyActions } from '../tracey-actions';
import { resultToArtifact } from '../tracey-artifacts';

type ToolStatus = 'pending' | 'success' | 'failed';

function classify(statusType: string, isError: boolean | undefined): ToolStatus {
  if (statusType === 'running' || statusType === 'requires-action') return 'pending';
  if (isError || statusType === 'incomplete') return 'failed';
  return 'success';
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

function StatusBadge({ status }: { status: ToolStatus }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-warn">
        <span className="size-1.5 animate-pulse rounded-full bg-warn" />
        Running
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-danger">
        <XIcon size={11} />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-success">
      <CheckIcon size={11} />
      Done
    </span>
  );
}

function Section({ title, children }: { title: string; children: string }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">{title}</div>
      <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-sm bg-surface-2 px-2 py-1.5 text-[11px] text-secondary">
        {children}
      </pre>
    </div>
  );
}

/**
 * A collapsed tool-call row showing name, execution duration, and status. Expands to reveal the
 * tool input, and its output (or error). Pinnable results can be sent to the artifact panel.
 */
export const ToolCallCard: ToolCallMessagePartComponent = ({ toolName, args, argsText, result, isError, status }) => {
  const { showArtifact } = useTraceyActions();
  const [open, setOpen] = useState(false);

  const isRunning = status.type === 'running' || status.type === 'requires-action';
  const toolStatus = classify(status.type, isError);

  // No per-tool timing is exposed by the runtime, so measure wall-clock from the first time we see
  // the call running until it settles. Restored (already-complete) calls simply show no duration.
  const startRef = useRef<number | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  useEffect(() => {
    if (isRunning && startRef.current === null) {
      startRef.current = performance.now();
    } else if (!isRunning && startRef.current !== null && durationMs === null) {
      setDurationMs(performance.now() - startRef.current);
    }
  }, [isRunning, durationMs]);

  const hasResult = result != null;
  const argsJson =
    args && Object.keys(args).length > 0
      ? JSON.stringify(args, null, 2)
      : argsText && argsText.trim() && argsText.trim() !== '{}'
        ? argsText
        : null;
  const resultText = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  // `show_*` tools already render into the panel and `navigate` returns nothing worth pinning.
  const pinnable = hasResult && !isError && !toolName.startsWith('show_') && toolName !== 'navigate';

  return (
    <div className="my-1 rounded-md border border-hairline bg-card text-xs">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)]"
      >
        <ChevronRightIcon
          size={12}
          className={cn('shrink-0 text-muted transition-transform duration-[var(--motion-base)]', open && 'rotate-90')}
        />
        <span className="truncate font-mono text-[11px] text-accent">{toolName}</span>
        <span className="ml-auto flex shrink-0 items-center gap-2.5">
          {durationMs != null && (
            <span className="tabular-nums text-[10px] text-muted">{formatDuration(durationMs)}</span>
          )}
          <StatusBadge status={toolStatus} />
        </span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-hairline px-2.5 py-2">
          {argsJson && <Section title="Input">{argsJson}</Section>}
          {hasResult && <Section title={isError ? 'Error' : 'Output'}>{resultText}</Section>}
          {!hasResult && !isRunning && <div className="text-[11px] text-muted">No output returned.</div>}
          {pinnable && (
            <button
              type="button"
              onClick={() => showArtifact(resultToArtifact(toolName, result))}
              className="inline-flex items-center gap-1 rounded-sm border border-border px-1.5 py-[2px] text-[10px] text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)] cursor-pointer"
            >
              <ExpandIcon size={11} />
              Pin to panel
            </button>
          )}
        </div>
      )}
    </div>
  );
};
