import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AgentCallDto } from '../../../api/models';
import { agentCallsApi } from '../../../api/agent-calls';
import { QUERY_KEYS } from '../../../api/query-keys';
import { WrenchIcon } from '../../../components/icons';
import { fmtLatency, fmtRelative, fmtTokens } from '../../../lib/format';
import { modelColor } from '../../../lib/colors';
import { cn } from '../../../lib/cn';
import { ColoredBadge } from '../../../components/ui/ColoredBadge';
import { StatusDot } from '../../../components/ui/StatusDot';
import { FilterDropdown } from '../../../components/ui/FilterDropdown';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { EmptyState } from '../../../components/ui/EmptyState';
import { SearchIcon } from '../../../components/icons';
import { TracePreviewPanel } from './TracePreviewPanel';

const RANGE_OPTIONS = [
  { key: '1h',  label: 'Last hour',  hours: 1 },
  { key: '24h', label: 'Last 24h',   hours: 24 },
  { key: '7d',  label: 'Last 7 days', hours: 24 * 7 },
  { key: '30d', label: 'Last 30 days', hours: 24 * 30 },
  { key: 'all', label: 'All time',   hours: null as number | null },
];

const TRACE_PAGE_SIZE = 200;

function rangeFrom(rangeKey: string): string | undefined {
  const opt = RANGE_OPTIONS.find(r => r.key === rangeKey);
  if (!opt || opt.hours === null) return undefined;
  return new Date(Date.now() - opt.hours * 60 * 60 * 1000).toISOString();
}

function firstUserContent(t: AgentCallDto): string {
  return t.request.find(m => m.role === 'user')?.content ?? '';
}

function searchHaystack(t: AgentCallDto): string {
  const userMsgs = t.request.filter(m => m.role === 'user').map(m => m.content ?? '').join(' ');
  const respMsg = t.response?.content ?? '';
  return `${userMsgs} ${respMsg}`.toLowerCase();
}

function hasTools(t: AgentCallDto): boolean {
  if (t.tools && t.tools.length > 0) return true;
  return [...t.request, ...(t.response ? [t.response] : [])].some(m => (m.toolRequests?.length ?? 0) > 0);
}

function fmtClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  agentId: string;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onClear: () => void;
}

export function TracesStep({ agentId, selected, onToggle, onSelectAll, onClear }: Props) {
  const [range, setRange] = useState<string>('7d');
  const [search, setSearch] = useState<string>('');
  const [focusedIdState, setFocusedIdState] = useState<string | null>(null);

  // Memoize so `from` is stable across renders; recomputing `Date.now()` each
  // render would churn the queryKey and cause an infinite refetch loop.
  const from = useMemo(() => rangeFrom(range), [range]);
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.agentCallsForSuiteCreate(agentId, from),
    queryFn: () => agentCallsApi.list({ agentId, pageSize: TRACE_PAGE_SIZE, from }),
    enabled: !!agentId,
  });

  const allTraces = useMemo(() => data?.items ?? [], [data]);

  const traces = useMemo(() => {
    const success = allTraces.filter(t => t.httpStatus >= 200 && t.httpStatus < 300);
    const q = search.trim().toLowerCase();
    if (!q) return success;
    return success.filter(t => searchHaystack(t).includes(q));
  }, [allTraces, search]);

  const focusedId =
    focusedIdState && traces.find(t => t.id === focusedIdState)
      ? focusedIdState
      : (traces[0]?.id ?? null);
  const setFocusedId = (id: string | null) => setFocusedIdState(id);

  const focused = traces.find(t => t.id === focusedId) ?? null;
  const truncated = data && data.total > TRACE_PAGE_SIZE;

  const allVisibleSelected = traces.length > 0 && traces.every(t => selected.has(t.id));

  return (
    <div data-testid="wizard-step-traces" className="flex flex-col gap-3 min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <Input
            leftAddon={<SearchIcon size={13} />}
            rightAddon={search ? <Button variant="link" className="text-[11px]" onClick={() => setSearch('')}>clear</Button> : undefined}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search prompts and responses…"
          />
        </div>
        <FilterDropdown
          label="Range"
          value={range}
          options={RANGE_OPTIONS.map(r => ({ key: r.key, label: r.label }))}
          onChange={setRange}
          active={range !== 'all'}
        />
        <span className="text-[11.5px] text-muted ml-1">{traces.length} of {allTraces.length} shown</span>
        <div className="flex-1" />
        <Button
          variant="secondary"
          size="sm"
          data-testid="wizard-trace-select-all"
          disabled={traces.length === 0}
          onClick={() => (allVisibleSelected ? onClear() : onSelectAll(traces.map(t => t.id)))}
        >
          {allVisibleSelected ? 'Select none' : 'Select all'}
        </Button>
        <span
          className={cn(
            'px-3 py-[5px] rounded-full text-[12px] font-semibold border',
            selected.size > 0
              ? 'bg-accent-subtle text-accent-hover border-accent'
              : 'bg-card text-muted border-border',
          )}
        >
          {selected.size} selected
        </span>
      </div>

      <p className="text-[11.5px] text-muted m-0">Only successful traces (2xx) are shown — errored traces aren't useful for benchmarking.</p>

      {/* Two-column body */}
      <div className="grid gap-3 min-h-0 grid-cols-[minmax(0,1fr)_420px] h-[520px]">
        {/* List */}
        <div className="flex flex-col min-h-0 rounded-[12px] border border-border bg-card overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto">
            {isLoading && (
              <div className="flex flex-col gap-2 p-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-[58px] rounded-[9px] bg-card-2 animate-pulse" />
                ))}
              </div>
            )}

            {!isLoading && traces.length === 0 && (
              <EmptyState
                title="No matching traces"
                description={search ? 'Try clearing the search or widening the time range.' : 'No successful traces found in this range.'}
              />
            )}

            {!isLoading && traces.length > 0 && (
              <ul className="flex flex-col">
                {traces.map(t => {
                  const sel = selected.has(t.id);
                  const tools = hasTools(t);
                  const snippet = firstUserContent(t).replace(/\s+/g, ' ').trim().slice(0, 120);
                  return (
                    <li
                      key={t.id}
                      data-testid={`wizard-trace-option-${t.id}`}
                      onClick={() => { setFocusedId(t.id); onToggle(t.id); }}
                      className={cn(
                        'cursor-pointer transition-colors duration-100',
                        'p-[10px_12px] border-l-[3px] border-b border-b-hairline -outline-offset-1',
                        sel
                          ? 'border-l-accent bg-accent-subtle'
                          : 'border-l-transparent bg-transparent',
                        focusedId === t.id && !sel
                          ? 'outline outline-1 outline-[rgba(255,255,255,0.08)]'
                          : 'outline-none',
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-[11px] font-mono text-muted shrink-0 w-[44px]">{fmtClock(t.createdAt)}</span>
                        <ColoredBadge color={modelColor(t.model)} label={t.model} dot size="sm" />
                        <StatusDot httpStatus={t.httpStatus} showLabel={false} />
                        <span className="text-[11px] font-mono text-secondary shrink-0">
                          {fmtTokens(t.inputTokens)}→{fmtTokens(t.outputTokens)}
                        </span>
                        <span className="text-[11px] font-mono text-muted shrink-0">{fmtLatency(t.durationMs)}</span>
                        {tools && (
                          <span title="Used tools" className="inline-flex items-center text-accent">
                            <WrenchIcon size={11} />
                          </span>
                        )}
                        <span className="text-[11px] font-mono text-muted ml-auto shrink-0">{fmtRelative(t.createdAt)}</span>
                      </div>
                      <div className="mt-[5px] text-[12px] text-secondary truncate min-w-0">
                        {snippet ? <span className="text-secondary">{snippet}</span> : <span className="text-muted italic">No user message</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {truncated && (
            <div className="px-3 py-2 text-[11px] text-muted border-t border-hairline bg-card-2 shrink-0">
              Showing first {TRACE_PAGE_SIZE} traces — narrow your filter to see older calls.
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="rounded-[12px] border border-border bg-card overflow-hidden min-h-0">
          <TracePreviewPanel trace={focused} />
        </div>
      </div>
    </div>
  );
}
