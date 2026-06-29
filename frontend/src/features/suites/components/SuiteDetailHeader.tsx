import { Trans, Plural } from '@lingui/react/macro';
import type { TestSuiteDto } from '../../../api/models';
import { agentColor } from '../../../lib/colors';
import { fmtRelative, fmtDate } from '../../../lib/format';
import { PlayFilledIcon, TrashIcon } from '../../../components/icons';
import { Pill } from '../../../components/ui/Pill';
import { Button } from '../../../components/ui/Button';

/** Header region for the selected suite: title, agent, a meta line (cases · created · last run), and
 * the run / delete actions. Rendered flush at the top of the suite workspace card — the workspace
 * owns the surface, so this only adds a left accent bar and a hairline divider. */
export function SuiteDetailHeader({ suite, onRun, onDelete }: { suite: TestSuiteDto; onRun: () => void; onDelete: () => void }) {
  const c = agentColor(suite.agentId);

  return (
    <div className="relative shrink-0 border-b border-hairline px-5 py-4 flex items-center gap-3 flex-wrap">
      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: c }} />

      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 data-testid="suite-detail-name" className="text-h1 font-semibold leading-none tracking-[-0.01em] m-0 truncate">{suite.name}</h2>
          <Pill label={suite.agentName} color={c} />
        </div>
        <div className="flex items-center gap-2 text-body-sm text-muted flex-wrap">
          <span><Plural value={suite.testCases.length} one="# case" other="# cases" /></span>
          <span aria-hidden>·</span>
          <span><Trans>created {fmtDate(suite.createdAt)}</Trans></span>
          <span aria-hidden>·</span>
          <span>{suite.lastRunAt ? <Trans>last run {fmtRelative(suite.lastRunAt)}</Trans> : <Trans>never run</Trans>}</span>
        </div>
      </div>

      <div className="flex gap-1.5 shrink-0">
        <Button variant="primary" size="sm" leftIcon={<PlayFilledIcon size={11} />} onClick={onRun} data-testid="suite-run-btn">
          <Trans>Run</Trans>
        </Button>
        <Button variant="dangerOutline" size="sm" onClick={onDelete} leftIcon={<TrashIcon size={13} />} data-testid="suite-detail-delete-btn">
          <Trans>Delete</Trans>
        </Button>
      </div>
    </div>
  );
}
