import type { ModelParametersDto } from '../../../api/models';
import { ModelParametersGrid } from '../../../components/ui/ModelParametersGrid';
import { Widget } from './Widget';

interface Props {
  params: ModelParametersDto;
  className?: string;
}

function summary(params: ModelParametersDto): string {
  const parts: string[] = [];
  if (params.temperature != null) parts.push(`temp ${params.temperature}`);
  if (params.maxTokens != null) parts.push(`${params.maxTokens.toLocaleString()} tok`);
  return parts.join(' · ');
}

export function ModelParametersWidget({ params, className }: Props) {
  const sum = summary(params);
  return (
    <Widget
      title="Model Parameters"
      right={sum && <span className="text-body-sm text-muted font-mono">{sum}</span>}
      className={className}
      collapsible
      defaultCollapsed
      expandTitle="Model Parameters"
      expandContent={<ModelParametersGrid params={params} />}
    >
      <ModelParametersGrid params={params} />
    </Widget>
  );
}
