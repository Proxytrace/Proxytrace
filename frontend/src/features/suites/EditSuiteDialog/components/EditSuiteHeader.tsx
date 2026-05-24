import type { TestSuiteDto } from '../../../../api/models';
import { XIcon } from '../../../../components/icons';

interface Props {
  suite: TestSuiteDto;
  agentColorHex: string;
  onClose: () => void;
}

export function EditSuiteHeader({ suite, agentColorHex: c, onClose }: Props) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <div
          className="w-10 h-10 rounded-[10px] shrink-0 flex items-center justify-center"
          style={{
            background: `color-mix(in srgb, ${c} 14%, transparent)`,
            border: `1px solid color-mix(in srgb, ${c} 32%, transparent)`,
          }}
        >
          <span className="text-h2 font-bold" style={{ color: c }}>
            {suite.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <h2 className="m-0 text-base font-bold text-primary truncate">{suite.name}</h2>
          <div className="mt-[3px] flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-[5px] px-2 py-[2px] rounded-full text-[10.5px] font-semibold shadow-[var(--shadow-pill)]"
              style={{
                background: `color-mix(in srgb, ${c} 14%, transparent)`,
                color: c,
                border: `1px solid color-mix(in srgb, ${c} 32%, transparent)`,
              }}
            >
              {suite.agentName}
            </span>
            <span className="text-[11.5px] text-muted">
              {suite.testCases.length} cases · {suite.evaluators.length} evaluators · {suite.totalRuns} runs
            </span>
            {suite.passRate !== null && (
              <span className="text-[11.5px] text-muted">· {Math.round(suite.passRate)}% pass</span>
            )}
          </div>
          {suite.description && (
            <p className="mt-2 text-[12.5px] text-secondary leading-[1.55] m-0 line-clamp-2">
              {suite.description}
            </p>
          )}
        </div>
      </div>
      <button onClick={onClose} className="btn-icon shrink-0" aria-label="Close dialog">
        <XIcon size={14} />
      </button>
    </div>
  );
}
