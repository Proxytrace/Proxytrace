import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import type { EvaluatorDetailDto } from '../../../api/models';
import { EVALUATOR_KIND_COLOR } from '../../../lib/colors';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Switch } from '../../../components/ui/Switch';
import { ColoredBadge } from '../../../components/ui/ColoredBadge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { SearchIcon, LockIcon } from '../../../components/icons';
import { useLicense } from '../../../api/license';

interface Props {
  evaluators: EvaluatorDetailDto[];
  baselineIds: Set<string>;
  stagedIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}

export function EvaluatorsPanel({ evaluators, baselineIds, stagedIds, selectedId, onSelect, onToggle }: Props) {
  const { t } = useLingui();
  const [search, setSearch] = useState('');
  const { data: license } = useLicense();
  // Agentic evaluators require the AgenticEvaluators license feature. Without it, an unattached
  // agentic evaluator can't be attached (locked); an already-attached one stays removable. The
  // backend mirrors this by skipping agentic evaluators during runs on unlicensed installs.
  const agenticGated = !(license?.features ?? []).includes('AgenticEvaluators');

  const q = search.trim().toLowerCase();
  const filtered = q
    ? evaluators.filter(e => e.name.toLowerCase().includes(q) || e.kind.toLowerCase().includes(q))
    : evaluators;

  return (
    <div className="flex flex-col gap-3 min-h-0 h-full">
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-semibold text-muted uppercase tracking-[0.08em]">
          <Trans>{stagedIds.size} of {evaluators.length} attached</Trans>
        </span>
        <DiffSummary baseline={baselineIds} staged={stagedIds} />
      </div>

      <Input
        leftAddon={<SearchIcon size={13} />}
        rightAddon={search ? <Button variant="link" className="text-[11px]" onClick={() => setSearch('')}><Trans>clear</Trans></Button> : undefined}
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={t`Search evaluators…`}
      />

      <div className="flex-1 min-h-0 overflow-y-auto rounded-[12px] border border-border bg-card p-1">
        {evaluators.length === 0 && (
          <EmptyState title={t`No evaluators`} description={t`Create evaluators in the Evaluators tab first.`} />
        )}
        {evaluators.length > 0 && filtered.length === 0 && (
          <EmptyState title={t`No matches`} description={t`Clear the search to see all evaluators.`} />
        )}
        {filtered.length > 0 && (
          <ul className="flex flex-col">
            {filtered.map(e => {
              const c = EVALUATOR_KIND_COLOR[e.kind];
              const staged = stagedIds.has(e.id);
              const wasBaseline = baselineIds.has(e.id);
              const focused = selectedId === e.id;
              // Lock only unattached agentic evaluators on free tier; a staged one stays removable.
              const locked = agenticGated && e.kind === 'Agentic' && !staged;
              const dirtyState =
                staged && !wasBaseline ? 'added'
                : !staged && wasBaseline ? 'removed'
                : null;
              return (
                <li
                  key={e.id}
                  onClick={() => onSelect(e.id)}
                  className={`cursor-pointer transition-colors duration-100 ${locked ? 'opacity-60' : ''}`}
                  style={{
                    padding: '10px 12px',
                    borderLeft: `3px solid ${staged ? 'var(--accent-primary)' : 'transparent'}`,
                    background: focused ? 'rgba(255,255,255,0.025)' : 'transparent',
                    borderBottom: '1px solid var(--hairline)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={staged}
                      disabled={locked}
                      onChange={() => onToggle(e.id)}
                      aria-label={staged ? t`Detach ${e.name}` : t`Attach ${e.name}`}
                      data-testid={`edit-suite-evaluator-toggle-${e.id}`}
                    />
                    <span className="text-[13px] font-medium flex-1 min-w-0 truncate">{e.name}</span>
                    {locked && (
                      <span
                        data-testid={`edit-suite-evaluator-lock-${e.id}`}
                        className="shrink-0 inline-flex items-center text-muted"
                        title={t`Agentic evaluators require a paid plan`}
                      >
                        <LockIcon size={12} />
                      </span>
                    )}
                    {dirtyState === 'added' && (
                      <span className="text-[10px] font-semibold text-accent uppercase tracking-[0.08em] shrink-0"><Trans>+ Added</Trans></span>
                    )}
                    {dirtyState === 'removed' && (
                      <span className="text-[10px] font-semibold text-warn uppercase tracking-[0.08em] shrink-0"><Trans>− Removed</Trans></span>
                    )}
                    <ColoredBadge color={c} label={e.kind} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function DiffSummary({ baseline, staged }: { baseline: Set<string>; staged: Set<string> }) {
  let added = 0;
  let removed = 0;
  staged.forEach(id => { if (!baseline.has(id)) added++; });
  baseline.forEach(id => { if (!staged.has(id)) removed++; });
  if (added === 0 && removed === 0) {
    return <span className="text-[11px] text-muted"><Trans>No changes</Trans></span>;
  }
  return (
    <span className="text-[11px] flex items-center gap-2">
      {added > 0 && <span className="text-accent font-semibold">+{added}</span>}
      {removed > 0 && <span className="text-warn font-semibold">−{removed}</span>}
    </span>
  );
}
