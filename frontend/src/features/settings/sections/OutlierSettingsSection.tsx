import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import type { OutlierSettings } from '../../../api/outlierSettings';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { SectionHeader } from '../components/SectionHeader';
import { ToggleRow } from '../components/ToggleRow';
import { useOutlierSettings, useUpdateOutlierSettings } from '../hooks/useOutlierSettings';

const EMPTY: OutlierSettings = {
  enabled: true,
  sigmaMultiplier: 3,
  minSampleCount: 30,
  sampleWindow: 200,
};

/** Inputs are valid when every knob stays in a range that produces a usable baseline. */
function isValid(draft: OutlierSettings): boolean {
  return draft.sigmaMultiplier > 0 && draft.minSampleCount >= 1 && draft.sampleWindow >= 1;
}

export function OutlierSettingsSection() {
  const { t } = useLingui();
  const { data } = useOutlierSettings();
  const update = useUpdateOutlierSettings();

  // Derive-on-change draft (BEST_PRACTICES §4.1): track the loaded value and reset the draft when
  // it changes during render. No useEffect.
  const [loaded, setLoaded] = useState<typeof data>(undefined);
  const [draft, setDraft] = useState<OutlierSettings>(EMPTY);
  if (data !== loaded) {
    setLoaded(data);
    setDraft(data ?? EMPTY);
  }

  const valid = isValid(draft);

  return (
    <div className="w-full min-w-0 flex flex-col" data-testid="settings-outlier-detection">
      <SectionHeader
        title={t`Outlier detection`}
        subtitle={t`Flag agent calls that deviate from their agent's recent behaviour.`}
      />
      <div className="max-w-[760px] flex flex-col gap-5">
        <div className="bg-card-2 border border-hairline rounded-[12px] p-4 flex flex-col gap-3">
          <ToggleRow
            label={t`Enable outlier detection`}
            description={t`When on, each ingested call is flagged if it deviates from the agent's recent baseline.`}
            checked={draft.enabled}
            onChange={(v) => setDraft({ ...draft, enabled: v })}
            testId="outlier-enabled"
          />
          <FormField label={t`Sensitivity (standard deviations)`}>
            <Input
              type="number"
              step="0.5"
              min="0.1"
              value={String(draft.sigmaMultiplier)}
              onChange={(e) => setDraft({ ...draft, sigmaMultiplier: Number(e.target.value) })}
              className="max-w-[160px]"
              data-testid="outlier-sigma"
            />
            <p className="text-caption text-muted">
              <Trans>A call is flagged when a metric is this many standard deviations from the agent's recent mean. Lower is more sensitive.</Trans>
            </p>
          </FormField>
          <FormField label={t`Minimum samples`}>
            <Input
              type="number"
              min="1"
              value={String(draft.minSampleCount)}
              onChange={(e) => setDraft({ ...draft, minSampleCount: Number(e.target.value) })}
              className="max-w-[160px]"
              data-testid="outlier-min-samples"
            />
            <p className="text-caption text-muted">
              <Trans>A metric is only judged once the agent has at least this many recent calls.</Trans>
            </p>
          </FormField>
          <FormField label={t`Baseline window (calls)`}>
            <Input
              type="number"
              min="1"
              value={String(draft.sampleWindow)}
              onChange={(e) => setDraft({ ...draft, sampleWindow: Number(e.target.value) })}
              className="max-w-[160px]"
              data-testid="outlier-sample-window"
            />
            <p className="text-caption text-muted">
              <Trans>How many of the agent's most recent successful calls form the baseline.</Trans>
            </p>
          </FormField>
          {!valid && (
            <p className="text-body-sm text-danger" data-testid="outlier-validation-error">
              <Trans>Sensitivity must be above 0, and the sample counts at least 1.</Trans>
            </p>
          )}
          <div className="flex gap-2 pt-2 border-t border-hairline">
            <Button
              variant="primary"
              size="sm"
              loading={update.isPending}
              disabled={!valid}
              data-testid="outlier-save-btn"
              onClick={() => update.mutate(draft)}
            >
              <Trans>Save changes</Trans>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
