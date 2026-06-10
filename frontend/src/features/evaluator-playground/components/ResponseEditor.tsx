import { Textarea } from '../../../components/ui/Textarea';
import { Button } from '../../../components/ui/Button';
import { EditPencilIcon, ResetIcon } from '../../../components/icons';

/** Read-only reference / expected answer. */
export function ExpectedResponse({ text }: { text: string }) {
  return (
    <section className="flex flex-col gap-1.5 min-w-0 shrink-0">
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">Expected · reference</span>
      <pre className="m-0 px-3.5 py-3 rounded-lg bg-card-2 border border-border-subtle text-[12.5px] leading-relaxed text-secondary font-mono whitespace-pre-wrap break-words max-h-[200px] overflow-auto">
        {text || '—'}
      </pre>
    </section>
  );
}

/** Editable candidate response with edited-state badge, reset, and char/word count. */
export function EditableResponse({ value, original, onChange, onReset }: {
  value: string;
  original: string;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  const edited = value.trim() !== original.trim();
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  return (
    <section className="flex flex-col gap-1.5 min-w-0 shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent-text">Candidate response</span>
        <span className="inline-flex items-center gap-1 text-[9.5px] text-muted">
          <EditPencilIcon size={10} /> editable
        </span>
        {edited && (
          <span className="inline-flex items-center gap-1 text-[9.5px] text-accent-text px-1.5 py-0.5 rounded-full bg-accent-subtle font-semibold">
            <span className="w-[5px] h-[5px] rounded-full bg-accent" /> edited
          </span>
        )}
        {edited && (
          <Button variant="ghost" size="sm" className="ml-auto" leftIcon={<ResetIcon size={12} />} onClick={onReset}>
            Reset
          </Button>
        )}
      </div>
      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        spellCheck={false}
        rows={8}
        data-testid="bench-actual-input"
        className="resize-none font-mono text-[12.5px] leading-relaxed"
      />
      <div className="flex items-center gap-2 text-[10px] text-muted font-mono">
        <span>{value.length} chars</span>
        <span className="opacity-50">·</span>
        <span>{words} {words === 1 ? 'word' : 'words'}</span>
      </div>
    </section>
  );
}
