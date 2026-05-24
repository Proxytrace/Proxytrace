import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EvaluationScore, type EvaluationResultDto } from '../../../api/models';

const SCORE_COLOR: Record<EvaluationScore, string> = {
  [EvaluationScore.Terrible]: 'var(--danger)',
  [EvaluationScore.Bad]: 'var(--warn)',
  [EvaluationScore.Acceptable]: 'var(--accent-primary)',
  [EvaluationScore.Good]: 'var(--teal)',
  [EvaluationScore.Excellent]: 'var(--success)',
};

/** Score / error / loading pill for a test-bench run result. Color is data-driven per score. */
export function ResultPill({ result, loading }: { result?: EvaluationResultDto; loading?: boolean }) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-[11.5px] font-semibold bg-card-2 text-muted">
        <span className="w-2 h-2 rounded-full bg-muted animate-pulse" />
        Scoring…
      </span>
    );
  }
  if (!result) return null;

  if (result.errorMessage !== null) {
    const color = 'var(--warn)';
    return (
      <div className="flex items-center gap-1.5">
        <span
          className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-[11.5px] font-semibold"
          style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
          title={result.errorMessage ?? 'Evaluator errored'}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
          Error
        </span>
        {result.errorMessage && <ReasoningTip text={result.errorMessage} />}
      </div>
    );
  }

  const color = result.score ? (SCORE_COLOR[result.score] ?? 'var(--accent-primary)') : 'var(--accent-primary)';
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-[11.5px] font-semibold"
        style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
      >
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        {result.score}
      </span>
      {result.reasoning && <ReasoningTip text={result.reasoning} />}
    </div>
  );
}

/** Hover/focus tooltip showing an evaluator's reasoning, portaled to body and positioned at runtime. */
export function ReasoningTip({ text }: { text: string }) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  function show() {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(352, window.innerWidth * 0.8);
    const left = Math.max(8, rect.right - width);
    const top = rect.top - 8;
    setPos({ top, left });
    setOpen(true);
  }

  function hide() {
    setOpen(false);
  }

  return (
    <>
      <span
        ref={anchorRef}
        tabIndex={0}
        role="button"
        aria-label="Show reasoning"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="w-5 h-5 inline-flex items-center justify-center rounded-full border border-hairline bg-card-2 text-[10.5px] font-semibold text-muted hover:text-accent hover:border-accent focus:text-accent focus:border-accent cursor-help transition-colors outline-none"
      >
        ?
      </span>
      {open && pos && createPortal(
        <div
          role="tooltip"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: 'min(22rem, 80vw)', transform: 'translateY(-100%)' }}
          className="pointer-events-none z-[1000] max-h-72 overflow-auto p-3 rounded-md bg-card border border-border shadow-[var(--shadow-card)] text-[11.5px] leading-[1.55] text-primary whitespace-pre-wrap text-left"
        >
          <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted mb-1.5">
            Reasoning
          </span>
          {text}
        </div>,
        document.body,
      )}
    </>
  );
}
