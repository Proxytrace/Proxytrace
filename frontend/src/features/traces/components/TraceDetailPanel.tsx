import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AgentCallDto, MessageDto } from '../../../api/models';
import { useAgentSuites } from '../hooks/usePromoteTrace';
import { agentColor, modelColor } from '../../../lib/colors';
import { fmtLatency, fmtTokens, fmtRelative, cachedPct } from '../../../lib/format';
import { cn } from '../../../lib/cn';
import {
  PlusIcon, ChevronRightIcon, ClockIcon, CoinsIcon,
  ArrowDownToLineIcon, ArrowUpFromLineIcon, ServerIcon,
} from '../../../components/icons';
import { ToolMessageBubble } from '../../../components/ui/ToolMessageBubble';
import { CopyButton } from '../../../components/ui/CopyButton';
import { ColoredBadge } from '../../../components/ui/ColoredBadge';
import { Button, IconButton } from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Tabs';
import { DetailPanel } from '../../../components/overlays/DetailPanel';
import { PromoteModal } from '../PromoteModal';
import { DrawerStat } from './DrawerStat';
import { TraceMessagesTab } from './TraceMessagesTab';
import { TraceRawJsonTab, TraceMetadataTab } from './TraceMetadataTab';
import { Trans, Plural, useLingui } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';
import { type MessageDescriptor } from '@lingui/core';

type Tab = 'Messages' | 'Tools' | 'Raw JSON' | 'Metadata';

const TAB_LABELS: Record<Tab, MessageDescriptor> = {
  Messages: msg`Messages`,
  Tools: msg`Tools`,
  'Raw JSON': msg`Raw JSON`,
  Metadata: msg`Metadata`,
};

interface Props {
  trace: AgentCallDto;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

export function TraceDetailPanel({ trace, onClose, onPrev, onNext }: Props) {
  const navigate = useNavigate();
  const { t, i18n } = useLingui();
  // eslint-disable-next-line lingui/no-unlocalized-strings -- Tab id token (display label from TAB_LABELS)
  const [tab, setTab] = useState<Tab>('Messages');
  const [promoting, setPromoting] = useState(false);
  const [prevTraceId, setPrevTraceId] = useState(trace.id);

  // Reset tab when trace changes (derived state pattern per BEST_PRACTICES §4)
  if (prevTraceId !== trace.id) {
    setPrevTraceId(trace.id);
    // eslint-disable-next-line lingui/no-unlocalized-strings -- Tab id token (display label from TAB_LABELS)
    setTab('Messages');
    setPromoting(false);
  }

  const suitesQuery = useAgentSuites(trace.agentId);
  const suites = suitesQuery.data?.items ?? [];
  const hasResponse = !!trace.response;
  const promoteDisabled = !trace.agentId || !hasResponse || suitesQuery.isLoading || suites.length === 0;
  const promoteTooltip = !trace.agentId
    ? t`This trace is not linked to an agent and cannot be promoted.`
    : !hasResponse
      ? t`This trace has no response and cannot be promoted.`
      : suitesQuery.isLoading
        ? t`Loading test suites…`
        : suites.length === 0
          ? t`No test suite for this agent yet.`
          : '';

  const aColor = agentColor(trace.agentId ?? trace.id);
  const mColor = modelColor(trace.model);
  const statusOk = trace.httpStatus >= 200 && trace.httpStatus < 300;
  const statusErr = trace.httpStatus >= 500;
  const statusColor = statusOk ? 'var(--success)' : statusErr ? 'var(--danger)' : 'var(--warn)';
  const statusLabel = statusOk ? t`OK` : statusErr ? t`ERROR` : t`RATE_LIMIT`;
  const tokTotal = trace.inputTokens + trace.outputTokens;
  const cachePct = cachedPct(trace.cachedInputTokens, trace.inputTokens);

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
      <DetailPanel onClose={onClose} onPrev={onPrev} onNext={onNext} keyboardEnabled={!promoting} testId="trace-detail">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-center gap-3 border-b border-hairline shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: aColor, boxShadow: `0 0 8px ${aColor}` }} />
              <span className="mono text-title font-semibold">{trace.id.slice(0, 18)}…</span>
              <CopyButton text={trace.id} label={t`Copy trace ID`} className="shrink-0" />
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-caption font-semibold font-mono',
                  statusOk ? 'bg-success-subtle' : statusErr ? 'bg-danger-subtle' : 'bg-[color-mix(in_srgb,var(--warn)_15%,transparent)]',
                )}
                style={{ color: statusColor }}
              >
                <span className="w-[5px] h-[5px] rounded-full" style={{ background: statusColor }} />
                {trace.httpStatus} {statusLabel}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              {trace.agentName && trace.agentId && (
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid="trace-detail-agent-name"
                  onClick={() => { onClose(); navigate(`/agents?id=${trace.agentId}`); }}
                  title={t`Open agent`}
                  className="p-0.5 rounded-full"
                >
                  <ColoredBadge color={aColor} label={trace.agentName} dot size="md" />
                </Button>
              )}
              <ColoredBadge color={mColor} label={trace.model} dot size="md" />
              <span className="text-body-sm text-muted">
                · {fmtRelative(trace.createdAt)} · <Plural value={msgCount} one="# msg" other="# msgs" /> · <Plural value={toolCallCount} one="# tool call" other="# tool calls" />
              </span>
            </div>
          </div>
          {onPrev && (
            <IconButton size="sm" onClick={onPrev} aria-label={t`Previous trace`} className="shrink-0 rotate-180">
              <ChevronRightIcon size={14} strokeWidth={2.5} />
            </IconButton>
          )}
          {onNext && (
            <IconButton size="sm" onClick={onNext} aria-label={t`Next trace`} className="shrink-0">
              <ChevronRightIcon size={14} strokeWidth={2.5} />
            </IconButton>
          )}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              data-testid="promote-btn"
              onClick={() => !promoteDisabled && setPromoting(true)}
              disabled={promoteDisabled}
              title={promoteTooltip || undefined}
              variant="primary"
              size="sm"
              leftIcon={<PlusIcon strokeWidth={2.5} size={12} />}
            >
              <Trans>Promote to test case</Trans>
            </Button>
            {trace.agentId && hasResponse && !suitesQuery.isLoading && suites.length === 0 && (
              <Button
                variant="link"
                className="text-body-sm"
                onClick={() => { onClose(); navigate('/suites'); }}
                title={t`Create a test suite for this agent`}
              >
                <Trans>Create suite →</Trans>
              </Button>
            )}
          </div>
        </div>

        {/* Stat band */}
        <div className="mx-5 mt-3.5 px-4 py-3.5 bg-card-2 rounded-xl grid grid-cols-5 gap-3.5 shrink-0 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
          <DrawerStat label={t`Latency`} value={fmtLatency(trace.durationMs)} icon={<ClockIcon size={15} strokeWidth={2.2} />} color={trace.durationMs > 3000 ? 'var(--warn)' : 'var(--teal)'} valueColor={trace.durationMs > 3000 ? 'var(--warn)' : undefined} />
          <DrawerStat label={t`Input`} value={fmtTokens(trace.inputTokens)} icon={<ArrowDownToLineIcon size={15} strokeWidth={2.2} />} color="var(--teal)" />
          <DrawerStat label={t`Output`} value={fmtTokens(trace.outputTokens)} icon={<ArrowUpFromLineIcon size={15} strokeWidth={2.2} />} color="var(--success)" />
          <DrawerStat
            label={t`Cached`}
            value={cachePct !== null ? `${cachePct}%` : '—'}
            icon={<ServerIcon size={15} strokeWidth={2.2} />}
            color="var(--accent-primary)"
          />
          <DrawerStat
            label={t`Cost`}
            // eslint-disable-next-line lingui/no-unlocalized-strings -- test id, not UI copy
            valueTestId={`trace-cost-${trace.id}`}
            value={trace.costEur != null ? `€${trace.costEur.toFixed(4)}` : '—'}
            icon={<CoinsIcon size={15} strokeWidth={2.2} />}
            color="var(--warn)"
            sub={trace.costEur == null
              ? <Button variant="link" className="text-caption" onClick={() => { onClose(); navigate('/settings/providers'); }} title={t`Configure pricing for this model endpoint`}><Trans>Set price →</Trans></Button>
              : undefined}
          />
        </div>

        {/* Tabs */}
        <Tabs
          className="px-5 pt-3.5 shrink-0"
          value={tab}
          onChange={t => setTab(t as Tab)}
          items={TABS.map(([t, count]) => ({
            value: t,
            'data-testid': `trace-tab-${t.toLowerCase().replace(/\s+/g, '-')}`,
            label: (
              <span className="inline-flex items-center gap-1.5">
                {i18n._(TAB_LABELS[t])}
                {count !== null && (
                  <span className="px-1.5 py-px rounded-full text-caption font-mono font-semibold bg-card-2 text-muted group-data-[state=active]:bg-accent-subtle group-data-[state=active]:text-accent-hover">{count}</span>
                )}
              </span>
            ),
          }))}
        />

        {/* Tab body */}
        <div
          data-testid={`trace-${tab.toLowerCase().replace(/\s+/g, '-')}-tab`}
          className="flex-1 min-h-0 overflow-y-auto px-5 pt-3.5 pb-7 flex flex-col gap-2.5 [&>*]:shrink-0"
        >
          {tab === 'Messages' && (
            <TraceMessagesTab trace={trace} onJumpToDefinition={jumpToDefinition} />
          )}
          {tab === 'Tools' && (
            invocations.length === 0
              ? <div className="px-5 py-10 text-center text-muted text-body"><Trans>No tools were invoked in this trace.</Trans></div>
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
      </DetailPanel>

      {promoting && <PromoteModal trace={trace} suites={suites} onClose={() => setPromoting(false)} />}
    </>
  );
}
