import type { TestSuiteDto } from '../../../api/models';
import { agentColor } from '../../../lib/colors';
import { fmtRelative, fmtDate } from '../../../lib/format';
import { PlayFilledIcon, TrashIcon } from '../../../components/icons';
import { Pill } from '../../../components/ui/Pill';
import { Button } from '../../../components/ui/Button';

/** Header card for the selected suite: title, agent, a meta line (cases · created · last run), and the
 * run / delete actions. Mirrors the Runs `RunGroupHeader` / agent header shape. */
export function SuiteDetailHeader({ suite, onRun, onDelete }: { suite: TestSuiteDto; onRun: () => void; onDelete: () => void }) {
  const c = agentColor(suite.agentId);

  return (
    <div className="relative overflow-hidden rounded-lg bg-card shadow-[var(--shadow-card)] px-[18px] py-3 flex items-center gap-3 flex-wrap">
      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg" style={{ background: c }} />

      <div className="flex flex-col gap-[3px] min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 data-testid="suite-detail-name" className="text-h1 font-bold tracking-[-0.01em] m-0 truncate">{suite.name}</h2>
          <Pill label={suite.agentName} color={c} />
        </div>
        <div className="flex items-center gap-2 text-body-sm text-muted flex-wrap">
          <span>{suite.testCases.length} case{suite.testCases.length !== 1 ? 's' : ''}</span>
          <span aria-hidden>·</span>
          <span>created {fmtDate(suite.createdAt)}</span>
          <span aria-hidden>·</span>
          <span>{suite.lastRunAt ? `last run ${fmtRelative(suite.lastRunAt)}` : 'never run'}</span>
        </div>
      </div>

      <div className="flex gap-1.5 shrink-0">
        <Button variant="primary" size="sm" leftIcon={<PlayFilledIcon size={11} />} onClick={onRun} data-testid="suite-run-btn">
          {suite.totalRuns > 0 ? 'Run again' : 'Run now'}
        </Button>
        <Button variant="dangerOutline" size="sm" onClick={onDelete} leftIcon={<TrashIcon size={13} />} data-testid="suite-detail-delete-btn">
          Delete
        </Button>
      </div>
    </div>
  );
}
