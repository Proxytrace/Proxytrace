import type { ApiKeyDto, ModelEndpointDto, ProjectDto, ProviderDto } from '../../../api/models';
import { cn } from '../../../lib/cn';
import { Card } from '../../../components/ui/Card';
import { Tabs } from '../../../components/ui/Tabs';
import { ProviderDetailHeader } from './ProviderDetailHeader';
import { ModelsTab } from './ModelsTab';
import { KeysTab } from './KeysTab';

export type ProviderTab = 'models' | 'keys';

interface ProviderDetailProps {
  provider: ProviderDto;
  models: ModelEndpointDto[];
  keys: ApiKeyDto[];
  projects: ProjectDto[];
  defaultProjectId: string;
  tab: ProviderTab;
  onTabChange: (tab: ProviderTab) => void;
  onDeleted: () => void;
}

const countBadgeCls =
  'text-caption font-semibold px-1.5 py-px rounded-full bg-card-2 text-muted group-data-[state=active]:bg-accent-subtle group-data-[state=active]:text-accent';

export function ProviderDetail({ provider, models, keys, projects, defaultProjectId, tab, onTabChange, onDeleted }: ProviderDetailProps) {
  return (
    <Card elevation="raised" padding="none" className="flex flex-col overflow-hidden">
      <ProviderDetailHeader provider={provider} onDeleted={onDeleted} />

      <Tabs
        className="shrink-0 px-2"
        value={tab}
        onChange={t => onTabChange(t as ProviderTab)}
        items={[
          {
            value: 'models',
            'data-testid': 'models-tab',
            label: (
              <span className="inline-flex items-center gap-2">
                Models
                {models.length > 0 && (
                  <span data-testid="provider-model-count" className={countBadgeCls}>{models.length}</span>
                )}
              </span>
            ),
          },
          {
            value: 'keys',
            'data-testid': 'keys-tab',
            label: (
              <span className="inline-flex items-center gap-2">
                API keys
                {keys.length > 0 && (
                  <span data-testid="provider-key-count" className={countBadgeCls}>{keys.length}</span>
                )}
              </span>
            ),
          },
        ]}
      />

      <div className="flex-1 overflow-y-auto p-5">
        <div className={cn('flex flex-col gap-4', tab !== 'models' && 'hidden')}>
          <ModelsTab providerId={provider.id} models={models} />
        </div>
        <div className={cn('flex flex-col gap-4', tab !== 'keys' && 'hidden')}>
          <KeysTab providerId={provider.id} keys={keys} projects={projects} defaultProjectId={defaultProjectId} />
        </div>
      </div>
    </Card>
  );
}
