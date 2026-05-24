import { useState } from 'react';
import type { TestRunDto, TestResultDto } from '../../api/models';
import { ID_SHORT_LEN } from '../../lib/constants';
import { fmtDuration } from '../../lib/format';
import { EVALUATOR_KIND_COLOR } from '../../lib/colors';
import { GridIcon, TableIcon, TargetIcon, ClockIcon, ZapIcon } from '../../components/icons';
import { Card } from '../../components/ui/Card';
import { KpiCard } from '../../components/ui/KpiCard';
import { ColoredBadge } from '../../components/ui/ColoredBadge';
import { DataTable } from '../../components/ui/DataTable';
import type { DataColumn } from '../../components/ui/DataTable';
import {
  resultPass, resultScore, scoreColor, dotColor, passRateColor, passRatePercent, avgLatency, isActive, isErrored,
  type CaseFilter, type ViewMode,
} from './results';
import { Minimap } from './components/Minimap';
import { CaseCard } from './components/CaseCard';
import { SegmentedToggle } from './components/SegmentedToggle';
import { FixtureDrawer } from './drawers';

interface SelectedCase { runId: string; caseId: string; summary: string; idx: number }

export function RunDetail({ run, activeCaseIds }: { run: TestRunDto; activeCaseIds?: Set<string> }) {
  const [selectedCase, setSelectedCase] = useState<SelectedCase | null>(null);

  const passed = run.results.filter(r => resultPass(r) === true).length;
  const failed = run.results.filter(r => resultPass(r) === false).length;
  const passRate = passRatePercent(run.passedCases, run.totalCases) ?? 0;
  const active = isActive(run.status);
  const avg = avgLatency(run);
  const hasResults = run.results.length > 0;

  // Initial filter: "failed" if any failures, else "all". Component is keyed on run.id
  // so this re-initialises whenever the user switches endpoint.
  const [caseFilter, setCaseFilter] = useState<CaseFilter>(() => (failed > 0 ? 'failed' : 'all'));
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

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

  const evalNames = run.evaluators.map(e => e.name).join(', ') || '—';

  return (
    <div className="flex flex-col gap-3">
      {/* KPI band */}
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
        <KpiCard
          icon={<TargetIcon size={15} />}
          label="Pass rate"
          value={hasResults ? `${passRate}%` : '—'}
          valueColor={hasResults ? passRateColor(passRate) : 'var(--text-muted)'}
          sub={`${run.passedCases}/${run.totalCases} cases`}
        />
        <KpiCard
          icon={<ClockIcon size={15} />}
          label={active ? 'Progress' : 'Duration'}
          value={active ? `${run.results.length}/${run.totalCases}` : fmtDuration(run.durationMs ?? 0)}
          sub={active ? 'executing' : 'wall time'}
        />
        <KpiCard
          icon={<ZapIcon size={15} />}
          label="Avg latency"
          value={avg !== null ? fmtDuration(avg) : '—'}
          sub="per case"
        />
      </div>

      {/* Case results explorer */}
      {hasResults && (
        <Card padding="none">
          {/* Overview: minimap + legend */}
          <div className="px-4 pt-3.5 pb-3 border-b border-hairline">
            <div className="flex items-center justify-between mb-2">
              <span className="text-title font-semibold text-secondary">Cases</span>
              <span className="mono text-body-sm">
                <span className="text-success">{passed} passed</span>
                {failed > 0 && <span className="text-muted"> · <span className="text-danger">{failed} failed</span></span>}
              </span>
            </div>
            <Minimap
              run={run}
              activeCaseIds={activeCaseIds}
              selectedCaseId={selectedCase?.caseId ?? null}
              onPick={selectCase}
              size={18}
            />
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-2.5 border-b border-hairline">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-h2 font-semibold">Test case results</span>
              <span className="text-body-sm text-muted truncate">
                Evaluators: <span className="text-secondary">{evalNames}</span>
              </span>
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
            <div className="grid gap-2.5 p-3 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
              {filteredResults.map((r, i) => (
                <CaseCard
                  key={r.id}
                  r={r}
                  isSelected={selectedCase?.caseId === r.testCaseId}
                  onClick={() => selectCase(r, i)}
                />
              ))}
              {caseFilter === 'all' && run.testCases
                .filter(tc => !run.results.some(r => r.testCaseId === tc.id))
                .map(tc => {
                  const running = activeCaseIds?.has(tc.id) ?? false;
                  return (
                    <div
                      key={tc.id}
                      className={`flex flex-col gap-1.5 rounded-md border border-dashed px-3.5 py-3 ${running ? 'border-[color-mix(in_srgb,var(--accent-primary)_38%,transparent)] bg-[color-mix(in_srgb,var(--accent-primary)_5%,transparent)] opacity-85' : 'border-hairline opacity-45'}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${running ? 'pulse-dot bg-accent' : 'bg-[var(--text-muted)]'}`} />
                        <span className="mono text-caption text-muted">{tc.id.slice(0, ID_SHORT_LEN)}</span>
                      </div>
                      <div className={`truncate text-title ${running ? 'text-primary' : 'text-muted'}`}>{tc.summary}</div>
                      <div className={`text-body-sm ${running ? 'text-accent-hover' : 'text-muted'}`}>{running ? 'running…' : 'pending'}</div>
                    </div>
                  );
                })
              }
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
      )}

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
    </div>
  );
}
