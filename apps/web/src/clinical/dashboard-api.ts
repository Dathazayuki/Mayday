import type { DashboardSummaryData } from '@drmayday/shared';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api';

/** Tiền tố query của Tổng quan: mọi thao tác ghi bệnh án làm mới cả nhóm (spec B, mục 8.6). */
export const DASHBOARD_KEY = ['dashboard'] as const;

/** GET /dashboard/summary (MT-123). `enabled` false: không gọi API (vd. người đăng nhập là bệnh nhân). */
export function useDashboardSummary(enabled: boolean) {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'summary'],
    queryFn: () => apiClient.get<DashboardSummaryData>('/dashboard/summary'),
    enabled,
  });
}
