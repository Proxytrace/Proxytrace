import { useLingui } from '@lingui/react/macro';
import { CheckIcon, XIcon } from '../../../../components/icons';
import { Badge } from '../../../../components/ui/Badge';
import { Spinner } from '../../../../components/ui/Spinner';
import { ProgressBar } from '../../../../components/ui/ProgressBar';
import { TestRunStatus } from '../../../../api/models';
import { isRunTerminal } from '../../tools/await';
import { RUN_STATUS_LABEL, RUN_STATUS_VARIANT } from './badge-variants';
import { groupProgress } from './live-run-progress';
import { entityLabel } from './await-card-logic';
import { useAwaitRunSnapshot } from './useAwaitLiveStatus';

/**
 * One in-flight test-run row of the await card. Mirrors the SSE-patched cache the run's live card
 * maintains (suite → agent, case progress, status) instead of showing a bare id; once the run is
 * terminal the spinner yields to a settled icon even while sibling handles keep the wait open.
 */
export function AwaitPendingRunRow({ id }: { id: string }) {
  const { t, i18n } = useLingui();
  const group = useAwaitRunSnapshot(id);
  const progress = group ? groupProgress(group) : null;
  const terminal = group != null && isRunTerminal(group.status);
  return (
    <div className="flex items-center gap-2 text-body-sm" data-testid={`tracey-await-row-${id}`}>
      <span className="shrink-0">
        {terminal && group ? (
          group.status === TestRunStatus.Completed ? (
            <span className="text-success"><CheckIcon size={13} /></span>
          ) : (
            <span className={group.status === TestRunStatus.Failed ? 'text-danger' : 'text-muted'}>
              <XIcon size={13} />
            </span>
          )
        ) : (
          <Spinner size={12} className="text-accent" />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-secondary">
        {(group && entityLabel(group)) ?? <span className="font-mono text-muted">{id}</span>}
      </span>
      {progress && progress.total > 0 && (
        <span className="flex w-32 shrink-0 items-center gap-1.5">
          <ProgressBar value={progress.completed} max={progress.total || 1} color="var(--accent-primary)" height={4} />
          <span className="shrink-0 font-mono text-caption tabular-nums text-muted">
            {progress.completed}/{progress.total}
          </span>
        </span>
      )}
      <Badge
        label={group ? i18n._(RUN_STATUS_LABEL[group.status]) : t`Waiting…`}
        variant={group ? RUN_STATUS_VARIANT[group.status] : 'neutral'}
        size="sm"
      />
    </div>
  );
}
