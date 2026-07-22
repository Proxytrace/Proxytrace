import { useRef, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { CheckIcon, ZapIcon } from '../../../components/icons';
import { Button } from '../../../components/ui/Button';
import { RowButton } from '../../../components/ui/RowButton';
import { Popover } from '../../../components/ui/Popover';
import useModelEndpoints from '../../../hooks/useModelEndpoints';
import { useAutosizeTextarea } from '../../../hooks/useAutosizeTextarea';
import { cn } from '../../../lib/cn';
import { FOCUS_RING_FIELD } from '../../../lib/constants';

interface Props {
  disabled: boolean;
  disabledReason?: string | null;
  endpointId?: string | null;
  defaultEndpointId?: string | null;
  onEndpointChange?: (endpointId: string) => void;
  onSend: (text: string) => void;
}

function approxTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function ComposeBox({
  disabled,
  disabledReason,
  endpointId,
  defaultEndpointId,
  onEndpointChange,
  onSend,
}: Props) {
  const { t } = useLingui();
  const [text, setText] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const { data: endpoints = [] } = useModelEndpoints(!!onEndpointChange);

  // Auto-grow the composer to fit its content (external DOM measurement → custom hook, §4.1).
  useAutosizeTextarea(taRef, text);

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  const tokens = approxTokens(text);
  const canSend = !disabled && !!text.trim();
  const current = endpoints.find(ep => ep.id === endpointId) ?? null;
  const isModified = !!defaultEndpointId && !!endpointId && endpointId !== defaultEndpointId;
  const badgeLabel = current
    ? `${current.providerName} · ${current.modelName}`
    : (endpointId ? '…' : t`Pick endpoint`);

  return (
    <div className="border-t border-border p-3 flex flex-col gap-2 bg-black/[0.12]">
      {/* The frame is the field — the textarea below is deliberately borderless — so the focus ring
          lives here, scoped to the text control so the endpoint chip and Send button below ring
          themselves instead (DESIGN §7, same treatment as the Tracey composer).
          The border used to tint on `canSend`, i.e. on *having text*, which read as a focus signal
          while being the opposite of one: lit when unfocused-but-typed-in, dark when focused-and-
          empty. It now tracks focus like every other field; the Send button's disabled state is
          what conveys "nothing to send". */}
      <div
        className={cn(
          'rounded-lg flex flex-col bg-card border border-border',
          'transition-[border-color,box-shadow] duration-[var(--motion-base)] ease-[var(--ease-standard)]',
          'focus-within:border-[color-mix(in_srgb,var(--accent-primary)_40%,transparent)]',
          FOCUS_RING_FIELD,
        )}
      >
        {/* eslint-disable-next-line no-restricted-syntax -- bespoke auto-resizing borderless composer textarea */}
        <textarea
          ref={taRef}
          data-testid="compose-box"
          className="w-full bg-transparent border-0 outline-none resize-none px-3 pt-2.5 pb-1.5 text-title leading-[1.55] text-primary placeholder:text-muted"
          placeholder={disabled && disabledReason ? disabledReason : t`Send a user message…`}
          value={text}
          disabled={disabled}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); send(); }
          }}
          rows={2}
          aria-label={t`Message`}
        />
        <div className="flex items-center gap-2 px-2.5 pb-2 pt-0.5">
          {onEndpointChange && (
            <Popover
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              side="top"
              align="start"
              className="w-[280px] py-1.5 max-h-[320px] overflow-y-auto"
              trigger={
                // eslint-disable-next-line no-restricted-syntax -- bespoke endpoint chip trigger (ZapIcon + modified dot); Popover asChild target
                <button
                  type="button"
                  data-testid="endpoint-picker"
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none text-caption mono cursor-pointer transition-colors hover:text-primary border',
                    pickerOpen
                      ? 'bg-accent-subtle border-[color-mix(in_srgb,var(--accent-primary)_32%,transparent)] text-accent-hover'
                      : 'bg-[var(--bg-wash-hover)] border-border text-secondary',
                  )}
                  title={t`Switch endpoint`}
                >
                  <ZapIcon size={11} strokeWidth={2.2} />
                  {badgeLabel}
                  {isModified && (
                    <span
                      aria-label={t`modified`}
                      title={t`Modified from agent default`}
                      className="ml-0.5 size-[5px] rounded-full bg-accent shadow-[0_0_0_2px_var(--bg-card)]"
                    />
                  )}
                </button>
              }
            >
              <div role="listbox">
                <div className="px-2.5 pt-0.5 pb-1.5 flex items-center justify-between">
                  <span className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary"><Trans>Endpoint</Trans></span>
                  {defaultEndpointId && endpointId !== defaultEndpointId && (
                    <Button
                      variant="link"
                      className="text-caption uppercase tracking-[0.08em]"
                      onClick={() => { onEndpointChange(defaultEndpointId); setPickerOpen(false); }}
                    >
                      <Trans>Reset</Trans>
                    </Button>
                  )}
                </div>
                {endpoints.length === 0 ? (
                  <div className="px-2.5 py-2 text-body-sm text-muted"><Trans>No endpoints configured.</Trans></div>
                ) : endpoints.map(ep => {
                  const active = ep.id === endpointId;
                  return (
                    <RowButton
                      key={ep.id}
                      role="option"
                      aria-selected={active}
                      onClick={() => { onEndpointChange(ep.id); setPickerOpen(false); }}
                      data-testid={`endpoint-picker-option-${ep.id}`}
                      className={cn(
                        'flex items-center gap-2 px-2.5 py-1.5 hover:bg-card transition-colors',
                        active && 'bg-accent-subtle',
                      )}
                    >
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className={cn('text-body truncate', active ? 'text-primary font-semibold' : 'text-secondary')}>
                          {ep.modelName}
                        </span>
                        <span className="text-caption text-muted truncate mono">{ep.providerName}</span>
                      </div>
                      {active && <CheckIcon size={12} strokeWidth={2.5} />}
                    </RowButton>
                  );
                })}
              </div>
            </Popover>
          )}
          <div className="ml-auto flex items-center gap-2.5 text-caption mono text-muted tabular-nums">
            <span title={t`Approximate tokens (chars / 4)`}><Trans>~{tokens} tok</Trans></span>
            <span><Trans>{text.length} chars</Trans></span>
          </div>
          <Button
            variant="primary"
            className="gap-2 py-1.5 px-3 text-body"
            onClick={send}
            disabled={!canSend}
            data-testid="compose-send"
            aria-label={t`Send message`}
          >
            <Trans>Send</Trans>
            <span className="kbd-hint">⌘↵</span>
          </Button>
        </div>
      </div>
      {disabled && disabledReason && (
        <div className="text-body-sm text-muted px-0.5">{disabledReason}</div>
      )}
    </div>
  );
}
