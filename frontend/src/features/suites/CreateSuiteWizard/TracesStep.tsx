import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AgentCallDto } from '../../../api/models';
import { agentCallsApi } from '../../../api/agent-calls';
import { QUERY_KEYS } from '../../../api/query-keys';
import { fmtLatency, fmtRelative, fmtTokens } from '../../../lib/format';
import { modelColor } from '../../../lib/colors';
import { ColoredBadge } from '../../../components/ui/ColoredBadge';
import { StatusDot } from '../../../components/ui/StatusDot';
import { FilterDropdown } from '../../../components/ui/FilterDropdown';
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

function WrenchIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

interface Props {
  agentId: string;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
}

export function TracesStep({ agentId, selected, onToggle, onClear }: Props) {
  const [range, setRange] = useState<string>('7d');
  const [search, setSearch] = useState<string>('');
  const [focusedIdState, setFocusedIdState] = useState<string | null>(null);

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

  const focusedId = useMemo(() => {
    if (focusedIdState && traces.find(t => t.id === focusedIdState)) return focusedIdState;
    return traces[0]?.id ?? null;
  }, [traces, focusedIdState]);
  const setFocusedId = (id: string | null) => setFocusedIdState(id);

  const focused = traces.find(t => t.id === focusedId) ?? null;
  const truncated = data && data.total > TRACE_PAGE_SIZE;

  return (
    <div className="flex flex-col gap-3 min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px] flex items-center gap-2 px-3 rounded-[9px] bg-card-2 border border-border focus-within:border-[var(--accent-primary)] transition-colors">
          <SearchIcon size={13} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search prompts and responses…"
            className="flex-1 bg-transparent border-0 py-[9px] text-[13px] outline-none text-primary placeholder:text-muted"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="text-[11px] text-muted hover:text-primary cursor-pointer bg-transparent border-0"
            >
              clear
            </button>
          )}
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
        <span
          className="px-3 py-[5px] rounded-full text-[12px] font-semibold"
          style={{
            background: selected.size > 0 ? 'var(--accent-subtle)' : 'var(--bg-card)',
            color: selected.size > 0 ? 'var(--accent-hover)' : 'var(--text-muted)',
            border: `1px solid ${selected.size > 0 ? 'var(--accent-primary)' : 'var(--border-color)'}`,
          }}
        >
          {selected.size} selected
        </span>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-[11.5px] text-muted hover:text-primary cursor-pointer bg-transparent border-0"
          >
            Clear
          </button>
        )}
      </div>

      <p className="text-[11.5px] text-muted m-0">Only successful traces (2xx) are shown — errored traces aren't useful for benchmarking.</p>

      {/* Two-column body */}
      <div className="grid gap-3 min-h-0" style={{ gridTemplateColumns: 'minmax(0, 1fr) 420px', height: 520 }}>
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
                      onClick={() => { setFocusedId(t.id); onToggle(t.id); }}
                      className="cursor-pointer transition-colors duration-100"
                      style={{
                        padding: '10px 12px',
                        borderLeft: `3px solid ${sel ? 'var(--accent-primary)' : 'transparent'}`,
                        background: sel ? 'var(--accent-subtle)' : 'transparent',
                        borderBottom: '1px solid var(--hairline)',
                        outline: focusedId === t.id && !sel ? '1px solid rgba(255,255,255,0.08)' : 'none',
                        outlineOffset: '-1px',
                      }}
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
                          <span title="Used tools" className="inline-flex items-center" style={{ color: 'var(--accent-primary)' }}>
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
