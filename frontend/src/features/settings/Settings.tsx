import { useState } from 'react';
import { Tabs } from '../../components/ui/Tabs';
import { ProjectsTab } from './ProjectsTab';
import { SearchIndexingTab } from './SearchIndexingTab';
import { DangerZoneTab } from './DangerZoneTab';

const TABS = [
  { id: 'projects', label: 'Projects', render: () => <ProjectsTab /> },
  { id: 'search', label: 'Search indexing', render: () => <SearchIndexingTab /> },
  { id: 'danger', label: 'Danger zone', render: () => <DangerZoneTab /> },
] as const;

type TabId = typeof TABS[number]['id'];

export default function Settings() {
  const [tab, setTab] = useState<TabId>('projects');
  const active = TABS.find(t => t.id === tab) ?? TABS[0];

  return (
    <div className="w-full min-w-0 flex flex-col gap-[14px]">
      <header className="fade-up shrink-0">
        <h1 className="text-[24px] font-bold tracking-[-0.02em] m-0 mb-1">Settings</h1>
        <p className="text-[14px] text-muted m-0">Configure projects and team membership.</p>
      </header>
      <Tabs
        className="shrink-0"
        value={tab}
        onChange={t => setTab(t as TabId)}
        items={TABS.map(t => ({ value: t.id, label: t.label }))}
      />
      <div className="flex-1 min-h-0 flex flex-col">{active.render()}</div>
    </div>
  );
}
