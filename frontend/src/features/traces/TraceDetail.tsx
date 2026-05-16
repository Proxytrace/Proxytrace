import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { AgentCallDto, MessageDto } from '../../api/models';
import { testSuitesApi } from '../../api/test-suites';
import { QUERY_KEYS } from '../../api/query-keys';
import { agentColor, modelColor } from '../../lib/colors';
import { fmtLatency, fmtTokens, fmtDate, fmtRelative } from '../../lib/format';
import { PlusIcon, ChevronRightIcon, ClockIcon, CoinsIcon, ArrowDownToLineIcon, ArrowUpFromLineIcon, SigmaIcon } from '../../components/icons';
import { Collapsible } from '../../components/ui/Collapsible';
import { JsonBlock } from '../../components/ui/JsonBlock';
import { MessageBubble } from '../../components/ui/MessageBubble';
import { ToolMessageBubble } from '../../components/ui/ToolMessageBubble';
import { PromoteModal } from './PromoteModal';
import { ColoredBadge } from '../../components/ui/ColoredBadge';
import { ModelParametersGrid } from '../../components/ui/ModelParametersGrid';
import { Button } from '../../components/ui/Button';

// ─── ToolResultBlock (fallback for orphan tool messages) ──────────────────────

function ToolResultBlock({ msg }: { msg: MessageDto }) {
  let parsed: unknown = msg.content;
  try { parsed = JSON.parse(msg.content); } catch { /* leave as string */ }
  const sizeB = msg.content?.length ?? 0;
  return (
    <div className="rounded-md overflow-hidden" style={{ background: 'color-mix(in srgb, var(--teal) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--teal) 28%, transparent)' }}>
      <Collapsible
        defaultOpen
        headerClassName="px-3 py-[9px] text-body-sm font-mono"
        contentClassName="px-[14px] pt-[10px] pb-3 pl-[34px] font-mono text-body-sm leading-[1.55]"
        title={
          <span className="flex items-center gap-2 flex-1 text-secondary">
            <span className="font-bold tracking-[0.04em]" style={{ color: 'var(--teal)' }}>RESULT</span>
            <span className="font-semibold text-primary">{msg.toolCallId?.slice(0, 12) ?? '—'}</span>
            <span className="ml-auto text-caption font-mono text-muted">{sizeB} B</span>
          </span>
        }
      >
        <div style={{ borderTop: '1px dashed color-mix(in srgb, var(--teal) 22%, transparent)' }}>
          <div className="mt-[10px]">
            <JsonBlock value={parsed} hideCopy transparent className="!px-0 !py-0" />
          </div>
        </div>
      </Collapsible>
    </div>
  );
}

// ─── DrawerStat ───────────────────────────────────────────────────────────────

function DrawerStat({
  label,
  value,
  sub,
  icon,
  color,
  valueColor,
  children,
}: {
  label: string;
  value?: string;
  sub?: React.ReactNode;
  icon: React.ReactNode;
  color: string;
  valueColor?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-[10px]">
        <div
          className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
          style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 32%, transparent)` }}
        >
          {icon}
        </div>
        <div className="min-w-0 leading-tight">
          <div className="text-[10.5px] text-muted font-medium tracking-[0.05em] uppercase">{label}</div>
          {value !== undefined && (
            <div className="text-[15px] font-bold mt-[2px] font-mono" style={{ color: valueColor ?? 'var(--text-primary)' }}>{value}</div>
          )}
          {children}
        </div>
      </div>
      {sub && <div className="text-[10px] text-muted mt-[4px] ml-[46px]">{sub}</div>}
    </div>
  );
}

// ─── TraceDetail ──────────────────────────────────────────────────────────────

interface Props {
  trace: AgentCallDto;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

type Tab = 'Messages' | 'Tools' | 'Raw JSON' | 'Metadata';

export function TraceDetail({ trace, onClose, onPrev, onNext }: Props) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('Messages');
  const [promoting, setPromoting] = useState(false);
  const [prevTrace] = useState(trace);

  if (prevTrace?.id !== trace.id) {
    setTab('Messages');
    setPromoting(false);
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (promoting) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev?.();
      if (e.key === 'ArrowRight') onNext?.();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, onPrev, onNext, promoting]);

  const suitesQuery = useQuery({
    queryKey: QUERY_KEYS.testSuites(trace.agentId ?? undefined),
    queryFn: () => testSuitesApi.list({ agentId: trace.agentId ?? undefined, pageSize: 200 }),
    enabled: !!trace.agentId,
  });
  const suites = suitesQuery.data?.items ?? [];
  const hasResponse = !!trace.response;
  const promoteDisabled = !trace.agentId || !hasResponse || suitesQuery.isLoading || suites.length === 0;
  const promoteTooltip = !trace.agentId
    ? 'This trace is not linked to an agent and cannot be promoted.'
    : !hasResponse
      ? 'This trace has no response and cannot be promoted.'
      : suitesQuery.isLoading
        ? 'Loading test suites…'
        : suites.length === 0
          ? 'No test suite for this agent yet.'
          : '';

  const aColor = agentColor(trace.agentId ?? trace.id);
  const mColor = modelColor(trace.model);
  const statusOk = trace.httpStatus >= 200 && trace.httpStatus < 300;
  const statusErr = trace.httpStatus >= 500;
  const statusColor = statusOk ? 'var(--success)' : statusErr ? 'var(--danger)' : 'var(--warn)';
  const statusLabel = statusOk ? 'OK' : statusErr ? 'ERROR' : 'RATE_LIMIT';
  const tokTotal = trace.inputTokens + trace.outputTokens;

  const allMessages: MessageDto[] = [...trace.request, ...(trace.response ? [trace.response] : [])];
  const toolCallCount = allMessages.reduce((n, m) => n + (m.toolRequests?.length ?? 0), 0);
  const msgCount = allMessages.length;

  const toolResultByCallId = new Map<string, MessageDto>();
  for (const m of allMessages) {
    if (m.role === 'tool' && m.toolCallId) toolResultByCallId.set(m.toolCallId, m);
  }
  const invocations = allMessages.flatMap(m =>
    (m.toolRequests ?? []).map(req => ({ req, result: toolResultByCallId.get(req.id) }))
  );
  const absorbedCallIds = new Set(invocations.map(i => i.req.id));

  const jumpToDefinition = (toolName: string) => {
    if (!trace.agentId) return;
    onClose();
    navigate(`/agents?id=${trace.agentId}&tool=${encodeURIComponent(toolName)}`);
  };

  const TABS: [Tab, number | null][] = [
    ['Messages', msgCount],
    ['Tools', invocations.length],
    ['Raw JSON', null],
    ['Metadata', null],
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.4)' }}
      />

      {/* Panel */}
      <div
        className="fixed top-[76px] right-[10px] bottom-[10px] w-[min(720px,92vw)] bg-card rounded-[18px] flex flex-col overflow-hidden z-[51]"
        style={{ boxShadow: 'var(--shadow-float)', animation: 'fade-up 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-center gap-3 border-b border-hairline shrink-0">
          <button onClick={onClose} className="w-7 h-7 rounded-[7px] flex items-center justify-center text-muted bg-card-2 shrink-0">
            <ChevronRightIcon size={14} strokeWidth={2.5} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: aColor, boxShadow: `0 0 8px ${aColor}` }} />
              <span className="mono text-[13px] font-semibold">{trace.id.slice(0, 18)}…</span>
              <span className="inline-flex items-center gap-[5px] px-2 py-[2px] rounded-full text-[10.5px] font-semibold font-mono" style={{ background: statusOk ? 'var(--success-subtle)' : statusErr ? 'var(--danger-subtle)' : 'rgba(212,145,92,0.15)', color: statusColor }}>
                <span className="w-[5px] h-[5px] rounded-full" style={{ background: statusColor }} />
                {trace.httpStatus} {statusLabel}
              </span>
            </div>
            <div className="mt-[6px] flex items-center gap-2 flex-wrap">
              {trace.agentName && trace.agentId && (
                <button
                  type="button"
                  onClick={() => { onClose(); navigate(`/agents?id=${trace.agentId}`); }}
                  title="Open agent"
                  className="cursor-pointer bg-transparent border-0 p-0 inline-flex rounded-full transition-opacity duration-150 hover:opacity-80"
                >
                  <ColoredBadge color={aColor} label={trace.agentName} dot size="md" />
                </button>
              )}
              <ColoredBadge color={mColor} label={trace.model} dot size="md" />
              <span className="text-[11px] text-muted">· {fmtRelative(trace.createdAt)} · {msgCount} msg{msgCount !== 1 ? 's' : ''} · {toolCallCount} tool call{toolCallCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
          {onPrev && (
            <button onClick={onPrev} className="w-7 h-7 rounded-[7px] flex items-center justify-center text-muted bg-card-2 shrink-0 rotate-180">
              <ChevronRightIcon size={14} strokeWidth={2.5} />
            </button>
          )}
          {onNext && (
            <button onClick={onNext} className="w-7 h-7 rounded-[7px] flex items-center justify-center text-muted bg-card-2 shrink-0">
              <ChevronRightIcon size={14} strokeWidth={2.5} />
            </button>
          )}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={() => !promoteDisabled && setPromoting(true)}
              disabled={promoteDisabled}
              title={promoteTooltip || undefined}
              variant="primary"
              size="sm"
              leftIcon={<PlusIcon strokeWidth={2.5} size={12} />}
            >
              Promote to test case
            </Button>
            {trace.agentId && hasResponse && !suitesQuery.isLoading && suites.length === 0 && (
              <button
                type="button"
                onClick={() => { onClose(); navigate('/suites'); }}
                title="Create a test suite for this agent"
                className="inline-flex items-center gap-[3px] text-[11px] text-accent-primary cursor-pointer bg-transparent border-0 p-0 hover:underline"
              >
                Create suite →
              </button>
            )}
          </div>
        </div>

        {/* Stat band */}
        <div className="mx-5 mt-[14px] px-4 py-[14px] bg-card-2 rounded-xl grid grid-cols-5 gap-[14px] shrink-0" style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset' }}>
          <DrawerStat
            label="Latency"
            value={fmtLatency(trace.durationMs)}
            icon={<ClockIcon size={15} strokeWidth={2.2} />}
            color={trace.durationMs > 3000 ? 'var(--warn)' : 'var(--teal)'}
            valueColor={trace.durationMs > 3000 ? 'var(--warn)' : undefined}
          />
          <DrawerStat
            label="Input"
            value={fmtTokens(trace.inputTokens)}
            icon={<ArrowDownToLineIcon size={15} strokeWidth={2.2} />}
            color="var(--teal)"
          />
          <DrawerStat
            label="Output"
            value={fmtTokens(trace.outputTokens)}
            icon={<ArrowUpFromLineIcon size={15} strokeWidth={2.2} />}
            color="var(--success)"
          />
          <DrawerStat
            label="Total"
            value={fmtTokens(tokTotal)}
            icon={<SigmaIcon size={15} strokeWidth={2.2} />}
            color="var(--accent-primary)"
          />
          <DrawerStat
            label="Cost"
            value={trace.costEur != null ? `€${trace.costEur.toFixed(4)}` : '—'}
            icon={<CoinsIcon size={15} strokeWidth={2.2} />}
            color="var(--warn)"
            sub={trace.costEur == null
              ? (
                <button
                  type="button"
                  onClick={() => { onClose(); navigate('/providers'); }}
                  className="inline-flex items-center gap-[3px] text-[10px] text-accent-primary cursor-pointer bg-transparent border-0 p-0 hover:underline"
                  title="Configure pricing for this model endpoint"
                >
                  Set price →
                </button>
              )
              : undefined}
          />
        </div>

        {/* Tabs */}
        <div className="px-5 pt-[14px] flex gap-1 border-b border-hairline shrink-0">
          {TABS.map(([t, count]) => (
            <button key={t} onClick={() => setTab(t)} className={`px-[14px] pt-[9px] pb-[11px] text-body font-medium bg-transparent -mb-px inline-flex items-center gap-1.5 transition-colors duration-[120ms] border-b-2 ${tab === t ? 'text-primary border-b-accent' : 'text-muted border-b-transparent'}`}>
              {t}
              {count !== null && (
                <span className="px-1.5 py-px rounded-full text-caption font-mono font-semibold" style={{ background: tab === t ? 'var(--accent-subtle)' : 'var(--bg-card-2)', color: tab === t ? 'var(--accent-hover)' : 'var(--text-muted)' }}>{count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-[14px] pb-7 flex flex-col gap-[10px] [&>*]:shrink-0">
          {tab === 'Messages' && (
            <>
              {allMessages.flatMap((msg, i) => {
                if (msg.role === 'tool') {
                  if (msg.toolCallId && absorbedCallIds.has(msg.toolCallId)) return [];
                  return [<ToolResultBlock key={`m${i}`} msg={msg} />];
                }
                const blocks: React.ReactElement[] = [];
                if (msg.content?.trim()) blocks.push(<MessageBubble key={`m${i}`} msg={msg} />);
                msg.toolRequests?.forEach(req => {
                  blocks.push(
                    <ToolMessageBubble
                      key={`t${req.id}`}
                      request={req}
                      result={toolResultByCallId.get(req.id)}
                      onJumpToDefinition={trace.agentId ? () => jumpToDefinition(req.name) : undefined}
                    />
                  );
                });
                return blocks;
              })}
              {trace.finishReason && (
                <div className="mt-1 px-3 py-2 bg-card-2 rounded-[8px] text-[11px] text-muted font-mono flex items-center gap-2">
                  <span className="text-success">●</span>
                  finish_reason: <span className="text-secondary">{trace.finishReason}</span>
                  <span className="ml-auto">completed in {fmtLatency(trace.durationMs)}</span>
                </div>
              )}
            </>
          )}

          {tab === 'Tools' && (
            invocations.length === 0
              ? <div className="px-5 py-[40px] text-center text-muted text-[13px]">No tools were invoked in this trace.</div>
              : invocations.map(({ req, result }, i) => (
                  <ToolMessageBubble
                    key={`${req.id}-${i}`}
                    request={req}
                    result={result}
                    onJumpToDefinition={trace.agentId ? () => jumpToDefinition(req.name) : undefined}
                  />
                ))
          )}

          {tab === 'Raw JSON' && (
            <JsonBlock value={{
              id: trace.id,
              object: 'chat.completion',
              model: trace.model,
              provider: trace.provider,
              agent_id: trace.agentId,
              agent_name: trace.agentName,
              conversation_id: trace.conversationId,
              messages: trace.request,
              response: trace.response,
              tools: trace.tools,
              usage: {
                prompt_tokens: trace.inputTokens,
                completion_tokens: trace.outputTokens,
                total_tokens: tokTotal,
              },
              finish_reason: trace.finishReason,
              error_message: trace.errorMessage,
              http_status: trace.httpStatus,
              duration_ms: trace.durationMs,
              cost_eur: trace.costEur,
              created_at: trace.createdAt,
              updated_at: trace.updatedAt,
            }} />
          )}

          {tab === 'Metadata' && (
            <>
              <div className="grid grid-cols-2 gap-[10px]">
                {([
                  ['trace.id', trace.id],
                  ['provider', trace.provider],
                  ['model', trace.model],
                  ['agent', trace.agentName ?? '—'],
                  ['http_status', String(trace.httpStatus)],
                  ['finish_reason', trace.finishReason ?? '—'],
                  ['duration_ms', String(trace.durationMs)],
                  ['input_tokens', String(trace.inputTokens)],
                  ['output_tokens', String(trace.outputTokens)],
                  ['cost_eur', trace.costEur != null ? trace.costEur.toFixed(6) : '—'],
                  ['created_at', fmtDate(trace.createdAt)],
                  ['updated_at', fmtDate(trace.updatedAt)],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="px-3 py-[10px] bg-card-2 rounded-[8px]">
                    <div className="text-[10px] text-muted uppercase tracking-[0.06em] mb-[3px]">{k}</div>
                    <div className="text-[12px] font-mono text-primary break-all">{v}</div>
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-muted uppercase tracking-[0.08em] font-semibold mt-[6px]">Model parameters</div>
              <ModelParametersGrid params={trace.modelParameters} />
            </>
          )}
        </div>
      </div>

      {promoting && <PromoteModal trace={trace} suites={suites} onClose={() => setPromoting(false)} />}
    </>
  );
}
