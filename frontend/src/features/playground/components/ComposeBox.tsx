import { useEffect, useRef, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { CheckIcon, ZapIcon } from '../../../components/icons';
import { Button } from '../../../components/ui/Button';
import { RowButton } from '../../../components/ui/RowButton';
import useModelEndpoints from '../../../hooks/useModelEndpoints';
import { cn } from '../../../lib/cn';

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
  const pickerRef = useRef<HTMLDivElement>(null);

  const { data: endpoints = [] } = useModelEndpoints(!!onEndpointChange);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const next = Math.min(220, Math.max(60, ta.scrollHeight));
    ta.style.height = `${next}px`;
  }, [text]);

  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPickerOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
    };
  }, [pickerOpen]);

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
    <div className="border-t border-border p-[12px] flex flex-col gap-[8px] bg-[rgba(0,0,0,0.12)]">
      <div
        className={cn(
          'rounded-[12px] flex flex-col bg-card border transition-[border-color,box-shadow] duration-150 ease-[ease]',
          canSend
            ? 'border-[color-mix(in_srgb,var(--accent-primary)_32%,transparent)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent-primary)_12%,transparent)]'
            : 'border-border shadow-[var(--shadow-pill)]',
        )}
      >
        {/* eslint-disable-next-line no-restricted-syntax -- bespoke auto-resizing borderless composer textarea */}
        <textarea
          ref={taRef}
          data-testid="compose-box"
          className="w-full bg-transparent border-0 outline-none resize-none px-[12px] pt-[10px] pb-[6px] text-[13.5px] leading-[1.55] text-primary placeholder:text-muted"
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
        <div className="flex items-center gap-[8px] px-[10px] pb-[8px] pt-[2px]">
          {onEndpointChange && (
            <div ref={pickerRef} className="relative">
              {/* eslint-disable-next-line no-restricted-syntax -- bespoke endpoint pill trigger (ZapIcon + modified dot) */}
              <button
                type="button"
                onClick={() => setPickerOpen(o => !o)}
                data-testid="endpoint-picker"
                className={cn(
                  'inline-flex items-center gap-[5px] px-[8px] py-[3px] rounded-full text-[10.5px] mono cursor-pointer transition-colors hover:text-primary border',
                  pickerOpen
                    ? 'bg-accent-subtle border-[color-mix(in_srgb,var(--accent-primary)_32%,transparent)] text-accent-hover'
                    : 'bg-[rgba(255,255,255,0.04)] border-border text-secondary',
                )}
                title={t`Switch endpoint`}
                aria-haspopup="listbox"
                aria-expanded={pickerOpen}
              >
                <ZapIcon size={11} strokeWidth={2.2} />
                {badgeLabel}
                {isModified && (
                  <span
                    aria-label={t`modified`}
                    title={t`Modified from agent default`}
                    className="ml-[2px] size-[5px] rounded-full bg-accent shadow-[0_0_0_2px_var(--bg-card)]"
                  />
                )}
              </button>
              {pickerOpen && (
                <div
                  role="listbox"
                  className="absolute left-0 bottom-full mb-[6px] z-30 w-[280px] rounded-[12px] py-[6px] max-h-[320px] overflow-y-auto fade-up bg-surface-2 border border-border shadow-[var(--shadow-float)]"
                >
                  <div className="px-[10px] pt-[2px] pb-[6px] flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"><Trans>Endpoint</Trans></span>
                    {defaultEndpointId && endpointId !== defaultEndpointId && (
                      <Button
                        variant="link"
                        className="text-[10px] uppercase tracking-[0.08em]"
                        onClick={() => { onEndpointChange(defaultEndpointId); setPickerOpen(false); }}
                      >
                        <Trans>Reset</Trans>
                      </Button>
                    )}
                  </div>
                  {endpoints.length === 0 ? (
                    <div className="px-[10px] py-[8px] text-[11.5px] text-muted"><Trans>No endpoints configured.</Trans></div>
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
                          'flex items-center gap-[8px] px-[10px] py-[6px] hover:bg-card transition-colors',
                          active && 'bg-accent-subtle',
                        )}
                      >
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className={`text-[12px] truncate ${active ? 'text-primary font-semibold' : 'text-secondary'}`}>
                            {ep.modelName}
                          </span>
                          <span className="text-[10.5px] text-muted truncate mono">{ep.providerName}</span>
                        </div>
                        {active && <CheckIcon size={12} strokeWidth={2.5} />}
                      </RowButton>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="ml-auto flex items-center gap-[10px] text-[10.5px] mono text-muted tabular-nums">
            <span title={t`Approximate tokens (chars / 4)`}><Trans>~{tokens} tok</Trans></span>
            <span><Trans>{text.length} chars</Trans></span>
          </div>
          <Button
            variant="primary"
            className="gap-[8px] py-[6px] px-[12px] text-[12.5px]"
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
        <div className="text-[11px] text-muted px-[2px]">{disabledReason}</div>
      )}
    </div>
  );
}
