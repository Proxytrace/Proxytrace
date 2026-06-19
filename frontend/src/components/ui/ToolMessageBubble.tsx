import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { ChevronRightIcon, ExternalLinkIcon } from '../icons';
import { JsonBlock } from './JsonBlock';
import { CopyButton } from './CopyButton';
import { hoverRevealOverlayCls } from './classes';

function safeParse(s: string | null | undefined): unknown {
  if (s == null || s === '') return s ?? null;
  try { return JSON.parse(s); } catch { return s; }
}

function argsPreview(args: unknown): string {
  if (typeof args !== 'object' || args === null) return '';
  const entries = Object.entries(args as Record<string, unknown>);
  if (entries.length === 0) return '';
  const head = entries.slice(0, 2).map(([k, v]) => {
    const raw = typeof v === 'string' ? `"${v}"` : JSON.stringify(v);
    const trimmed = raw.length > 24 ? raw.slice(0, 24) + '…' : raw;
    return `${k}: ${trimmed}`;
  }).join(', ');
  const more = entries.length > 2 ? ', …' : '';
  return `${head}${more}`;
}

interface Props {
  request: { id: string; name: string; arguments: string };
  result?: { content: string };
  onJumpToDefinition?: () => void;
  defaultOpen?: boolean;
}

export function ToolMessageBubble({ request, result, onJumpToDefinition, defaultOpen = true }: Props) {
  const { t } = useLingui();
  const [open, setOpen] = useState(defaultOpen);

  const args = safeParse(request.arguments);
  const resultParsed = result ? safeParse(result.content) : undefined;
  const resultBytes = result?.content?.length ?? 0;

  const hasResult = result != null;
  const copyText = JSON.stringify(
    { tool: request.name, arguments: args, ...(hasResult ? { result: resultParsed } : {}) },
    null,
    2,
  );
  const statusLabel = hasResult ? t`ok` : t`pending`;
  const statusFg = hasResult ? 'var(--teal)' : 'var(--warn)';
  const statusBg = hasResult ? 'color-mix(in srgb, var(--teal) 14%, transparent)' : 'color-mix(in srgb, var(--warn) 14%, transparent)';
  const statusTitle = hasResult ? t`Tool returned a response` : t`No response captured for this call`;

  return (
    <div
      className="relative group rounded-[12px] overflow-hidden bg-card-2 border border-[color-mix(in_srgb,var(--success)_22%,transparent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
    >
      <CopyButton text={copyText} label={t`Copy tool call`} className={hoverRevealOverlayCls} />
      {/* Header */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 pl-3 pr-9 py-[10px] text-left bg-transparent border-0 cursor-pointer transition-colors duration-100 hover:bg-success-subtle"
      >
        <span
          aria-hidden
          className={`inline-flex shrink-0 transition-transform duration-150 text-success ${open ? 'rotate-90' : ''}`}
        >
          <ChevronRightIcon size={11} strokeWidth={2.5} />
        </span>
        <span className="font-mono text-[10.5px] font-bold tracking-[0.06em] text-success"><Trans>TOOL</Trans></span>
        <span className="font-mono text-[12.5px] font-semibold text-success">{request.name}</span>
        {argsPreview(args) && (
          <span className="font-mono text-[11px] truncate min-w-0 text-muted">
            <span>(</span>
            <span className="text-secondary">{argsPreview(args)}</span>
            <span>)</span>
          </span>
        )}
        <span
          title={statusTitle}
          className="ml-auto inline-flex items-center gap-[5px] px-[7px] py-[2px] rounded-full text-[10px] font-semibold font-mono shrink-0"
          style={{ background: statusBg, color: statusFg }}
        >
          <span aria-hidden className="w-[5px] h-[5px] rounded-full" style={{ background: statusFg }} />
          {statusLabel}
        </span>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] shrink-0 text-muted">
          {request.id.slice(0, 16)}
        </span>
        {onJumpToDefinition && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onJumpToDefinition(); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onJumpToDefinition();
              }
            }}
            title={t`View tool definition on Agents page`}
            className="ml-1 inline-flex items-center gap-[3px] px-[7px] py-[3px] rounded-[6px] text-[10.5px] font-semibold cursor-pointer transition-colors duration-150 shrink-0 text-success hover:bg-success-subtle"
          >
            <ExternalLinkIcon size={10} strokeWidth={2.5} />
            <Trans>Definition</Trans>
          </span>
        )}
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-border-subtle">
          {/* Input panel */}
          <div className="px-[14px] py-[10px] bg-success-subtle">
            <div className="flex items-center gap-2 mb-[6px]">
              <span aria-hidden className="w-[4px] h-[4px] rounded-full bg-success" />
              <span className="text-[9.5px] font-bold tracking-[0.1em] uppercase text-success"><Trans>Input</Trans></span>
            </div>
            <JsonBlock value={args} hideCopy transparent maxHeight={280} className="!px-0 !py-0" />
          </div>

          {/* Output panel */}
          {hasResult ? (
            <div className="px-[14px] py-[10px] border-t border-border-subtle bg-[color-mix(in_srgb,var(--teal)_7%,transparent)]">
              <div className="flex items-center gap-2 mb-[6px]">
                <span aria-hidden className="w-[4px] h-[4px] rounded-full bg-teal" />
                <span className="text-[9.5px] font-bold tracking-[0.1em] uppercase text-teal"><Trans>Output</Trans></span>
                <span className="ml-auto font-mono text-[10px] text-muted"><Trans>{resultBytes} B</Trans></span>
              </div>
              <JsonBlock value={resultParsed} hideCopy transparent maxHeight={280} className="!px-0 !py-0" />
            </div>
          ) : (
            <div
              className="px-[14px] py-[9px] border-t border-dashed border-border-subtle text-[11px] font-mono italic bg-[color-mix(in_srgb,var(--warn)_5%,transparent)] text-warn"
            >
              <Trans>No response captured for this call.</Trans>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
