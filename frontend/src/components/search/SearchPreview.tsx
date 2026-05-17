import { useQuery } from '@tanstack/react-query';
import type { SearchHit, SearchKind } from '../../api/search';
import { agentsApi } from '../../api/agents';
import { agentCallsApi } from '../../api/agent-calls';
import { testCasesApi } from '../../api/test-cases';
import { testSuitesApi } from '../../api/test-suites';
import { evaluatorsApi } from '../../api/evaluators';
import type {
  AgentCallDto, AgentDto, EvaluatorDetailDto, MessageDto,
  TestCaseDto, TestSuiteDto, TestSuiteMessageDto,
} from '../../api/models';
import { UsersIcon, CheckboxIcon, ActivityIcon, ScaleIcon } from '../icons';

type KindStyle = { label: string; accent: string; icon: (s: number) => React.ReactNode };

const KIND_STYLE: Record<SearchKind, KindStyle> = {
  agent:     { label: 'Agent',      accent: 'var(--teal)',           icon: s => <UsersIcon size={s} /> },
  testSuite: { label: 'Test Suite', accent: 'var(--success)',        icon: s => <CheckboxIcon size={s} /> },
  agentCall: { label: 'Trace',      accent: 'var(--accent-primary)', icon: s => <ActivityIcon size={s} /> },
  evaluator: { label: 'Evaluator',  accent: 'var(--warn)',           icon: s => <ScaleIcon size={s} /> },
  testCase:  { label: 'Test Case',  accent: 'var(--success)',        icon: s => <CheckboxIcon size={s} /> },
};

const ROLE_COLOR: Record<string, string> = {
  system:    'var(--text-secondary)',
  user:      'var(--teal)',
  assistant: 'var(--accent-hover)',
  tool:      'var(--success)',
};

export function SearchPreview({ hit }: { hit: SearchHit }) {
  const style = KIND_STYLE[hit.kind];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] uppercase tracking-wider font-semibold px-2 py-[3px] rounded-full inline-flex items-center gap-1.5"
          style={{ background: `${style.accent}1f`, color: style.accent }}
        >
          {style.icon(11)}
          {style.label}
        </span>
        {hit.score > 0 && (
          <span className="text-[10px] text-white/30">score {hit.score.toFixed(2)}</span>
        )}
      </div>

      <div className="text-[14px] font-semibold text-white leading-snug break-words">
        {hit.title}
      </div>

      <KindBody hit={hit} />
    </div>
  );
}

function KindBody({ hit }: { hit: SearchHit }) {
  switch (hit.kind) {
    case 'agentCall':  return <AgentCallBody id={hit.entityId} hit={hit} />;
    case 'testCase':   return <TestCaseBody id={hit.entityId} hit={hit} />;
    case 'agent':      return <AgentBody id={hit.entityId} hit={hit} />;
    case 'testSuite':  return <TestSuiteBody id={hit.entityId} hit={hit} />;
    case 'evaluator':  return <EvaluatorBody id={hit.entityId} hit={hit} />;
    default:           return <GenericBody hit={hit} />;
  }
}

function AgentCallBody({ id, hit }: { id: string; hit: SearchHit }) {
  const q = useQuery({
    queryKey: ['search-preview', 'agentCall', id],
    queryFn: () => agentCallsApi.get(id),
    staleTime: 60_000,
  });
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <GenericBody hit={hit} />;
  const call: AgentCallDto = q.data;
  const messages: MessageDto[] = [...call.request, call.response].filter(m => m != null);
  return (
    <>
      <MetaGrid entries={[
        ['Agent', call.agentName ?? '—'],
        ['Model', call.model],
        ['Status', String(call.httpStatus)],
        ['Tokens', `${call.inputTokens} in · ${call.outputTokens} out`],
      ]} />
      <Conversation messages={messages.map(m => ({ role: m.role, content: m.content }))} />
    </>
  );
}

function TestCaseBody({ id, hit }: { id: string; hit: SearchHit }) {
  const q = useQuery({
    queryKey: ['search-preview', 'testCase', id],
    queryFn: () => testCasesApi.get(id),
    staleTime: 60_000,
  });
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <GenericBody hit={hit} />;
  const tc: TestCaseDto = q.data;
  const meta = hit.metadata ?? {};
  const msgs: { role: string; content: string }[] = [
    ...(tc.input ?? []).map((m: TestSuiteMessageDto) => ({ role: m.role, content: m.content })),
  ];
  if (tc.expectedOutput) {
    msgs.push({ role: `expected (${tc.expectedOutput.role})`, content: tc.expectedOutput.content });
  }
  return (
    <>
      <MetaGrid entries={[
        ['Suite', meta.suiteName ?? '—'],
        ['Agent', meta.agentName ?? '—'],
      ]} />
      <Conversation messages={msgs} />
    </>
  );
}

function AgentBody({ id, hit }: { id: string; hit: SearchHit }) {
  const q = useQuery({
    queryKey: ['search-preview', 'agent', id],
    queryFn: () => agentsApi.get(id),
    staleTime: 60_000,
  });
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <GenericBody hit={hit} />;
  const a: AgentDto = q.data;
  return (
    <>
      <MetaGrid entries={[
        ['Project', a.projectName],
        ['Endpoint', a.endpointName],
        ['Tools', String(a.tools?.length ?? 0)],
      ]} />
      {a.systemMessage && (
        <Section title="System prompt">
          <pre className="text-[11.5px] text-white/75 leading-relaxed whitespace-pre-wrap break-words m-0 font-sans">
            {truncate(a.systemMessage, 600)}
          </pre>
        </Section>
      )}
      {a.tools && a.tools.length > 0 && (
        <Section title="Tools">
          <div className="flex flex-wrap gap-1.5">
            {a.tools.map(t => (
              <span
                key={t.name}
                className="px-2 py-[2px] rounded-full text-[10.5px] font-mono"
                style={{ background: 'var(--success-subtle)', color: 'var(--success)', border: '1px solid color-mix(in srgb, var(--success) 28%, transparent)' }}
                title={t.description}
              >
                {t.name}
              </span>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

function TestSuiteBody({ id, hit }: { id: string; hit: SearchHit }) {
  const q = useQuery({
    queryKey: ['search-preview', 'testSuite', id],
    queryFn: () => testSuitesApi.get(id),
    staleTime: 60_000,
  });
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <GenericBody hit={hit} />;
  const s: TestSuiteDto = q.data;
  return (
    <>
      <MetaGrid entries={[
        ['Agent', s.agentName],
        ['Test cases', String(s.testCases?.length ?? 0)],
        ['Pass rate', s.passRate != null ? `${(s.passRate * 100).toFixed(0)}%` : '—'],
        ['Total runs', String(s.totalRuns)],
      ]} />
      {s.description && (
        <Section title="Description">
          <div className="text-[12px] text-white/75 leading-relaxed whitespace-pre-wrap break-words">
            {truncate(s.description, 400)}
          </div>
        </Section>
      )}
      {s.evaluators && s.evaluators.length > 0 && (
        <Section title="Evaluators">
          <div className="flex flex-wrap gap-1.5">
            {s.evaluators.map(e => (
              <span
                key={e.id}
                className="px-2 py-[2px] rounded-full text-[10.5px] font-mono"
                style={{ background: 'color-mix(in srgb, var(--warn) 18%, transparent)', color: 'var(--warn)', border: '1px solid color-mix(in srgb, var(--warn) 28%, transparent)' }}
              >
                {e.kind}
              </span>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

function EvaluatorBody({ id, hit }: { id: string; hit: SearchHit }) {
  const q = useQuery({
    queryKey: ['search-preview', 'evaluator', id],
    queryFn: () => evaluatorsApi.get(id),
    staleTime: 60_000,
  });
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <GenericBody hit={hit} />;
  const e: EvaluatorDetailDto = q.data;
  return (
    <>
      <MetaGrid entries={[
        ['Kind', e.kind],
        ['Endpoint', e.endpointName ?? '—'],
      ].filter(([, v]) => v != null) as [string, string][]} />
      {e.systemMessage && (
        <Section title="System prompt">
          <pre className="text-[11.5px] text-white/75 leading-relaxed whitespace-pre-wrap break-words m-0 font-sans">
            {truncate(e.systemMessage, 500)}
          </pre>
        </Section>
      )}
      {e.jsonSchema && (
        <Section title="JSON schema">
          <pre className="text-[10.5px] text-white/70 font-mono leading-snug whitespace-pre-wrap break-words m-0">
            {truncate(e.jsonSchema, 400)}
          </pre>
        </Section>
      )}
      {e.extractionPattern && (
        <Section title="Extraction pattern">
          <code className="text-[11px] text-white/75 font-mono break-words">{e.extractionPattern}</code>
        </Section>
      )}
    </>
  );
}

function GenericBody({ hit }: { hit: SearchHit }) {
  const entries = Object.entries(hit.metadata ?? {});
  return (
    <>
      {hit.snippet && (
        <div
          className="text-[12px] text-white/70 leading-relaxed break-words [&_mark]:bg-accent/30 [&_mark]:text-accent-hover [&_mark]:rounded [&_mark]:px-[3px] [&_mark]:py-[1px] [&_mark]:font-medium"
          dangerouslySetInnerHTML={{ __html: hit.snippet }}
        />
      )}
      {entries.length > 0 && <MetaGrid entries={entries as [string, string][]} />}
    </>
  );
}

function Conversation({ messages }: { messages: { role: string; content: string }[] }) {
  if (messages.length === 0) {
    return <div className="text-[11.5px] text-white/40 italic">No messages.</div>;
  }
  return (
    <div className="flex flex-col gap-2">
      {messages.map((m, i) => {
        const baseRole = m.role.replace(/^expected \(/, '').replace(/\)$/, '').toLowerCase();
        const color = ROLE_COLOR[baseRole] ?? 'var(--text-secondary)';
        return (
          <div
            key={i}
            className="rounded-md border border-white/[.06] bg-white/[.02] p-2 flex flex-col gap-1"
          >
            <span
              className="text-[9.5px] uppercase tracking-[0.08em] font-semibold"
              style={{ color }}
            >
              {m.role}
            </span>
            <div className="text-[11.5px] text-white/80 leading-relaxed whitespace-pre-wrap break-words line-clamp-6">
              {m.content || <span className="text-white/30 italic">empty</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MetaGrid({ entries }: { entries: [string, string][] }) {
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-baseline gap-3 text-[11.5px]">
          <span className="text-white/40 min-w-[80px] uppercase tracking-wider text-[10px]">{k}</span>
          <span className="text-white/80 truncate">{v}</span>
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">{title}</div>
      {children}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center gap-2 text-[11.5px] text-white/40">
      <span className="size-[6px] rounded-full bg-accent pulse-dot" />
      Loading preview…
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
