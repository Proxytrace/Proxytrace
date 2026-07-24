import { useLingui } from '@lingui/react/macro';
import { Badge } from '../../../../components/ui/Badge';
import { fmtDate, fmtPct } from '../../../../lib/format';
import { NotificationTargetKind } from '../../../../api/models';
import { targetRoute } from '../../notificationsMeta';
import { groupCaseTotals, runStatusLabel, runStatusVariant } from '../../targetPreviewMeta';
import { useTestRunGroupTarget } from '../../hooks/useNotificationTarget';
import { TargetPreviewCard, TargetPreviewRow } from './TargetPreviewCard';

/** Live summary of the test run a notification was raised for. */
export function TestRunGroupPreview({ id }: { id: string }) {
  const { t, i18n } = useLingui();
  const { data: group, isPending } = useTestRunGroupTarget(id);
  const cases = group ? groupCaseTotals(group.runs) : null;

  return (
    <TargetPreviewCard
      eyebrow={t`Test run`}
      state={isPending ? 'loading' : group ? 'ready' : 'missing'}
      title={group?.suiteName}
      route={targetRoute(NotificationTargetKind.TestRunGroup, id)}
      ctaLabel={t`Open test run`}
    >
      {group && (
        <>
          <TargetPreviewRow label={t`Agent`} value={group.agentName} />
          <TargetPreviewRow
            label={t`Status`}
            value={
              <Badge
                label={i18n._(runStatusLabel(group.status))}
                variant={runStatusVariant(group.status)}
                size="sm"
              />
            }
          />
          {cases && (
            <TargetPreviewRow
              label={t`Pass rate`}
              value={`${fmtPct(cases.passed / cases.total)} (${cases.passed}/${cases.total})`}
            />
          )}
          {group.completedAt && <TargetPreviewRow label={t`Completed`} value={fmtDate(group.completedAt)} />}
        </>
      )}
    </TargetPreviewCard>
  );
}
