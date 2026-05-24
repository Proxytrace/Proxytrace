import { useState } from 'react';
import type { ProviderDto } from '../../api/models';
import useCurrentProject from '../../hooks/useCurrentProject';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PlusIcon } from '../../components/icons';
import { useProviders, useProviderProjects } from './hooks/useProviderQueries';
import { ProviderList } from './components/ProviderList';
import { ProviderDetail, type ProviderTab } from './components/ProviderDetail';
import { AddProviderModal } from './components/AddProviderModal';

export default function Providers() {
  const { currentProjectId } = useCurrentProject();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<ProviderTab>('models');
  const [showNewProvider, setShowNewProvider] = useState(false);

  const { data: providersData, isLoading: providersLoading } = useProviders();
  const { data: projectsData } = useProviderProjects();

  const providers = providersData?.items ?? [];
  const projects = projectsData?.items ?? [];
  const selected = providers.find(p => p.id === selectedId)
    ?? (providers.length > 0 && !selectedId ? providers[0] : null);

  function selectProvider(p: ProviderDto) {
    setSelectedId(p.id);
  }

  function handleDeleted() {
    const remaining = providers.filter(p => p.id !== selected?.id);
    setSelectedId(remaining[0]?.id ?? null);
  }

  return (
    <div className="w-full min-w-0 flex flex-col gap-4">
      <div className="fade-up flex items-start justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-h1 font-semibold m-0 mb-1 text-primary">Providers</h1>
          <p className="text-body-sm text-muted m-0">Configure upstream model providers and manage Trsr API keys.</p>
        </div>
        <Button variant="primary" size="sm" leftIcon={<PlusIcon size={14} />} onClick={() => setShowNewProvider(true)}>
          Add provider
        </Button>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-[280px_1fr] gap-3">
        <ProviderList
          providers={providers}
          loading={providersLoading}
          selectedId={selected?.id ?? null}
          onSelect={selectProvider}
        />

        {selected ? (
          <ProviderDetail
            key={selected.id}
            provider={selected}
            projects={projects}
            defaultProjectId={currentProjectId ?? projects[0]?.id ?? ''}
            tab={tab}
            onTabChange={setTab}
            onDeleted={handleDeleted}
          />
        ) : (
          <Card elevation="raised" padding="lg" className="flex items-center justify-center text-muted text-body">
            Add your first provider to get started.
          </Card>
        )}
      </div>

      {showNewProvider && (
        <AddProviderModal
          onClose={() => setShowNewProvider(false)}
          onCreated={id => { setShowNewProvider(false); setSelectedId(id); }}
        />
      )}
    </div>
  );
}
