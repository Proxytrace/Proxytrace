import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setupApi } from '../../api/setup';
import { QUERY_KEYS } from '../../api/query-keys';
import { useToast } from '../../components/ui/Toast';
import { ConfirmDialog } from '../../components/overlays/ConfirmDialog';
import { TrashIcon } from '../../components/icons';

const DELETED = [
  'Agent calls (traces)',
  'Test runs & test run groups',
  'Test results',
  'Evaluations',
  'Optimization proposals',
];

const KEPT = [
  'Providers, Models & Endpoints',
  'Agents',
  'Test suites & Test cases',
  'Evaluators',
  'Projects, Users & API keys',
];

const CONFIRM_PHRASE = 'delete all non-model data';

export function DangerZoneTab() {
  const qc = useQueryClient();
  const { show: toast } = useToast();
  const [confirm, setConfirm] = useState(false);

  const cleanup = useMutation({
    mutationFn: () => setupApi.cleanupNonModelData(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-calls'] });
      qc.invalidateQueries({ queryKey: ['test-run-groups'] });
      qc.invalidateQueries({ queryKey: ['proposals'] });
      qc.invalidateQueries({ queryKey: ['statistics-summary'] });
      qc.invalidateQueries({ queryKey: ['statistics-latency'] });
      qc.invalidateQueries({ queryKey: ['statistics-model-breakdown'] });
      qc.invalidateQueries({ queryKey: ['statistics-agent-breakdown'] });
      qc.invalidateQueries({ queryKey: ['agent-stats-overview'] });
      qc.invalidateQueries({ queryKey: ['agent-suite-pass-rates'] });
      qc.invalidateQueries({ queryKey: ['agent-counts'] });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.testSuites() });
      setConfirm(false);
      toast('Non-model data deleted', 'success');
    },
    onError: (err) => toast((err as Error).message || 'Failed to delete data', 'error'),
  });

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-[760px] flex flex-col gap-4">
        <div className="bg-card border border-[rgba(217,85,85,0.3)] rounded-[14px] p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-[16px] font-bold text-[#d95555] m-0 mb-1">Delete all non-model data</h2>
            <p className="text-[13px] text-secondary m-0">
              Wipes runtime/trace data while preserving configuration. This action cannot be undone.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card-2 border border-hairline rounded-[10px] p-3">
              <div className="text-[12px] font-semibold text-[#d95555] mb-2 uppercase tracking-wide">Will be deleted</div>
              <ul className="m-0 pl-4 flex flex-col gap-1">
                {DELETED.map(x => (
                  <li key={x} className="text-[12.5px] text-primary">{x}</li>
                ))}
              </ul>
            </div>
            <div className="bg-card-2 border border-hairline rounded-[10px] p-3">
              <div className="text-[12px] font-semibold text-[#3daa6f] mb-2 uppercase tracking-wide">Will be kept</div>
              <ul className="m-0 pl-4 flex flex-col gap-1">
                {KEPT.map(x => (
                  <li key={x} className="text-[12.5px] text-primary">{x}</li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <button
              onClick={() => setConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-[7px] rounded-lg text-[12.5px] font-semibold cursor-pointer bg-transparent border border-[rgba(217,85,85,0.3)] text-[#d95555] hover:bg-[rgba(217,85,85,0.08)]"
            >
              <TrashIcon size={14} />
              Delete all non-model data
            </button>
          </div>
        </div>
      </div>

      {confirm && (
        <ConfirmDialog
          entityName={CONFIRM_PHRASE}
          onCancel={() => setConfirm(false)}
          onConfirm={() => cleanup.mutate()}
          loading={cleanup.isPending}
        />
      )}
    </div>
  );
}
