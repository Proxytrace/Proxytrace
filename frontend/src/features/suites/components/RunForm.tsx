import type { ModelEndpointDto, TestSuiteListItemDto } from '../../../api/models';
import { modelColor } from '../../../lib/colors';
import { MAX_RUN_ENDPOINTS } from '../../../lib/constants';
import { PlayFilledIcon } from '../../../components/icons';
import { Button } from '../../../components/ui/Button';
import { MultiCombobox } from '../../../components/ui/MultiCombobox';

interface Props {
  suite: TestSuiteListItemDto;
  modelsData: ModelEndpointDto[];
  selectedEndpoints: string[];
  loading: boolean;
  isMulti: boolean;
  onChange: (ids: string[]) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export function RunForm({ suite, modelsData, selectedEndpoints, loading, isMulti, onChange, onCancel, onSubmit }: Props) {
  const count = selectedEndpoints.length;
  const hasSelection = count > 0;

  return (
    <>
      <h3 className="text-[16px] font-bold mb-1">Start new test run</h3>
      <p className="text-[12.5px] text-muted mb-5 leading-[1.55]">
        Run <strong className="text-primary">{suite.testCaseCount} test cases</strong> from{' '}
        <strong className="text-primary">{suite.name}</strong> and compare results.
      </p>

      <div className="mb-5">
        <div className="text-caption text-muted font-semibold uppercase tracking-[0.08em] mb-2 flex items-center gap-2">
          Model endpoints to evaluate
          {isMulti && (
            <span
              className="px-2 py-[2px] bg-accent-subtle text-[color:var(--accent-hover)] rounded-full text-[10px] font-semibold normal-case tracking-normal border border-[color-mix(in_srgb,var(--accent-primary)_22%,transparent)]"
            >
              Parallel · {count} selected
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
          placeholder="Select model endpoints…"
          searchPlaceholder="Search models…"
          emptyText="No endpoints configured. Add providers first."
          aria-label="Model endpoints to evaluate"
          data-testid="run-endpoints"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={onSubmit}
          disabled={!hasSelection}
          loading={loading}
          leftIcon={<PlayFilledIcon size={12} />}
        >
          {isMulti ? `Run on ${count} endpoints` : 'Start run'}
        </Button>
      </div>
    </>
  );
}
