import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { evaluatorsApi } from '../../api/evaluators';
import { testSuitesApi } from '../../api/test-suites';
import { statisticsApi } from '../../api/statistics';
import { QUERY_KEYS } from '../../api/query-keys';
import useCurrentProject from '../../hooks/useCurrentProject';
import { EvaluatorKind, type CreateEvaluatorPayload, type EvaluatorDetailDto } from '../../api/models';
import { Modal, ModalFooter } from '../../components/overlays/Modal';
import { fmtRelative } from '../../lib/format';
import { rangeFrom, bucketFor, type RangeKey } from '../../lib/time-range';
import { Sparkline } from '../../components/charts';
import { EvaluatorForm, } from './EvaluatorForm';
import { EvaluatorStatsBlock } from './EvaluatorStatsBlock';
import { EvaluatorTestBench, type EvaluatorTestBenchHandle } from './EvaluatorTestBench';
import { type EvaluatorFormState, META, KIND_ORDER, initForm } from './evaluators';

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
  numeric: { label: 'Numeric extract', short: 'Numeric',   color: '#8ec0cc' },
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

function TypeIcon({ kind, size = 14 }: { kind: EvaluatorKind; size?: number }) {
  const cat = KIND_CATEGORY[kind];
  const m = TYPE_META[cat];
  const box = size + 14;
  return (
    <span style={{
      width: box, height: box, borderRadius: 'var(--radius-md)',
      background: m.color + '1a', color: m.color,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {cat === 'llm' ? <BeakerIcon size={size}/> : cat === 'rule' ? <FilterIcon size={size}/> : <HashIcon size={size}/>}
    </span>
  );
}

// ── Left rail row ────────────────────────────────────────────────────────────

function EvaluatorRow({ evaluator: e, isSelected, onSelect, sparkline }: {
  evaluator: EvaluatorDetailDto;
  isSelected: boolean;
  onSelect: (id: string) => void;
  sparkline?: number[];
}) {
  const m = TYPE_META[KIND_CATEGORY[e.kind]];
  return (
    <button
      onClick={() => onSelect(e.id)}
      style={{
        textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px',
        borderRadius: 'var(--radius-md)',
        background: isSelected ? `${m.color}10` : 'transparent',
        borderLeft: isSelected ? `3px solid ${m.color}` : '3px solid transparent',
        cursor: 'pointer',
        transition: 'background 0.12s',
        width: '100%',
      }}
      onMouseEnter={ev => { if (!isSelected) ev.currentTarget.style.background = 'var(--bg-card-2)'; }}
      onMouseLeave={ev => { if (!isSelected) ev.currentTarget.style.background = 'transparent'; }}
    >
      <TypeIcon kind={e.kind} size={12} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{e.name}</div>
        <div style={{
          fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1,
          display: 'flex', gap: 6, alignItems: 'center',
        }}>
          <span style={{ color: m.color, fontWeight: 600 }}>{m.short}</span>
          <span>·</span>
          <span>{fmtRelative(e.updatedAt)}</span>
        </div>
      </div>
      {sparkline && sparkline.length >= 2 && (
        <Sparkline data={sparkline} color={m.color} width={48} height={20} strokeWidth={1.25} />
      )}
    </button>
  );
}

// ── Config panel ─────────────────────────────────────────────────────────────

function ConfigPanel({ evaluator: e, onEdit }: { evaluator: EvaluatorDetailDto; onEdit: () => void }) {
  const m = TYPE_META[KIND_CATEGORY[e.kind]];
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
          <div style={{ padding: '10px 12px', background: 'var(--bg-card-2)', borderRadius: 'var(--radius-md)', gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>extract pattern</div>
            <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#8ec0cc' }}>{e.extractionPattern}</code>
          </div>
        )}
        {e.tolerance != null && (
          <div style={{ padding: '10px 12px', background: 'var(--bg-card-2)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>tolerance</div>
            <div style={{ fontSize: 12.5, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>± {e.tolerance}</div>
          </div>
        )}
      </div>
    );
  } else {
    body = (
      <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
        Preset configuration — no user-defined settings.
      </div>
    );
  }
  return (
    <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
      <header style={{ padding: '12px 16px', borderBottom: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CodeIcon size={13}/>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>Configuration</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {m.label}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {e.systemMessage && (
            <button
              onClick={() => navigator.clipboard.writeText(e.systemMessage!)}
              style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', cursor: 'pointer' }}
            >
              <CopyIcon size={11}/> Copy
            </button>
          )}
          <button
            onClick={onEdit}
            data-write
            style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, color: 'var(--accent-hover)', background: 'var(--accent-subtle)', fontWeight: 600, cursor: 'pointer' }}
          >
            Edit
          </button>
        </div>
      </header>
      <div style={{ padding: '14px 16px', maxHeight: 360, overflow: 'auto' }}>{body}</div>
    </section>
  );
}

// ── Detail pane ──────────────────────────────────────────────────────────────

function EvaluatorDetail({ evaluator: e, attachedSuites, range, projectId, onEdit, onDelete }: {
  evaluator: EvaluatorDetailDto;
  attachedSuites: { id: string; name: string; agentName: string }[];
  range: RangeKey;
  projectId: string | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const benchRef = useRef<EvaluatorTestBenchHandle | null>(null);
  const cat = KIND_CATEGORY[e.kind];
  const m = TYPE_META[cat];
  const agentNames = [...new Set(attachedSuites.map(s => s.agentName))];

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header band */}
      <div style={{
        background: `linear-gradient(135deg, ${m.color}14, transparent 60%), var(--bg-card)`,
        border: '1px solid var(--border-subtle)',
        borderRadius: 14,
        padding: '18px 22px',
        boxShadow: 'var(--shadow-card)',
        display: 'flex', alignItems: 'flex-start', gap: 16,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 'var(--radius-lg)',
          background: `color-mix(in srgb, ${m.color} 14%, transparent)`, color: m.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          {cat === 'llm' ? <BeakerIcon size={22}/> : cat === 'rule' ? <FilterIcon size={22}/> : <HashIcon size={22}/>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>{e.name}</h2>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 100, background: 'var(--success-subtle)', color: '#5cc98a', fontSize: 10.5, fontWeight: 600 }}>
              <span className="pulse-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success)' }}/>
              Active
            </span>
            <span style={{ padding: '2px 8px', borderRadius: 6, background: m.color + '14', color: m.color, fontSize: 10.5, fontWeight: 600 }}>{m.label}</span>
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
            onClick={() => benchRef.current?.focus()}
            title="Test this evaluator against a past test result"
            style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-card-2)', cursor: 'pointer' }}
          >
            <PlayIcon size={11}/> Test evaluator
          </button>
          <button
            onClick={onDelete}
            data-write
            style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid color-mix(in srgb, var(--danger) 22%, transparent)', background: 'var(--danger-subtle)', cursor: 'pointer' }}
          >
            Delete
          </button>
          <button
            onClick={onEdit}
            data-write
            style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 600, color: '#fff', background: 'var(--grad-accent)', boxShadow: 'var(--shadow-btn)', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
          >
            <EditPencilIcon size={11}/> Edit
          </button>
        </div>
      </div>

      {/* Configuration */}
      <ConfigPanel evaluator={e} onEdit={onEdit}/>

      {/* Test bench */}
      <EvaluatorTestBench ref={benchRef} evaluatorId={e.id} projectId={projectId}/>

      {/* Metrics block */}
      <EvaluatorStatsBlock evaluatorId={e.id} kind={e.kind} range={range} color={m.color}/>

      {/* Attached to */}
      <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '16px 18px' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 12 }}>Attached to</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 6 }}>Test suites</div>
            {attachedSuites.length ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {attachedSuites.map(s => (
                  <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', background: 'var(--bg-card-2)', borderRadius: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                    <CheckboxIcon size={9}/> {s.name}
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
                    <span style={{ width: 6, height: 6, borderRadius: 2, background: 'var(--accent-primary)' }}/>
                    {a}
                  </span>
                ))}
              </div>
            ) : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>none</span>}
          </div>
        </div>
      </section>

      {/* Recent evaluations */}
      <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
        <header style={{ padding: '12px 16px', borderBottom: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <ActivityIcon size={13}/>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>Recent evaluations</span>
        </header>
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
          No evaluations yet. Attach this evaluator to a suite and run it.
        </div>
      </section>

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
        width: 56, height: 56, borderRadius: 14, background: 'var(--bg-card-2)',
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
            ? 'Pick one from the list to view its configuration, attached suites, and metrics.'
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
        background: 'rgba(8, 8, 11, 0.7)', backdropFilter: 'blur(8px)',
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
          <button onClick={onClose} style={{ color: 'var(--text-muted)', padding: 6, borderRadius: 6, fontSize: 18, cursor: 'pointer' }}>×</button>
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
                    textAlign: 'left', padding: 14, borderRadius: 'var(--radius-lg)',
                    background: 'var(--bg-card-2)', border: '1px solid var(--border-subtle)',
                    display: 'flex', gap: 12, cursor: 'pointer', transition: 'all 0.15s',
                  }}
                    onMouseEnter={ev => { ev.currentTarget.style.background = m.color + '10'; ev.currentTarget.style.borderColor = m.color + '44'; }}
                    onMouseLeave={ev => { ev.currentTarget.style.background = 'var(--bg-card-2)'; ev.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${m.color} 14%, transparent)`, color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {cat === 'llm' ? <BeakerIcon size={16}/> : cat === 'rule' ? <FilterIcon size={16}/> : <HashIcon size={16}/>}
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
              <EvaluatorForm form={form} setForm={setForm} kind={pickedKind} presets={presets}/>
            </div>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--hairline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>You can change the configuration later from the evaluator's settings.</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
            <button
              onClick={onSubmit}
              data-write
              disabled={!pickedKind || loading}
              style={{
                padding: '8px 16px', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 600,
                color: pickedKind ? '#fff' : 'var(--text-muted)',
                background: pickedKind ? 'var(--grad-accent)' : 'var(--bg-card-2)',
                boxShadow: pickedKind ? 'var(--shadow-btn)' : 'none',
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

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [range, setRange] = useState<RangeKey>('7d');
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
      from: rangeFrom(range),
      to: new Date().toISOString(),
      bucket: bucketFor(range),
    };
  }, [currentProjectId, range]);

  const { data: sparklineRows } = useQuery({
    queryKey: QUERY_KEYS.statisticsEvaluatorSparklines(currentProjectId ?? '', range),
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

  const visible = evaluators.filter(e => typeFilter === 'all' || KIND_CATEGORY[e.kind] === typeFilter);
  const selected = routeId ? evaluators.find(e => e.id === routeId) ?? null : null;

  useEffect(() => {
    if (!routeId && visible.length > 0) {
      navigate(`/evaluators/${visible[0].id}`, { replace: true });
    }
  }, [routeId, visible, navigate]);
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

  const typeFilterOptions: [TypeFilter, string, string | null][] = [
    ['all', 'All', null],
    ['llm', 'LLM judge', 'var(--accent-primary)'],
    ['rule', 'Rule', 'var(--teal)'],
    ['numeric', 'Numeric', '#8ec0cc'],
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '300px 1fr', gap: 14, minHeight: 0 }}>
        {/* Left rail */}
        <aside style={{
          background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
          display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--hairline)' }}>
            <button
              onClick={openNew}
              data-write
              style={{
                width: '100%', padding: '9px 14px',
                background: 'var(--grad-accent)',
                borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, color: '#fff',
                boxShadow: 'var(--shadow-btn)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, cursor: 'pointer',
              }}
            >
              <PlusIcon size={13}/> New evaluator
            </button>
          </div>

          <div style={{ padding: '10px 12px 6px' }}>
            <div className="flex gap-1 p-1 bg-card-2 rounded-[9px]" role="group" aria-label="Time range">
              {(['1h', '24h', '7d', '30d'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  aria-pressed={range === r}
                  style={{ boxShadow: range === r ? '0 1px 0 rgba(255,255,255,0.06) inset, 0 1px 2px rgba(0,0,0,0.25)' : 'none' }}
                  className={`flex-1 px-[8px] py-[3px] text-[11px] font-medium rounded-[6px] cursor-pointer transition-colors duration-150 ${
                    range === r ? 'bg-card text-primary' : 'bg-transparent text-muted hover:text-secondary'
                  }`}
                >{r}</button>
              ))}
            </div>
          </div>

          <div style={{ padding: '6px 12px 10px', borderBottom: '1px solid var(--hairline)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {typeFilterOptions.map(([k, label, color]) => {
                const isActive = typeFilter === k;
                const count = k === 'all' ? evaluators.length : evaluators.filter(e => KIND_CATEGORY[e.kind] === k).length;
                return (
                  <button
                    key={k}
                    onClick={() => setTypeFilter(k)}
                    style={{
                      padding: '5px 9px', borderRadius: 7, fontSize: 11, fontWeight: 500,
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: isActive ? 'var(--bg-card-2)' : 'transparent',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {color && <span style={{ width: 6, height: 6, borderRadius: 2, background: color, opacity: isActive ? 1 : 0.5 }}/>}
                    {label}
                    <span style={{ padding: '0 5px', background: isActive ? 'var(--accent-subtle)' : 'var(--bg-card)', color: isActive ? '#e8c99a' : 'var(--text-muted)', borderRadius: 100, fontSize: 9.5, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {isLoading ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Loading…</div>
            ) : visible.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                {evaluators.length === 0 ? 'No evaluators yet.' : 'No evaluators match this filter.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {visible.map(e => (
                  <EvaluatorRow
                    key={e.id}
                    evaluator={e}
                    isSelected={e.id === routeId}
                    onSelect={(id) => navigate(`/evaluators/${id}`)}
                    sparkline={sparklineById.get(e.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Right pane */}
        <main style={{ minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {selected ? (
            <EvaluatorDetail
              evaluator={selected}
              attachedSuites={attachedSuites}
              range={range}
              projectId={currentProjectId}
              onEdit={() => openEdit(selected)}
              onDelete={() => setDeleteTargetId(selected.id)}
            />
          ) : (
            <EmptyDetail hasAny={evaluators.length > 0} onCreate={openNew}/>
          )}
        </main>
      </div>

      {/* New evaluator modal */}
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
          <EvaluatorForm form={editForm} setForm={setEditForm} kind={editTarget.kind} presets={presets} showPresetPicker={false}/>
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
