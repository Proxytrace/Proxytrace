import { useState } from 'react';
import { Trans, Plural, useLingui } from '@lingui/react/macro';
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
  const { t } = useLingui();
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
        <span className="text-caption font-semibold text-secondary uppercase tracking-[0.08em]">
          <Plural value={cases.length} one="# case" other="# cases" />
          {pendingAddTraces.length > 0 && <span className="text-accent"> <Trans>· +{pendingAddTraces.length} pending</Trans></span>}
        </span>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<PlusIcon size={12} />}
          onClick={onOpenAdd}
          data-testid="suite-add-traces-btn"
        >
          <Trans>Add from traces</Trans>
        </Button>
      </div>

      <Input
        leftAddon={<SearchIcon size={13} />}
        rightAddon={search ? <Button variant="link" className="text-body-sm" onClick={() => setSearch('')}><Trans>clear</Trans></Button> : undefined}
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={t`Search cases…`}
      />

      <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-border bg-card">
        {totalEmpty && (
          <EmptyState
            title={t`No test cases`}
            description={t`Add cases from captured traces to seed this suite.`}
          />
        )}
        {noMatches && <EmptyState title={t`No matches`} description={t`Clear the search to see all cases.`} />}

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
  const { t } = useLingui();
  const snippet = lastUserSnippet(testCase.input).slice(0, 120);
  return (
    <li
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={e => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        'cursor-pointer transition-colors duration-100 px-3 py-2.5 border-l-[3px] border-b border-b-hairline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)]',
        selected ? 'border-l-accent bg-accent-subtle' : 'border-l-transparent',
        removing && 'opacity-55',
      )}
    >
      <div className="flex items-center gap-2">
        <ColoredBadge color="var(--teal)" label={t`${testCase.input.length} msg`} size="sm" />
        <span className={cn('text-body truncate min-w-0 flex-1', removing ? 'line-through text-muted' : 'text-primary')}>
          {snippet || <span className="text-muted italic"><Trans>No user message</Trans></span>}
        </span>
        {removing ? (
          <Button variant="link" className="text-body-sm shrink-0" onClick={e => { e.stopPropagation(); onToggleRemove(); }} title={t`Undo remove`}>
            <Trans>Undo</Trans>
          </Button>
        ) : (
          <IconButton danger className="shrink-0" onClick={e => { e.stopPropagation(); onToggleRemove(); }} aria-label={t`Remove`} title={t`Remove`}>
            <XIcon size={12} />
          </IconButton>
        )}
      </div>
      {removing && (
        <div className="mt-0.5 text-caption text-warn font-semibold uppercase tracking-[0.08em]"><Trans>Pending removal</Trans></div>
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
  const { t } = useLingui();
  const snippet = traceUserSnippet(trace).slice(0, 120);
  return (
    <li
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={e => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        'cursor-pointer transition-colors duration-100 px-3 py-2.5 border-l-[3px] border-b border-b-hairline border-l-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)]',
        selected ? 'bg-accent-subtle' : 'bg-accent-subtle/40',
      )}
    >
      <div className="flex items-center gap-2">
        <ColoredBadge color={modelColor(trace.model)} label={trace.model} dot size="sm" />
        <span className="text-body-sm font-mono text-muted shrink-0">{fmtRelative(trace.createdAt)}</span>
        <span className="text-body-sm font-mono text-secondary shrink-0">{fmtTokens(trace.inputTokens)}→{fmtTokens(trace.outputTokens)}</span>
        <Button variant="link" className="text-body-sm shrink-0 ml-auto" onClick={e => { e.stopPropagation(); onUndo(); }} title={t`Remove from staged`}>
          <Trans>Undo</Trans>
        </Button>
      </div>
      <div className="mt-1.5 flex items-center gap-2 min-w-0">
        <span className="text-caption font-semibold text-accent uppercase tracking-[0.08em] shrink-0"><Trans>+ Pending add</Trans></span>
        <span className="text-body text-secondary truncate min-w-0">
          {snippet || <span className="text-muted italic"><Trans>No user message</Trans></span>}
        </span>
      </div>
    </li>
  );
}
