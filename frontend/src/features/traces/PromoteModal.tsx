import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AgentCallDto, MessageDto, TestSuiteDto } from '../../api/models';
import { testSuitesApi } from '../../api/test-suites';
import { agentColor, EVALUATOR_KIND_COLOR } from '../../lib/colors';
import { fmtRelative, fmtPct } from '../../lib/format';
import { PlusIcon, XIcon, CheckIcon } from '../../components/icons';
import { ColoredBadge } from '../../components/ui/ColoredBadge';
import { MessageBubble } from '../../components/ui/MessageBubble';
import { ToolMessageBubble } from '../../components/ui/ToolMessageBubble';
import useToast from '../../hooks/useToast';
import { Button } from '../../components/ui/Button';

interface Props {
  trace: AgentCallDto;
  suites: TestSuiteDto[];
  onClose: () => void;
}

export function PromoteModal({ trace, suites, onClose }: Props) {
  const aColor = agentColor(trace.agentId ?? trace.id);
  const agentLabel = trace.agentName ?? 'Agent';

  const [suiteId, setSuiteId] = useState<string>(suites[0]?.id ?? '');
  const { show: toast } = useToast();
  const qc = useQueryClient();

  const inputMessages = trace.request.filter(m => m.role !== 'system');
  const expected: MessageDto | null = trace.response ?? null;
  const hasSystem = trace.request.some(m => m.role === 'system');
  const expectedToolResultByCallId = new Map<string, MessageDto>();

  const selectedSuite = suites.find(s => s.id === suiteId) ?? null;

  const addCase = useMutation({
    mutationFn: () => testSuitesApi.addTestCase(suiteId, trace.id),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['test-suites'] });
      toast(`Added to ${updated.name}`, 'success');
      onClose();
    },
    onError: (err) => {
      console.error(err);
    },
  });

  const errorMsg = addCase.isError
    ? ((addCase.error as Error).message || 'Failed to add test case')
    : null;
  const submitDisabled = !suiteId || addCase.isPending;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center p-5 fade-up bg-[rgba(0,0,0,0.65)] backdrop-blur-[8px]"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[980px] h-[min(720px,90vh)] bg-card rounded-[20px] flex flex-col overflow-hidden shadow-[var(--shadow-float)]"
      >
        {/* Header */}
        <div className="px-6 py-[18px] flex items-center gap-[14px] border-b border-hairline shrink-0">
          <div
            className="w-9 h-9 rounded-md flex items-center justify-center text-white shrink-0 bg-[image:var(--grad-accent)]"
          >
            <PlusIcon strokeWidth={2.5} size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[16px] font-bold">Promote to Test Case</h2>
            <p className="text-[12px] text-muted mt-[2px]">Adds this trace as a single test case to the selected suite.</p>
          </div>
          <ColoredBadge color={aColor} label={agentLabel} dot size="md" />
          <span className="mono text-[11px] text-muted">{trace.id.slice(0, 10)}…</span>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="btn-icon cursor-pointer"
          >
            <XIcon size={14} />
          </button>
        </div>

        {/* Body — two columns */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left: preview */}
          <div className="flex-1 min-w-0 border-r border-hairline overflow-y-auto px-6 py-5 flex flex-col gap-[16px]">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10.5px] font-semibold text-muted uppercase tracking-[0.08em]">
                  Input · {inputMessages.length} message{inputMessages.length !== 1 ? 's' : ''}
                </span>
                {hasSystem && (
                  <span className="text-[10.5px] text-muted italic">System messages excluded</span>
                )}
              </div>
              {inputMessages.length === 0 ? (
                <div className="px-3 py-4 bg-card-2 rounded-[10px] text-[12px] text-muted text-center">
                  No input messages.
                </div>
              ) : (
                <div className="flex flex-col gap-[8px]">
                  {inputMessages.map((msg, i) => (
                    <MessageBubble key={i} msg={msg} defaultOpen />
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="text-[10.5px] font-semibold text-muted uppercase tracking-[0.08em] mb-2">
                Expected output
              </div>
              {expected === null ? (
                <div className="px-3 py-4 bg-card-2 rounded-[10px] text-[12px] text-muted text-center">
                  This trace has no response.
                </div>
              ) : (
                <div className="flex flex-col gap-[8px]">
                  {expected.content?.trim() && <MessageBubble msg={expected} defaultOpen />}
                  {expected.toolRequests?.map(req => (
                    <ToolMessageBubble
                      key={req.id}
                      request={req}
                      result={expectedToolResultByCallId.get(req.id)}
                    />
                  ))}
                  {!expected.content?.trim() && !(expected.toolRequests?.length) && (
                    <div className="px-3 py-4 bg-card-2 rounded-[10px] text-[12px] text-muted text-center">
                      Response is empty.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: suite picker + stats */}
          <div className="w-[360px] shrink-0 flex flex-col min-h-0">
            <div className="px-5 pt-5 pb-3 shrink-0">
              <div className="text-[10.5px] font-semibold text-muted uppercase tracking-[0.08em]">
                Destination suite
              </div>
              <div className="text-[11px] text-muted mt-[3px]">
                {suites.length} suite{suites.length !== 1 ? 's' : ''} for this agent
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-3 flex flex-col gap-[6px]">
              {suites.map(s => {
                const isSel = s.id === suiteId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSuiteId(s.id)}
                    className="text-left rounded-md px-3 py-2.5 cursor-pointer transition-all duration-150 flex items-start gap-2"
                    style={{
                      background: isSel ? 'var(--accent-subtle)' : 'var(--bg-card-2)',
                      boxShadow: isSel
                        ? 'inset 0 0 0 1.5px color-mix(in srgb, var(--accent-primary) 67%, transparent)'
                        : 'inset 0 0 0 1px var(--border-color)',
                    }}
                  >
                    <span
                      className="w-[14px] h-[14px] rounded-full mt-[2px] shrink-0 flex items-center justify-center transition-all duration-150"
                      style={{
                        background: isSel ? 'var(--accent-primary)' : 'transparent',
                        border: isSel ? '1.5px solid var(--accent-primary)' : '1.5px solid var(--border-color)',
                        boxShadow: isSel ? '0 0 8px var(--accent-glow)' : 'none',
                      }}
                    >
                      {isSel && <span className="text-white inline-flex"><CheckIcon size={9} strokeWidth={3} /></span>}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[12.5px] font-semibold truncate" style={{ color: isSel ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {s.name}
                      </span>
                      <span className="block text-[10.5px] text-muted mt-[2px]">
                        {s.testCases.length} case{s.testCases.length !== 1 ? 's' : ''} · {s.evaluators.length} evaluator{s.evaluators.length !== 1 ? 's' : ''}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Stats panel */}
            <div className="px-5 py-4 border-t border-hairline shrink-0 bg-[rgba(0,0,0,0.18)]">
              {selectedSuite ? (
                <SuiteStats suite={selectedSuite} />
              ) : (
                <div className="text-[12px] text-muted text-center py-2">Select a suite</div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-[14px] border-t border-hairline flex items-center justify-between gap-3 shrink-0 bg-[rgba(0,0,0,0.15)]">
          <div className="text-[11.5px] min-w-0 flex-1">
            {errorMsg && <span className="text-[var(--danger)]">{errorMsg}</span>}
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => addCase.mutate()}
              disabled={submitDisabled}
              loading={addCase.isPending}
              leftIcon={!addCase.isPending && <PlusIcon strokeWidth={2.5} size={13} />}
            >
              {addCase.isPending ? 'Adding…' : 'Add to suite'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SuiteStats({ suite }: { suite: TestSuiteDto }) {
  const passRateLabel = suite.passRate != null ? fmtPct(suite.passRate) : '—';
  const lastRunLabel = suite.lastRunAt ? fmtRelative(suite.lastRunAt) : 'never';

  return (
    <div className="flex flex-col gap-[12px]">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Cases" value={String(suite.testCases.length)} accent="var(--accent-primary)" />
        <Stat label="Pass rate" value={passRateLabel} accent="var(--success)" />
        <Stat label="Total runs" value={String(suite.totalRuns)} accent="var(--teal)" />
      </div>
      <div>
        <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.08em] mb-[6px]">
          Evaluators
        </div>
        {suite.evaluators.length === 0 ? (
          <div className="text-[11px] text-muted italic">None configured</div>
        ) : (
          <div className="flex flex-wrap gap-[5px]">
            {suite.evaluators.map(e => (
              <ColoredBadge key={e.id} color={EVALUATOR_KIND_COLOR[e.kind]} label={e.kind} size="sm" />
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between text-[10.5px] text-muted">
        <span>Last run</span>
        <span className="text-secondary">{lastRunLabel}</span>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-card rounded-[8px] px-2 py-[8px] text-center shadow-[inset_0_0_0_1px_var(--border-color)]">
      <div className="text-[15px] font-bold font-mono" style={{ color: accent }}>{value}</div>
      <div className="text-[9px] text-muted uppercase tracking-[0.06em] mt-[1px]">{label}</div>
    </div>
  );
}
