import { Fragment } from 'react';
import { CheckIcon, XIcon } from '../../../../components/icons';
import { modelColor } from '../../../../lib/colors';
import type { TestRunDto, TestCaseFixtureDto } from '../../../../api/models';
import { isDivergent, scoreLabel } from '../../results';
import { SECTION_LABEL } from './constants';

export function EvalBreakdown({ runs, fixtures }: { runs: TestRunDto[]; fixtures: (TestCaseFixtureDto | undefined)[] }) {
  // Union of evaluator names, in first-seen order. Same suite ⇒ same evaluators per model.
  const names: string[] = [];
  fixtures.forEach(f => f?.evaluators.forEach(e => { if (!names.includes(e.evaluatorName)) names.push(e.evaluatorName); }));
  if (names.length === 0) return null;

  const gridCols = `minmax(140px,1.4fr) repeat(${runs.length}, minmax(84px,1fr))`;

  return (
    <section>
      <div className={SECTION_LABEL}>Evaluator breakdown</div>
      <div className="overflow-x-auto rounded-lg border border-hairline">
        <div className="grid" style={{ gridTemplateColumns: gridCols }}>
          {/* Header */}
          <div className="bg-card px-3 py-2 border-b border-hairline text-body-sm font-semibold text-secondary">Evaluator</div>
          {runs.map(run => (
            <div key={run.id} className="bg-card px-2 py-2 border-b border-hairline flex items-center justify-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: modelColor(run.endpointName) }} />
              <span className="mono text-caption font-semibold truncate">{run.endpointName}</span>
            </div>
          ))}

          {/* Rows */}
          {names.map(name => {
            const cells = fixtures.map(f => f?.evaluators.find(e => e.evaluatorName === name) ?? null);
            const divergent = isDivergent(cells.flatMap(c => (c ? [c.pass] : [])));
            const rowCls = divergent
              ? 'bg-[color-mix(in_srgb,var(--accent-primary)_7%,transparent)]'
              : '';
            return (
              <Fragment key={name}>
                <div
                  className={`px-3 py-2 border-b border-hairline flex items-center min-w-0 ${rowCls} ${divergent ? 'shadow-[inset_3px_0_0_var(--accent-primary)]' : ''}`}
                  title={name}
                >
                  <span className="truncate text-body">{name}</span>
                </div>
                {cells.map((c, ci) => (
                  <div key={runs[ci].id} className={`px-2 py-2 border-b border-hairline flex items-center justify-center gap-1 ${rowCls}`}>
                    {c
                      ? <>
                          {c.pass ? <CheckIcon size={12} strokeWidth={2.5} className="text-success shrink-0" /> : <XIcon size={12} strokeWidth={2.5} className="text-danger shrink-0" />}
                          {typeof c.score === 'number' && (
                            <span className={`mono text-caption font-semibold truncate ${c.pass ? 'text-success' : 'text-danger'}`}>{scoreLabel(c.score)}</span>
                          )}
                        </>
                      : <span className="text-muted">—</span>}
                  </div>
                ))}
              </Fragment>
            );
          })}
        </div>
      </div>
    </section>
  );
}
