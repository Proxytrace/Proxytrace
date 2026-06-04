import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { type EvaluationResultDto } from '../../../api/models';
import { scoreColor, tooltipPosition } from '../testBenchMeta';

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
    return (
      <div className="flex items-center gap-1.5">
        <span
          className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-[11.5px] font-semibold bg-[color-mix(in_srgb,var(--warn)_18%,transparent)] text-warn"
          title={result.errorMessage ?? 'Evaluator errored'}
        >
          <span className="w-2 h-2 rounded-full bg-warn" />
          Error
        </span>
        {result.errorMessage && <ReasoningTip text={result.errorMessage} />}
      </div>
    );
  }

  const color = scoreColor(result.score);
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
    setPos(tooltipPosition(el.getBoundingClientRect(), window.innerWidth));
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
          style={{ top: pos.top, left: pos.left }}
          className="fixed w-[min(22rem,80vw)] -translate-y-full pointer-events-none z-[1000] max-h-72 overflow-auto p-3 rounded-md bg-card border border-border shadow-[var(--shadow-card)] text-[11.5px] leading-[1.55] text-primary whitespace-pre-wrap text-left"
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
