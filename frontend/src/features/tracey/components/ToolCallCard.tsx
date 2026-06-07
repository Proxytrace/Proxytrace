import { useEffect, useRef, useState } from 'react';
import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { CheckIcon, ChevronRightIcon, XIcon } from '../../../components/icons';
import { CodeBlock } from '../../../components/ui/CodeBlock';
import { RowButton } from '../../../components/ui/RowButton';
import { cn } from '../../../lib/cn';

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

/** A labelled, copyable input/output block. JSON gets a language tag; plain strings don't. */
function Section({ title, content, json }: { title: string; content: string; json: boolean }) {
  return <CodeBlock heading={title} content={content} language={json ? 'json' : undefined} maxLines={12} />;
}

/**
 * A collapsed tool-call row showing name, execution duration, and status. Expands to reveal the
 * tool input, and its output (or error). Used as the fallback for tools without a dedicated
 * inline UI (e.g. `navigate`, `list_*`, `get_dashboard_stats`).
 */
export const ToolCallCard: ToolCallMessagePartComponent = ({ toolName, args, argsText, result, isError, status }) => {
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
  const resultIsString = typeof result === 'string';
  const resultText = resultIsString ? (result as string) : JSON.stringify(result, null, 2);

  return (
    <div className="my-1 rounded-md border border-hairline bg-card text-xs">
      <RowButton
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 px-2.5 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)]"
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
      </RowButton>

      {open && (
        <div className="space-y-2 border-t border-hairline px-2.5 py-2">
          {argsJson && <Section title="Input" content={argsJson} json />}
          {hasResult && (
            <Section title={isError ? 'Error' : 'Output'} content={resultText} json={!resultIsString} />
          )}
          {!hasResult && !isRunning && <div className="text-[11px] text-muted">No output returned.</div>}
        </div>
      )}
    </div>
  );
};
