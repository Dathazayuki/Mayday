import type { Flag, TemplateSummary } from '@drmayday/shared';

export interface TemplateFormValues {
  code_template: string;
  name: string;
  description?: string;
  version: string;
  is_active: Flag;
}

export const TEMPLATE_STATUS_OPTIONS: { value: Flag; label: string }[] = [
  { value: '1', label: 'Đang dùng' },
  { value: '0', label: 'Ngừng dùng' },
];

export const toTemplateFormValues = (template: TemplateSummary | null) => ({
  code_template: template?.code_template ?? '',
  name: template?.name ?? '',
  description: template?.description ?? '',
  version: template?.version ?? '1.0',
  is_active: template?.is_active ?? '1',
});
