import { useMutation, useQueryClient } from '@tanstack/react-query';

/** Mutation làm mới mọi query có tiền tố `queryKey` sau khi thành công (danh sách lẫn chi tiết). */
export function useInvalidatingMutation<TVars, TData>(
  queryKey: readonly unknown[],
  fn: (vars: TVars) => Promise<TData>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
}
