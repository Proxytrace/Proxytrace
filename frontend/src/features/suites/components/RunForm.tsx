import { Trans, Plural, useLingui } from '@lingui/react/macro';
import type { ModelEndpointDto, TestSuiteListItemDto } from '../../../api/models';
import { modelColor } from '../../../lib/colors';
import { MAX_RUN_ENDPOINTS, MAX_SAMPLE_COUNT } from '../../../lib/constants';
import { PlayFilledIcon } from '../../../components/icons';
import { Button } from '../../../components/ui/Button';
import { MultiCombobox } from '../../../components/ui/MultiCombobox';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';

interface Props {
  suite: TestSuiteListItemDto;
  modelsData: ModelEndpointDto[];
  selectedEndpoints: string[];
  sampleCount: number;
  loading: boolean;
  isMulti: boolean;
  onChange: (ids: string[]) => void;
  onSampleCountChange: (n: number) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export function RunForm({ suite, modelsData, selectedEndpoints, sampleCount, loading, isMulti, onChange, onSampleCountChange, onCancel, onSubmit }: Props) {
  const { t } = useLingui();
  const count = selectedEndpoints.length;
  const hasSelection = count > 0;
  const totalRuns = count * sampleCount;
  const sampleSegments = Array.from({ length: MAX_SAMPLE_COUNT }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
    testId: `run-samples-${i + 1}`,
  }));

  return (
    <>
      <h3 className="text-h2 font-semibold mb-1"><Trans>Start new test run</Trans></h3>
      <p className="text-body text-muted mb-5 leading-[1.55]">
        <Trans>
          Run <strong className="text-primary"><Plural value={suite.testCaseCount} one="# test case" other="# test cases" /></strong> from{' '}
          <strong className="text-primary">{suite.name}</strong> and compare results.
        </Trans>
      </p>

      <div className="mb-5">
        <div className="text-caption text-muted font-semibold uppercase tracking-[0.08em] mb-2 flex items-center gap-2">
          <Trans>Model endpoints to evaluate</Trans>
          {isMulti && (
            <span
              className="px-2 py-0.5 bg-accent-subtle text-[color:var(--accent-hover)] rounded-none text-caption font-semibold normal-case tracking-normal border border-[color-mix(in_srgb,var(--accent-primary)_22%,transparent)]"
            >
              <Trans>Parallel · {count} selected</Trans>
            </span>
          )}
        </div>

        <MultiCombobox
          values={selectedEndpoints}
          onChange={onChange}
          items={modelsData}
          itemKey={ep => ep.id}
          itemLabel={ep => ep.modelName}
          itemMeta={ep => ep.providerName}
          itemColor={ep => modelColor(ep.modelName)}
          maxSelected={MAX_RUN_ENDPOINTS}
          placeholder={t`Select model endpoints…`}
          searchPlaceholder={t`Search models…`}
          emptyText={t`No endpoints configured. Add providers first.`}
          aria-label={t`Model endpoints to evaluate`}
          data-testid="run-endpoints"
        />
      </div>

      <div className="mb-5">
        <div className="text-caption text-muted font-semibold uppercase tracking-[0.08em] mb-2">
          <Trans>Samples per endpoint</Trans>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <SegmentedControl
            value={String(sampleCount)}
            onChange={v => onSampleCountChange(Number(v))}
            segments={sampleSegments}
          />
          {hasSelection && (
            <span className="text-caption text-muted">
              {sampleCount > 1
                ? <Plural value={totalRuns} one="# run total" other="# runs total" />
                : <Trans>Run each endpoint once</Trans>}
            </span>
          )}
        </div>
        <p className="text-body-sm text-muted mt-2 leading-[1.5]">
          <Trans>Run each endpoint multiple times to surface flaky cases; results are averaged per endpoint.</Trans>
        </p>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={onCancel}>
          <Trans>Cancel</Trans>
        </Button>
        <Button
          variant="primary"
          onClick={onSubmit}
          disabled={!hasSelection}
          loading={loading}
          leftIcon={<PlayFilledIcon size={12} />}
        >
          {isMulti ? <Plural value={count} one="Run on # endpoint" other="Run on # endpoints" /> : <Trans>Start run</Trans>}
        </Button>
      </div>
    </>
  );
}
