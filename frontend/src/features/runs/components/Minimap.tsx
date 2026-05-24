import type { TestRunDto, TestResultDto } from '../../../api/models';
import { FOCUS_RING } from '../../../lib/constants';
import { resultPass } from '../results';

/** Grid of small squares — one per case — colored by pass/fail, dashed for pending. */
export function Minimap({
  run, activeCaseIds, selectedCaseId, onPick, size = 18,
}: {
  run: TestRunDto;
  activeCaseIds?: Set<string>;
  selectedCaseId?: string | null;
  onPick?: (r: TestResultDto, idx: number) => void;
  size?: number;
}) {
  const completedIds = new Set(run.results.map(r => r.testCaseId));
  const pending = run.testCases.filter(tc => !completedIds.has(tc.id));

  return (
    <div className="flex flex-wrap gap-[3px]">
      {run.results.map((r, i) => {
        const pass = resultPass(r);
        const selected = selectedCaseId === r.testCaseId;
        const fill = pass === true ? 'color-mix(in srgb, var(--success) 28%, transparent)' : pass === false ? 'color-mix(in srgb, var(--danger) 28%, transparent)' : 'rgba(255,255,255,0.07)';
        const border = selected ? 'var(--text-primary)' : pass === true ? 'color-mix(in srgb, var(--success) 55%, transparent)' : pass === false ? 'color-mix(in srgb, var(--danger) 55%, transparent)' : 'var(--border-color)';
        return (
          <button
            key={r.id}
            onClick={onPick ? () => onPick(r, i) : undefined}
            title={r.testCaseSummary}
            aria-label={`${r.testCaseSummary} — ${pass === true ? 'passed' : pass === false ? 'failed' : 'no result'}`}
            className={`shrink-0 rounded-sm border transition-[box-shadow] duration-[var(--motion-fast)] ${onPick ? `cursor-pointer hover:ring-1 hover:ring-white/40 ${FOCUS_RING}` : 'cursor-default'}`}
            style={{ width: size, height: size, background: fill, borderColor: border }}
          />
        );
      })}
      {pending.map(tc => {
        const running = activeCaseIds?.has(tc.id) ?? false;
        return (
          <span
            key={tc.id}
            title={`${tc.summary} — ${running ? 'running…' : 'pending'}`}
            className={`shrink-0 rounded-sm border border-dashed ${running ? 'pulse-dot border-[color-mix(in_srgb,var(--accent-primary)_55%,transparent)] bg-[color-mix(in_srgb,var(--accent-primary)_18%,transparent)]' : 'border-hairline'}`}
            style={{ width: size, height: size }}
          />
        );
      })}
    </div>
  );
}
