import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { evaluatorsApi } from '../../api/evaluators';
import { testSuitesApi } from '../../api/test-suites';
import { statisticsApi } from '../../api/statistics';
import { QUERY_KEYS } from '../../api/query-keys';
import useCurrentProject from '../../hooks/useCurrentProject';
import {
  EvaluatorKind,
  EvaluationScore,
  type CreateEvaluatorPayload,
  type EvaluatorDetailDto,
  type EvaluatorOverviewDto,
  type EvaluatorScoreBucketDto,
} from '../../api/models';
import { Modal, ModalFooter } from '../../components/overlays/Modal';
import { fmtRelative, fmtPct, fmtTokens, fmtLatency } from '../../lib/format';
import { rangeFrom, bucketFor, type RangeKey } from '../../lib/time-range';
import { Sparkline, AreaChart } from '../../components/charts';
import { SkeletonList } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { EvaluatorForm } from './EvaluatorForm';
import { META, KIND_ORDER, initForm, type EvaluatorFormState } from './evaluators';

// ── Type categories ──────────────────────────────────────────────────────────

type TypeCategory = 'llm' | 'rule' | 'numeric';
type TypeFilter = 'all' | TypeCategory;

const KIND_CATEGORY: Record<EvaluatorKind, TypeCategory> = {
  [EvaluatorKind.Agentic]: 'llm',
  [EvaluatorKind.ExactMatch]: 'rule',
  [EvaluatorKind.JsonSchemaMatch]: 'rule',
  [EvaluatorKind.NumericMatch]: 'numeric',
};

const TYPE_META: Record<TypeCategory, { label: string; short: string; color: string }> = {
  llm:     { label: 'LLM-as-judge',    short: 'LLM judge', color: 'var(--accent-primary)' },
  rule:    { label: 'Rule-based',      short: 'Rule',      color: 'var(--teal)' },
  numeric: { label: 'Numeric extract', short: 'Numeric',   color: 'var(--teal)' },
};

// Distinct hex per category for color-mix and dynamic backgrounds
const TYPE_HEX: Record<TypeCategory, string> = {
  llm: 'var(--accent-primary)',
  rule: 'var(--teal)',
  numeric: 'var(--teal)',
};

const SCORE_ORDER: EvaluationScore[] = [
  EvaluationScore.Terrible,
  EvaluationScore.Bad,
  EvaluationScore.Acceptable,
  EvaluationScore.Good,
  EvaluationScore.Excellent,
];

const SCORE_LABEL: Record<EvaluationScore, string> = {
  [EvaluationScore.Terrible]: 'Terrible',
  [EvaluationScore.Bad]: 'Bad',
  [EvaluationScore.Acceptable]: 'Acceptable',
  [EvaluationScore.Good]: 'Good',
  [EvaluationScore.Excellent]: 'Excellent',
};

// ── Inline SVG icons ─────────────────────────────────────────────────────────

function BeakerIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6M8 3v8l-4 9h16l-4-9V3"/><path d="M6 17h12"/>
    </svg>
  );
}
function FilterIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>
  );
}
function HashIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/>
      <line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>
    </svg>
  );
}
function CopyIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  );
}
function CheckboxIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  );
}
function PlusIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}
function PlayIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="6 4 20 12 6 20 6 4" fill="currentColor"/>
    </svg>
  );
}
function EditPencilIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}
function SearchIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}
function ArrowUpRightIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
    </svg>
  );
}
function ActivityIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  );
}

function CategoryIcon({ category, size = 14 }: { category: TypeCategory; size?: number }) {
  return category === 'llm' ? <BeakerIcon size={size}/> : category === 'rule' ? <FilterIcon size={size}/> : <HashIcon size={size}/>;
}

function TypeIconBox({ category, size = 14 }: { category: TypeCategory; size?: number }) {
  const m = TYPE_META[category];
  const box = size + 14;
  return (
    <span style={{
      width: box, height: box, borderRadius: 'var(--radius-md)',
      background: `color-mix(in srgb, ${m.color} 14%, transparent)`, color: m.color,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <CategoryIcon category={category} size={size}/>
    </span>
  );
}

// ── Format helpers ───────────────────────────────────────────────────────────

function fmtScoreShort(v: number | null | undefined, kind: EvaluatorKind): string {
  if (v == null) return '—';
  if (kind === EvaluatorKind.Agentic) return v.toFixed(2);
  return fmtPct(v);
}

// ── Left rail row ────────────────────────────────────────────────────────────

interface RailRow {
  evaluator: EvaluatorDetailDto;
  isSelected: boolean;
  onSelect: (id: string) => void;
  sparkline?: number[];
  avgScore?: number | null;
}

function EvaluatorRow({ evaluator: e, isSelected, onSelect, sparkline, avgScore }: RailRow) {
  const cat = KIND_CATEGORY[e.kind];
  const m = TYPE_META[cat];
  const hex = TYPE_HEX[cat];
  return (
    <button
      onClick={() => onSelect(e.id)}
      style={{
        textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 10px',
        borderRadius: 9,
        background: isSelected ? `color-mix(in srgb, ${hex} 12%, transparent)` : 'transparent',
        boxShadow: isSelected ? `inset 0 0 0 1px color-mix(in srgb, ${hex} 35%, transparent)` : 'none',
        cursor: 'pointer',
        transition: 'background 0.12s',
        width: '100%',
        border: 'none',
      }}
      onMouseEnter={ev => { if (!isSelected) ev.currentTarget.style.background = 'var(--bg-card-2)'; }}
      onMouseLeave={ev => { if (!isSelected) ev.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{
        width: 3, alignSelf: 'stretch', borderRadius: 100,
        background: isSelected ? m.color : 'transparent', flexShrink: 0,
      }}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="pulse-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }}/>
          <span style={{
            fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{e.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
          <span style={{ color: avgScore == null ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
            {fmtScoreShort(avgScore ?? null, e.kind)}
          </span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{fmtRelative(e.updatedAt)}</span>
        </div>
      </div>
      {sparkline && sparkline.length >= 2 && (
        <Sparkline data={sparkline} color={m.color} width={42} height={16} strokeWidth={1.3} />
      )}
    </button>
  );
}

// ── Left rail ────────────────────────────────────────────────────────────────

interface RailProps {
  evaluators: EvaluatorDetailDto[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  sparklineById: Map<string, number[]>;
  avgScoreById: Map<string, number | null>;
}

function EvalRail({ evaluators, isLoading, selectedId, onSelect, onNew, sparklineById, avgScoreById }: RailProps) {
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const filtered = evaluators.filter(e => {
    if (typeFilter !== 'all' && KIND_CATEGORY[e.kind] !== typeFilter) return false;
    if (q && !e.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const groups: { type: TypeCategory; items: EvaluatorDetailDto[] }[] = (['llm', 'rule', 'numeric'] as TypeCategory[])
    .map(type => ({ type, items: filtered.filter(e => KIND_CATEGORY[e.kind] === type) }))
    .filter(g => g.items.length > 0);

  const typeFilterOptions: { key: TypeFilter; label: string; color: string | null }[] = [
    { key: 'all', label: 'All', color: null },
    { key: 'llm', label: 'LLM', color: TYPE_HEX.llm },
    { key: 'rule', label: 'Rule', color: TYPE_HEX.rule },
    { key: 'numeric', label: 'Num', color: TYPE_HEX.numeric },
  ];

  return (
    <aside style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
      display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--hairline)', display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.015em' }}>Evaluators</span>
          <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{evaluators.length}</span>
        </div>
        <button
          onClick={onNew}
          data-write
          style={{
            width: '100%', padding: '8px 12px',
            background: 'var(--grad-accent)',
            borderRadius: 'var(--radius-md)', fontSize: 12.5, fontWeight: 600, color: '#fff',
            boxShadow: 'var(--shadow-btn)',
            border: 'none',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer',
          }}
        >
          <PlusIcon size={12}/> New evaluator
        </button>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '6px 9px',
          background: 'var(--bg-card-2)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-muted)',
        }}>
          <SearchIcon size={12}/>
          <input
            value={q}
            onChange={ev => setQ(ev.target.value)}
            placeholder="Search…"
            style={{
              flex: 1, minWidth: 0,
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: 12,
            }}
          />
        </div>
      </div>

      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--hairline)' }}>
        <div style={{ display: 'flex', gap: 3 }}>
          {typeFilterOptions.map(opt => {
            const active = typeFilter === opt.key;
            const count = opt.key === 'all'
              ? evaluators.length
              : evaluators.filter(e => KIND_CATEGORY[e.kind] === opt.key).length;
            return (
              <button
                key={opt.key}
                onClick={() => setTypeFilter(opt.key)}
                style={{
                  flex: 1,
                  padding: '5px 6px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  background: active ? 'var(--bg-card-2)' : 'transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {opt.color && <span style={{ width: 5, height: 5, borderRadius: 1, background: opt.color, opacity: active ? 1 : 0.5 }}/>}
                {opt.label}
                <span style={{
                  padding: '0 5px', borderRadius: 100, fontSize: 9.5,
                  fontFamily: 'JetBrains Mono, monospace', fontWeight: 600,
                  background: active ? 'var(--accent-subtle)' : 'transparent',
                  color: active ? 'var(--accent-hover)' : 'var(--text-muted)',
                }}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isLoading ? (
          <SkeletonList rows={6} height={48} gap={4} />
        ) : groups.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            {evaluators.length === 0 ? 'No evaluators yet.' : 'No matches.'}
          </div>
        ) : (
          groups.map(g => (
            <div key={g.type} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px', marginBottom: 2 }}>
                <span style={{ width: 5, height: 5, borderRadius: 1, background: TYPE_HEX[g.type] }}/>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 600 }}>
                  {TYPE_META[g.type].short}
                </span>
                <span style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', marginLeft: 'auto' }}>
                  {g.items.length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {g.items.map(e => (
                  <EvaluatorRow
                    key={e.id}
                    evaluator={e}
                    isSelected={e.id === selectedId}
                    onSelect={onSelect}
                    sparkline={sparklineById.get(e.id)}
                    avgScore={avgScoreById.get(e.id) ?? null}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

// ── Workspace header (sticky) ────────────────────────────────────────────────

function WorkspaceHeader({ evaluator: e, onEdit, onDelete, onTestBench }: {
  evaluator: EvaluatorDetailDto;
  onEdit: () => void;
  onDelete: () => void;
  onTestBench: () => void;
}) {
  const cat = KIND_CATEGORY[e.kind];
  const m = TYPE_META[cat];
  const hex = TYPE_HEX[cat];
  return (
    <header style={{
      background: `linear-gradient(135deg, color-mix(in srgb, ${hex} 12%, transparent), transparent 60%), var(--bg-card)`,
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{
        padding: '14px 18px',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <TypeIconBox category={cat} size={18}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>{e.name}</h1>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 100,
              background: 'var(--success-subtle)', color: 'var(--success)',
              fontSize: 10.5, fontWeight: 600,
            }}>
              <span className="pulse-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success)' }}/>
              Active
            </span>
            <span style={{
              padding: '3px 9px', borderRadius: 5,
              background: `color-mix(in srgb, ${hex} 14%, transparent)`, color: m.color,
              fontSize: 10.5, fontWeight: 600,
            }}>{m.label}</span>
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 5, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap', fontFamily: 'JetBrains Mono, monospace' }}>
            <span><span style={{ opacity: 0.7 }}>id</span> {e.id.slice(0, 12)}…</span>
            <span><span style={{ opacity: 0.7 }}>kind</span> {e.kind}</span>
            {e.endpointName && <span><span style={{ opacity: 0.7 }}>model</span> {e.endpointName}</span>}
            <span>
              <span style={{ opacity: 0.7 }}>updated</span>{' '}
              <span style={{ fontFamily: 'Inter, sans-serif' }}>{fmtRelative(e.updatedAt)}</span>
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={onTestBench}
            style={{
              padding: '8px 12px', borderRadius: 'var(--radius-md)', fontSize: 12,
              color: 'var(--text-primary)',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              border: '1px solid var(--border-subtle)', background: 'var(--bg-card-2)',
              cursor: 'pointer',
            }}
          >
            <PlayIcon size={11}/> Test
          </button>
          <button
            onClick={onDelete}
            data-write
            style={{
              padding: '8px 12px', borderRadius: 'var(--radius-md)', fontSize: 12,
              color: 'var(--danger)',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              border: '1px solid color-mix(in srgb, var(--danger) 22%, transparent)',
              background: 'var(--danger-subtle)',
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
          <button
            onClick={onEdit}
            data-write
            style={{
              padding: '8px 14px', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 600,
              color: '#fff', background: 'var(--grad-accent)',
              boxShadow: 'var(--shadow-btn)',
              border: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            }}
          >
            <EditPencilIcon size={11}/> Edit
          </button>
        </div>
      </div>
    </header>
  );
}

// ── Performance panel ────────────────────────────────────────────────────────

function PerformancePanel({ evaluator: e, overview, range, onRangeChange, color }: {
  evaluator: EvaluatorDetailDto;
  overview: EvaluatorOverviewDto | null;
  range: RangeKey;
  onRangeChange: (r: RangeKey) => void;
  color: string;
}) {
  const summary = overview?.summary;
  const passSeries = useMemo(
    () => (overview?.passRateTrend ?? []).map(p => (p.total > 0 ? p.passed / p.total : 0)),
    [overview?.passRateTrend],
  );
  const hasTrend = passSeries.length >= 2;

  const ranges: RangeKey[] = ['1h', '24h', '7d', '30d'];

  return (
    <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 600 }}>
          Performance
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
          {(summary?.totalEvaluations ?? 0).toLocaleString()} runs · {range}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, padding: 3, background: 'var(--bg-card-2)', borderRadius: 'var(--radius-md)' }}>
          {ranges.map(r => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              aria-pressed={range === r}
              style={{
                padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                background: range === r ? 'var(--bg-card)' : 'transparent',
                color: range === r ? 'var(--text-primary)' : 'var(--text-muted)',
                border: 'none',
                fontFamily: 'JetBrains Mono, monospace',
                boxShadow: range === r ? '0 1px 0 rgba(255,255,255,0.04) inset, 0 1px 2px rgba(0,0,0,0.25)' : 'none',
                cursor: 'pointer',
              }}
            >{r}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid var(--hairline)' }}>
        <StatCell
          label={e.kind === EvaluatorKind.Agentic ? 'Avg score' : 'Pass rate'}
          value={e.kind === EvaluatorKind.Agentic
            ? (summary?.avgScore != null ? summary.avgScore.toFixed(2) : '—')
            : (summary?.overallPassRate != null ? fmtPct(summary.overallPassRate) : '—')}
          sub="vs prev period"
          color={color}
          big
        />
        <StatCell label="Evaluations" value={(summary?.totalEvaluations ?? 0).toLocaleString()} sub="executed" color="var(--text-primary)"/>
        <StatCell label="Pass rate" value={summary?.overallPassRate != null ? fmtPct(summary.overallPassRate) : '—'} sub="score ≥ acceptable" color="var(--success)"/>
        <StatCell label="Avg latency" value={summary?.avgLatencyMs != null ? fmtLatency(summary.avgLatencyMs) : '—'} sub="per evaluation" color="var(--teal)" last/>
      </div>

      <div style={{ padding: '14px 18px 14px' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8 }}>
          Pass rate trend
        </div>
        {hasTrend ? (
          <AreaChart
            data={passSeries}
            width={860}
            height={130}
            color={color}
            gradientId={`evalTrend-${e.id.slice(0, 8)}`}
            showAxis={false}
            showEndMarker
            formatValue={v => fmtPct(v)}
            tooltipLabelFn={i => new Date((overview?.passRateTrend ?? [])[i]?.bucketStart ?? '').toLocaleDateString()}
          />
        ) : (
          <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 11.5 }}>
            Not enough data
          </div>
        )}
      </div>
    </section>
  );
}

function StatCell({ label, value, sub, color, big = false, last = false }: {
  label: string; value: string; sub: string; color: string; big?: boolean; last?: boolean;
}) {
  return (
    <div style={{
      padding: '16px 18px',
      borderRight: last ? 'none' : '1px solid var(--hairline)',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{label}</div>
      <div style={{
        fontSize: big ? 26 : 20, fontWeight: 700,
        fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.03em', color, lineHeight: 1.1,
      }}>{value}</div>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{sub}</div>
    </div>
  );
}

// ── Definition panel ─────────────────────────────────────────────────────────

function DefinitionPanel({ evaluator: e, onEdit }: { evaluator: EvaluatorDetailDto; onEdit: () => void }) {
  const cat = KIND_CATEGORY[e.kind];
  const m = TYPE_META[cat];
  const hex = TYPE_HEX[cat];

  let body: React.ReactNode;
  let vars: string[] = [];

  if (e.systemMessage) {
    vars = Array.from(new Set(e.systemMessage.match(/\{\{[a-z_]+\}\}/gi) ?? []));
    body = <NumberedCode text={e.systemMessage} color={m.color} highlightVars/>;
  } else if (e.jsonSchema) {
    body = <NumberedCode text={e.jsonSchema} color={m.color}/>;
  } else if (e.extractionPattern || e.tolerance != null) {
    body = (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {e.extractionPattern && (
          <div style={{ padding: '12px 14px', background: 'var(--bg-card-2)', borderRadius: 'var(--radius-md)', gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>extract pattern</div>
            <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--teal)' }}>/{e.extractionPattern}/</code>
          </div>
        )}
        {e.tolerance != null && (
          <div style={{ padding: '12px 14px', background: 'var(--bg-card-2)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>tolerance</div>
            <div style={{ fontSize: 12.5, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>± {e.tolerance}</div>
          </div>
        )}
      </div>
    );
  } else {
    body = (
      <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
        Preset configuration — no user-defined settings.
      </div>
    );
  }

  return (
    <section style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
      display: 'flex', flexDirection: 'column', minWidth: 0,
    }}>
      <header style={{ padding: '12px 16px', borderBottom: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 600 }}>
          Definition
        </span>
        <span style={{
          padding: '2px 8px', borderRadius: 4,
          background: `color-mix(in srgb, ${hex} 14%, transparent)`, color: m.color,
          fontSize: 10.5, fontWeight: 600,
        }}>{e.kind}</span>
        {e.endpointName && (
          <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
            · {e.endpointName}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {e.systemMessage && (
            <button
              onClick={() => navigator.clipboard.writeText(e.systemMessage!)}
              style={{
                padding: '5px 9px', borderRadius: 6, fontSize: 11,
                color: 'var(--text-secondary)', background: 'transparent', border: 'none',
                display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer',
              }}
            >
              <CopyIcon size={11}/> Copy
            </button>
          )}
          <button
            onClick={onEdit}
            data-write
            style={{
              padding: '5px 11px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              color: m.color, background: `color-mix(in srgb, ${hex} 18%, transparent)`,
              border: 'none', cursor: 'pointer',
            }}
          >Edit</button>
        </div>
      </header>
      <div style={{ padding: '14px 18px', maxHeight: 460, overflow: 'auto', flex: 1 }}>{body}</div>
      {vars.length > 0 && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: 'var(--text-muted)' }}>
          <span style={{ textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>variables</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {vars.map(v => (
              <span key={v} style={{
                padding: '2px 7px', borderRadius: 4,
                background: `color-mix(in srgb, ${hex} 18%, transparent)`, color: m.color,
                fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5,
              }}>{v}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function NumberedCode({ text, color, highlightVars = false }: { text: string; color: string; highlightVars?: boolean }) {
  const lines = text.split('\n');
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '36px 1fr', gap: 0,
      fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, lineHeight: 1.65,
    }}>
      {lines.map((ln, i) => (
        <div key={i} style={{ display: 'contents' }}>
          <span style={{ color: 'var(--text-muted)', textAlign: 'right', paddingRight: 12, fontSize: 10, opacity: 0.55, userSelect: 'none' }}>{i + 1}</span>
          <span style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {highlightVars
              ? ln.split(/(\{\{[a-z_]+\}\})/gi).map((part, j) =>
                  /\{\{[a-z_]+\}\}/i.test(part)
                    ? <span key={j} style={{
                        background: `color-mix(in srgb, ${color} 22%, transparent)`,
                        color, padding: '0 4px', borderRadius: 3,
                      }}>{part}</span>
                    : <span key={j}>{part}</span>,
                )
              : (ln || ' ')}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Score distribution panel ─────────────────────────────────────────────────

function ScoreDistributionPanel({ buckets, color, totalRuns, range }: {
  buckets: EvaluatorScoreBucketDto[];
  color: string;
  totalRuns: number;
  range: RangeKey;
}) {
  const byScore = new Map(buckets.map(b => [b.score, b.count]));
  const data = SCORE_ORDER.map(s => ({ score: s, label: SCORE_LABEL[s], count: byScore.get(s) ?? 0 }));
  const total = data.reduce((a, b) => a + b.count, 0);
  const max = Math.max(...data.map(d => d.count), 1);
  const empty = total === 0;

  return (
    <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)' }}>
      <header style={{ padding: '12px 16px', borderBottom: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 600 }}>
          Score distribution
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {range} · {totalRuns.toLocaleString()} runs
        </span>
      </header>
      <div style={{ padding: '16px 18px' }}>
        {empty ? (
          <div style={{ height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 11.5, border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
            No data in range
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {data.map((d, i) => {
              const pct = total > 0 ? (d.count / total) * 100 : 0;
              const w = Math.max(2, (d.count / max) * 100);
              const intensity = 0.45 + (i / Math.max(1, data.length - 1)) * 0.55;
              return (
                <div key={d.score} style={{
                  display: 'grid', gridTemplateColumns: '90px 1fr 52px',
                  alignItems: 'center', gap: 10, fontSize: 11,
                }}>
                  <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
                  <div style={{ height: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      width: w + '%', height: '100%',
                      background: color, opacity: intensity, borderRadius: 4,
                      transition: 'width 0.3s var(--ease-standard, ease)',
                    }}/>
                  </div>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)', textAlign: 'right', fontSize: 10.5 }}>
                    {pct.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// ── LLM judge cost panel ─────────────────────────────────────────────────────

function fmtEur(v: number | null | undefined): string {
  if (v == null) return '—';
  if (v < 0.01) return '<€0.01';
  return `€${v.toFixed(2)}`;
}

function CostPanel({ overview, color, modelName, range }: {
  overview: EvaluatorOverviewDto | null;
  color: string;
  modelName: string | null;
  range: RangeKey;
}) {
  const s = overview?.summary;
  return (
    <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)' }}>
      <header style={{ padding: '12px 16px', borderBottom: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 600 }}>
          LLM judge cost
        </span>
        {modelName && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>· {modelName}</span>
        )}
      </header>
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{
            fontSize: 26, fontWeight: 700,
            fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.03em', color,
          }}>{fmtEur(s?.totalCost ?? null)}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>past {range}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          <div style={{ padding: '10px 12px', background: 'var(--bg-card-2)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
              Input tokens
            </div>
            <div style={{ fontSize: 14, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)', fontWeight: 600 }}>
              {s?.inputTokens != null ? fmtTokens(s.inputTokens) : '—'}
            </div>
          </div>
          <div style={{ padding: '10px 12px', background: 'var(--bg-card-2)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
              Output tokens
            </div>
            <div style={{ fontSize: 14, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)', fontWeight: 600 }}>
              {s?.outputTokens != null ? fmtTokens(s.outputTokens) : '—'}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Reduce by trimming the rubric or sampling test cases.
        </div>
      </div>
    </section>
  );
}

// ── Attached panel ───────────────────────────────────────────────────────────

function AttachedPanel({ suites, agentNames }: {
  suites: { id: string; name: string; agentName: string }[];
  agentNames: string[];
}) {
  return (
    <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)' }}>
      <header style={{ padding: '12px 16px', borderBottom: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 600 }}>
          Attached to
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {suites.length} suite{suites.length !== 1 ? 's' : ''} · {agentNames.length} agent{agentNames.length !== 1 ? 's' : ''}
        </span>
      </header>
      <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: 8 }}>
            Test suites
          </div>
          {suites.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {suites.map(s => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', background: 'var(--bg-card-2)',
                  borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-secondary)',
                }}>
                  <CheckboxIcon size={11}/>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  <ArrowUpRightIcon size={10}/>
                </div>
              ))}
            </div>
          ) : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Not attached to any suite yet.</span>}
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: 8 }}>
            Agents
          </div>
          {agentNames.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {agentNames.map(a => (
                <div key={a} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', background: 'var(--bg-card-2)',
                  borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-secondary)',
                }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: 5,
                    background: 'color-mix(in srgb, var(--accent-primary) 22%, transparent)',
                    color: 'var(--accent-primary)',
                    fontSize: 10, fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>{a.charAt(0).toUpperCase()}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a}</span>
                  <ArrowUpRightIcon size={10}/>
                </div>
              ))}
            </div>
          ) : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Not used by any agent yet.</span>}
        </div>
      </div>
    </section>
  );
}

// ── Recent evaluations table ─────────────────────────────────────────────────

function RecentEvaluationsTable({ evaluatorId }: { evaluatorId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.evaluatorRecentEvaluations(evaluatorId, 8),
    queryFn: () => evaluatorsApi.recentEvaluations(evaluatorId, 8),
    retry: false,
  });

  const rows = data ?? [];

  return (
    <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
      <header style={{ padding: '12px 16px', borderBottom: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <ActivityIcon size={13}/>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 600 }}>
          Recent evaluations
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>last 8</span>
      </header>
      {isLoading ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Loading…</div>
      ) : isError ? (
        <div style={{ padding: '32px 16px' }}>
          <EmptyState title="Not yet wired" description="Recent evaluations endpoint is not implemented yet."/>
        </div>
      ) : rows.length === 0 ? (
        <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
          No evaluations yet. Attach this evaluator to a suite and run it.
        </div>
      ) : (
        <div>
          <div style={{
            display: 'grid', gridTemplateColumns: '90px 1fr 70px 70px 70px',
            padding: '8px 16px', fontSize: 9.5, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            borderBottom: '1px solid var(--hairline)', fontWeight: 600,
          }}>
            <span>Time</span>
            <span>Case · reason</span>
            <span style={{ textAlign: 'right' }}>Latency</span>
            <span style={{ textAlign: 'right' }}>Score</span>
            <span style={{ textAlign: 'right' }}>Verdict</span>
          </div>
          {rows.map((s, i) => (
            <div key={s.testResultId} style={{
              display: 'grid', gridTemplateColumns: '90px 1fr 70px 70px 70px',
              padding: '11px 16px',
              borderBottom: i < rows.length - 1 ? '1px solid var(--hairline)' : 'none',
              alignItems: 'center', gap: 12, fontSize: 11.5,
            }}>
              <span style={{ color: 'var(--text-muted)' }}>{fmtRelative(s.evaluatedAt)}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.caseSummary}</div>
                {s.reasoning && (
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.reasoning}</div>
                )}
              </div>
              <span style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)', fontSize: 11 }}>
                {s.latencyMs ? fmtLatency(s.latencyMs) : '—'}
              </span>
              <span style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: 'var(--text-primary)' }}>
                {s.score ?? '—'}
              </span>
              <span style={{ textAlign: 'right' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 8px', borderRadius: 100,
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                  background: s.passed ? 'var(--success-subtle)' : 'var(--danger-subtle)',
                  color: s.passed ? 'var(--success)' : 'var(--danger)',
                }}>{s.passed ? 'PASS' : 'FAIL'}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Detail pane ──────────────────────────────────────────────────────────────

function EvaluatorDetail({ evaluator: e, attachedSuites, range, onRangeChange, onEdit, onDelete }: {
  evaluator: EvaluatorDetailDto;
  attachedSuites: { id: string; name: string; agentName: string }[];
  range: RangeKey;
  onRangeChange: (r: RangeKey) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const navigate = useNavigate();
  const cat = KIND_CATEGORY[e.kind];
  const m = TYPE_META[cat];
  const showCost = e.kind === EvaluatorKind.Agentic;
  const agentNames = Array.from(new Set(attachedSuites.map(s => s.agentName)));

  const overviewParams = useMemo(() => ({
    from: rangeFrom(range),
    to: new Date().toISOString(),
    bucket: bucketFor(range),
  }), [range]);

  const overviewQuery = useQuery({
    queryKey: QUERY_KEYS.statisticsEvaluatorOverview(e.id, range),
    queryFn: () => statisticsApi.evaluatorOverview(e.id, overviewParams),
    retry: false,
    placeholderData: keepPreviousData,
  });

  const overview = overviewQuery.data ?? null;

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <WorkspaceHeader
        evaluator={e}
        onEdit={onEdit}
        onDelete={onDelete}
        onTestBench={() => navigate(`/evaluator-playground?id=${e.id}`)}
      />

      <PerformancePanel evaluator={e} overview={overview} range={range} onRangeChange={onRangeChange} color={m.color}/>

      <DefinitionPanel evaluator={e} onEdit={onEdit}/>

      <div style={{ display: 'grid', gridTemplateColumns: showCost ? '1.4fr 1fr' : '1fr', gap: 14 }}>
        <ScoreDistributionPanel
          buckets={overview?.scoreDistribution ?? []}
          color={m.color}
          totalRuns={overview?.summary.totalEvaluations ?? 0}
          range={range}
        />
        {showCost && (
          <CostPanel
            overview={overview}
            color={m.color}
            modelName={e.endpointName ?? null}
            range={range}
          />
        )}
      </div>

      <AttachedPanel suites={attachedSuites} agentNames={agentNames}/>

      <RecentEvaluationsTable evaluatorId={e.id}/>
    </div>
  );
}

// ── Empty selection state ────────────────────────────────────────────────────

function EmptyDetail({ hasAny, onCreate }: { hasAny: boolean; onCreate: () => void }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 40, textAlign: 'center', color: 'var(--text-muted)', gap: 14,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 'var(--radius-lg)', background: 'var(--bg-card-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)',
      }}>
        <BeakerIcon size={24}/>
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
          {hasAny ? 'Select an evaluator' : 'No evaluators yet'}
        </div>
        <div style={{ fontSize: 12, marginTop: 4, maxWidth: 320 }}>
          {hasAny
            ? "Pick one from the list to view its definition, attached suites, and performance."
            : 'Create your first evaluator to start scoring agent responses.'}
        </div>
      </div>
      <button
        onClick={onCreate}
        data-write
        style={{
          marginTop: 4, padding: '9px 16px',
          background: 'var(--grad-accent)',
          borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, color: '#fff',
          boxShadow: 'var(--shadow-btn)',
          border: 'none',
          display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer',
        }}
      >
        <PlusIcon size={13}/> New evaluator
      </button>
    </div>
  );
}

// ── New evaluator modal ──────────────────────────────────────────────────────

function NewEvaluatorModal({ pickedKind, setPickedKind, form, setForm, presets, onClose, onSubmit, loading }: {
  pickedKind: EvaluatorKind | null;
  setPickedKind: (k: EvaluatorKind | null) => void;
  form: EvaluatorFormState;
  setForm: (f: EvaluatorFormState) => void;
  presets: import('../../api/models').AgenticEvaluatorPresetDto[];
  onClose: () => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={ev => ev.stopPropagation()}
        style={{
          background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
          width: 'min(720px, 100%)', maxHeight: '88vh', overflow: 'auto',
          boxShadow: 'var(--shadow-float)', border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>New evaluator</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              {pickedKind ? 'Configure your evaluator.' : 'Choose how this evaluator scores agent responses.'}
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', padding: 6, borderRadius: 6, fontSize: 18, background: 'transparent', border: 'none', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: 20 }}>
          {!pickedKind ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {KIND_ORDER.map(k => {
                const cat = KIND_CATEGORY[k];
                const hex = TYPE_HEX[cat];
                const m = TYPE_META[cat];
                const meta = META[k];
                return (
                  <button key={k} onClick={() => setPickedKind(k)} style={{
                    textAlign: 'left', padding: 14, borderRadius: 'var(--radius-lg)',
                    background: 'var(--bg-card-2)', border: '1px solid var(--border-subtle)',
                    display: 'flex', gap: 12, cursor: 'pointer', transition: 'all 0.15s',
                  }}
                    onMouseEnter={ev => {
                      ev.currentTarget.style.background = `color-mix(in srgb, ${hex} 10%, var(--bg-card-2))`;
                      ev.currentTarget.style.borderColor = `color-mix(in srgb, ${hex} 44%, transparent)`;
                    }}
                    onMouseLeave={ev => {
                      ev.currentTarget.style.background = 'var(--bg-card-2)';
                      ev.currentTarget.style.borderColor = 'var(--border-subtle)';
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 'var(--radius-md)',
                      background: `color-mix(in srgb, ${hex} 14%, transparent)`, color: m.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <CategoryIcon category={cat} size={16}/>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{meta.label}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>{meta.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6,
                  background: `color-mix(in srgb, ${TYPE_HEX[KIND_CATEGORY[pickedKind]]} 18%, transparent)`,
                  color: TYPE_META[KIND_CATEGORY[pickedKind]].color, fontSize: 12, fontWeight: 600,
                }}>
                  {META[pickedKind].label}
                </span>
                <button onClick={() => setPickedKind(null)} style={{ fontSize: 11, color: 'var(--text-muted)', padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer' }}>← Change</button>
              </div>
              <EvaluatorForm form={form} setForm={setForm} kind={pickedKind} presets={presets}/>
            </div>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--hairline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>You can change the configuration later from the evaluator's settings.</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer' }}>Cancel</button>
            <button
              onClick={onSubmit}
              data-write
              disabled={!pickedKind || loading}
              style={{
                padding: '8px 16px', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 600,
                color: pickedKind ? '#fff' : 'var(--text-muted)',
                background: pickedKind ? 'var(--grad-accent)' : 'var(--bg-card-2)',
                boxShadow: pickedKind ? 'var(--shadow-btn)' : 'none',
                border: 'none',
                cursor: pickedKind ? 'pointer' : 'not-allowed',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main view ────────────────────────────────────────────────────────────────

export default function Evaluators() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { id: routeId } = useParams<{ id: string }>();
  const { currentProjectId } = useCurrentProject();

  const [range, setRange] = useState<RangeKey>('7d');
  const SPARKLINE_RANGE: RangeKey = '7d';
  const [showNew, setShowNew] = useState(false);
  const [pickedKind, setPickedKind] = useState<EvaluatorKind | null>(null);
  const [createForm, setCreateForm] = useState<EvaluatorFormState>(initForm());
  const [editOpen, setEditOpen] = useState(false);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EvaluatorFormState>(initForm());
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const { data: evaluators = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.evaluators(currentProjectId ?? undefined),
    queryFn: () => evaluatorsApi.list(currentProjectId ? { projectId: currentProjectId } : undefined),
    enabled: currentProjectId !== null,
  });
  const { data: suitesResult } = useQuery({
    queryKey: QUERY_KEYS.testSuites(undefined, currentProjectId ?? undefined),
    queryFn: () => testSuitesApi.list(currentProjectId ? { projectId: currentProjectId } : undefined),
    enabled: currentProjectId !== null,
  });
  const { data: presets = [] } = useQuery({ queryKey: QUERY_KEYS.agenticEvaluatorPresets, queryFn: evaluatorsApi.getAgenticPresets });
  const suites = suitesResult?.items ?? [];

  const sparklineParams = useMemo(() => {
    if (!currentProjectId) return null;
    return {
      projectId: currentProjectId,
      from: rangeFrom(SPARKLINE_RANGE),
      to: new Date().toISOString(),
      bucket: bucketFor(SPARKLINE_RANGE),
    };
  }, [currentProjectId]);

  const { data: sparklineRows } = useQuery({
    queryKey: QUERY_KEYS.statisticsEvaluatorSparklines(currentProjectId ?? '', SPARKLINE_RANGE),
    queryFn: () => statisticsApi.evaluatorSparklines(sparklineParams!),
    enabled: sparklineParams !== null,
    retry: false,
  });

  const sparklineById = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const row of sparklineRows ?? []) {
      m.set(row.evaluatorId, row.points.map(p => (p.total > 0 ? p.passed / p.total : 0)));
    }
    return m;
  }, [sparklineRows]);

  // Derive a coarse avg from the sparkline tail so rail rows have a number.
  const avgScoreById = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const row of sparklineRows ?? []) {
      const pts = row.points;
      const lastN = pts.slice(-7);
      const totalPass = lastN.reduce((a, p) => a + p.passed, 0);
      const totalAll = lastN.reduce((a, p) => a + p.total, 0);
      m.set(row.evaluatorId, totalAll > 0 ? totalPass / totalAll : null);
    }
    return m;
  }, [sparklineRows]);

  const selected = routeId ? evaluators.find(e => e.id === routeId) ?? null : null;

  useEffect(() => {
    if (!routeId && evaluators.length > 0) {
      navigate(`/evaluators/${evaluators[0].id}`, { replace: true });
    }
  }, [routeId, evaluators, navigate]);
  const editTarget = evaluators.find(e => e.id === editTargetId) ?? null;
  const deleteTarget = evaluators.find(e => e.id === deleteTargetId) ?? null;

  const attachedSuites = selected
    ? suites.filter(s => s.evaluators.some(ev => ev.id === selected.id)).map(s => ({ id: s.id, name: s.name, agentName: s.agentName }))
    : [];

  const createEval = useMutation({
    mutationFn: () => {
      const k = pickedKind!;
      const payload: CreateEvaluatorPayload = { kind: k, projectId: currentProjectId! };
      if (k === EvaluatorKind.Agentic) { payload.name = createForm.name; payload.systemMessage = createForm.systemMessage; }
      else if (k === EvaluatorKind.JsonSchemaMatch) { payload.jsonSchema = createForm.jsonSchema; }
      else if (k === EvaluatorKind.NumericMatch) { payload.extractionPattern = createForm.extractionPattern; payload.tolerance = parseFloat(createForm.tolerance) || 0.01; }
      return evaluatorsApi.create(payload);
    },
    onSuccess: (e) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.evaluators(currentProjectId ?? undefined) });
      navigate(`/evaluators/${e.id}`);
      setShowNew(false); setPickedKind(null); setCreateForm(initForm());
    },
  });

  const updateEval = useMutation({
    mutationFn: () => {
      const ev = editTarget!;
      const payload: Partial<CreateEvaluatorPayload> = {};
      if (ev.kind === EvaluatorKind.Agentic) { payload.name = editForm.name; payload.systemMessage = editForm.systemMessage; }
      else if (ev.kind === EvaluatorKind.JsonSchemaMatch) { payload.jsonSchema = editForm.jsonSchema; }
      else if (ev.kind === EvaluatorKind.NumericMatch) { payload.extractionPattern = editForm.extractionPattern; payload.tolerance = parseFloat(editForm.tolerance) || 0.01; }
      return evaluatorsApi.update(ev.id, payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: QUERY_KEYS.evaluators(currentProjectId ?? undefined) }); setEditOpen(false); setEditTargetId(null); },
  });

  const deleteEval = useMutation({
    mutationFn: () => evaluatorsApi.delete(deleteTargetId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.evaluators(currentProjectId ?? undefined) });
      if (routeId === deleteTargetId) navigate('/evaluators');
      setDeleteTargetId(null);
    },
  });

  function openEdit(e: EvaluatorDetailDto) {
    setEditTargetId(e.id);
    setEditForm({ name: e.name, systemMessage: e.systemMessage ?? '', presetKey: '', jsonSchema: e.jsonSchema ?? '', extractionPattern: e.extractionPattern ?? '', tolerance: String(e.tolerance ?? 0.01) });
    setEditOpen(true);
  }

  function openNew() { setShowNew(true); setPickedKind(null); setCreateForm(initForm()); }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '288px 1fr', gap: 14, minHeight: 0 }}>
        <EvalRail
          evaluators={evaluators}
          isLoading={isLoading}
          selectedId={routeId ?? null}
          onSelect={(id) => navigate(`/evaluators/${id}`)}
          onNew={openNew}
          sparklineById={sparklineById}
          avgScoreById={avgScoreById}
        />

        <main style={{ minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {selected ? (
            <EvaluatorDetail
              evaluator={selected}
              attachedSuites={attachedSuites}
              range={range}
              onRangeChange={setRange}
              onEdit={() => openEdit(selected)}
              onDelete={() => setDeleteTargetId(selected.id)}
            />
          ) : (
            <EmptyDetail hasAny={evaluators.length > 0} onCreate={openNew}/>
          )}
        </main>
      </div>

      {showNew && (
        <NewEvaluatorModal
          pickedKind={pickedKind}
          setPickedKind={setPickedKind}
          form={createForm}
          setForm={setCreateForm}
          presets={presets}
          onClose={() => setShowNew(false)}
          onSubmit={() => createEval.mutate()}
          loading={createEval.isPending}
        />
      )}

      {editOpen && editTarget && (
        <Modal
          title={`Edit ${META[editTarget.kind]?.label ?? 'Evaluator'}`}
          onClose={() => { setEditOpen(false); setEditTargetId(null); }}
          maxWidth={520}
          footer={
            <ModalFooter
              onCancel={() => { setEditOpen(false); setEditTargetId(null); }}
              onSubmit={() => updateEval.mutate()}
              submitLabel={updateEval.isPending ? 'Saving…' : 'Save'}
              loading={updateEval.isPending}
            />
          }
        >
          <EvaluatorForm form={editForm} setForm={setEditForm} kind={editTarget.kind} presets={presets} showPresetPicker={false}/>
        </Modal>
      )}

      {deleteTargetId && deleteTarget && (
        <Modal
          title={`Delete "${deleteTarget.name}"`}
          onClose={() => setDeleteTargetId(null)}
          footer={
            <ModalFooter
              onCancel={() => setDeleteTargetId(null)}
              onSubmit={() => deleteEval.mutate()}
              submitLabel={deleteEval.isPending ? 'Deleting…' : 'Delete'}
              loading={deleteEval.isPending}
              danger
            />
          }
        >
          <p className="text-[13px] text-secondary m-0">
            This will permanently remove <strong>{deleteTarget.name}</strong> and detach it from all test suites.
          </p>
        </Modal>
      )}
    </div>
  );
}
