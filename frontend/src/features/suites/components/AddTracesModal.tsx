import { useState } from 'react';
import type { AgentCallDto } from '../../../api/models';
import { Modal, ModalFooter } from '../../../components/overlays/Modal';
import { TracesStep } from '../CreateSuiteWizard';

interface Props {
  agentId: string;
  onClose: () => void;
  /** Called with the chosen traces when the user confirms. Purely additive — the host stages them. */
  onAdd: (traces: AgentCallDto[]) => void;
}

/** Focused picker for adding test cases from captured traces, reusing the create-wizard's
 * `TracesStep` (search, time-range filter, select-all, two-pane list + live conversation preview).
 * Opens empty each time; confirming stages the selection on the suite (shown as pending-add rows
 * until Save). */
export function AddTracesModal({ agentId, onClose, onAdd }: Props) {
  const [selected, setSelected] = useState<Map<string, AgentCallDto>>(new Map());

  function toggle(trace: AgentCallDto) {
    setSelected(prev => {
      const next = new Map(prev);
      if (next.has(trace.id)) next.delete(trace.id);
      else next.set(trace.id, trace);
      return next;
    });
  }

  function selectAll(traces: AgentCallDto[]) {
    setSelected(prev => {
      const next = new Map(prev);
      traces.forEach(t => next.set(t.id, t));
      return next;
    });
  }

  function confirm() {
    onAdd([...selected.values()]);
    onClose();
  }

  return (
    <Modal
      title="Add cases from traces"
      onClose={onClose}
      size="xl"
      footer={
        <ModalFooter
          onCancel={onClose}
          onSubmit={confirm}
          submitLabel={selected.size > 0 ? `Add ${selected.size} to suite` : 'Add to suite'}
          disabled={selected.size === 0}
        />
      }
    >
      <TracesStep
        agentId={agentId}
        selected={new Set(selected.keys())}
        onToggle={toggle}
        onSelectAll={selectAll}
        onClear={() => setSelected(new Map())}
      />
    </Modal>
  );
}
