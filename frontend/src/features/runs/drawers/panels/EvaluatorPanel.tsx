import { useState } from 'react';
import { XIcon, ChevronDownIcon, CheckIcon } from '../../../../components/icons';
import { RowButton } from '../../../../components/ui/RowButton';
import { FOCUS_RING } from '../../../../lib/constants';
import { evaluatorColor, tint } from '../../../../lib/colors';
import type { EvaluatorFixtureResultDto } from '../../../../api/models';
import { scoreLabel } from '../../results';
import { PassFailTag } from './PassFailTag';

export function EvaluatorPanel({ ev, defaultOpen }: { ev: EvaluatorFixtureResultDto; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const hasDetails = !!ev.note || ev.breakdown.length > 0 || !!ev.desc;
  const color = evaluatorColor(ev.evaluatorKind);

  return (
    <div data-testid={`fixture-evaluator-${ev.evaluatorId}`} className="bg-card-2 rounded-md overflow-hidden border-l-[3px]" style={{ borderLeftColor: color }}>
      <RowButton
        onClick={() => setOpen(o => !o)}
        className={`px-3.5 py-2.5 flex items-center gap-2 ${FOCUS_RING}`}
      >
        <span className="px-[7px] py-[2px] rounded-full text-caption font-semibold shrink-0" style={{ background: tint(color, 18), color }}>{ev.evaluatorKind}</span>
        <span className="text-title font-semibold flex-1 min-w-0 truncate">{ev.evaluatorName}</span>
        {typeof ev.score === 'number' && (
          <span className="mono text-body-sm text-secondary shrink-0">{scoreLabel(ev.score)}</span>
        )}
        <PassFailTag pass={ev.pass} />
        {hasDetails && (
          <span className={`flex text-muted shrink-0 transition-transform duration-[var(--motion-base)] ${open ? 'rotate-180' : ''}`}>
            <ChevronDownIcon size={13} />
          </span>
        )}
      </RowButton>

      {open && hasDetails && (
        <div className="border-t border-hairline">
          {ev.desc && (
            <div className="px-3.5 pt-2.5 pb-0.5 text-body-sm text-muted italic leading-snug">{ev.desc}</div>
          )}
          {ev.note && (
            <div className="px-3.5 py-2.5">
              <div className="text-caption font-semibold text-muted mb-1.5">Reasoning</div>
              <div className="text-body text-secondary leading-snug">{ev.note}</div>
            </div>
          )}
          {ev.breakdown.length > 0 && (
            <div className={`px-3.5 py-2.5 grid grid-cols-[1fr_auto_auto] items-center gap-x-3.5 gap-y-1.5 ${(ev.desc || ev.note) ? 'border-t border-hairline' : ''}`}>
              {ev.breakdown.map(b => (
                <div key={b.k} className="contents">
                  <span className="text-body text-muted">{b.k}</span>
                  <span className="mono text-body-sm text-secondary text-right">{b.v}</span>
                  <span className={`flex justify-end ${b.match ? 'text-success' : 'text-danger'}`}>
                    {b.match ? <CheckIcon size={12} strokeWidth={2.5} /> : <XIcon size={12} strokeWidth={2.5} />}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Evaluator panels list — failing evaluators expanded by default. */
export function EvaluatorList({ evaluators }: { evaluators: EvaluatorFixtureResultDto[] }) {
  if (evaluators.length === 0) return null;
  return (
    <div data-testid="fixture-evaluator-list" className="flex flex-col gap-2">
      {evaluators.map(ev => <EvaluatorPanel key={ev.evaluatorId} ev={ev} defaultOpen={!ev.pass} />)}
    </div>
  );
}
