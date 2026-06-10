import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../../api/projects';
import { usersApi } from '../../../api/users';
import { QUERY_KEYS } from '../../../api/query-keys';
import type { UserRole } from '../../../api/models';
import { LIST_PAGE_SIZE } from '../../../lib/constants';

/** All users for the admin table. */
export function useUsers() {
  return useQuery({
    queryKey: QUERY_KEYS.users,
    queryFn: () => usersApi.list({ pageSize: LIST_PAGE_SIZE }),
    select: (page) => page.items,
  });
}

/** Promotes/demotes a user; invalidates the list. */
export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; role: UserRole }) => usersApi.updateRole(args.id, args.role),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.users }),
  });
}

/** Removes a user; invalidates the list. */
export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.users }),
  });
}

/** Projects a single user belongs to (for the assignment editor). */
export function useUserProjects(userId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.userProjects(userId ?? 'none'),
    queryFn: () => usersApi.listProjects(userId ?? ''),
    enabled: !!userId,
  });
}

/** Every project (for the assignment editor's checklist). */
export function useAllProjects() {
  return useQuery({
    queryKey: QUERY_KEYS.projects,
    queryFn: () => projectsApi.list({ pageSize: LIST_PAGE_SIZE }),
    select: (page) => page.items,
  });
}

/** Adds the user to a project; invalidates that user's project list and the project list. */
export function useAssignUserProject(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => projectsApi.addMember(projectId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.userProjects(userId) });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.projects });
    },
  });
}

/** Removes the user from a project; invalidates that user's project list and the project list. */
export function useUnassignUserProject(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => projectsApi.removeMember(projectId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.userProjects(userId) });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.projects });
    },
  });
}
