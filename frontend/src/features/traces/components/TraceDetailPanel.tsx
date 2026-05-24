import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { AgentCallDto, MessageDto } from '../../../api/models';
import { testSuitesApi } from '../../../api/test-suites';
import { QUERY_KEYS } from '../../../api/query-keys';
import { agentColor, modelColor } from '../../../lib/colors';
import { fmtLatency, fmtTokens, fmtRelative } from '../../../lib/format';
import {
  PlusIcon, ChevronRightIcon, ClockIcon, CoinsIcon,
  ArrowDownToLineIcon, ArrowUpFromLineIcon, SigmaIcon,
} from '../../../components/icons';
import { ToolMessageBubble } from '../../../components/ui/ToolMessageBubble';
import { ColoredBadge } from '../../../components/ui/ColoredBadge';
import { Button } from '../../../components/ui/Button';
import { PromoteModal } from '../PromoteModal';
import { DrawerStat } from './DrawerStat';
import { TraceMessagesTab } from './TraceMessagesTab';
import { TraceRawJsonTab, TraceMetadataTab } from './TraceMetadataTab';

type Tab = 'Messages' | 'Tools' | 'Raw JSON' | 'Metadata';

interface Props {
  trace: AgentCallDto;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

export function TraceDetailPanel({ trace, onClose, onPrev, onNext }: Props) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('Messages');
  const [promoting, setPromoting] = useState(false);
  const [prevTraceId, setPrevTraceId] = useState(trace.id);

  // Reset tab when trace changes (derived state pattern per BEST_PRACTICES §4)
  if (prevTraceId !== trace.id) {
    setPrevTraceId(trace.id);
    setTab('Messages');
    setPromoting(false);
  }

  // Keyboard navigation — genuine DOM subscription per BEST_PRACTICES §4.1.
  // Lives here (not in TraceDetail.tsx) because `promoting` guard requires
  // access to this component's modal state.
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
    (m.toolRequests ?? []).map(req => ({ req, result: toolResultByCallId.get(req.id) })),
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
      <div onClick={onClose} className="fixed inset-0 z-50 bg-[rgba(0,0,0,0.4)]" />

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
              <span className="mono text-body-title font-semibold">{trace.id.slice(0, 18)}…</span>
              <span
                className="inline-flex items-center gap-[5px] px-2 py-[2px] rounded-full text-caption font-semibold font-mono"
                style={{
                  background: statusOk ? 'var(--success-subtle)' : statusErr ? 'var(--danger-subtle)' : 'color-mix(in srgb, var(--warn) 15%, transparent)',
                  color: statusColor,
                }}
              >
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
              <span className="text-body-sm text-muted">
                · {fmtRelative(trace.createdAt)} · {msgCount} msg{msgCount !== 1 ? 's' : ''} · {toolCallCount} tool call{toolCallCount !== 1 ? 's' : ''}
              </span>
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
                className="inline-flex items-center gap-[3px] text-body-sm text-accent cursor-pointer bg-transparent border-0 p-0 hover:underline"
              >
                Create suite →
              </button>
            )}
          </div>
        </div>

        {/* Stat band */}
        <div className="mx-5 mt-[14px] px-4 py-[14px] bg-card-2 rounded-xl grid grid-cols-5 gap-[14px] shrink-0" style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset' }}>
          <DrawerStat label="Latency" value={fmtLatency(trace.durationMs)} icon={<ClockIcon size={15} strokeWidth={2.2} />} color={trace.durationMs > 3000 ? 'var(--warn)' : 'var(--teal)'} valueColor={trace.durationMs > 3000 ? 'var(--warn)' : undefined} />
          <DrawerStat label="Input" value={fmtTokens(trace.inputTokens)} icon={<ArrowDownToLineIcon size={15} strokeWidth={2.2} />} color="var(--teal)" />
          <DrawerStat label="Output" value={fmtTokens(trace.outputTokens)} icon={<ArrowUpFromLineIcon size={15} strokeWidth={2.2} />} color="var(--success)" />
          <DrawerStat label="Total" value={fmtTokens(tokTotal)} icon={<SigmaIcon size={15} strokeWidth={2.2} />} color="var(--accent-primary)" />
          <DrawerStat
            label="Cost"
            value={trace.costEur != null ? `€${trace.costEur.toFixed(4)}` : '—'}
            icon={<CoinsIcon size={15} strokeWidth={2.2} />}
            color="var(--warn)"
            sub={trace.costEur == null
              ? <button type="button" onClick={() => { onClose(); navigate('/providers'); }} className="inline-flex items-center gap-[3px] text-caption text-accent cursor-pointer bg-transparent border-0 p-0 hover:underline" title="Configure pricing for this model endpoint">Set price →</button>
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
            <TraceMessagesTab
              trace={trace}
              allMessages={allMessages}
              toolResultByCallId={toolResultByCallId}
              absorbedCallIds={absorbedCallIds}
              onJumpToDefinition={jumpToDefinition}
            />
          )}
          {tab === 'Tools' && (
            invocations.length === 0
              ? <div className="px-5 py-[40px] text-center text-muted text-body">No tools were invoked in this trace.</div>
              : invocations.map(({ req, result }, i) => (
                <ToolMessageBubble
                  key={`${req.id}-${i}`}
                  request={req}
                  result={result}
                  onJumpToDefinition={trace.agentId ? () => jumpToDefinition(req.name) : undefined}
                />
              ))
          )}
          {tab === 'Raw JSON' && <TraceRawJsonTab trace={trace} tokTotal={tokTotal} />}
          {tab === 'Metadata' && <TraceMetadataTab trace={trace} />}
        </div>
      </div>

      {promoting && <PromoteModal trace={trace} suites={suites} onClose={() => setPromoting(false)} />}
    </>
  );
}
