import type { QuestionData } from './contracts/templates.js';

export interface QuestionNode {
  question: QuestionData;
  children: QuestionNode[];
}

/** Giá trị trả lời dùng để xét hiển thị: radio/text → chuỗi, checkbox → mảng. */
export type AnswerValue = string | readonly string[] | null | undefined;

/** Dựng cây theo parent_question_id; anh em sắp theo order (số) tăng dần, ổn định. */
export function buildQuestionTree(questions: readonly QuestionData[]): QuestionNode[] {
  const nodes = new Map(
    questions.map((q) => [q.question_id, { question: q, children: [] as QuestionNode[] }]),
  );
  const roots: QuestionNode[] = [];
  for (const q of questions) {
    const node = nodes.get(q.question_id)!;
    const parent = q.parent_question_id ? nodes.get(q.parent_question_id) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  const sortNodes = (list: QuestionNode[]): QuestionNode[] => {
    list.sort((a, b) => Number(a.question.order) - Number(b.question.order));
    list.forEach((n) => sortNodes(n.children));
    return list;
  };
  return sortNodes(roots);
}

/**
 * Câu hỏi có hiện hay không, chỉ xét điều kiện của chính nó (MT-69).
 * Người gọi duyệt cây từ gốc và dừng ở nút bị ẩn, nên câu hỏi con của câu bị ẩn cũng ẩn theo.
 */
export function isQuestionVisible(
  question: Pick<QuestionData, 'parent_question_id' | 'show_if_answer'>,
  answers: Readonly<Record<string, AnswerValue>>,
): boolean {
  if (!question.parent_question_id || !question.show_if_answer) return true;
  const answer = answers[question.parent_question_id];
  const values = typeof answer === 'string' ? (answer ? [answer] : []) : (answer ?? []);
  return values.some((value) => question.show_if_answer!.includes(value));
}

/** Chuỗi show_if_answer hợp lệ: JSON mảng chuỗi khác rỗng, có ít nhất 1 phần tử. */
export function isValidShowIfAnswer(raw: string): boolean {
  try {
    const parsed: unknown = JSON.parse(raw);
    return (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every((v) => typeof v === 'string' && v.trim() !== '')
    );
  } catch {
    return false;
  }
}
