import { Trans, useLingui } from '@lingui/react/macro';
import { cn } from '../../../lib/cn';
import { tint } from '../../../lib/colors';
import { RowButton } from '../../../components/ui/RowButton';
import { scoreColor } from '../testBenchMeta';
import { ScoreChip } from './ScorePills';
import type { SessionRun } from '../hooks/usePlaygroundSession';

function runTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Vertical timeline of this session's re-scores; click an entry to inspect it. */
export function RunHistoryTimeline({ runs, currentId, onSelect }: {
  runs: SessionRun[];
  currentId: string;
  onSelect: (id: string) => void;
}) {
  const { t } = useLingui();
  return (
    <div className="flex flex-col">
      {runs.map((r, i) => {
        const color = scoreColor(r.result.score);
        const on = r.id === currentId;
        return (
          <RowButton
            key={r.id}
            data-testid={`run-history-row-${r.id}`}
            aria-pressed={on}
            onClick={() => onSelect(r.id)}
            className="flex gap-3 text-left items-stretch py-0.5"
          >
            <div className="flex flex-col items-center w-[22px] shrink-0">
              <span
                className="w-2.5 h-2.5 rounded-full mt-1"
                style={{ background: color, boxShadow: `0 0 0 3px ${tint(color, 13)}` }}
              />
              {i < runs.length - 1 && <span className="flex-1 w-0.5 bg-border my-0.5" />}
            </div>
            <div className="flex-1 pb-3 min-w-0">
              <div className="flex items-center gap-2">
                <ScoreChip score={r.result.score} />
                <span className={cn('text-[11.5px] font-semibold', on ? 'text-primary' : 'text-secondary')}>
                  {r.kind === 'logged' ? <Trans>Logged evaluation</Trans> : r.edited ? <Trans>Re-scored · edited</Trans> : <Trans>Re-scored</Trans>}
                </span>
                <span className="ml-auto text-[10px] text-muted font-mono">
                  {r.at != null ? runTime(r.at) : t`baseline`}
                </span>
              </div>
              {r.result.reasoning && (
                <div className="text-[11px] text-muted leading-relaxed mt-1 line-clamp-2">{r.result.reasoning}</div>
              )}
            </div>
          </RowButton>
        );
      })}
    </div>
  );
}
