import { useLingui } from '@lingui/react/macro';
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
  const { t } = useLingui();
  const sum = summary(params);
  return (
    <Widget
      title={t`Model Parameters`}
      right={sum && <span className="text-body-sm text-muted font-mono">{sum}</span>}
      className={className}
      collapsible
      defaultCollapsed
      expandTitle={t`Model Parameters`}
      expandContent={<ModelParametersGrid params={params} />}
    >
      <ModelParametersGrid params={params} />
    </Widget>
  );
}
