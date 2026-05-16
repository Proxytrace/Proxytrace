import { useContext } from "react";
import ProjectContext from "../contexts/ProjectContext";

export default function useCurrentProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx)
    throw new Error("useCurrentProject must be used inside <ProjectProvider>");
  return ctx;
}
