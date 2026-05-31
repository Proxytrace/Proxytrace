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

  // Once the user has explicitly selected a project, honor it unconditionally. Deriving from
  // `projects.some(...)` made `effectiveId` flicker back to the fallback whenever the projects
  // query was momentarily between fetches, which reseeded dependent editor drafts and clobbered
  // in-progress edits. Fall back to the first project only when nothing is selected yet.
  const fallbackId = filtered[0]?.id ?? null;
  const effectiveId = selectedId ?? fallbackId;

  return { selectedId, setSelectedId, search, setSearch, projects, filtered, effectiveId, projectsLoading };
}
