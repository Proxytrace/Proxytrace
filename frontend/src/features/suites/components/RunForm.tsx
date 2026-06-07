import type { ModelEndpointDto, TestSuiteDto } from '../../../api/models';
import { modelColor } from '../../../lib/colors';
import { PlayFilledIcon } from '../../../components/icons';
import { Button } from '../../../components/ui/Button';
import { RowButton } from '../../../components/ui/RowButton';

interface Props {
  suite: TestSuiteDto;
  modelsData: ModelEndpointDto[];
  selectedEndpoints: Set<string>;
  loading: boolean;
  isMulti: boolean;
  onToggle: (id: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export function RunForm({ suite, modelsData, selectedEndpoints, loading, isMulti, onToggle, onCancel, onSubmit }: Props) {
  const hasSelection = selectedEndpoints.size > 0;

  return (
    <>
      <h3 className="text-[16px] font-bold mb-1">Start new test run</h3>
      <p className="text-[12.5px] text-muted mb-5 leading-[1.55]">
        Run <strong className="text-primary">{suite.testCases.length} test cases</strong> from{' '}
        <strong className="text-primary">{suite.name}</strong> and compare results.
      </p>

      <div className="mb-5">
        <div className="text-caption text-muted font-semibold uppercase tracking-[0.08em] mb-2 flex items-center gap-2">
          Model endpoints to evaluate
          {isMulti && (
            <span
              className="px-2 py-[2px] bg-accent-subtle text-[color:var(--accent-hover)] rounded-full text-[10px] font-semibold normal-case tracking-normal border border-[color-mix(in_srgb,var(--accent-primary)_22%,transparent)]"
            >
              Parallel · {selectedEndpoints.size} selected
            </span>
          )}
        </div>

        <div className="flex flex-col gap-[6px] max-h-[280px] overflow-y-auto">
          {modelsData.map(ep => {
            const mc = modelColor(ep.modelName);
            const isOn = selectedEndpoints.has(ep.id);
            return (
              <RowButton
                key={ep.id}
                onClick={() => onToggle(ep.id)}
                className="flex items-center gap-[10px] px-3 py-[9px] rounded-md transition-all duration-[120ms]"
                style={{
                  background: isOn ? `color-mix(in srgb, ${mc} 8%, transparent)` : 'var(--bg-card-2)',
                  boxShadow: isOn
                    ? `inset 0 0 0 1.5px color-mix(in srgb, ${mc} 28%, transparent)`
                    : 'var(--shadow-pill)',
                }}
              >
                <div
                  className="flex items-center justify-center shrink-0 rounded-[4px] transition-all duration-[120ms] w-4 h-4"
                  style={{
                    border: `1.5px solid ${isOn ? mc : 'var(--text-muted)'}`,
                    background: isOn ? mc : 'transparent',
                  }}
                >
                  {isOn && (
                    <span className="text-black text-[10px] font-[800] leading-none">✓</span>
                  )}
                </div>
                <span
                  className="font-mono text-[12.5px] font-semibold flex-1"
                  style={{ color: isOn ? mc : 'var(--text-secondary)' }}
                >
                  {ep.modelName}
                </span>
                <span className="text-[11px] text-muted">{ep.providerName}</span>
              </RowButton>
            );
          })}

          {modelsData.length === 0 && (
            <div className="text-center text-muted text-body p-5">
              No endpoints configured. Add providers first.
            </div>
          )}
        </div>
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
          {isMulti ? `Run on ${selectedEndpoints.size} endpoints` : 'Start run'}
        </Button>
      </div>
    </>
  );
}
