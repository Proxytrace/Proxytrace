import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { FlaskIcon } from '../../../../components/icons';
import { agentColor } from '../../../../lib/colors';
import { fmtPct } from '../../../../lib/format';
import type { TestSuiteDto } from '../../../../api/models';
import { ListCard, LIST_CARD_MAX } from './ListCard';
import { ListCardRow } from './ListCardRow';
import { toolUiState } from './tool-ui-state';

/** Inline renderer for the `list_suites` tool result. */
export const SuiteListToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const state = toolUiState(status, isError, result != null);
  const suites = (result as TestSuiteDto[] | undefined) ?? [];
  return (
    <ListCard
      state={state}
      icon={<FlaskIcon size={14} />}
      title="Test suites"
      count={suites.length}
      shown={Math.min(suites.length, LIST_CARD_MAX)}
      viewAllTo="/suites"
      pendingLabel="Loading suites…"
      emptyLabel="No test suites in this project yet."
      testId="tracey-suite-list"
    >
      {suites.slice(0, LIST_CARD_MAX).map((suite) => (
        <ListCardRow
          key={suite.id}
          to="/suites"
          color={agentColor(suite.agentId)}
          title={suite.name}
          subtitle={`${suite.agentName} · ${suite.testCases.length} cases`}
          right={
            <span className="font-mono text-body-sm tabular-nums text-muted">
              {suite.passRate != null ? `${fmtPct(suite.passRate)} pass` : '—'}
            </span>
          }
        />
      ))}
    </ListCard>
  );
};
