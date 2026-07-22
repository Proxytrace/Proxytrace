import { Trans } from '@lingui/react/macro';
import type { SearchHit, SearchKind } from '../../api/search';
import { KIND_META } from './searchMeta';
import {
  UsersIcon, CheckboxIcon, ActivityIcon, ScaleIcon,
} from '../icons';
import { AgentCallPreview } from './AgentCallPreview';
import { TestCasePreview } from './TestCasePreview';
import { AgentPreview } from './AgentPreview';
import { TestSuitePreview } from './TestSuitePreview';
import { EvaluatorPreview } from './EvaluatorPreview';
import { GenericBody } from './SearchGenericBody';

// Icon map kept here (presentation concern, not pure logic)
const KIND_ICON: Record<SearchKind, (s: number) => React.ReactNode> = {
  agent:     s => <UsersIcon size={s} />,
  testSuite: s => <CheckboxIcon size={s} />,
  agentCall: s => <ActivityIcon size={s} />,
  evaluator: s => <ScaleIcon size={s} />,
  testCase:  s => <CheckboxIcon size={s} />,
};

function KindBody({ hit }: { hit: SearchHit }) {
  switch (hit.kind) {
    case 'agentCall':  return <AgentCallPreview id={hit.entityId} hit={hit} />;
    case 'testCase':   return <TestCasePreview  id={hit.entityId} hit={hit} />;
    case 'agent':      return <AgentPreview     id={hit.entityId} hit={hit} />;
    case 'testSuite':  return <TestSuitePreview id={hit.entityId} hit={hit} />;
    case 'evaluator':  return <EvaluatorPreview id={hit.entityId} hit={hit} />;
    default:           return <GenericBody hit={hit} />;
  }
}

export function SearchPreview({ hit }: { hit: SearchHit }) {
  const meta = KIND_META[hit.kind];
  const icon = KIND_ICON[hit.kind];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span
          className="text-caption uppercase tracking-wider font-semibold px-2 py-0.75 inline-flex items-center gap-1.5"
          style={{ background: `${meta.accent}1f`, color: meta.accent }}
        >
          {icon(11)}
          {meta.label}
        </span>
        {hit.score > 0 && (
          <span className="text-caption text-muted"><Trans>score {hit.score.toFixed(2)}</Trans></span>
        )}
      </div>

      <div className="text-h2 font-semibold text-primary leading-snug break-words">
        {hit.title}
      </div>

      <KindBody hit={hit} />
    </div>
  );
}
