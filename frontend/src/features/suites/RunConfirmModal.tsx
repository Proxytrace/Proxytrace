import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { providersApi } from '../../api/providers';
import type { ModelEndpointDto, TestSuiteDto } from '../../api/models';
import { agentColor } from '../../lib/colors';
import { QUERY_KEYS } from '../../api/query-keys';
import { Modal } from '../../components/overlays/Modal';
import { RunForm } from './components/RunForm';

interface Props {
  suite: TestSuiteDto;
  onClose: () => void;
  onSubmit: (endpointIds: string[]) => void;
  loading: boolean;
  done: boolean;
}

export function RunConfirmModal({ suite, onClose, onSubmit, loading, done }: Props) {
  const navigate = useNavigate();
  const { data: modelsData = [] } = useQuery({
    queryKey: QUERY_KEYS.modelEndpoints,
    queryFn: providersApi.getAllModels,
  });
  const [selectedEndpoints, setSelectedEndpoints] = useState<Set<string>>(new Set());
  const c = agentColor(suite.agentId);
  const isMulti = selectedEndpoints.size > 1;

  function toggle(id: string) {
    setSelectedEndpoints(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <Modal onClose={onClose} maxWidth={480}>
      {/* Accent bar — runtime colour. Modal padding is 28px (7 × 4px Tailwind units). */}
      <div
        className="h-[3px] -mx-7 -mt-7 mb-5 rounded-t-xl"
        style={{ background: `linear-gradient(90deg, ${c}, color-mix(in srgb, ${c} 38%, transparent))` }}
      />

      {done ? (
        <DoneState
          suite={suite}
          agentColor={c}
          isMulti={isMulti}
          selectedEndpoints={selectedEndpoints}
          modelsData={modelsData as ModelEndpointDto[]}
          onNavigate={() => { navigate('/runs'); onClose(); }}
        />
      ) : (
        <RunForm
          suite={suite}
          modelsData={modelsData as ModelEndpointDto[]}
          selectedEndpoints={selectedEndpoints}
          loading={loading}
          isMulti={isMulti}
          onToggle={toggle}
          onCancel={onClose}
          onSubmit={() => onSubmit(Array.from(selectedEndpoints))}
        />
      )}
    </Modal>
  );
}

interface DoneStateProps {
  suite: TestSuiteDto;
  agentColor: string;
  isMulti: boolean;
  selectedEndpoints: Set<string>;
  modelsData: ModelEndpointDto[];
  onNavigate: () => void;
}

function DoneState({ suite, agentColor: c, isMulti, selectedEndpoints, modelsData, onNavigate }: DoneStateProps) {
  const selectedModelName =
    modelsData.find(ep => selectedEndpoints.has(ep.id))?.modelName ?? 'selected model';

  return (
    <div className="py-[10px] text-center">
      <div
        className="w-[52px] h-[52px] rounded-[15px] bg-success-subtle flex items-center justify-center mx-auto mb-4 text-success text-[24px] border border-[color-mix(in_srgb,var(--success)_30%,transparent)]"
      >
        ✓
      </div>
      <h3 className="text-[17px] font-bold mb-2">
        {isMulti ? 'Parallel evaluation started' : 'Evaluation started'}
      </h3>
      <p className="text-body text-muted leading-[1.6] mb-6">
        Running <strong className="text-primary">{suite.testCases.length} test cases</strong>
        {isMulti ? (
          <> across <strong style={{ color: c }}>{selectedEndpoints.size} models</strong> in parallel</>
        ) : selectedEndpoints.size === 1 ? (
          <> against <strong style={{ color: c }}>{selectedModelName}</strong></>
        ) : null}
        .
      </p>
      <button
        onClick={onNavigate}
        className="px-7 py-[10px] bg-[image:var(--grad-accent)] rounded-md text-body font-semibold text-white shadow-[var(--shadow-btn)]"
      >
        View Test Runs →
      </button>
    </div>
  );
}
