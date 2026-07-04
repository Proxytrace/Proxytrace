import { Trans, Plural, useLingui } from '@lingui/react/macro';
import type { TestRunGroupDto } from '../../../api/models';
import { agentColor } from '../../../lib/colors';
import { fmtRelative } from '../../../lib/format';
import { TrashIcon } from '../../../components/icons';
import { Pill } from '../../../components/ui/Pill';
import { ColoredBadge } from '../../../components/ui/ColoredBadge';
import { Button, IconButton } from '../../../components/ui/Button';
import { isActive, runStatusColor } from '../results';
import { RunProgressBar } from './RunProgressBar';
import { AskTraceyButton } from '../../../components/tracey/AskTraceyButton';
import { runGroupPrompt } from '../../../components/tracey/askTraceyPrompts';

/**
 * Header for a run group: title, agent, status, and a unified meta line (id · age · model
 * count) for single- and multi-model groups alike. While a run is active it hosts the live
 * RunProgressBar; per-model metrics live in the PerformanceSummary cards below.
 */
export function RunGroupHeader({ group, onDelete, onCancel, cancelPending }: {
  group: TestRunGroupDto;
  onDelete: () => void;
  onCancel: () => void;
  cancelPending: boolean;
}) {
  const { t } = useLingui();
  const c = agentColor(group.agentId);
  const sc = runStatusColor(group.status);
  const active = group.runs.some(r => isActive(r.status));
  const endpointCount = new Set(group.runs.map(r => r.endpointId)).size;

  return (
    <div
      className="relative overflow-hidden rounded-lg bg-card shadow-[var(--shadow-card)] px-4.5 py-3 flex items-center gap-3 flex-wrap"
    >
      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg" style={{ background: c }} />

      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 data-testid="run-group-header-title" className="text-h1 font-semibold leading-none tracking-[-0.01em] m-0 truncate min-w-0">{group.suiteName}</h2>
          <Pill label={group.agentName} color={c} />
          <span data-testid={`group-status-${group.id}`} className="inline-flex">
            <ColoredBadge color={sc} label={group.status} dot size="md" />
          </span>
          {active && (
            <span className="inline-flex items-center gap-1.5 text-caption text-muted shrink-0">
              <span className="pulse-dot w-[5px] h-[5px] rounded-full bg-accent inline-block" />
              <Trans>live</Trans>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-body-sm text-muted flex-wrap">
          <span className="mono">{group.id.slice(0, 8)}</span>
          <span>·</span>
          <span>{fmtRelative(group.createdAt)}</span>
          <span>·</span>
          <span><Plural value={endpointCount} one="# model" other="# models" /></span>
          {group.sampleCount > 1 && (
            <>
              <span>·</span>
              <span><Plural value={group.sampleCount} one="# sample each" other="# samples each" /></span>
            </>
          )}
        </div>

        {active && (
          <div className="mt-1.5">
            <RunProgressBar runs={group.runs} />
          </div>
        )}
      </div>

      <div className="flex gap-2 shrink-0">
        <AskTraceyButton
          data-testid="ask-tracey-btn-run-group"
          prompt={() => runGroupPrompt(group)}
        />
        {active && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onCancel}
            loading={cancelPending}
            data-testid={`run-cancel-btn-${group.id}`}
          >
            <Trans>Cancel</Trans>
          </Button>
        )}
        <IconButton danger onClick={onDelete} aria-label={t`Delete run group`} title={t`Delete run group`}><TrashIcon size={14} /></IconButton>
      </div>
    </div>
  );
}
