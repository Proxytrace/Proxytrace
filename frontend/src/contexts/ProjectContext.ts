import { createContext } from "react";
import type { ProjectDto } from "../api/models";

export interface ProjectContextValue {
  projects: ProjectDto[];
  currentProjectId: string | null;
  currentProject: ProjectDto | null;
  setCurrentProjectId: (id: string) => void;
  isLoading: boolean;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);
export default ProjectContext;
