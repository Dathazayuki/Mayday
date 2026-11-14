import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';

/**
 * Mutation làm mới mọi query có tiền tố nằm trong `queryKeys` khi kết thúc (kể cả khi thất bại giữa
 * chừng, vì thao tác có thể đã ghi một phần). Dùng chung cho mọi module API.
 */
export function useInvalidatingMutation<TVars, TData>(
  queryKeys: readonly QueryKey[],
  fn: (vars: TVars) => Promise<TData>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () =>
      Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}
