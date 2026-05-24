import type { OptimizationProposalDto } from '../../api/models';
import { TestRunStatus } from '../../api/models';
import { KIND_META } from './shared';
import { displayStatus, isTerminal, titleFromRationale } from './shared';
import { useUpdateProposalStatus } from './hooks/useUpdateProposalStatus';
import { ProposalHeader } from './components/ProposalHeader';
import { PredictedImpactBand } from './components/PredictedImpactBand';
import { SystemPromptSection } from './components/PromptDiff';
import { ModelSwitchSection } from './components/ModelSwitchSection';
import { ToolUpdateSection } from './components/ToolUpdateSection';
import { EvidenceList } from './components/EvidenceList';
import { ProposalTerminalNote } from './components/ProposalTerminalNote';
import { ProposalActionBar } from './components/ProposalActionBar';
import { AbTestHero } from './AbTestHero';

interface Props {
  dto: OptimizationProposalDto;
}

export function ProposalDetail({ dto }: Props) {
  const updateStatus = useUpdateProposalStatus(dto.id);
  const kind = KIND_META[dto.kind];
  const status = displayStatus(dto);
  const terminal = isTerminal(dto);
  const ab = dto.abTestRun;
  const isAbRunning = ab?.status === TestRunStatus.Running || ab?.status === TestRunStatus.Pending;
  const abReady = ab?.status === TestRunStatus.Completed;

  const titleLine = titleFromRationale(dto.rationale);
  const restOfRationale = dto.rationale.length > titleLine.length
    ? dto.rationale.slice(titleLine.length).replace(/^[.!?\s]+/, '')
    : '';

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-4 [&>*]:shrink-0 [scrollbar-gutter:stable]">
        <ProposalHeader dto={dto} status={status} titleLine={titleLine}/>

        {restOfRationale && (
          <p
            className="text-body text-secondary leading-relaxed m-0 px-3.5 py-3 rounded-md whitespace-pre-wrap"
            style={{
              background: `color-mix(in srgb, ${kind.color} 4%, transparent)`,
              borderLeft: `2px solid color-mix(in srgb, ${kind.color} 40%, transparent)`,
            }}
          >
            {restOfRationale}
          </p>
        )}

        <PredictedImpactBand dto={dto}/>

        {ab && (isAbRunning || abReady) && (
          <AbTestHero ab={ab} expectedPassRateDelta={dto.expectedPassRateDelta}/>
        )}

        {dto.details.kind === 'SystemPrompt' && <SystemPromptSection details={dto.details}/>}
        {dto.details.kind === 'ModelSwitch'  && <ModelSwitchSection  details={dto.details}/>}
        {dto.details.kind === 'Tool'         && <ToolUpdateSection   details={dto.details}/>}

        {dto.evidenceTestRunIds.length > 0 && (
          <EvidenceList ids={dto.evidenceTestRunIds}/>
        )}

        <ProposalTerminalNote dto={dto}/>
      </div>

      {!terminal && (
        <ProposalActionBar
          abReady={abReady ?? false}
          hasAbRun={!!ab}
          updateStatus={updateStatus}
        />
      )}
    </div>
  );
}
