import { useMemo, useState } from 'react';
import type { AgentDto, AgentVersionDto } from '../../../api/models';
import { Modal, ModalFooter } from '../../../components/overlays/Modal';
import { Input } from '../../../components/ui/Input';
import {
  MOVE_CANDIDATE_FETCH_LIMIT, useMoveVersion, useMoveVersionCandidates,
} from '../hooks/useMoveVersion';

interface Props {
  version: AgentVersionDto;
  sourceAgent: AgentDto;
  onClose: () => void;
}

export function MoveVersionDialog({ version, sourceAgent, onClose }: Props) {
  const [targetAgentId, setTargetAgentId] = useState('');
  const [search, setSearch] = useState('');
  const { data: agents } = useMoveVersionCandidates(sourceAgent.projectId);
  const mutation = useMoveVersion(version.id, sourceAgent.id, sourceAgent.projectId, onClose);

  const filtered = useMemo(() => {
    const all = (agents?.items ?? []).filter((a) => a.id !== sourceAgent.id);
    const needle = search.trim().toLowerCase();
    return needle === '' ? all : all.filter((a) => a.name.toLowerCase().includes(needle));
  }, [agents?.items, search, sourceAgent.id]);

  const totalCandidates = (agents?.items?.length ?? 0) - 1;
  const truncated = totalCandidates >= MOVE_CANDIDATE_FETCH_LIMIT - 1;

  return (
    <Modal
      title={`Move version v${version.versionNumber}`}
      onClose={onClose}
      size="sm"
      footer={
        <ModalFooter
          onCancel={onClose}
          onSubmit={() => mutation.mutate(targetAgentId)}
          submitLabel={mutation.isPending ? 'Moving…' : 'Move'}
          loading={mutation.isPending}
          disabled={!targetAgentId}
        />
      }
    >
      <p className="text-xs text-muted mb-3">
        Choose the agent that should own this version. Calls referencing this version follow it.
        The source agent ({sourceAgent.name}) is deleted if it has no versions left.
      </p>
      <label className="block text-sm mb-2">
        Search
        <Input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter agents by name…"
          className="mt-1"
        />
      </label>
      <label className="block text-sm">
        Target agent
        {/* eslint-disable-next-line no-restricted-syntax -- multi-row listbox (size=N), not a dropdown Select */}
        <select
          className="mt-1 w-full rounded border border-border bg-background p-2 text-sm"
          value={targetAgentId}
          onChange={(e) => setTargetAgentId(e.target.value)}
          size={Math.min(8, Math.max(2, filtered.length))}
        >
          {filtered.length === 0 && <option value="">No matches</option>}
          {filtered.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      {truncated && (
        <p className="text-[11px] text-muted mt-2">
          Showing first {MOVE_CANDIDATE_FETCH_LIMIT} agents. Refine with search to find more.
        </p>
      )}
    </Modal>
  );
}
