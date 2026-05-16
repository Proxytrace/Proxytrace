import type { AgentDto } from '../../api/models';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAgentStats } from './useAgentStats';
import { IdentityWidget } from './widgets/IdentityWidget';
import { KpiTraces, KpiTokens, KpiCost, KpiLatency } from './widgets/KpiWidgets';
import { PassRateWidget } from './widgets/PassRateWidget';
import { ChartsWidget } from './widgets/ChartsWidget';
import { SystemPromptWidget } from './widgets/SystemPromptWidget';
import { ToolsWidget } from './widgets/ToolsWidget';
import { ModelParametersWidget } from './widgets/ModelParametersWidget';
import { SuitePassRatesWidget } from './widgets/SuitePassRatesWidget';

interface Props {
  agent: AgentDto;
  onDelete: () => void;
  highlightTool?: string | null;
}

export function AgentDetail({ agent, onDelete, highlightTool }: Props) {
  const { overview, isLoading, range, setRange } = useAgentStats(agent.id);

  return (
    <div
      className="fade-up grid gap-3 min-w-0"
      style={{
        gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
        gridAutoRows: 'min-content',
        animationDelay: '40ms',
      }}
    >
      <IdentityWidget agent={agent} onDelete={onDelete} className="col-span-12" />

      <SystemPromptWidget systemMessage={agent.systemMessage} className="col-span-12 lg:col-span-7" />
      <ToolsWidget tools={agent.tools} highlightTool={highlightTool} className="col-span-12 lg:col-span-5" />

      {isLoading && (
        <>
          <Skeleton height={92} className="col-span-12 sm:col-span-6 lg:col-span-3 rounded-lg" />
          <Skeleton height={92} className="col-span-12 sm:col-span-6 lg:col-span-3 rounded-lg" />
          <Skeleton height={92} className="col-span-12 sm:col-span-6 lg:col-span-3 rounded-lg" />
          <Skeleton height={92} className="col-span-12 sm:col-span-6 lg:col-span-3 rounded-lg" />
          <Skeleton height={240} className="col-span-12 lg:col-span-4 rounded-lg" />
          <Skeleton height={240} className="col-span-12 lg:col-span-8 rounded-lg" />
        </>
      )}

      {!isLoading && overview && overview.summary.totalTraces === 0 && (
        <div className="col-span-12 bg-card rounded-lg py-6 shadow-[var(--shadow-card)]">
          <EmptyState
            title="No activity yet"
            description="KPIs and charts appear once this agent is invoked."
          />
        </div>
      )}

      {!isLoading && overview && overview.summary.totalTraces > 0 && (
        <>
          <KpiTraces overview={overview} range={range} className="col-span-12 sm:col-span-6 lg:col-span-3" />
          <KpiTokens overview={overview} range={range} className="col-span-12 sm:col-span-6 lg:col-span-3" />
          <KpiCost overview={overview} range={range} className="col-span-12 sm:col-span-6 lg:col-span-3" />
          <KpiLatency overview={overview} range={range} className="col-span-12 sm:col-span-6 lg:col-span-3" />

          <PassRateWidget overview={overview} className="col-span-12 lg:col-span-4" />
          <ChartsWidget overview={overview} range={range} onRangeChange={setRange} className="col-span-12 lg:col-span-8" />
        </>
      )}

      {!isLoading && overview && overview.suitePassRates.length > 0 && (
        <SuitePassRatesWidget suitePassRates={overview.suitePassRates} className="col-span-12" />
      )}

      <ModelParametersWidget params={agent.modelParameters} className="col-span-12" />
    </div>
  );
}
