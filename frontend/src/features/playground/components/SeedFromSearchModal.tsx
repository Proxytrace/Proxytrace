import { useEffect, useState } from 'react';
import { Modal } from '../../../components/overlays/Modal';
import { searchApi, type SearchHit } from '../../../api/search';
import { agentCallsApi } from '../../../api/agent-calls';
import { testCasesApi } from '../../../api/test-cases';
import type { AgentCallDto, MessageDto, TestCaseDto, TestSuiteMessageDto } from '../../../api/models';
import { formInputCls } from '../../../components/ui/classes';
import { makeMessage } from '../state/usePlaygroundSession';
import type { PlaygroundMessage, PlaygroundRole } from '../state/types';

interface Props {
  projectId: string;
  onClose: () => void;
  onLoad: (messages: PlaygroundMessage[]) => void;
}

const ALLOWED_KINDS = new Set(['agentCall', 'testCase']);

export function SeedFromSearchModal({ projectId, onClose, onLoad }: Props) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (query.trim().length < 2) { setHits([]); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const t = setTimeout(async () => {
      try {
        const r = await searchApi.search(projectId, query.trim());
        if (!cancelled) {
          setHits(r.hits.filter(h => ALLOWED_KINDS.has(h.kind)));
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, projectId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const pick = async (hit: SearchHit) => {
    try {
      if (hit.kind === 'agentCall') {
        const call = await agentCallsApi.get(hit.entityId);
        onLoad(agentCallToMessages(call));
      } else {
        const tc = await testCasesApi.get(hit.entityId);
        onLoad(testCaseToMessages(tc));
      }
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Modal title="Load conversation from search" onClose={onClose} size="lg">
      <input
        autoFocus
        className={formInputCls}
        placeholder="Search traces and test cases (min 2 chars)…"
        value={query}
        onChange={e => setQuery(e.target.value)}
      />

      <div className="mt-[12px] max-h-[440px] overflow-y-auto flex flex-col gap-[6px]">
        {loading && <div className="text-[12px] text-muted">Searching…</div>}
        {error && <div className="text-[12px] text-danger">{error}</div>}
        {!loading && hits.length === 0 && query.trim().length >= 2 && (
          <div className="text-[12px] text-muted italic">No traces or test cases match.</div>
        )}
        {hits.map(hit => (
          <button
            key={`${hit.kind}-${hit.entityId}`}
            onClick={() => pick(hit)}
            className="text-left p-[10px] rounded-[10px] border border-border bg-card-2 hover:bg-[rgba(255,255,255,0.04)] cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-[4px]">
              <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-accent">{hit.kind}</span>
              <span className="text-[12.5px] font-semibold">{hit.title}</span>
            </div>
            {hit.snippet && (
              <div
                className="text-[11.5px] text-secondary line-clamp-2"
                dangerouslySetInnerHTML={{ __html: hit.snippet }}
              />
            )}
          </button>
        ))}
      </div>
    </Modal>
  );
}

function roleFromString(role: string): PlaygroundRole {
  const lower = role.toLowerCase();
  if (lower === 'user' || lower === 'assistant' || lower === 'system' || lower === 'tool') return lower;
  return 'user';
}

function agentCallToMessages(call: AgentCallDto): PlaygroundMessage[] {
  const out: PlaygroundMessage[] = call.request.map(toPlaygroundMessage);
  if (call.response) out.push(toPlaygroundMessage(call.response));
  return out;
}

function toPlaygroundMessage(m: MessageDto): PlaygroundMessage {
  const base = makeMessage(roleFromString(m.role), m.content ?? '');
  if (m.toolRequests && m.toolRequests.length > 0) {
    base.toolRequests = m.toolRequests.map(tr => ({ id: tr.id, name: tr.name, arguments: tr.arguments }));
  }
  if (m.toolCallId) base.toolCallId = m.toolCallId;
  return base;
}

function testCaseToMessages(tc: TestCaseDto): PlaygroundMessage[] {
  const fromInput = (tc.input ?? []).map((m: TestSuiteMessageDto) =>
    makeMessage(roleFromString(m.role), m.content ?? ''));
  if (tc.expectedOutput) {
    fromInput.push(makeMessage(roleFromString(tc.expectedOutput.role), tc.expectedOutput.content ?? ''));
  }
  return fromInput;
}
