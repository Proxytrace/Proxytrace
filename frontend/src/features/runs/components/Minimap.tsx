import type { TestRunDto, TestResultDto } from '../../../api/models';
import { FOCUS_RING } from '../../../lib/constants';
import { cn } from '../../../lib/cn';
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
        const fillCls = pass === true ? 'bg-[color-mix(in_srgb,var(--success)_28%,transparent)]'
          : pass === false ? 'bg-[color-mix(in_srgb,var(--danger)_28%,transparent)]' : 'bg-white/[0.07]';
        const borderCls = selected ? 'border-[var(--text-primary)]'
          : pass === true ? 'border-[color-mix(in_srgb,var(--success)_55%,transparent)]'
            : pass === false ? 'border-[color-mix(in_srgb,var(--danger)_55%,transparent)]' : 'border-[var(--border-color)]';
        return (
          <button
            key={r.id}
            onClick={onPick ? () => onPick(r, i) : undefined}
            title={r.testCaseSummary}
            aria-label={`${r.testCaseSummary} — ${pass === true ? 'passed' : pass === false ? 'failed' : 'no result'}`}
            className={cn('shrink-0 rounded-sm border transition-[box-shadow] duration-[var(--motion-fast)]', fillCls, borderCls, onPick ? `cursor-pointer hover:ring-1 hover:ring-white/40 ${FOCUS_RING}` : 'cursor-default')}
            style={{ width: size, height: size }}
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
