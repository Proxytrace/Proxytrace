import type { ModelEndpointDto, TestSuiteDto } from '../../../api/models';
import { modelColor } from '../../../lib/colors';
import { PlayFilledIcon } from '../../../components/icons';

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
              className="px-2 py-[2px] bg-accent-subtle text-[color:var(--accent-hover)] rounded-full text-[10px] font-semibold normal-case tracking-normal"
              style={{ border: '1px solid color-mix(in srgb, var(--accent-primary) 22%, transparent)' }}
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
              <button
                key={ep.id}
                onClick={() => onToggle(ep.id)}
                className="flex items-center gap-[10px] px-3 py-[9px] rounded-md text-left transition-all duration-[120ms] cursor-pointer"
                style={{
                  background: isOn ? `color-mix(in srgb, ${mc} 8%, transparent)` : 'var(--bg-card-2)',
                  boxShadow: isOn
                    ? `inset 0 0 0 1.5px color-mix(in srgb, ${mc} 28%, transparent)`
                    : 'var(--shadow-pill)',
                }}
              >
                <div
                  className="flex items-center justify-center shrink-0 rounded-[4px] transition-all duration-[120ms]"
                  style={{
                    width: 16,
                    height: 16,
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
              </button>
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
        <button
          onClick={onCancel}
          className="px-[18px] py-[9px] bg-card-2 rounded-[10px] text-body font-medium text-secondary shadow-[var(--shadow-pill)]"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={loading || !hasSelection}
          className="px-5 py-[9px] rounded-[10px] text-body font-semibold inline-flex items-center gap-[7px] transition-all duration-[150ms]"
          style={{
            background: hasSelection ? 'var(--grad-accent)' : 'var(--bg-card-2)',
            color: hasSelection ? '#fff' : 'var(--text-muted)',
            opacity: loading ? 0.7 : 1,
            boxShadow: hasSelection ? 'var(--shadow-btn)' : 'none',
          }}
        >
          {loading ? (
            <>
              <span className="w-3 h-3 rounded-full border-2 border-[rgba(255,255,255,0.3)] border-t-white animate-spin block" />
              Running…
            </>
          ) : (
            <><PlayFilledIcon size={12} /> {isMulti ? `Run on ${selectedEndpoints.size} endpoints` : 'Start run'}</>
          )}
        </button>
      </div>
    </>
  );
}
