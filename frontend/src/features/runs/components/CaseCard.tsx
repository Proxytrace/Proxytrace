import type { TestResultDto } from '../../../api/models';
import { FOCUS_RING, ID_SHORT_LEN } from '../../../lib/constants';
import { fmtDuration } from '../../../lib/format';
import { resultPass, resultScore, scoreColor, dotColor, isErrored, isEvalPass } from '../results';
import { EvalChip } from './EvalChip';

/** Grid-view card for a single test case, failure-first styling. */
export function CaseCard({ r, isSelected, onClick }: { r: TestResultDto; isSelected: boolean; onClick: () => void }) {
  const pass = resultPass(r);
  const score = resultScore(r);
  const sColor = scoreColor(score);
  const erroredFirst = r.evaluations.find(isErrored);
  const reasoning = erroredFirst
    ? erroredFirst.errorMessage
    : r.evaluations.find(e => !isEvalPass(e) && e.reasoning)?.reasoning;
  const tint = pass === false
    ? (isSelected ? 'color-mix(in srgb, var(--danger) 10%, transparent)' : 'color-mix(in srgb, var(--danger) 5%, transparent)')
    : (isSelected ? 'color-mix(in srgb, var(--accent-primary) 6%, transparent)' : 'var(--bg-card-2)');
  const borderColor = isSelected
    ? (pass === false ? 'color-mix(in srgb, var(--danger) 45%, transparent)' : 'color-mix(in srgb, var(--accent-primary) 35%, transparent)')
    : pass === false ? 'color-mix(in srgb, var(--danger) 28%, transparent)' : 'var(--hairline)';

  return (
    <button
      onClick={onClick}
      className={`relative w-full text-left flex flex-col gap-1.5 rounded-md border px-3.5 py-3 overflow-hidden cursor-pointer transition-[background,border-color] duration-[var(--motion-fast)] ${FOCUS_RING}`}
      style={{ background: tint, borderColor }}
    >
      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: sColor }} />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: dotColor(pass) }} />
          <span className="mono text-caption text-muted">{r.testCaseId.slice(0, ID_SHORT_LEN)}</span>
          {score !== null && score < 1 && (
            <span className="mono text-body-sm font-bold" style={{ color: sColor }}>{score.toFixed(2)}</span>
          )}
        </div>
        <span className="mono text-caption text-muted shrink-0">{fmtDuration(r.durationMs)}</span>
      </div>

      <div className="overflow-hidden text-title font-medium text-primary leading-snug [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
        {r.testCaseSummary}
      </div>

      {pass === false && reasoning && (
        <div className="overflow-hidden text-body-sm text-danger leading-snug [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
          {reasoning}
        </div>
      )}

      {r.evaluations.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {r.evaluations.map((e, i) => <EvalChip key={i} e={e} />)}
        </div>
      )}
    </button>
  );
}
