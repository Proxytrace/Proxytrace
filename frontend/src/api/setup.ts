import { api } from './client';
import type { ProjectDto } from './models';

interface UserDto {
  id: string;
  name: string;
}

export interface SetupStatusDto {
  isConfigured: boolean;
}

export const setupApi = {
  getStatus: () => api.get<SetupStatusDto>('/api/setup/status'),
  createUser: (name: string) => api.post<UserDto>('/api/users', { name }),
  createProject: (name: string) =>
    api.post<ProjectDto>('/api/projects', { name }),
};
