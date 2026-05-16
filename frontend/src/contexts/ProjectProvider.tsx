import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "../api/projects";
import { QUERY_KEYS } from "../api/query-keys";
import ProjectContext, { type ProjectContextValue } from "./ProjectContext";

const STORAGE_KEY = "trsr:current-project-id";

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
  "agents",
  "agent-calls",
  "evaluators",
  "test-suites",
  "test-run-groups",
  "proposals",
  "statistics-summary",
  "statistics-latency",
  "statistics-model-breakdown",
  "statistics-agent-breakdown",
  "provider-keys",
]);

export default function ProjectProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const qc = useQueryClient();
  const [storedProjectId, setStoredProjectId] = useState<string | null>(() =>
    readStored(),
  );

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.projects,
    queryFn: () => projectsApi.list({ pageSize: 100 }),
  });

  const projects = useMemo(() => data?.items ?? [], [data]);

  const currentProjectId = useMemo(() => {
    if (projects.length === 0) return storedProjectId;
    if (storedProjectId && projects.some((p) => p.id === storedProjectId)) {
      return storedProjectId;
    }
    return projects[0].id;
  }, [projects, storedProjectId]);

  useEffect(() => {
    const stored = readStored();
    if (currentProjectId !== stored) {
      writeStored(currentProjectId);
    }
  }, [currentProjectId]);

  const setCurrentProjectId = useCallback(
    (id: string) => {
      writeStored(id);
      setStoredProjectId(id);
      qc.invalidateQueries({
        predicate: (query) => {
          const head = query.queryKey[0];
          return typeof head === "string" && PROJECT_SCOPED_KEYS.has(head);
        },
      });
    },
    [qc],
  );

  const currentProject = useMemo(
    () => projects.find((p) => p.id === currentProjectId) ?? null,
    [projects, currentProjectId],
  );

  const value = useMemo<ProjectContextValue>(
    () => ({
      projects,
      currentProjectId,
      currentProject,
      setCurrentProjectId,
      isLoading,
    }),
    [
      projects,
      currentProjectId,
      currentProject,
      setCurrentProjectId,
      isLoading,
    ],
  );

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}
