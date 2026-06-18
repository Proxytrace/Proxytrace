import { useState } from 'react';
import type { TestRunScheduleDto } from '../../../api/models';
import { useFeature } from '../../../api/license';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { ConfirmDialog } from '../../../components/overlays/ConfirmDialog';
import { PlusIcon, LockIcon } from '../../../components/icons';
import { showUpgradeModal } from '../../../components/license/UpgradeModal';
import { useTestRunSchedules } from '../hooks/useTestRunSchedules';
import { useTestRunScheduleMutations } from '../hooks/useTestRunScheduleMutations';
import { ScheduleCard } from './ScheduleCard';
import { ScheduleFormDialog, type ScheduleFormValues } from './ScheduleFormDialog';

/**
 * "Scheduled runs" section of the Runs page. Lists the project's schedules (optionally agent-filtered),
 * gates creation/mutation behind the `ScheduledTestRuns` license feature, and owns the create/edit
 * dialog and delete confirmation. Recent-run clicks bubble up via `onSelectRun` to drive the page's
 * existing `?id=` selection.
 */
export function SchedulesSection({ agentFilter, onSelectRun }: {
  agentFilter: string;
  onSelectRun: (groupId: string) => void;
}) {
  const licensed = useFeature('ScheduledTestRuns');
  const { schedules, isLoading } = useTestRunSchedules(agentFilter);
  const { create, update, remove } = useTestRunScheduleMutations();

  const [editing, setEditing] = useState<TestRunScheduleDto | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TestRunScheduleDto | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(schedule: TestRunScheduleDto) {
    setEditing(schedule);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
  }

  function handleSubmit(form: ScheduleFormValues) {
    if (editing) {
      update.mutate(
        { id: editing.id, body: { name: form.name, modelEndpointIds: form.modelEndpointIds, intervalMinutes: form.intervalMinutes, anchorAt: form.anchorAt, enabled: form.enabled } },
        { onSuccess: closeDialog },
      );
    } else {
      create.mutate(form, { onSuccess: closeDialog });
    }
  }

  function toggleEnabled(schedule: TestRunScheduleDto, next: boolean) {
    update.mutate({
      id: schedule.id,
      body: {
        name: schedule.name,
        modelEndpointIds: schedule.endpoints.map(e => e.id),
        intervalMinutes: schedule.intervalMinutes,
        enabled: next,
      },
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  }

  return (
    <div className="flex flex-col gap-3" data-testid="schedules-section">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-h2 font-semibold text-primary">Scheduled runs</h2>
        {licensed ? (
          <Button variant="primary" size="sm" onClick={openCreate} leftIcon={<PlusIcon size={14} />} data-testid="schedule-create-btn">
            New schedule
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => showUpgradeModal({ errorType: 'FeatureNotLicensed' })}
            leftIcon={<LockIcon size={14} />}
            data-testid="schedule-upgrade-btn"
          >
            Upgrade to schedule
          </Button>
        )}
      </div>

      {isLoading && <SkeletonList rows={3} height={120} gap={10} />}

      {!isLoading && schedules.length === 0 && (
        <div data-testid="schedules-empty-state">
          <EmptyState
            title="No scheduled runs"
            description={licensed
              ? 'Create a schedule to run a suite on a recurring cadence.'
              : 'Scheduled test runs are part of the Enterprise tier.'}
          />
        </div>
      )}

      {!isLoading && schedules.length > 0 && (
        <div className="flex flex-col gap-2.5" data-testid="schedules-list">
          {schedules.map(schedule => (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              toggling={update.isPending}
              onToggle={next => toggleEnabled(schedule, next)}
              onEdit={() => openEdit(schedule)}
              onDelete={() => setDeleteTarget(schedule)}
              onSelectRun={onSelectRun}
            />
          ))}
        </div>
      )}

      {dialogOpen && (
        <ScheduleFormDialog
          schedule={editing ?? undefined}
          onClose={closeDialog}
          onSubmit={handleSubmit}
          pending={create.isPending || update.isPending}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete schedule "${deleteTarget.name}"?`}
          message="This stops future runs. Existing runs it produced are kept. This action cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={remove.isPending}
        />
      )}
    </div>
  );
}
