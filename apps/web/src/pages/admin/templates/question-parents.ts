import type { QuestionData, TemplateSectionDetail } from '@drmayday/shared';

/** question_id của câu hỏi `rootId` và mọi câu hỏi cháu chắt của nó. */
function subtreeIds(questions: readonly QuestionData[], rootId: string): Set<string> {
  const ids = new Set([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const q of questions) {
      if (q.parent_question_id && ids.has(q.parent_question_id) && !ids.has(q.question_id)) {
        ids.add(q.question_id);
        grew = true;
      }
    }
  }
  return ids;
}

/**
 * Câu hỏi có thể làm cha: thuộc cùng mẫu phiếu (mọi section), có lựa chọn, và không phải chính
 * câu đang sửa hay con cháu của nó (tránh vòng lặp).
 */
export function parentCandidates(
  sections: readonly TemplateSectionDetail[],
  editingId?: string,
): QuestionData[] {
  const all = sections.flatMap((s) => s.questions);
  const excluded = editingId ? subtreeIds(all, editingId) : new Set<string>();
  return all.filter((q) => q.options.length > 0 && !excluded.has(q.question_id));
}
