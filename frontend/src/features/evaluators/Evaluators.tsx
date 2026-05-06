import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { evaluatorsApi } from '../../api/evaluators';
import { testSuitesApi } from '../../api/test-suites';
import { providersApi } from '../../api/providers';
import { QUERY_KEYS } from '../../api/query-keys';
import { EvaluatorKind, type CreateEvaluatorPayload, type EvaluatorDetailDto } from '../../api/models';
import { Modal, ModalFooter } from '../../components/overlays/Modal';
import { useToast } from '../../components/ui/Toast';
import { fmtRelative } from '../../lib/format';
import { EvaluatorForm, META, KIND_ORDER, initForm, type EvaluatorFormState } from './EvaluatorForm';

// ── Type categories ──────────────────────────────────────────────────────────

type TypeCategory = 'llm' | 'classifier' | 'rule' | 'numeric';

const KIND_CATEGORY: Record<EvaluatorKind, TypeCategory> = {
  [EvaluatorKind.Custom]: 'llm',
  [EvaluatorKind.Helpfulness]: 'llm',
  [EvaluatorKind.Politeness]: 'llm',
  [EvaluatorKind.ToolUsage]: 'llm',
  [EvaluatorKind.Safety]: 'classifier',
  [EvaluatorKind.ExactMatch]: 'rule',
  [EvaluatorKind.JsonSchemaMatch]: 'rule',
  [EvaluatorKind.NumericMatch]: 'numeric',
};

const TYPE_META: Record<TypeCategory, { label: string; short: string; color: string; icon: React.ReactNode }> = {
  llm:        { label: 'LLM-as-judge',    short: 'LLM judge',   color: '#c9944a', icon: <BeakerIcon /> },
  classifier: { label: 'Classifier',      short: 'Classifier',  color: '#d95555', icon: <ShieldIcon /> },
  rule:       { label: 'Rule-based',      short: 'Rule',        color: '#6b9eaa', icon: <FilterIcon /> },
  numeric:    { label: 'Numeric extract', short: 'Numeric',     color: '#8ec0cc', icon: <HashIcon /> },
};

// ── Inline SVG icons ─────────────────────────────────────────────────────────

function BeakerIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6M8 3v8l-4 9h16l-4-9V3"/>
      <path d="M6 17h12"/>
    </svg>
  );
}

function ShieldIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
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

function ActivityIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  );
}

function CodeIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
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

function ArrowUpRightIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
    </svg>
  );
}

function WandIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5"/>
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

// ── Sub-components ───────────────────────────────────────────────────────────

function EvaluatorTypeIcon({ kind, size = 14 }: { kind: EvaluatorKind; size?: number }) {
  const cat = KIND_CATEGORY[kind];
  const m = TYPE_META[cat];
  return (
    <span style={{
      width: size + 14, height: size + 14,
      borderRadius: 8,
      background: m.color + '1a',
      color: m.color,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {cat === 'llm' ? <BeakerIcon size={size} /> : cat === 'classifier' ? <ShieldIcon size={size} /> : cat === 'rule' ? <FilterIcon size={size} /> : <HashIcon size={size} />}
    </span>
  );
}

function MiniSpark({ data, width = 80, height = 26, color = '#c9944a' }: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (!data || data.length < 2) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}>—</div>
    );
  }
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const pts = data.map((v, i) => [i * stepX, height - 2 - ((v - min) / range) * (height - 4)] as [number, number]);
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={color} />
    </svg>
  );
}

function DistributionBar({ buckets, labels, color, height = 28 }: {
  buckets: number[];
  labels: string[];
  color: string;
  height?: number;
}) {
  if (!buckets || buckets.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 10, border: '1px dashed var(--border-color)', borderRadius: 6 }}>
        no data yet
      </div>
    );
  }
  const total = buckets.reduce((a, b) => a + b, 0) || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', height, borderRadius: 6, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)' }}>
        {buckets.map((v, i) => (
          <div key={i} title={`${labels[i]}: ${((v / total) * 100).toFixed(1)}%`} style={{
            width: `${(v / total) * 100}%`,
            background: color,
            opacity: 0.35 + (i / Math.max(1, buckets.length - 1)) * 0.65,
            borderRight: i < buckets.length - 1 ? '1px solid rgba(0,0,0,0.3)' : 'none',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
        {labels.map((l, i) => <span key={i}>{l}</span>)}
      </div>
    </div>
  );
}

// ── EvaluatorCard ────────────────────────────────────────────────────────────

function EvaluatorCard({ evaluator: e, isSelected, onSelect }: {
  evaluator: EvaluatorDetailDto;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const cat = KIND_CATEGORY[e.kind];
  const typeMeta = TYPE_META[cat];
  return (
    <button onClick={() => onSelect(e.id)} style={{
      textAlign: 'left',
      background: 'var(--bg-card)',
      border: isSelected ? `1px solid ${typeMeta.color}66` : '1px solid var(--border-subtle)',
      borderRadius: 14,
      padding: '14px 16px',
      boxShadow: isSelected ? `var(--shadow-card), 0 0 0 3px ${typeMeta.color}1f` : 'var(--shadow-card)',
      display: 'flex', flexDirection: 'column', gap: 12,
      transition: 'border-color 0.15s, box-shadow 0.15s',
      cursor: 'pointer',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <EvaluatorTypeIcon kind={e.kind} size={14} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {e.name}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: typeMeta.color, fontWeight: 600 }}>{typeMeta.short}</span>
            <span>·</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.id.slice(0, 8)}…</span>
          </div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 100, background: 'rgba(61,170,111,0.1)', color: '#5cc98a', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
          <span className="pulse-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: '#3daa6f' }} />
          Active
        </span>
      </div>

      {/* Score row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.03em', color: 'var(--text-muted)' }}>—</div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>avg · 7d</div>
        </div>
        <MiniSpark data={[]} color={typeMeta.color} width={86} height={28} />
      </div>

      {/* Distribution */}
      <DistributionBar buckets={[]} labels={[]} color={typeMeta.color} />

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--hairline)', paddingTop: 10, fontSize: 10.5, color: 'var(--text-muted)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <CheckboxIcon size={11} /> 0 suites
        </span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>— runs / 7d</span>
        <span>updated {fmtRelative(e.updatedAt)}</span>
      </div>
    </button>
  );
}

// ── EvalConfigPanel ──────────────────────────────────────────────────────────

function EvalConfigPanel({ evaluator: e, onEdit }: { evaluator: EvaluatorDetailDto; onEdit: () => void }) {
  const cat = KIND_CATEGORY[e.kind];
  const typeMeta = TYPE_META[cat];

  let body: React.ReactNode;
  if (e.systemMessage) {
    body = (
      <pre style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, lineHeight: 1.65, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: 0 }}>
        {e.systemMessage}
      </pre>
    );
  } else if (e.jsonSchema) {
    body = (
      <pre style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, lineHeight: 1.6, color: 'var(--text-secondary)', whiteSpace: 'pre', margin: 0, overflow: 'auto' }}>
        {e.jsonSchema}
      </pre>
    );
  } else if (e.extractionPattern || e.tolerance != null) {
    body = (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {e.extractionPattern && (
          <div style={{ padding: '10px 12px', background: 'var(--bg-card-2)', borderRadius: 8, gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>extract pattern</div>
            <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#8ec0cc' }}>{e.extractionPattern}</code>
          </div>
        )}
        {e.tolerance != null && (
          <div style={{ padding: '10px 12px', background: 'var(--bg-card-2)', borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>tolerance</div>
            <div style={{ fontSize: 12.5, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>± {e.tolerance}</div>
          </div>
        )}
      </div>
    );
  } else {
    body = (
      <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
        This evaluator uses a preset configuration — no user-defined settings.
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 14, boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CodeIcon size={13} />
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>Configuration</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {typeMeta.label}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {e.systemMessage && (
            <button
              onClick={() => navigator.clipboard.writeText(e.systemMessage!)}
              style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent' }}
              onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--bg-card-2)')}
              onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}
            >
              <CopyIcon size={11} /> Copy
            </button>
          )}
          <button
            onClick={onEdit}
            style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, color: 'var(--accent-hover)', background: 'var(--accent-subtle)', fontWeight: 600 }}
          >
            Edit
          </button>
        </div>
      </div>
      <div style={{ padding: '14px 16px', maxHeight: 360, overflow: 'auto' }}>{body}</div>
    </div>
  );
}

// ── EvaluatorDetail ──────────────────────────────────────────────────────────

function EvaluatorDetail({ evaluator: e, attachedSuites, onEdit, onDelete }: {
  evaluator: EvaluatorDetailDto;
  attachedSuites: { id: string; name: string; agentName: string }[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const cat = KIND_CATEGORY[e.kind];
  const typeMeta = TYPE_META[cat];
  const agentNames = [...new Set(attachedSuites.map(s => s.agentName))];

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4 }}>
      {/* Header band */}
      <div style={{
        background: `linear-gradient(135deg, ${typeMeta.color}14, transparent 60%), var(--bg-card)`,
        border: '1px solid var(--border-subtle)',
        borderRadius: 14,
        padding: '18px 22px',
        boxShadow: 'var(--shadow-card)',
        display: 'flex', alignItems: 'flex-start', gap: 16,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 12,
          background: typeMeta.color + '22', color: typeMeta.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          {cat === 'llm' ? <BeakerIcon size={22} /> : cat === 'classifier' ? <ShieldIcon size={22} /> : cat === 'rule' ? <FilterIcon size={22} /> : <HashIcon size={22} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>{e.name}</h2>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 100, background: 'rgba(61,170,111,0.1)', color: '#5cc98a', fontSize: 10.5, fontWeight: 600 }}>
              <span className="pulse-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: '#3daa6f' }} />
              Active
            </span>
            <span style={{ padding: '2px 8px', borderRadius: 6, background: typeMeta.color + '14', color: typeMeta.color, fontSize: 10.5, fontWeight: 600 }}>{typeMeta.label}</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6, maxWidth: 720 }}>
            {META[e.kind]?.desc}
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 12, fontSize: 11.5, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--text-muted)' }}>id</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{e.id.slice(0, 12)}…</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--text-muted)' }}>kind</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{e.kind}</span>
            </span>
            {e.endpointName && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>model</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{e.endpointName}</span>
              </span>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--text-muted)' }}>updated</span>
              {fmtRelative(e.updatedAt)}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={onDelete}
            style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(217,85,85,0.2)', background: 'rgba(217,85,85,0.06)' }}
            onMouseEnter={ev => (ev.currentTarget.style.background = 'rgba(217,85,85,0.12)')}
            onMouseLeave={ev => (ev.currentTarget.style.background = 'rgba(217,85,85,0.06)')}
          >
            Delete
          </button>
          <button
            onClick={onEdit}
            style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fff', background: 'linear-gradient(135deg, #c9944a, #a07434)', boxShadow: '0 4px 14px -4px rgba(201,148,74,0.5), inset 0 1px 0 rgba(255,255,255,0.15)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <EditPencilIcon size={11} /> Edit
          </button>
        </div>
      </div>

      {/* Two-column body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 14, alignItems: 'start' }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <EvalConfigPanel evaluator={e} onEdit={onEdit} />

          {/* Recent evaluations */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 14, boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ActivityIcon size={13} />
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>Recent evaluations</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· last 24h sample</span>
              </div>
              <button style={{ fontSize: 11, color: 'var(--accent-hover)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                See all <ArrowUpRightIcon size={10} />
              </button>
            </div>
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              No evaluations yet. Attach this evaluator to a suite and run it.
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Score chart */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 14, boxShadow: 'var(--shadow-card)', padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Avg score · 7d</div>
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>— runs</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 30, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.03em', color: 'var(--text-muted)' }}>—</span>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>no data yet</span>
            </div>
            <div style={{ marginTop: 12 }}>
              <MiniSpark data={[]} color={typeMeta.color} width={296} height={56} />
            </div>
          </div>

          {/* Distribution */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 14, boxShadow: 'var(--shadow-card)', padding: '16px 18px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 12 }}>Score distribution</div>
            <DistributionBar buckets={[]} labels={[]} color={typeMeta.color} height={36} />
          </div>

          {/* Attached to */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 14, boxShadow: 'var(--shadow-card)', padding: '16px 18px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 10 }}>Attached to</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 6 }}>Test suites</div>
                {attachedSuites.length ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {attachedSuites.map(s => (
                      <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', background: 'var(--bg-card-2)', borderRadius: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                        <CheckboxIcon size={9} /> {s.name}
                      </span>
                    ))}
                  </div>
                ) : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>none</span>}
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 6 }}>Agents</div>
                {agentNames.length ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {agentNames.map(a => (
                      <span key={a} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', background: 'var(--bg-card-2)', borderRadius: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                        <span style={{ width: 6, height: 6, borderRadius: 2, background: '#c9944a' }} />
                        {a}
                      </span>
                    ))}
                  </div>
                ) : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>none</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
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

// ── NewEvaluatorModal ────────────────────────────────────────────────────────

function NewEvaluatorModal({ pickedKind, setPickedKind, form, setForm, endpoints, onClose, onSubmit, loading }: {
  pickedKind: EvaluatorKind | null;
  setPickedKind: (k: EvaluatorKind | null) => void;
  form: EvaluatorFormState;
  setForm: (f: EvaluatorFormState) => void;
  endpoints: import('../../api/models').ModelEndpointDto[];
  onClose: () => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(8, 8, 11, 0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={ev => ev.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          borderRadius: 16,
          width: 'min(720px, 100%)',
          maxHeight: '88vh',
          overflow: 'auto',
          boxShadow: 'var(--shadow-float)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>New evaluator</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              {pickedKind ? 'Configure your evaluator.' : 'Choose how this evaluator scores agent responses.'}
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', padding: 6, borderRadius: 6, fontSize: 18 }}>×</button>
        </div>

        <div style={{ padding: 20 }}>
          {!pickedKind ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {KIND_ORDER.map(k => {
                const cat = KIND_CATEGORY[k];
                const m = TYPE_META[cat];
                const meta = META[k];
                return (
                  <button key={k} onClick={() => setPickedKind(k)} style={{
                    textAlign: 'left', padding: 14, borderRadius: 12,
                    background: 'var(--bg-card-2)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex', gap: 12, cursor: 'pointer', transition: 'all 0.15s',
                  }}
                    onMouseEnter={ev => { ev.currentTarget.style.background = m.color + '10'; ev.currentTarget.style.borderColor = m.color + '44'; }}
                    onMouseLeave={ev => { ev.currentTarget.style.background = 'var(--bg-card-2)'; ev.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: m.color + '22', color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {cat === 'llm' ? <BeakerIcon size={16} /> : cat === 'classifier' ? <ShieldIcon size={16} /> : cat === 'rule' ? <FilterIcon size={16} /> : <HashIcon size={16} />}
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
                  background: TYPE_META[KIND_CATEGORY[pickedKind]].color + '18',
                  color: TYPE_META[KIND_CATEGORY[pickedKind]].color, fontSize: 12, fontWeight: 600,
                }}>
                  {META[pickedKind].label}
                </span>
                <button onClick={() => setPickedKind(null)} style={{ fontSize: 11, color: 'var(--text-muted)', padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer' }}>← Change</button>
              </div>
              <EvaluatorForm form={form} setForm={setForm} kind={pickedKind} endpoints={endpoints} />
            </div>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--hairline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>You can change the configuration later from the evaluator's settings.</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)' }}>Cancel</button>
            <button
              onClick={onSubmit}
              disabled={!pickedKind || loading}
              style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                color: pickedKind ? '#fff' : 'var(--text-muted)',
                background: pickedKind ? 'linear-gradient(135deg, #c9944a, #a07434)' : 'var(--bg-card-2)',
                boxShadow: pickedKind ? '0 4px 14px -4px rgba(201,148,74,0.5)' : 'none',
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

type TypeFilter = 'all' | TypeCategory;

export default function Evaluators() {
  const qc = useQueryClient();
  const { show: toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [showNew, setShowNew] = useState(false);
  const [pickedKind, setPickedKind] = useState<EvaluatorKind | null>(null);
  const [createForm, setCreateForm] = useState<EvaluatorFormState>(initForm());
  const [editOpen, setEditOpen] = useState(false);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EvaluatorFormState>(initForm());
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const { data: evaluators = [], isLoading } = useQuery({ queryKey: QUERY_KEYS.evaluators, queryFn: evaluatorsApi.list });
  const { data: suitesResult } = useQuery({ queryKey: QUERY_KEYS.testSuites(), queryFn: () => testSuitesApi.list() });
  const { data: endpoints = [] } = useQuery({ queryKey: QUERY_KEYS.modelEndpoints, queryFn: providersApi.getAllModels });
  const suites = suitesResult?.items ?? [];

  const visible = evaluators.filter(e => {
    if (typeFilter === 'all') return true;
    return KIND_CATEGORY[e.kind] === typeFilter;
  });

  const selected = evaluators.find(e => e.id === selectedId) ?? visible[0] ?? null;
  const editTarget = evaluators.find(e => e.id === editTargetId) ?? null;
  const deleteTarget = evaluators.find(e => e.id === deleteTargetId) ?? null;

  const attachedSuites = selected
    ? suites.filter(s => s.evaluators.some(ev => ev.id === selected.id)).map(s => ({ id: s.id, name: s.name, agentName: s.agentName }))
    : [];

  // KPI counts
  const llmCount = evaluators.filter(e => KIND_CATEGORY[e.kind] === 'llm').length;
  const ruleCount = evaluators.filter(e => KIND_CATEGORY[e.kind] === 'rule').length;
  const numericCount = evaluators.filter(e => KIND_CATEGORY[e.kind] === 'numeric').length;
  const classCount = evaluators.filter(e => KIND_CATEGORY[e.kind] === 'classifier').length;

  const createEval = useMutation({
    mutationFn: () => {
      const k = pickedKind!;
      const payload: CreateEvaluatorPayload = { kind: k };
      if (k === EvaluatorKind.Custom) { payload.name = createForm.name; payload.systemMessage = createForm.systemMessage; payload.endpointId = createForm.endpointId || null; }
      else if (META[k]?.requiresEndpoint) { payload.endpointId = createForm.endpointId || null; }
      else if (k === EvaluatorKind.JsonSchemaMatch) { payload.jsonSchema = createForm.jsonSchema; }
      else if (k === EvaluatorKind.NumericMatch) { payload.extractionPattern = createForm.extractionPattern; payload.tolerance = parseFloat(createForm.tolerance) || 0.01; }
      return evaluatorsApi.create(payload);
    },
    onSuccess: (e) => { qc.invalidateQueries({ queryKey: QUERY_KEYS.evaluators }); setSelectedId(e.id); setShowNew(false); setPickedKind(null); setCreateForm(initForm()); },
    onError: (err) => toast((err as Error).message || 'Failed to create evaluator', 'error'),
  });

  const updateEval = useMutation({
    mutationFn: () => {
      const ev = editTarget!;
      const payload: Partial<CreateEvaluatorPayload> = {};
      if (ev.kind === EvaluatorKind.Custom) { payload.name = editForm.name; payload.systemMessage = editForm.systemMessage; payload.endpointId = editForm.endpointId || null; }
      else if (META[ev.kind]?.requiresEndpoint) { payload.endpointId = editForm.endpointId || null; }
      else if (ev.kind === EvaluatorKind.JsonSchemaMatch) { payload.jsonSchema = editForm.jsonSchema; }
      else if (ev.kind === EvaluatorKind.NumericMatch) { payload.extractionPattern = editForm.extractionPattern; payload.tolerance = parseFloat(editForm.tolerance) || 0.01; }
      return evaluatorsApi.update(ev.id, payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: QUERY_KEYS.evaluators }); setEditOpen(false); setEditTargetId(null); },
    onError: (err) => toast((err as Error).message || 'Failed to update evaluator', 'error'),
  });

  const deleteEval = useMutation({
    mutationFn: () => evaluatorsApi.delete(deleteTargetId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.evaluators });
      if (selectedId === deleteTargetId) setSelectedId(null);
      setDeleteTargetId(null);
    },
    onError: (err) => toast((err as Error).message || 'Failed to delete evaluator', 'error'),
  });

  function openEdit(e: EvaluatorDetailDto) {
    setEditTargetId(e.id);
    setEditForm({ name: e.name, systemMessage: e.systemMessage ?? '', endpointId: e.endpointId ?? '', jsonSchema: e.jsonSchema ?? '', extractionPattern: e.extractionPattern ?? '', tolerance: String(e.tolerance ?? 0.01) });
    setEditOpen(true);
  }

  const typeFilterOptions: [TypeFilter, string, string | null][] = [
    ['all', 'All types', null],
    ['llm', 'LLM judge', '#c9944a'],
    ['rule', 'Rule', '#6b9eaa'],
    ['numeric', 'Numeric', '#8ec0cc'],
    ['classifier', 'Classifier', '#d95555'],
  ];

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 40 }}>
        {/* Header */}
        <div className="fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6 }}>Evaluators</h1>
            <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: 0 }}>
              Score agent responses with LLM judges, rules, code, embeddings, classifiers and numeric checks.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              className="btn-ghost"
              style={{ padding: '9px 14px', borderRadius: 10, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 7 }}
            >
              <WandIcon size={13} /> Library
            </button>
            <button
              onClick={() => { setShowNew(true); setPickedKind(null); setCreateForm(initForm()); }}
              style={{ padding: '9px 16px', background: 'linear-gradient(135deg, #c9944a, #a07434)', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#fff', boxShadow: '0 4px 14px -4px rgba(201,148,74,0.5), inset 0 1px 0 rgba(255,255,255,0.15)', display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap', cursor: 'pointer' }}
            >
              <PlusIcon size={13} /> New evaluator
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="fade-up" style={{ animationDelay: '30ms', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: 'Total evaluators', value: evaluators.length, sub: 'configured', color: '#3daa6f' },
            { label: 'LLM judges',       value: llmCount,          sub: 'grading with models', color: '#c9944a' },
            { label: 'Rule-based',       value: ruleCount + numericCount, sub: 'deterministic checks', color: '#6b9eaa' },
            { label: 'Classifiers',      value: classCount,        sub: 'safety · PII · tone', color: '#d95555' },
          ].map(k => (
            <div key={k.label} style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '16px 18px', boxShadow: 'var(--shadow-card)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: k.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: k.color, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.04em' }}>{k.value}</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{k.label}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>{k.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="fade-up" style={{ animationDelay: '60ms', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg-card)', borderRadius: 11, boxShadow: 'var(--shadow-pill)' }}>
            {typeFilterOptions.map(([k, label, color]) => {
              const isActive = typeFilter === k;
              const count = k === 'all' ? evaluators.length : evaluators.filter(e => KIND_CATEGORY[e.kind] === k).length;
              return (
                <button
                  key={k}
                  onClick={() => setTypeFilter(k)}
                  style={{
                    padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    background: isActive ? 'var(--bg-card-2)' : 'transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: isActive ? '0 1px 0 rgba(255,255,255,0.02) inset, 0 1px 2px rgba(0,0,0,0.25)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  {color && <span style={{ width: 7, height: 7, borderRadius: 2, background: color, opacity: isActive ? 1 : 0.5 }} />}
                  {label}
                  <span style={{ padding: '1px 6px', background: isActive ? 'rgba(201,148,74,0.18)' : 'var(--bg-card)', color: isActive ? '#e8c99a' : 'var(--text-muted)', borderRadius: 100, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
            {visible.length} evaluator{visible.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Card grid */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            No evaluators yet. Create one to start scoring agent responses.
          </div>
        ) : (
          <div className="fade-up" style={{ animationDelay: '100ms', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {visible.map(e => (
              <EvaluatorCard
                key={e.id}
                evaluator={e}
                isSelected={e.id === (selected?.id ?? null)}
                onSelect={setSelectedId}
              />
            ))}
          </div>
        )}

        {/* Detail panel */}
        {selected && (
          <EvaluatorDetail
            evaluator={selected}
            attachedSuites={attachedSuites}
            onEdit={() => openEdit(selected)}
            onDelete={() => setDeleteTargetId(selected.id)}
          />
        )}
      </div>

      {/* New evaluator modal */}
      {showNew && (
        <NewEvaluatorModal
          pickedKind={pickedKind}
          setPickedKind={setPickedKind}
          form={createForm}
          setForm={setCreateForm}
          endpoints={endpoints}
          onClose={() => setShowNew(false)}
          onSubmit={() => createEval.mutate()}
          loading={createEval.isPending}
        />
      )}

      {/* Edit modal */}
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
          <EvaluatorForm form={editForm} setForm={setEditForm} kind={editTarget.kind} endpoints={endpoints} />
        </Modal>
      )}

      {/* Delete confirm */}
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
