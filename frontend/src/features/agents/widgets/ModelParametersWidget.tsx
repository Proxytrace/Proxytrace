import type { ModelParametersDto } from '../../../api/models';
import { ModelParametersGrid } from '../../../components/ui/ModelParametersGrid';
import { Widget } from './Widget';

interface Props {
  params: ModelParametersDto;
  className?: string;
}

export function ModelParametersWidget({ params, className }: Props) {
  return (
    <Widget
      title="Model Parameters"
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
