import type { CreateSectionRequest, FilledBy, TemplateSectionDetail } from '@drmayday/shared';
import { fromFlag, toFlag } from './mapping';

export interface SectionFormValues {
  title: string;
  order: number;
  is_required: boolean;
  filled_by?: FilledBy;
}

/** Cùng một body cho POST và PUT section (PUT nhận từng phần nhưng form luôn có đủ trường). */
export function toSectionRequest(values: SectionFormValues): CreateSectionRequest {
  return {
    title: values.title.trim(),
    order: String(values.order),
    is_required: toFlag(values.is_required),
    ...(values.filled_by && { filled_by: values.filled_by }),
  };
}

/** Giá trị ban đầu của form: section cần sửa, hoặc mặc định khi tạo mới (order = thứ tự kế tiếp). */
export function toSectionFormValues(
  section: TemplateSectionDetail | null,
  nextOrder: number,
): SectionFormValues {
  if (!section) return { title: '', order: nextOrder, is_required: false };
  return {
    title: section.title,
    order: Number(section.order),
    is_required: fromFlag(section.is_required),
    filled_by: section.filled_by ?? undefined,
  };
}
