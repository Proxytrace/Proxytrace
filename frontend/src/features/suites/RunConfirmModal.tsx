import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trans, Plural, useLingui } from '@lingui/react/macro';
import type { ModelEndpointDto, TestSuiteListItemDto } from '../../api/models';
import { agentColor } from '../../lib/colors';
import useModelEndpoints from '../../hooks/useModelEndpoints';
import { Modal } from '../../components/overlays/Modal';
import { Button } from '../../components/ui/Button';
import { RunForm } from './components/RunForm';

interface Props {
  suite: TestSuiteListItemDto;
  onClose: () => void;
  onSubmit: (endpointIds: string[]) => void;
  loading: boolean;
  done: boolean;
}

export function RunConfirmModal({ suite, onClose, onSubmit, loading, done }: Props) {
  const navigate = useNavigate();
  const { data: modelsData = [] } = useModelEndpoints();
  const [selectedEndpoints, setSelectedEndpoints] = useState<string[]>([]);
  const c = agentColor(suite.agentId);
  const isMulti = selectedEndpoints.length > 1;

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
          onChange={setSelectedEndpoints}
          onCancel={onClose}
          onSubmit={() => onSubmit(selectedEndpoints)}
        />
      )}
    </Modal>
  );
}

interface DoneStateProps {
  suite: TestSuiteListItemDto;
  agentColor: string;
  isMulti: boolean;
  selectedEndpoints: string[];
  modelsData: ModelEndpointDto[];
  onNavigate: () => void;
}

function DoneState({ suite, agentColor: c, isMulti, selectedEndpoints, modelsData, onNavigate }: DoneStateProps) {
  const { t } = useLingui();
  const selectedModelName =
    modelsData.find(ep => selectedEndpoints.includes(ep.id))?.modelName ?? t`selected model`;

  return (
    <div className="py-[10px] text-center">
      <div
        className="w-[52px] h-[52px] rounded-[15px] bg-success-subtle flex items-center justify-center mx-auto mb-4 text-success text-[24px] border border-[color-mix(in_srgb,var(--success)_30%,transparent)]"
      >
        ✓
      </div>
      <h3 className="text-[17px] font-bold mb-2">
        {isMulti ? <Trans>Parallel evaluation started</Trans> : <Trans>Evaluation started</Trans>}
      </h3>
      <p className="text-body text-muted leading-[1.6] mb-6">
        <Trans>Running <strong className="text-primary"><Plural value={suite.testCaseCount} one="# test case" other="# test cases" /></strong></Trans>
        {isMulti ? (
          <> <Trans>across <strong style={{ color: c }}><Plural value={selectedEndpoints.length} one="# model" other="# models" /></strong> in parallel</Trans></>
        ) : selectedEndpoints.length === 1 ? (
          <> <Trans>against <strong style={{ color: c }}>{selectedModelName}</strong></Trans></>
        ) : null}
        .
      </p>
      <Button variant="primary" onClick={onNavigate}>
        <Trans>View Test Runs →</Trans>
      </Button>
    </div>
  );
}
