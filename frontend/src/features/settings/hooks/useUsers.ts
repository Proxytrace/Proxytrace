import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../../../api/users';
import { QUERY_KEYS } from '../../../api/query-keys';
import { LIST_PAGE_SIZE } from '../../../lib/constants';

/** All users (admin), for the add-member picker. */
export function useUsers() {
  return useQuery({
    queryKey: QUERY_KEYS.users,
    queryFn: () => usersApi.list({ pageSize: LIST_PAGE_SIZE }),
  });
}
