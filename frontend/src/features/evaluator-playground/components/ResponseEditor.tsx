import { Trans, Plural } from '@lingui/react/macro';
import { Textarea } from '../../../components/ui/Textarea';
import { Button } from '../../../components/ui/Button';
import { EditPencilIcon, ResetIcon } from '../../../components/icons';

/** Read-only reference / expected answer. */
export function ExpectedResponse({ text }: { text: string }) {
  return (
    <section className="flex flex-col gap-1.5 min-w-0 shrink-0">
      <span className="text-caption font-semibold uppercase tracking-[0.08em] text-muted"><Trans>Expected · reference</Trans></span>
      <pre className="m-0 px-3.5 py-3 rounded-lg bg-card-2 border border-border-subtle text-body leading-relaxed text-secondary font-mono whitespace-pre-wrap break-words max-h-[200px] overflow-auto">
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
        <span className="text-caption font-semibold uppercase tracking-[0.08em] text-accent-text"><Trans>Candidate response</Trans></span>
        <span className="inline-flex items-center gap-1 text-caption text-muted">
          <EditPencilIcon size={10} /> <Trans>editable</Trans>
        </span>
        {edited && (
          <span className="inline-flex items-center gap-1 text-caption text-accent-text px-1.5 py-0.5 rounded-none bg-accent-subtle font-semibold">
            <span className="w-[5px] h-[5px] rounded-full bg-accent" /> <Trans>edited</Trans>
          </span>
        )}
        {edited && (
          <Button variant="ghost" size="sm" className="ml-auto" leftIcon={<ResetIcon size={12} />} onClick={onReset}>
            <Trans>Reset</Trans>
          </Button>
        )}
      </div>
      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        spellCheck={false}
        rows={8}
        data-testid="bench-actual-input"
        className="resize-none font-mono text-body leading-relaxed"
      />
      <div className="flex items-center gap-2 text-caption text-muted font-mono">
        <span><Trans>{value.length} chars</Trans></span>
        <span className="opacity-50">·</span>
        <span><Plural value={words} one="# word" other="# words" /></span>
      </div>
    </section>
  );
}
