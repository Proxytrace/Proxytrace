import { createContext } from "react";
import type { ProjectListItemDto } from "../api/models";

export interface ProjectContextValue {
  projects: ProjectListItemDto[];
  currentProjectId: string | null;
  currentProject: ProjectListItemDto | null;
  setCurrentProjectId: (id: string) => void;
  isLoading: boolean;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);
export default ProjectContext;
