import { useState } from 'react';
import type { MessageDto, ToolRequestDto } from '../../api/models';
import { ChevronRightIcon, ExternalLinkIcon } from '../icons';
import { JsonBlock } from './JsonBlock';

const EMERALD = 'rgba(16,185,129,1)';
const EMERALD_BG = 'rgba(16,185,129,0.07)';
const EMERALD_BORDER = 'rgba(16,185,129,0.22)';
const CYAN = 'rgba(6,182,212,1)';
const CYAN_BG = 'rgba(6,182,212,0.07)';

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
  request: ToolRequestDto;
  result?: MessageDto;
  onJumpToDefinition?: () => void;
  defaultOpen?: boolean;
}

export function ToolMessageBubble({ request, result, onJumpToDefinition, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const args = safeParse(request.arguments);
  const resultParsed = result ? safeParse(result.content) : undefined;
  const resultBytes = result?.content?.length ?? 0;

  const hasResult = result != null;
  const statusLabel = hasResult ? 'ok' : 'pending';
  const statusFg = hasResult ? CYAN : 'var(--warn)';
  const statusBg = hasResult ? 'rgba(6,182,212,0.14)' : 'rgba(245,158,11,0.14)';
  const statusTitle = hasResult ? 'Tool returned a response' : 'No response captured for this call';

  return (
    <div
      className="rounded-[12px] overflow-hidden bg-card-2"
      style={{ border: `1px solid ${EMERALD_BORDER}`, boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset' }}
    >
      {/* Header */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-[10px] text-left bg-transparent border-0 cursor-pointer transition-colors duration-100 hover:bg-[rgba(16,185,129,0.04)]"
      >
        <span
          aria-hidden
          className={`inline-flex shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
          style={{ color: EMERALD }}
        >
          <ChevronRightIcon size={11} strokeWidth={2.5} />
        </span>
        <span className="font-mono text-[10.5px] font-bold tracking-[0.06em]" style={{ color: EMERALD }}>TOOL</span>
        <span className="font-mono text-[12.5px] font-semibold" style={{ color: '#d1fae5' }}>{request.name}</span>
        {argsPreview(args) && (
          <span className="font-mono text-[11px] truncate min-w-0" style={{ color: '#71717a' }}>
            <span>(</span>
            <span style={{ color: '#a1a1aa' }}>{argsPreview(args)}</span>
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
        <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] shrink-0" style={{ color: '#52525b' }}>
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
            title="View tool definition on Agents page"
            className="ml-1 inline-flex items-center gap-[3px] px-[7px] py-[3px] rounded-[6px] text-[10.5px] font-semibold cursor-pointer transition-colors duration-150 shrink-0 hover:bg-[rgba(16,185,129,0.12)]"
            style={{ color: EMERALD }}
          >
            <ExternalLinkIcon size={10} strokeWidth={2.5} />
            Definition
          </span>
        )}
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-[rgba(255,255,255,0.05)]">
          {/* Input panel */}
          <div className="px-[14px] py-[10px]" style={{ background: EMERALD_BG }}>
            <div className="flex items-center gap-2 mb-[6px]">
              <span aria-hidden className="w-[4px] h-[4px] rounded-full" style={{ background: EMERALD }} />
              <span className="text-[9.5px] font-bold tracking-[0.1em] uppercase" style={{ color: EMERALD }}>Input</span>
            </div>
            <JsonBlock value={args} hideCopy transparent maxHeight={280} className="!px-0 !py-0" />
          </div>

          {/* Output panel */}
          {hasResult ? (
            <div className="px-[14px] py-[10px] border-t border-[rgba(255,255,255,0.05)]" style={{ background: CYAN_BG }}>
              <div className="flex items-center gap-2 mb-[6px]">
                <span aria-hidden className="w-[4px] h-[4px] rounded-full" style={{ background: CYAN }} />
                <span className="text-[9.5px] font-bold tracking-[0.1em] uppercase" style={{ color: CYAN }}>Output</span>
                <span className="ml-auto font-mono text-[10px]" style={{ color: '#52525b' }}>{resultBytes} B</span>
              </div>
              <JsonBlock value={resultParsed} hideCopy transparent maxHeight={280} className="!px-0 !py-0" />
            </div>
          ) : (
            <div
              className="px-[14px] py-[9px] border-t border-[rgba(255,255,255,0.05)] text-[11px] font-mono italic"
              style={{ background: 'rgba(245,158,11,0.05)', color: 'var(--warn)', borderTopStyle: 'dashed' }}
            >
              No response captured for this call.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
