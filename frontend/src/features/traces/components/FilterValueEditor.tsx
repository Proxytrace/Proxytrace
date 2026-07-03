import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { RowButton } from '../../../components/ui/RowButton';
import { cn } from '../../../lib/cn';
import { Trans, useLingui } from '@lingui/react/macro';

export interface EditorOption {
  key: string;
  label: string;
  accent?: string;
}

export type EditorSpec =
  | { kind: 'options'; options: EditorOption[]; value: string; emptyText: string; onApply: (key: string) => void }
  | { kind: 'text'; value: string; placeholder: string; onApply: (value: string) => void }
  | { kind: 'range'; min: string; max: string; unit?: string; onApply: (min: string, max: string) => void };

/**
 * The value editor inside a filter chip's popover: an option list (agent/anomaly/tool/status),
 * a free-text match (model), or a numeric min/max pair (tokens/latency). Option picks apply
 * immediately; text/range apply on the button (or Enter).
 */
export function FilterValueEditor({ spec }: { spec: EditorSpec }) {
  const { t } = useLingui();
  // Drafts keep typing local until Apply — the parent applies filters (and refetches) per commit,
  // not per keystroke. Editors remount per open (popover unmount), so initial state is fresh.
  const [text, setText] = useState(spec.kind === 'text' ? spec.value : '');
  const [min, setMin] = useState(spec.kind === 'range' ? spec.min : '');
  const [max, setMax] = useState(spec.kind === 'range' ? spec.max : '');

  if (spec.kind === 'options') {
    if (spec.options.length === 0) {
      return <div className="px-3.5 py-3 text-body text-muted">{spec.emptyText}</div>;
    }
    return (
      <div className="py-1 max-h-72 overflow-y-auto">
        {spec.options.map(o => (
          <RowButton
            key={o.key}
            data-testid={`traces-filter-option-${o.key}`}
            onClick={() => spec.onApply(o.key)}
            className={cn(
              'flex items-center gap-2 px-3.5 py-2 text-body',
              'text-secondary hover:bg-[var(--bg-wash-hover)] hover:text-primary',
              o.key === spec.value && 'text-accent-text',
            )}
          >
            {o.accent && <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: o.accent }} />}
            {o.label}
          </RowButton>
        ))}
      </div>
    );
  }

  if (spec.kind === 'text') {
    return (
      <form
        className="flex items-center gap-2 p-3"
        onSubmit={e => {
          e.preventDefault();
          spec.onApply(text.trim());
        }}
      >
        <Input
          // eslint-disable-next-line lingui/no-unlocalized-strings -- size token; the rule can't see Input's union prop type through forwardRef
          inputSize="sm"
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={spec.placeholder}
          data-testid="traces-filter-text-input"
        />
        <Button type="submit" variant="secondary" size="sm"><Trans>Apply</Trans></Button>
      </form>
    );
  }

  return (
    <form
      className="flex items-center gap-2 p-3"
      onSubmit={e => {
        e.preventDefault();
        spec.onApply(min.trim(), max.trim());
      }}
    >
      <Input
        // eslint-disable-next-line lingui/no-unlocalized-strings -- size token; the rule can't see Input's union prop type through forwardRef
        inputSize="sm"
        autoFocus
        type="number"
        inputMode="decimal"
        min={0}
        value={min}
        onChange={e => setMin(e.target.value)}
        placeholder={spec.unit ? t`Min (${spec.unit})` : t`Min`}
        data-testid="traces-filter-min-input"
        className="w-28"
      />
      <Input
        // eslint-disable-next-line lingui/no-unlocalized-strings -- size token; the rule can't see Input's union prop type through forwardRef
        inputSize="sm"
        type="number"
        inputMode="decimal"
        min={0}
        value={max}
        onChange={e => setMax(e.target.value)}
        placeholder={spec.unit ? t`Max (${spec.unit})` : t`Max`}
        data-testid="traces-filter-max-input"
        className="w-28"
      />
      <Button type="submit" variant="secondary" size="sm"><Trans>Apply</Trans></Button>
    </form>
  );
}
