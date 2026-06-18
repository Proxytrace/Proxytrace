import { useState } from 'react';
import type { AgentCallDto, TestCaseDto } from '../../../api/models';
import { Button, IconButton } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { ColoredBadge } from '../../../components/ui/ColoredBadge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { SearchIcon, XIcon, PlusIcon } from '../../../components/icons';
import { fmtRelative, fmtTokens } from '../../../lib/format';
import { modelColor } from '../../../lib/colors';
import { cn } from '../../../lib/cn';

function lastUserSnippet(msgs: { role: string; content: string }[]): string {
  const last = [...msgs].reverse().find(m => m.role === 'user');
  return (last?.content ?? msgs[msgs.length - 1]?.content ?? '').replace(/\s+/g, ' ').trim();
}

function traceUserSnippet(t: AgentCallDto): string {
  return (t.request.find(m => m.role === 'user')?.content ?? '').replace(/\s+/g, ' ').trim();
}

interface Props {
  cases: TestCaseDto[];
  /** Traces staged to become cases (resolved objects) — shown as pending-add rows until Save. */
  pendingAddTraces: AgentCallDto[];
  pendingRemoveCaseIds: Set<string>;
  selectedCaseId: string | null;
  selectedTraceId: string | null;
  onSelectCase: (id: string) => void;
  onSelectTrace: (id: string) => void;
  onToggleRemove: (id: string) => void;
  onUnstageAdd: (id: string) => void;
  onOpenAdd: () => void;
}

export function TestCasesPanel({
  cases,
  pendingAddTraces,
  pendingRemoveCaseIds,
  selectedCaseId,
  selectedTraceId,
  onSelectCase,
  onSelectTrace,
  onToggleRemove,
  onUnstageAdd,
  onOpenAdd,
}: Props) {
  const [search, setSearch] = useState('');

  const q = search.trim().toLowerCase();
  const filteredCases = q
    ? cases.filter(tc => lastUserSnippet(tc.input).toLowerCase().includes(q))
    : cases;
  const filteredAdds = q
    ? pendingAddTraces.filter(t => traceUserSnippet(t).toLowerCase().includes(q) || t.model.toLowerCase().includes(q))
    : pendingAddTraces;

  const totalEmpty = cases.length === 0 && pendingAddTraces.length === 0;
  const noMatches = !totalEmpty && filteredCases.length === 0 && filteredAdds.length === 0 && !!q;

  return (
    <div className="flex flex-col gap-3 min-h-0 h-full">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10.5px] font-semibold text-muted uppercase tracking-[0.08em]">
          {cases.length} case{cases.length !== 1 ? 's' : ''}
          {pendingAddTraces.length > 0 && <span className="text-accent"> · +{pendingAddTraces.length} pending</span>}
        </span>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<PlusIcon size={12} />}
          onClick={onOpenAdd}
          data-testid="suite-add-traces-btn"
        >
          Add from traces
        </Button>
      </div>

      <Input
        leftAddon={<SearchIcon size={13} />}
        rightAddon={search ? <Button variant="link" className="text-[11px]" onClick={() => setSearch('')}>clear</Button> : undefined}
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search cases…"
      />

      <div className="flex-1 min-h-0 overflow-y-auto rounded-[12px] border border-border bg-card">
        {totalEmpty && (
          <EmptyState
            title="No test cases"
            description="Add cases from captured traces to seed this suite."
          />
        )}
        {noMatches && <EmptyState title="No matches" description="Clear the search to see all cases." />}

        {!totalEmpty && !noMatches && (
          <ul className="flex flex-col">
            {filteredAdds.map(t => (
              <AddedTraceRow
                key={`add-${t.id}`}
                trace={t}
                selected={selectedTraceId === t.id}
                onSelect={() => onSelectTrace(t.id)}
                onUndo={() => onUnstageAdd(t.id)}
              />
            ))}
            {filteredCases.map(tc => (
              <CaseRow
                key={tc.id}
                testCase={tc}
                removing={pendingRemoveCaseIds.has(tc.id)}
                selected={selectedCaseId === tc.id}
                onSelect={() => onSelectCase(tc.id)}
                onToggleRemove={() => onToggleRemove(tc.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CaseRow({
  testCase, removing, selected, onSelect, onToggleRemove,
}: {
  testCase: TestCaseDto;
  removing: boolean;
  selected: boolean;
  onSelect: () => void;
  onToggleRemove: () => void;
}) {
  const snippet = lastUserSnippet(testCase.input).slice(0, 120);
  return (
    <li
      onClick={onSelect}
      className={cn(
        'cursor-pointer transition-colors duration-100 px-3 py-2.5 border-l-[3px] border-b border-b-hairline',
        selected ? 'border-l-accent bg-accent-subtle' : 'border-l-transparent',
        removing && 'opacity-55',
      )}
    >
      <div className="flex items-center gap-2">
        <ColoredBadge color="var(--teal)" label={`${testCase.input.length} msg`} size="sm" />
        <span className={cn('text-[12.5px] truncate min-w-0 flex-1', removing ? 'line-through text-muted' : 'text-primary')}>
          {snippet || <span className="text-muted italic">No user message</span>}
        </span>
        {removing ? (
          <Button variant="link" className="text-[11px] shrink-0" onClick={e => { e.stopPropagation(); onToggleRemove(); }} title="Undo remove">
            Undo
          </Button>
        ) : (
          <IconButton danger className="shrink-0" onClick={e => { e.stopPropagation(); onToggleRemove(); }} aria-label="Remove" title="Remove">
            <XIcon size={12} />
          </IconButton>
        )}
      </div>
      {removing && (
        <div className="mt-[3px] text-[10.5px] text-warn font-semibold uppercase tracking-[0.08em]">Pending removal</div>
      )}
    </li>
  );
}

function AddedTraceRow({
  trace, selected, onSelect, onUndo,
}: {
  trace: AgentCallDto;
  selected: boolean;
  onSelect: () => void;
  onUndo: () => void;
}) {
  const snippet = traceUserSnippet(trace).slice(0, 120);
  return (
    <li
      onClick={onSelect}
      className={cn(
        'cursor-pointer transition-colors duration-100 px-3 py-2.5 border-l-[3px] border-b border-b-hairline border-l-accent',
        selected ? 'bg-accent-subtle' : 'bg-accent-subtle/40',
      )}
    >
      <div className="flex items-center gap-2">
        <ColoredBadge color={modelColor(trace.model)} label={trace.model} dot size="sm" />
        <span className="text-[11px] font-mono text-muted shrink-0">{fmtRelative(trace.createdAt)}</span>
        <span className="text-[11px] font-mono text-secondary shrink-0">{fmtTokens(trace.inputTokens)}→{fmtTokens(trace.outputTokens)}</span>
        <Button variant="link" className="text-[11px] shrink-0 ml-auto" onClick={e => { e.stopPropagation(); onUndo(); }} title="Remove from staged">
          Undo
        </Button>
      </div>
      <div className="mt-[5px] flex items-center gap-2 min-w-0">
        <span className="text-[10px] font-semibold text-accent uppercase tracking-[0.08em] shrink-0">+ Pending add</span>
        <span className="text-[12px] text-secondary truncate min-w-0">
          {snippet || <span className="text-muted italic">No user message</span>}
        </span>
      </div>
    </li>
  );
}
