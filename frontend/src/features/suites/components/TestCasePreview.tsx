import { useLingui } from '@lingui/react/macro';
import type { AgentCallDto, TestCaseDto } from '../../../api/models';
import { ConversationView } from '../../../components/conversation/ConversationView';
import { fromAgentCall, fromTestCase } from '../../../components/conversation/adapters';
import { EmptyState } from '../../../components/ui/EmptyState';

function PreviewShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="h-full min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-2.5">
      <div className="text-caption font-semibold text-muted uppercase tracking-[0.08em]">{label}</div>
      {children}
    </div>
  );
}

export function TestCasePreview({ testCase }: { testCase: TestCaseDto }) {
  const { t } = useLingui();
  return (
    <PreviewShell label={t`Conversation · ${testCase.input.length} input · 1 expected`}>
      <ConversationView messages={fromTestCase(testCase)} />
    </PreviewShell>
  );
}

export function TraceConversationPreview({ trace }: { trace: AgentCallDto }) {
  const { t } = useLingui();
  return (
    <PreviewShell label={t`Trace preview · ${trace.model}`}>
      <ConversationView messages={fromAgentCall(trace)} />
    </PreviewShell>
  );
}

export function PreviewEmpty({ title, description }: { title: string; description?: string }) {
  return (
    <div className="h-full flex items-center justify-center">
      <EmptyState title={title} description={description} />
    </div>
  );
}
