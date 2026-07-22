import { Trans, useLingui } from '@lingui/react/macro';
import { EditPencilIcon, TargetIcon } from '../../../../components/icons';
import { Button } from '../../../../components/ui/Button';
import { Switch } from '../../../../components/ui/Switch';
import { detectorColor, tint } from '../../../../lib/colors';
import { fmtRelative } from '../../../../lib/format';
import { ID_SHORT_LEN } from '../../../../lib/constants';
import type { CustomAnomalyDetectorDto } from '../../../../api/models';

interface Props {
  detector: CustomAnomalyDetectorDto;
  onEdit: () => void;
  onDelete: () => void;
  onToggleEnabled: (next: boolean) => void;
  toggling: boolean;
}

/** Detail-pane header: identity, status chip, quick enable toggle, and edit/delete actions. */
export function DetectorDetailHeader({ detector: d, onEdit, onDelete, onToggleEnabled, toggling }: Props) {
  const { t } = useLingui();
  const color = detectorColor(d.id);
  return (
    <header className="bg-card rounded-lg shadow-[var(--shadow-card)]" data-testid="detector-detail-header">
      <div className="flex items-center gap-3.5 px-4.5 py-3.5 flex-wrap">
        <span
          className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
          style={{ background: tint(color, 14), color }}
          aria-hidden
        >
          <TargetIcon size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-h1 font-semibold leading-tight tracking-[-0.02em] m-0 truncate" data-testid="detector-name">
              {d.name}
            </h1>
            {d.isEnabled ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-none bg-success-subtle text-success text-caption font-semibold">
                <span className="pulse-dot w-[5px] h-[5px] rounded-full bg-success" />
                <Trans>Active</Trans>
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-none bg-card-2 text-muted text-caption font-semibold">
                <Trans>Disabled</Trans>
              </span>
            )}
            {d.blockUpstream && (
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-none bg-danger-subtle text-danger text-caption font-semibold"
                title={t`Matching requests are rejected at the proxy before reaching the provider`}
                data-testid="detector-blocking-badge"
              >
                <Trans>Blocking</Trans>
              </span>
            )}
          </div>
          <div className="flex gap-3.5 mt-1.5 text-body-sm text-muted flex-wrap font-mono">
            <span><span className="opacity-70"><Trans>id</Trans></span> {d.id.slice(0, ID_SHORT_LEN)}…</span>
            <span><span className="opacity-70"><Trans>model</Trans></span> {d.endpointName}</span>
            <span>
              <span className="opacity-70"><Trans>updated</Trans></span>{' '}
              <span className="font-sans">{fmtRelative(d.updatedAt)}</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Switch
            checked={d.isEnabled}
            onChange={onToggleEnabled}
            disabled={toggling}
            aria-label={d.isEnabled ? t`Disable detector` : t`Enable detector`}
            data-testid="detector-enabled-toggle"
          />
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" leftIcon={<EditPencilIcon size={11} />} onClick={onEdit} data-testid="detector-edit-btn">
              <Trans>Edit</Trans>
            </Button>
            <Button variant="dangerOutline" size="sm" onClick={onDelete} data-testid="detector-delete-btn">
              <Trans>Delete</Trans>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
