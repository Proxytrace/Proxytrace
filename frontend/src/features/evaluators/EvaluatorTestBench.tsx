import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { EvaluationScore, EvaluationStatus, type EvaluationResultDto, type MessageDto } from '../../api/models';
import { evaluatorTestBenchApi } from '../../api/evaluator-testbench';
import { QUERY_KEYS } from '../../api/query-keys';
import { Card } from '../../components/ui/Card';
import { MessageBubble } from '../../components/ui/MessageBubble';
import { TestResultPicker } from './TestResultPicker';
import type { SearchHit } from '../../api/search';

const SCORE_COLOR: Record<EvaluationScore, string> = {
  [EvaluationScore.Terrible]: 'var(--danger)',
  [EvaluationScore.Bad]: 'var(--warn)',
  [EvaluationScore.Acceptable]: 'var(--accent-primary)',
  [EvaluationScore.Good]: 'var(--teal)',
  [EvaluationScore.Excellent]: 'var(--success)',
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
    const [lastResult, setLastResult] = useState<EvaluationResultDto | null>(null);
    const [prevEvaluatorId, setPrevEvaluatorId] = useState(evaluatorId);

    useImperativeHandle(ref, () => ({
      focus() {
        rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    }));

    const defaultQuery = useQuery({
      queryKey: QUERY_KEYS.evaluatorTestBenchDefault(evaluatorId),
      queryFn: () => evaluatorTestBenchApi.default(evaluatorId),
      staleTime: 60_000,
    });

    if (evaluatorId !== prevEvaluatorId) {
      setPrevEvaluatorId(evaluatorId);
      setPickedHit(null);
      setActualOverride(null);
      setLastResult(null);
    }

    const autoHit = useMemo(() => {
      if (pickedHit != null) return null;
      const d = defaultQuery.data;
      if (d?.testCaseId == null) return null;
      return {
        kind: 'testCase' as const,
        entityId: d.testCaseId,
        title: d.label ?? 'Test case',
        snippet: '',
        score: 0,
        metadata: {} as Record<string, string>,
      };
    }, [defaultQuery.data, pickedHit]);

    const effectivePickedHit = pickedHit ?? autoHit;

    const testCaseId = effectivePickedHit?.entityId ?? null;

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
      setLastResult(null);
    }

    function onResetActual() {
      setActualOverride(null);
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

    const selectedLabel = effectivePickedHit?.title ?? null;
    const runDisabled = testCaseId == null || payloadQuery.isLoading || runMutation.isPending;
    const runLabel = runMutation.isPending
      ? 'Running…'
      : lastResult != null
        ? 'Re-run'
        : 'Run evaluator';

    return (
      <div ref={rootRef}>
        <Card padding="md" elevation="raised">
          <Card.Header
            title="Test bench"
            description="Run this evaluator against a past test result. Edit the actual response to probe behavior."
          />

          <Card.Body className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted shrink-0">
                Test result
              </label>
              <div className="flex-1 min-w-0">
                <TestResultPicker
                  evaluatorId={evaluatorId}
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
              <div className="flex flex-col gap-3">
                <details className="group rounded-lg border border-hairline bg-card-2">
                  <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none list-none">
                    <ChevronIcon />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                      Input conversation
                    </span>
                    <span className="text-[10.5px] text-muted">
                      {conversationMessages.length} {conversationMessages.length === 1 ? 'message' : 'messages'}
                    </span>
                  </summary>
                  <div className="px-3 pb-3">
                    {conversationMessages.length === 0 ? (
                      <div className="text-[12px] text-muted">No messages.</div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {conversationMessages.map((m, i) => (
                          <MessageBubble key={i} msg={m} defaultOpen={i === conversationMessages.length - 1} />
                        ))}
                      </div>
                    )}
                  </div>
                </details>

                <div
                  className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch"
                  style={{ height: 'min(60vh, 480px)' }}
                >
                  <ResponsePane title="Expected response">
                    <pre className="w-full min-h-0 flex-1 m-0 px-3 py-2.5 rounded-lg bg-surface border border-border text-xs text-primary font-mono leading-relaxed overflow-auto whitespace-pre-wrap break-words">
                      {payload.expectedResponse || '—'}
                    </pre>
                  </ResponsePane>

                  <ResponsePane
                    title="Actual response"
                    badge={isModified ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-md bg-card text-accent border border-hairline">
                          modified
                        </span>
                        <button
                          onClick={onResetActual}
                          className="text-[11px] font-medium text-muted hover:text-secondary cursor-pointer"
                        >
                          Reset
                        </button>
                      </div>
                    ) : null}
                  >
                    <textarea
                      value={currentActual}
                      onChange={e => setActualOverride(e.target.value)}
                      spellCheck={false}
                      className="w-full min-h-0 flex-1 px-3 py-2.5 rounded-lg bg-surface border border-border text-xs text-primary font-mono leading-relaxed resize-none outline-none focus:ring-1 focus:ring-accent"
                    />
                  </ResponsePane>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center pt-1">
                  <div>
                    <button
                      type="button"
                      disabled={runDisabled}
                      data-write
                      onClick={() => runMutation.mutate()}
                      className="px-4 py-2 rounded-md text-[12.5px] font-semibold text-white shadow-[var(--shadow-btn)] inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      style={{ background: 'var(--grad-accent)' }}
                    >
                      <PlayIcon /> {runLabel}
                    </button>
                  </div>
                  <div className="min-w-0 flex items-center gap-2 px-3 rounded-lg border border-hairline bg-card-2 h-[40px]">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted shrink-0">
                      Result
                    </span>
                    <div className="min-w-0 flex items-center">
                      {runMutation.isPending ? (
                        <ResultPill loading />
                      ) : lastResult ? (
                        <ResultPill result={lastResult} />
                      ) : runMutation.isError ? (
                        <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-danger">failed</span>
                      ) : (
                        <span className="text-[11.5px] text-muted">
                          {isModified ? 'Actual response modified — re-run to score.' : 'Run evaluator to see score.'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </Card.Body>
        </Card>
      </div>
    );
  },
);

function ResponsePane({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border border-hairline bg-card-2 min-w-0 h-full overflow-hidden">
      <div className="flex items-center justify-between gap-2 min-h-[20px] shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{title}</span>
        {badge}
      </div>
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">{children}</div>
    </div>
  );
}

function ResultPill({ result, loading }: { result?: EvaluationResultDto; loading?: boolean }) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-[11.5px] font-semibold bg-card-2 text-muted">
        <span className="w-2 h-2 rounded-full bg-muted animate-pulse" />
        Scoring…
      </span>
    );
  }
  if (!result) return null;
  if (result.status === EvaluationStatus.Errored) {
    const color = 'var(--warn)';
    return (
      <div className="flex items-center gap-1.5">
        <span
          className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-[11.5px] font-semibold"
          style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
          title={result.errorMessage ?? 'Evaluator errored'}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
          Error
        </span>
        {result.errorMessage && <ReasoningTip text={result.errorMessage} />}
      </div>
    );
  }
  const color = result.score ? (SCORE_COLOR[result.score] ?? 'var(--accent-primary)') : 'var(--accent-primary)';
  const hasReasoning = !!result.reasoning;
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-[11.5px] font-semibold"
        style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
      >
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        {result.score}
      </span>
      {hasReasoning && <ReasoningTip text={result.reasoning!} />}
    </div>
  );
}

function ReasoningTip({ text }: { text: string }) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  function show() {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(352, window.innerWidth * 0.8);
    const left = Math.max(8, rect.right - width);
    const top = rect.top - 8;
    setPos({ top, left });
    setOpen(true);
  }

  function hide() {
    setOpen(false);
  }

  return (
    <>
      <span
        ref={anchorRef}
        tabIndex={0}
        role="button"
        aria-label="Show reasoning"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="w-5 h-5 inline-flex items-center justify-center rounded-full border border-hairline bg-card-2 text-[10.5px] font-semibold text-muted hover:text-accent hover:border-accent focus:text-accent focus:border-accent cursor-help transition-colors outline-none"
      >
        ?
      </span>
      {open && pos && createPortal(
        <div
          role="tooltip"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: 'min(22rem, 80vw)',
            transform: 'translateY(-100%)',
          }}
          className="pointer-events-none z-[1000] max-h-72 overflow-auto p-3 rounded-md bg-card border border-border shadow-[var(--shadow-card)] text-[11.5px] leading-[1.55] text-primary whitespace-pre-wrap text-left"
        >
          <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted mb-1.5">
            Reasoning
          </span>
          {text}
        </div>,
        document.body,
      )}
    </>
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

function ChevronIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted transition-transform group-open:rotate-90" aria-hidden>
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
