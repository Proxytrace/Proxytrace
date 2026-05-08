import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../api/projects';
import { QUERY_KEYS } from '../api/query-keys';
import type { ProjectDto } from '../api/models';

const STORAGE_KEY = 'trsr:current-project-id';

interface ProjectContextValue {
  projects: ProjectDto[];
  currentProjectId: string | null;
  currentProject: ProjectDto | null;
  setCurrentProjectId: (id: string) => void;
  isLoading: boolean;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(id: string | null) {
  try {
    if (id === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore
  }
}

const PROJECT_SCOPED_KEYS = new Set([
  'agents',
  'agent-calls',
  'evaluators',
  'test-suites',
  'test-run-groups',
  'proposals',
  'statistics-summary',
  'statistics-latency',
  'statistics-model-breakdown',
  'statistics-agent-breakdown',
  'provider-keys',
]);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [currentProjectId, setCurrentProjectIdState] = useState<string | null>(() => readStored());

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.projects,
    queryFn: () => projectsApi.list({ pageSize: 100 }),
  });

  const projects = data?.items ?? [];

  useEffect(() => {
    if (projects.length === 0) return;
    const validId = projects.some(p => p.id === currentProjectId);
    if (!validId) {
      const next = projects[0].id;
      setCurrentProjectIdState(next);
      writeStored(next);
    }
  }, [projects, currentProjectId]);

  const setCurrentProjectId = useCallback((id: string) => {
    writeStored(id);
    setCurrentProjectIdState(id);
    qc.invalidateQueries({
      predicate: query => {
        const head = query.queryKey[0];
        return typeof head === 'string' && PROJECT_SCOPED_KEYS.has(head);
      },
    });
  }, [qc]);

  const currentProject = useMemo(
    () => projects.find(p => p.id === currentProjectId) ?? null,
    [projects, currentProjectId],
  );

  const value = useMemo<ProjectContextValue>(
    () => ({ projects, currentProjectId, currentProject, setCurrentProjectId, isLoading }),
    [projects, currentProjectId, currentProject, setCurrentProjectId, isLoading],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useCurrentProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useCurrentProject must be used inside <ProjectProvider>');
  return ctx;
}
