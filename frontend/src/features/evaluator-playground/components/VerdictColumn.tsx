import { Trans } from '@lingui/react/macro';
import type { EvaluatorListItemDto } from '../../../api/models';
import { tint } from '../../../lib/colors';
import { TargetIcon } from '../../../components/icons';
import { scoreColor, scoreDelta } from '../testBenchMeta';
import type { PlaygroundSession } from '../hooks/usePlaygroundSession';
import { RadialScore } from './RadialScore';
import { DeltaChip } from './ScorePills';
import { ReasoningCard } from './ReasoningCard';
import { RunHistoryTimeline } from './RunHistoryTimeline';

/** Right column: the live verdict gauge, the judge's reasoning, and the run history. */
export function VerdictColumn({ session, evaluator }: { session: PlaygroundSession; evaluator: EvaluatorListItemDto }) {
  const { currentRun, prevRun, runs, runPending } = session;
  const scored = currentRun != null && !currentRun.result.errorMessage;

  return (
    <aside
      data-testid="test-bench-result"
      className="flex flex-col rounded-lg bg-card shadow-[var(--shadow-card)] overflow-hidden min-h-0"
    >
      <div className="px-5 py-4 border-b border-hairline flex items-center gap-2 shrink-0">
        <span className="text-caption font-bold uppercase tracking-[0.09em] text-secondary"><Trans>Verdict</Trans></span>
        {scored && currentRun && (
          currentRun.kind === 'logged' ? (
            <span className="text-caption px-2 py-0.5 rounded-none font-semibold bg-card-2 text-muted"><Trans>logged baseline</Trans></span>
          ) : (
            <span
              className="text-caption px-2 py-0.5 rounded-none font-bold"
              style={{ color: scoreColor(currentRun.result.score), background: tint(scoreColor(currentRun.result.score), 16) }}
            >
              <Trans>live re-score</Trans>
            </span>
          )
        )}
        {runPending && <span className="ml-auto text-caption text-muted"><Trans>scoring…</Trans></span>}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5 min-h-0">
        {currentRun == null ? (
          <EmptyVerdict pending={runPending} />
        ) : (
          <>
            {scored && (
              <div className="flex flex-col items-center gap-3">
                <RadialScore score={currentRun.result.score} />
                <DeltaChip delta={scoreDelta(prevRun?.result.score ?? null, currentRun.result.score)} />
              </div>
            )}
            <ReasoningCard evaluator={evaluator} run={currentRun} />
            {runs.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-caption font-bold uppercase tracking-[0.09em] text-muted"><Trans>Run history</Trans></span>
                  <span className="text-caption text-muted font-mono">{runs.length}</span>
                </div>
                <RunHistoryTimeline runs={runs} currentId={currentRun.id} onSelect={session.selectRun} />
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

/** Placeholder before the first run of the current case. */
function EmptyVerdict({ pending }: { pending: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-10">
      <span className="w-12 h-12 rounded-lg bg-accent-subtle text-accent inline-flex items-center justify-center">
        <TargetIcon size={22} />
      </span>
      <div className="text-title font-semibold text-secondary">{pending ? <Trans>Scoring…</Trans> : <Trans>Not scored yet</Trans>}</div>
      <p className="text-body-sm text-muted max-w-[220px] leading-relaxed m-0">
        <Trans>Run the evaluator to see a 1–5 verdict, the judge’s reasoning, and how edits move the score.</Trans>
      </p>
    </div>
  );
}
