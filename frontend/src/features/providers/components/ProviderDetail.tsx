import type { ApiKeyDto, AzureDeploymentType, ModelEndpointDto, ProjectDto, ProviderDto } from '../../../api/models';
import { Card } from '../../../components/ui/Card';
import { ProviderDetailHeader } from './ProviderDetailHeader';
import { ModelsSection } from './ModelsSection';
import { KeysSection } from './KeysSection';
import { isAzureEndpoint } from '../providerMeta';
import { useReloadProvider } from '../hooks/useProviderMutations';

interface ProviderDetailProps {
  provider: ProviderDto;
  models: ModelEndpointDto[];
  keys: ApiKeyDto[];
  projects: ProjectDto[];
  defaultProjectId: string;
  onDeleted: () => void;
}

export function ProviderDetail({ provider, models, keys, projects, defaultProjectId, onDeleted }: ProviderDetailProps) {
  const reload = useReloadProvider(provider.id);
  return (
    <Card elevation="raised" padding="none" className="flex flex-col overflow-hidden">
      <ProviderDetailHeader provider={provider} onDeleted={onDeleted} />
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-8">
        <ModelsSection
          providerId={provider.id}
          models={models}
          isAzure={isAzureEndpoint(provider.endpoint)}
          reloading={reload.isPending}
          onReload={(t: AzureDeploymentType) => reload.mutate(t)}
        />
        <KeysSection providerId={provider.id} keys={keys} projects={projects} defaultProjectId={defaultProjectId} />
      </div>
    </Card>
  );
}
