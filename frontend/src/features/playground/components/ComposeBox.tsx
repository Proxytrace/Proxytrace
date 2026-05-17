import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckIcon, ZapIcon } from '../../../components/icons';
import { providersApi } from '../../../api/providers';

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
  const [text, setText] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const { data: endpoints = [] } = useQuery({
    queryKey: ['model-endpoints'],
    queryFn: () => providersApi.getAllModels(),
    enabled: !!onEndpointChange,
  });

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
    : (endpointId ? '…' : 'Pick endpoint');

  return (
    <div className="border-t border-border p-[12px] flex flex-col gap-[8px] bg-[rgba(0,0,0,0.12)]">
      <div
        className="rounded-[12px] flex flex-col"
        style={{
          background: 'var(--bg-card)',
          border: `1px solid ${canSend ? 'color-mix(in srgb, var(--accent-primary) 32%, transparent)' : 'var(--border-color)'}`,
          boxShadow: canSend ? '0 0 0 3px color-mix(in srgb, var(--accent-primary) 12%, transparent)' : 'var(--shadow-pill)',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        <textarea
          ref={taRef}
          className="w-full bg-transparent border-0 outline-none resize-none px-[12px] pt-[10px] pb-[6px] text-[13.5px] leading-[1.55] text-primary placeholder:text-muted"
          placeholder={disabled && disabledReason ? disabledReason : 'Send a user message…'}
          value={text}
          disabled={disabled}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); send(); }
          }}
          rows={2}
          aria-label="Message"
        />
        <div className="flex items-center gap-[8px] px-[10px] pb-[8px] pt-[2px]">
          {onEndpointChange && (
            <div ref={pickerRef} className="relative">
              <button
                type="button"
                onClick={() => setPickerOpen(o => !o)}
                className="inline-flex items-center gap-[5px] px-[8px] py-[3px] rounded-full text-[10.5px] mono cursor-pointer transition-colors hover:text-primary"
                style={{
                  background: pickerOpen ? 'var(--accent-subtle)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${pickerOpen ? 'color-mix(in srgb, var(--accent-primary) 32%, transparent)' : 'var(--border-color)'}`,
                  color: pickerOpen ? 'var(--accent-hover)' : 'var(--text-secondary)',
                }}
                title="Switch endpoint"
                aria-haspopup="listbox"
                aria-expanded={pickerOpen}
              >
                <ZapIcon size={11} strokeWidth={2.2} />
                {badgeLabel}
                {isModified && (
                  <span
                    aria-label="modified"
                    title="Modified from agent default"
                    className="ml-[2px] size-[5px] rounded-full bg-accent"
                    style={{ boxShadow: '0 0 0 2px var(--bg-card)' }}
                  />
                )}
              </button>
              {pickerOpen && (
                <div
                  role="listbox"
                  className="absolute left-0 bottom-full mb-[6px] z-30 w-[280px] rounded-[12px] py-[6px] max-h-[320px] overflow-y-auto fade-up"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-float)',
                  }}
                >
                  <div className="px-[10px] pt-[2px] pb-[6px] flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">Endpoint</span>
                    {defaultEndpointId && endpointId !== defaultEndpointId && (
                      <button
                        type="button"
                        onClick={() => { onEndpointChange(defaultEndpointId); setPickerOpen(false); }}
                        className="text-[10px] font-semibold text-accent uppercase tracking-[0.08em] cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  {endpoints.length === 0 ? (
                    <div className="px-[10px] py-[8px] text-[11.5px] text-muted">No endpoints configured.</div>
                  ) : endpoints.map(ep => {
                    const active = ep.id === endpointId;
                    return (
                      <button
                        key={ep.id}
                        role="option"
                        aria-selected={active}
                        onClick={() => { onEndpointChange(ep.id); setPickerOpen(false); }}
                        className="w-full flex items-center gap-[8px] px-[10px] py-[6px] text-left cursor-pointer hover:bg-card transition-colors"
                        style={active ? { background: 'var(--accent-subtle)' } : undefined}
                      >
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className={`text-[12px] truncate ${active ? 'text-primary font-semibold' : 'text-secondary'}`}>
                            {ep.modelName}
                          </span>
                          <span className="text-[10.5px] text-muted truncate mono">{ep.providerName}</span>
                        </div>
                        {active && <CheckIcon size={12} strokeWidth={2.5} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="ml-auto flex items-center gap-[10px] text-[10.5px] mono text-muted tabular-nums">
            <span title="Approximate tokens (chars / 4)">~{tokens} tok</span>
            <span>{text.length} chars</span>
          </div>
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-[8px] py-[6px] px-[12px] text-[12.5px]"
            onClick={send}
            disabled={!canSend}
            data-write
            aria-label="Send message"
          >
            Send
            <span className="kbd-hint">⌘↵</span>
          </button>
        </div>
      </div>
      {disabled && disabledReason && (
        <div className="text-[11px] text-muted px-[2px]">{disabledReason}</div>
      )}
    </div>
  );
}
