import { useState } from 'react';
import type { AgentDto } from '../../api/models';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAgentStats } from './useAgentStats';
import { useAgentVersions } from './hooks/useAgentVersions';
import { AgentHeader } from './widgets/AgentHeader';
import { PerformanceCard } from './widgets/PerformanceCard';
import { SystemPromptWidget } from './widgets/SystemPromptWidget';
import { ToolsWidget } from './widgets/ToolsWidget';
import { ModelParametersWidget } from './widgets/ModelParametersWidget';
import { SuitePassRatesWidget } from './widgets/SuitePassRatesWidget';
import { VersionsWidget } from './VersionsWidget';

interface Props {
  agent: AgentDto;
  onDelete: () => void;
  highlightTool?: string | null;
}

export function AgentDetail({ agent, onDelete, highlightTool }: Props) {
  const { overview, isLoading, range, setRange } = useAgentStats(agent.id);
  const { versions, latestVersion } = useAgentVersions(agent.id);

  // null = follow latest; otherwise the version number being viewed.
  const [selected, setSelected] = useState<number | null>(null);
  const activeVersion = selected ?? latestVersion;
  const isLatest = activeVersion === latestVersion;

  const versionDto = versions.find(v => v.versionNumber === activeVersion);
  const displaySystemMessage = isLatest ? agent.systemMessage : versionDto?.systemMessage ?? agent.systemMessage;
  const displayTools = isLatest ? agent.tools : versionDto?.tools ?? agent.tools;

  return (
    <div className="fade-up flex flex-col gap-3.5 min-w-0 [animation-delay:40ms]">
      <AgentHeader agent={agent} overview={overview} onDelete={onDelete} />

      <PerformanceCard overview={overview} isLoading={isLoading} range={range} onRangeChange={setRange} />

      {/* Definition (left) + version history & metadata rail (right) */}
      <div className="grid gap-3.5 items-start grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-3.5 min-w-0">
          <SystemPromptWidget
            agentId={agent.id}
            systemMessage={displaySystemMessage}
            activeVersion={activeVersion}
            isLatest={isLatest}
          />
          <ToolsWidget tools={displayTools} highlightTool={highlightTool} />
        </div>

        <div className="flex flex-col gap-3.5 min-w-0">
          <VersionsWidget
            agent={agent}
            selectedVersion={activeVersion}
            onSelect={n => setSelected(n === latestVersion ? null : n)}
          />

          {isLoading ? (
            <Skeleton height={120} className="rounded-lg" />
          ) : (
            overview && overview.suitePassRates.length > 0 && (
              <SuitePassRatesWidget suitePassRates={overview.suitePassRates} />
            )
          )}

          <ModelParametersWidget params={agent.modelParameters} />
        </div>
      </div>
    </div>
  );
}
