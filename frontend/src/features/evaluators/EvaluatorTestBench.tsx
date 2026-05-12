import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { EvaluationScore, type EvaluationResultDto, type MessageDto } from '../../api/models';
import { evaluatorTestBenchApi } from '../../api/evaluator-testbench';
import { QUERY_KEYS } from '../../api/query-keys';
import { Card } from '../../components/ui/Card';
import { MessageBubble } from '../../components/ui/MessageBubble';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { TestResultPicker } from './TestResultPicker';
import type { SearchHit } from '../../api/search';

const SCORE_COLOR: Record<EvaluationScore, string> = {
  [EvaluationScore.Terrible]: '#ef4444',
  [EvaluationScore.Bad]: '#f97316',
  [EvaluationScore.Acceptable]: '#eab308',
  [EvaluationScore.Good]: '#84cc16',
  [EvaluationScore.Excellent]: '#22c55e',
};

export interface EvaluatorTestBenchHandle {
  focus(): void;
}

interface Props {
  evaluatorId: string;
  projectId: string | null;
}

export const EvaluatorTestBench = forwardRef<EvaluatorTestBenchHandle, Props>(
  function EvaluatorTestBench({ evaluatorId, projectId }, ref) {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const [pickedHit, setPickedHit] = useState<SearchHit | null>(null);
    const [actualOverride, setActualOverride] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);
    const [editDraft, setEditDraft] = useState('');
    const [lastResult, setLastResult] = useState<EvaluationResultDto | null>(null);

    useImperativeHandle(ref, () => ({
      focus() {
        rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    }));

    const testCaseId = pickedHit?.entityId ?? null;

    const payloadQuery = useQuery({
      queryKey: QUERY_KEYS.evaluatorTestBench(evaluatorId, testCaseId ?? ''),
      queryFn: () => evaluatorTestBenchApi.load(evaluatorId, testCaseId!),
      enabled: testCaseId != null,
      retry: false,
      staleTime: 60_000,
    });

    const payload = payloadQuery.data;
    const originalActual = payload?.actualResponse ?? '';
    const currentActual = actualOverride ?? originalActual;
    const isModified = actualOverride != null && actualOverride !== originalActual;

    const runMutation = useMutation({
      mutationFn: () => evaluatorTestBenchApi.run(evaluatorId, {
        testCaseId: testCaseId!,
        actualResponseOverride: isModified ? currentActual : null,
      }),
      onSuccess: (r) => setLastResult(r),
    });

    function onPick(hit: SearchHit) {
      setPickedHit(hit);
      setActualOverride(null);
      setEditing(false);
      setLastResult(null);
    }

    function onEditStart() {
      setEditDraft(currentActual);
      setEditing(true);
    }
    function onEditSave() {
      setActualOverride(editDraft);
      setEditing(false);
    }
    function onEditCancel() {
      setEditing(false);
    }
    function onResetActual() {
      setActualOverride(null);
      setEditing(false);
    }

    const conversationMessages = useMemo<MessageDto[]>(
      () => (payload?.conversation ?? []).map(m => ({
        role: m.role,
        content: m.content,
        toolRequests: [],
        toolCallId: null,
      })),
      [payload?.conversation],
    );

    const selectedLabel = pickedHit?.title ?? null;
    const runDisabled = testCaseId == null || payloadQuery.isLoading || runMutation.isPending;
    const runLabel = runMutation.isPending
      ? 'Running…'
      : lastResult != null
        ? 'Re-run evaluator'
        : 'Run evaluator';

    return (
      <div ref={rootRef}>
        <Card padding="md" elevation="raised">
          <Card.Header
            title="Test bench"
            description="Test this evaluator against a past test result. Edit the actual response to probe behavior."
            action={
              <button
                type="button"
                disabled={runDisabled}
                onClick={() => runMutation.mutate()}
                className="px-3 py-1.5 rounded-md text-[12px] font-semibold text-white shadow-[var(--shadow-btn)] inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                style={{ background: 'var(--grad-accent)' }}
              >
                <PlayIcon /> {runLabel}
              </button>
            }
          />

          <Card.Body className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted shrink-0">
                Test result
              </label>
              <div className="flex-1 min-w-0">
                <TestResultPicker
                  projectId={projectId}
                  selectedLabel={selectedLabel}
                  onSelect={onPick}
                />
              </div>
            </div>

            {testCaseId == null ? (
              <EmptyBench />
            ) : payloadQuery.isLoading ? (
              <div className="text-[12px] text-muted py-6 text-center">Loading test result…</div>
            ) : payloadQuery.isError ? (
              <ErrorState message={String((payloadQuery.error as Error)?.message ?? 'Failed to load')} />
            ) : payload ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Panel title="Input conversation">
                  {conversationMessages.length === 0 ? (
                    <div className="text-[12px] text-muted">No messages.</div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {conversationMessages.map((m, i) => (
                        <MessageBubble key={i} msg={m} defaultOpen={i === conversationMessages.length - 1} />
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel
                  title="Result"
                  action={
                    runMutation.isError ? (
                      <span className="text-[10.5px] text-danger">failed</span>
                    ) : null
                  }
                >
                  {runMutation.isPending ? (
                    <ResultSkeleton />
                  ) : lastResult ? (
                    <EvaluationView result={lastResult} />
                  ) : (
                    <div className="text-[12px] text-muted py-4 text-center">
                      Click <strong className="text-secondary">Run evaluator</strong> to score this result.
                    </div>
                  )}
                </Panel>

                <Panel title="Expected response">
                  <CodeBlock content={payload.expectedResponse || '—'} maxLines={12} />
                </Panel>

                <Panel
                  title="Actual response"
                  action={
                    <div className="flex items-center gap-2">
                      {isModified && (
                        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-md bg-card-2 text-accent">
                          modified
                        </span>
                      )}
                      {!editing && (
                        <button
                          onClick={onEditStart}
                          className="text-[11px] font-medium text-accent cursor-pointer"
                        >
                          ✏ Edit
                        </button>
                      )}
                      {isModified && !editing && (
                        <button
                          onClick={onResetActual}
                          className="text-[11px] font-medium text-muted cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  }
                >
                  {editing ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={editDraft}
                        onChange={e => setEditDraft(e.target.value)}
                        rows={10}
                        className="w-full px-3 py-2.5 rounded-lg bg-surface border border-border text-xs text-primary font-mono leading-relaxed resize-y outline-none focus:ring-1 focus:ring-accent"
                      />
                      <div className="flex gap-2 self-end">
                        <button
                          onClick={onEditCancel}
                          className="px-2.5 py-1 rounded-md text-[11.5px] border border-border bg-card text-secondary cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={onEditSave}
                          className="px-2.5 py-1 rounded-md text-[11.5px] font-semibold text-white cursor-pointer"
                          style={{ background: 'var(--grad-accent)' }}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <CodeBlock content={currentActual || '—'} maxLines={12} />
                  )}
                </Panel>
              </div>
            ) : null}
          </Card.Body>
        </Card>
      </div>
    );
  },
);

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border border-hairline bg-card-2 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{title}</span>
        {action}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function EmptyBench() {
  return (
    <div className="py-10 text-center text-[12.5px] text-muted">
      Pick a past test result to start testing this evaluator.
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="p-3 rounded-md border border-[color-mix(in_srgb,var(--danger)_22%,transparent)] bg-[var(--danger-subtle)] text-[12px] text-danger">
      {message}
    </div>
  );
}

function ResultSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="h-6 w-28 rounded-md bg-card animate-pulse" />
      <div className="h-3 w-full rounded bg-card animate-pulse" />
      <div className="h-3 w-5/6 rounded bg-card animate-pulse" />
      <div className="h-3 w-3/4 rounded bg-card animate-pulse" />
    </div>
  );
}

function EvaluationView({ result }: { result: EvaluationResultDto }) {
  const color = SCORE_COLOR[result.score] ?? 'var(--accent-primary)';
  return (
    <div className="flex flex-col gap-2.5">
      <span
        className="inline-flex items-center gap-2 self-start px-2.5 py-1 rounded-md text-[12px] font-semibold"
        style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
      >
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        {result.score}
      </span>
      {result.reasoning ? (
        <div className="text-[12.5px] leading-[1.6] text-primary whitespace-pre-wrap">
          {result.reasoning}
        </div>
      ) : (
        <div className="text-[11.5px] text-muted italic">No reasoning provided.</div>
      )}
      <div className="text-[10.5px] font-mono tracking-[0.04em] text-muted">
        {result.evaluatorName} · {result.evaluatorKind}
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
