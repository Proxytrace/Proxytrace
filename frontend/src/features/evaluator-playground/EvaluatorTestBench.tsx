import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Card } from '../../components/ui/Card';
import { MessageBubble } from '../../components/ui/MessageBubble';
import { TestResultPicker } from './components/TestResultPicker';
import { ResponsePane, EmptyBench, ErrorState } from './components/TestBenchPanes';
import { ResultPill } from './components/TestBenchResult';
import { TestBenchChevronIcon, TestBenchPlayIcon } from '../../components/icons';
import { useEvaluatorTestBench } from './hooks/useEvaluatorTestBench';

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
    const bench = useEvaluatorTestBench(evaluatorId);

    useImperativeHandle(ref, () => ({
      focus() {
        rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    }));

    const {
      selectedLabel, testCaseId, payload, payloadLoading, payloadError, payloadErrorMessage,
      conversationMessages, currentActual, isModified, setActualOverride, onPick, onResetActual,
      run, runDisabled, runLabel, runPending, runError, lastResult,
    } = bench;

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
            ) : payloadLoading ? (
              <div className="text-[12px] text-muted py-6 text-center">Loading test result…</div>
            ) : payloadError ? (
              <ErrorState message={payloadErrorMessage} />
            ) : payload ? (
              <div className="flex flex-col gap-3">
                <details className="group rounded-lg border border-hairline bg-card-2">
                  <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none list-none">
                    <TestBenchChevronIcon />
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
                          // MessageDto has no id; key off the message's own content (role + content), not array index.
                          <MessageBubble key={`${m.role}:${m.content}`} msg={m} defaultOpen={i === conversationMessages.length - 1} />
                        ))}
                      </div>
                    )}
                  </div>
                </details>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch h-[min(60vh,480px)]">
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
                      onClick={() => run()}
                      className="px-4 py-2 rounded-md text-[12.5px] font-semibold text-white shadow-[var(--shadow-btn)] inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer bg-[image:var(--grad-accent)]"
                    >
                      <TestBenchPlayIcon /> {runLabel}
                    </button>
                  </div>
                  <div className="min-w-0 flex items-center gap-2 px-3 rounded-lg border border-hairline bg-card-2 h-[40px]">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted shrink-0">
                      Result
                    </span>
                    <div className="min-w-0 flex items-center">
                      {runPending ? (
                        <ResultPill loading />
                      ) : lastResult ? (
                        <ResultPill result={lastResult} />
                      ) : runError ? (
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
