import { cn } from '../../../lib/cn';
import { fmtTokens } from '../../../lib/format';
import { type RangeKey } from '../../../lib/time-range';
import type { EvaluatorOverviewDto } from '../../../api/models';
import { type TypeCategory, fmtEur } from '../evaluatorMeta';
import { categoryText } from '../categoryClasses';

interface Props {
  overview: EvaluatorOverviewDto | null;
  category: TypeCategory;
  modelName: string | null;
  range: RangeKey;
}

/** LLM-judge cost card: total spend plus input/output token tallies. */
export function CostPanel({ overview, category, modelName, range }: Props) {
  const s = overview?.summary;
  return (
    <section className="bg-card rounded-lg shadow-[var(--shadow-card)] flex flex-col">
      <header className="flex items-center gap-2.5 px-4 py-3 border-b border-hairline">
        <span className="text-[10px] text-muted uppercase tracking-[0.09em] font-semibold">LLM judge cost</span>
        {modelName && <span className="text-[11px] text-muted font-mono">· {modelName}</span>}
      </header>
      <div className="px-[18px] py-4 flex flex-col gap-3.5 flex-1">
        <div className="flex-1 flex items-center">
          <div className="flex items-baseline gap-2">
            <span className={cn('text-[48px] leading-none font-bold font-mono tracking-[-0.03em]', categoryText[category])}>
              {fmtEur(s?.totalCost ?? null)}
            </span>
            <span className="text-[11px] text-muted">past {range}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="px-3 py-2.5 bg-card-2 rounded-md">
            <div className="text-[10px] text-muted uppercase tracking-[0.07em] mb-1">Input tokens</div>
            <div className="text-[16px] font-mono text-primary font-semibold">
              {s?.inputTokens != null ? fmtTokens(s.inputTokens) : '—'}
            </div>
          </div>
          <div className="px-3 py-2.5 bg-card-2 rounded-md">
            <div className="text-[10px] text-muted uppercase tracking-[0.07em] mb-1">Output tokens</div>
            <div className="text-[16px] font-mono text-primary font-semibold">
              {s?.outputTokens != null ? fmtTokens(s.outputTokens) : '—'}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
