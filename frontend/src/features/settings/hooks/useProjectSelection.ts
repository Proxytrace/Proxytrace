import { useState } from 'react';
import { useProjects } from './useProjects';

/**
 * Shared project-list selection state for settings tabs: search filter plus a
 * sticky selection that falls back to the first filtered project when the
 * current selection is absent. Used by both ProjectsTab and SearchIndexingTab.
 */
export function useProjectSelection() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data: projectsData, isLoading: projectsLoading } = useProjects();
  const projects = projectsData?.items ?? [];

  const q = search.trim().toLowerCase();
  const filtered = q ? projects.filter(p => p.name.toLowerCase().includes(q)) : projects;

  const fallbackId = filtered[0]?.id ?? null;
  const effectiveId = selectedId && projects.some(p => p.id === selectedId) ? selectedId : fallbackId;

  return { selectedId, setSelectedId, search, setSearch, projects, filtered, effectiveId, projectsLoading };
}
