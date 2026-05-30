import type { ApiKeyDto, ModelEndpointDto, ProjectDto, ProviderDto } from '../../../api/models';
import { cn } from '../../../lib/cn';
import { Card } from '../../../components/ui/Card';
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

export function ProviderDetail({ provider, models, keys, projects, defaultProjectId, tab, onTabChange, onDeleted }: ProviderDetailProps) {

  return (
    <Card elevation="raised" padding="none" className="flex flex-col overflow-hidden">
      <ProviderDetailHeader provider={provider} onDeleted={onDeleted} />

      <div className="flex border-b border-hairline shrink-0 px-2">
        {(['models', 'keys'] as const).map(t => {
          const count = t === 'models' ? models.length : keys.length;
          const active = tab === t;
          return (
            <button
              key={t}
              data-testid={`${t}-tab`}
              onClick={() => onTabChange(t)}
              className={cn(
                'relative px-4 py-3 text-title font-semibold cursor-pointer bg-transparent border-none',
                'transition-colors duration-[var(--motion-base)] ease-[var(--ease-standard)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)] focus-visible:rounded-sm',
                active ? 'text-accent' : 'text-muted hover:text-primary',
              )}
            >
              <span className="inline-flex items-center gap-2">
                {t === 'models' ? 'Models' : 'API keys'}
                {count > 0 && (
                  <span
                    data-testid={t === 'models' ? 'provider-model-count' : 'provider-key-count'}
                    className={cn('text-caption font-semibold px-1.5 py-px rounded-full', active ? 'bg-accent-subtle text-accent' : 'bg-card-2 text-muted')}
                  >
                    {count}
                  </span>
                )}
              </span>
              {active && <span aria-hidden className="absolute left-2 right-2 -bottom-px h-[2px] bg-accent rounded-full" />}
            </button>
          );
        })}
      </div>

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
