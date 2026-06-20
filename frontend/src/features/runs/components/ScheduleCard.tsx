import { Trans, useLingui } from '@lingui/react/macro';
import type { TestRunScheduleDto } from '../../../api/models';
import { agentColor } from '../../../lib/colors';
import { fmtUntil, fmtDateTimeShortUtc } from '../../../lib/format';
import { formatInterval } from '../../../lib/interval';
import { EditIcon, TrashIcon, ClockIcon } from '../../../components/icons';
import { Card } from '../../../components/ui/Card';
import { Pill } from '../../../components/ui/Pill';
import { Switch } from '../../../components/ui/Switch';
import { IconButton } from '../../../components/ui/Button';
import { RecentRunStrip } from './RecentRunStrip';

/**
 * One scheduled-run card: name, cadence, next-run time, an enable/disable toggle, edit + delete
 * actions, and a strip of recent runs. The toggle flips `isEnabled` via the update mutation,
 * re-sending the schedule's current fields so the unchanged ones are preserved.
 */
export function ScheduleCard({ schedule, onToggle, onEdit, onDelete, onSelectRun, toggling }: {
  schedule: TestRunScheduleDto;
  onToggle: (next: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onSelectRun: (groupId: string) => void;
  toggling: boolean;
}) {
  const { t } = useLingui();
  const c = agentColor(schedule.agentId);

  return (
    <Card padding="md" accentBar={c} data-testid={`schedule-card-${schedule.id}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate text-title font-semibold" data-testid={`schedule-name-${schedule.id}`}>
              {schedule.name}
            </span>
            <Pill label={schedule.agentName} color={c} />
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-body-sm text-muted flex-wrap">
            <span className="text-secondary">{schedule.suiteName}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <ClockIcon size={12} />
              {formatInterval(schedule.intervalMinutes)}
            </span>
            <span aria-hidden>·</span>
            {schedule.isEnabled ? (
              <span data-testid={`schedule-next-run-${schedule.id}`}>
                <Trans>Next {fmtDateTimeShortUtc(schedule.nextRunAt)} UTC
                <span className="text-muted"> · {fmtUntil(schedule.nextRunAt)}</span></Trans>
              </span>
            ) : (
              <span><Trans>Paused</Trans></span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Switch
            checked={schedule.isEnabled}
            onChange={onToggle}
            disabled={toggling}
            aria-label={schedule.isEnabled ? t`Disable schedule` : t`Enable schedule`}
            data-testid={`schedule-toggle-${schedule.id}`}
          />
          <IconButton onClick={onEdit} aria-label={t`Edit schedule`} data-testid={`schedule-edit-btn-${schedule.id}`}>
            <EditIcon size={14} />
          </IconButton>
          <IconButton danger onClick={onDelete} aria-label={t`Delete schedule`} data-testid={`schedule-delete-btn-${schedule.id}`}>
            <TrashIcon size={14} />
          </IconButton>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-hairline">
        <RecentRunStrip runs={schedule.recentRuns} onSelect={onSelectRun} />
      </div>
    </Card>
  );
}
