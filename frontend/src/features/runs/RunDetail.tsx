import { useState } from 'react';
import type { TestRunDto, TestResultDto } from '../../api/models';
import { fmtDuration } from '../../lib/format';
import { EVALUATOR_KIND_COLOR } from '../../lib/colors';
import { GridIcon, TableIcon } from '../../components/icons';
import { Card } from '../../components/ui/Card';
import { ColoredBadge } from '../../components/ui/ColoredBadge';
import { DataTable } from '../../components/ui/DataTable';
import type { DataColumn } from '../../components/ui/DataTable';
import {
  resultPass, resultScore, scoreColor, dotColor, isErrored,
  type CaseFilter, type ViewMode,
} from './results';
import { CaseTile, PendingTile } from './components/CaseTile';
import { CaseDotLegend } from './components/CaseDotLegend';
import { SegmentedToggle } from './components/SegmentedToggle';
import { FixtureDrawer } from './drawers';

interface SelectedCase { runId: string; caseId: string; summary: string; idx: number }

/** Single-model run body: just the case-results explorer. Headline metrics live in the group header. */
export function RunDetail({ run, activeCaseIds }: { run: TestRunDto; activeCaseIds?: Set<string> }) {
  const [selectedCase, setSelectedCase] = useState<SelectedCase | null>(null);
  // Filter defaults to "all". Component is keyed on run.id so this re-initialises per run.
  const [caseFilter, setCaseFilter] = useState<CaseFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const passed = run.results.filter(r => resultPass(r) === true).length;
  const failed = run.results.filter(r => resultPass(r) === false).length;
  const pending = run.testCases.filter(tc => !run.results.some(r => r.testCaseId === tc.id));
  const hasContent = run.results.length > 0 || run.testCases.length > 0;

  const filteredResults = run.results.filter(r => {
    if (caseFilter === 'all') return true;
    const pass = resultPass(r);
    if (caseFilter === 'passed') return pass === true;
    if (caseFilter === 'failed') return pass === false;
    return true;
  });

  const selectCase = (r: TestResultDto, idx: number) =>
    setSelectedCase(selectedCase?.caseId === r.testCaseId ? null : { runId: run.id, caseId: r.testCaseId, summary: r.testCaseSummary, idx });

  const tableColumns: DataColumn<TestResultDto>[] = [
    {
      key: 'dot', label: '', width: '20px',
      render: r => <span className="inline-block w-2 h-2 rounded-full" style={{ background: dotColor(resultPass(r)) }} />,
    },
    {
      key: 'case', label: 'Test case', width: '2fr',
      render: r => <span className="block truncate pr-3 text-body font-medium">{r.testCaseSummary}</span>,
    },
    {
      key: 'evaluator', label: 'Evaluator', width: '1fr',
      render: r => {
        const primary = r.evaluations[0];
        const c = primary ? (EVALUATOR_KIND_COLOR[primary.evaluatorKind] ?? 'var(--text-muted)') : null;
        return c ? <ColoredBadge color={c} label={primary.evaluatorName} shape="rounded" /> : <span />;
      },
    },
    {
      key: 'score', label: 'Score', width: '0.8fr',
      render: r => {
        const score = resultScore(r);
        return <span className="mono text-body font-bold" style={{ color: scoreColor(score) }}>{score !== null ? score.toFixed(2) : '—'}</span>;
      },
    },
    {
      key: 'latency', label: 'Latency', width: '0.7fr',
      render: r => <span className="mono text-body-sm text-muted">{fmtDuration(r.durationMs)}</span>,
    },
    {
      key: 'note', label: 'Note', width: '1.4fr',
      render: r => {
        const pass = resultPass(r);
        const errored = r.evaluations.find(isErrored);
        const note = errored ? (errored.errorMessage ?? '') : (r.evaluations.find(e => e.reasoning)?.reasoning ?? '');
        const color = errored ? 'var(--warn)' : (pass ? 'var(--text-muted)' : 'var(--danger)');
        return <span className="block truncate text-body-sm" style={{ color }}>{note}</span>;
      },
    },
  ];

  if (!hasContent) return null;

  return (
    <>
      <Card padding="none">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-2.5 border-b border-hairline">
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
            <span className="text-h2 font-semibold">Results</span>
            <CaseDotLegend evaluators={run.evaluators} />
          </div>
          <div className="flex items-center gap-1.5">
            <SegmentedToggle
              value={caseFilter}
              onChange={setCaseFilter}
              segments={[
                { value: 'all', label: 'All', count: run.results.length },
                { value: 'passed', label: 'Passed', count: passed },
                { value: 'failed', label: 'Failed', count: failed },
              ]}
            />
            <SegmentedToggle
              value={viewMode}
              onChange={setViewMode}
              segments={[
                { value: 'grid', icon: <GridIcon size={13} />, ariaLabel: 'Grid view' },
                { value: 'table', icon: <TableIcon size={13} />, ariaLabel: 'Table view' },
              ]}
            />
          </div>
        </div>

        {/* Grid view */}
        {viewMode === 'grid' && (
          <div className="grid gap-1.5 p-3 grid-cols-[repeat(auto-fill,minmax(72px,1fr))]">
            {filteredResults.map((r, i) => (
              <CaseTile
                key={r.id}
                r={r}
                isSelected={selectedCase?.caseId === r.testCaseId}
                onClick={() => selectCase(r, i)}
              />
            ))}
            {caseFilter === 'all' && pending.map(tc => (
              <PendingTile key={tc.id} summary={tc.summary} caseId={tc.id} running={activeCaseIds?.has(tc.id) ?? false} />
            ))}
          </div>
        )}

        {/* Table view */}
        {viewMode === 'table' && (
          <DataTable
            columns={tableColumns}
            rows={filteredResults}
            rowKey={r => r.id}
            onRowClick={(r, i) => selectCase(r, i)}
            isSelected={r => selectedCase?.caseId === r.testCaseId}
          />
        )}
      </Card>

      {selectedCase && (
        <FixtureDrawer
          runId={selectedCase.runId}
          caseId={selectedCase.caseId}
          caseIdx={selectedCase.idx}
          total={run.results.length}
          caseSummary={selectedCase.summary}
          onClose={() => setSelectedCase(null)}
          onPrev={selectedCase.idx > 0 ? () => {
            const prev = run.results[selectedCase.idx - 1];
            if (prev) setSelectedCase({ runId: run.id, caseId: prev.testCaseId, summary: prev.testCaseSummary, idx: selectedCase.idx - 1 });
          } : undefined}
          onNext={selectedCase.idx < run.results.length - 1 ? () => {
            const next = run.results[selectedCase.idx + 1];
            if (next) setSelectedCase({ runId: run.id, caseId: next.testCaseId, summary: next.testCaseSummary, idx: selectedCase.idx + 1 });
          } : undefined}
        />
      )}
    </>
  );
}
