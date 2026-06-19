import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import useToast from '../../../hooks/useToast';
import { useCleanupNonModelData } from '../hooks/useDangerZone';
import { ConfirmDialog } from '../../../components/overlays/ConfirmDialog';
import { Button } from '../../../components/ui/Button';
import { TrashIcon } from '../../../components/icons';
import { SectionHeader } from '../components/SectionHeader';

const DELETED: MessageDescriptor[] = [
  msg`Agent calls (traces)`,
  msg`Test runs & test run groups`,
  msg`Test results`,
  msg`Evaluations`,
  msg`Optimization proposals`,
];

const KEPT: MessageDescriptor[] = [
  msg`Providers, Models & Endpoints`,
  msg`Agents`,
  msg`Test suites & Test cases`,
  msg`Evaluators`,
  msg`Projects, Users & API keys`,
];

const CONFIRM_PHRASE = 'delete all non-model data';

/** Destructive workspace-wide maintenance: wipe runtime/trace data while keeping configuration. */
export function DangerZoneSection() {
  const { t, i18n } = useLingui();
  const { show: toast } = useToast();
  const [confirm, setConfirm] = useState(false);

  const cleanup = useCleanupNonModelData(() => {
    setConfirm(false);
    toast(t`Non-model data deleted`, 'success');
  });

  return (
    <div className="w-full min-w-0 flex flex-col" data-testid="settings-danger">
      <SectionHeader title={t`Danger zone`} subtitle={t`Irreversible, workspace-wide maintenance actions.`} />

      <div className="max-w-[760px]">
        <div className="bg-card border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] rounded-[14px] p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-h2 font-bold text-danger m-0 mb-1"><Trans>Delete all non-model data</Trans></h2>
            <p className="text-body text-secondary m-0">
              <Trans>Wipes runtime/trace data while preserving configuration. This action cannot be undone.</Trans>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card-2 border border-hairline rounded-[10px] p-3">
              <div className="text-body font-semibold text-danger mb-2 uppercase tracking-wide"><Trans>Will be deleted</Trans></div>
              <ul className="m-0 pl-4 flex flex-col gap-1">
                {DELETED.map(x => <li key={x.id} className="text-body text-primary">{i18n._(x)}</li>)}
              </ul>
            </div>
            <div className="bg-card-2 border border-hairline rounded-[10px] p-3">
              <div className="text-body font-semibold text-success mb-2 uppercase tracking-wide"><Trans>Will be kept</Trans></div>
              <ul className="m-0 pl-4 flex flex-col gap-1">
                {KEPT.map(x => <li key={x.id} className="text-body text-primary">{i18n._(x)}</li>)}
              </ul>
            </div>
          </div>

          <div>
            <Button
              variant="dangerOutline"
              size="sm"
              data-testid="cleanup-data-btn"
              leftIcon={<TrashIcon size={14} />}
              onClick={() => setConfirm(true)}
            >
              <Trans>Delete all non-model data</Trans>
            </Button>
          </div>
        </div>
      </div>

      {confirm && (
        <ConfirmDialog
          entityName={CONFIRM_PHRASE}
          onCancel={() => setConfirm(false)}
          onConfirm={() => cleanup.mutate()}
          loading={cleanup.isPending}
        />
      )}
    </div>
  );
}
