import type { ProposalDetailsDto } from '../../../api/models';
import { SystemPromptSection } from './PromptDiff';
import { ModelSwitchSection } from './ModelSwitchSection';
import { ToolUpdateSection } from './ToolUpdateSection';

/** Kind-specific rendering of a proposed change: prompt diff, model swap, or tool diff. */
export function ChangeSections({ details }: { details: ProposalDetailsDto }) {
  if (details.kind === 'SystemPrompt') return <SystemPromptSection details={details} />;
  if (details.kind === 'ModelSwitch') return <ModelSwitchSection details={details} />;
  return <ToolUpdateSection details={details} />;
}
