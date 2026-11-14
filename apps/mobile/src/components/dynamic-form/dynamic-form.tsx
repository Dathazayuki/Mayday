import {
  buildQuestionTree,
  isQuestionVisible,
  type AnswerValue,
  type FormState,
  type QuestionNode,
  type TemplateDetailData,
} from '@drmayday/shared';
import { StyleSheet, Text, View } from 'react-native';
import { isPatientSection } from '@/lib/dynamic-form';
import { QuestionField } from './question-field';
import { ReadonlyAnswer } from './readonly-answer';

interface DynamicFormProps {
  template: TemplateDetailData;
  state: FormState;
  /** Chỉ đọc: hiện mọi section (kể cả của bác sĩ). Ngược lại chỉ hiện section bệnh nhân điền. */
  readOnly?: boolean;
  errors?: Record<string, string>;
  onChange?: (questionId: string, value: AnswerValue) => void;
}

/**
 * Phiếu theo cấu trúc mẫu. Khi điền, section `doctor` bị ẩn hoàn toàn (bệnh nhân không được ghi
 * nên hiện ô nhập sẽ gây hiểu nhầm); khi xem lại thì hiện tất cả ở chế độ chỉ đọc.
 */
export function DynamicForm({
  template,
  state,
  readOnly = false,
  errors,
  onChange,
}: DynamicFormProps) {
  const sections = [...template.sections]
    .filter((section) => readOnly || isPatientSection(section))
    .sort((a, b) => Number(a.order) - Number(b.order));

  const renderNodes = (nodes: QuestionNode[]) =>
    nodes.map(({ question, children }) => {
      // Dừng ở nút bị ẩn: câu con của câu bị ẩn cũng không hiển thị.
      if (!isQuestionVisible(question, state)) return null;
      const value = state[question.question_id];
      return (
        <View key={question.question_id} style={styles.question}>
          {readOnly ? (
            <ReadonlyAnswer question={question} value={value} />
          ) : (
            <QuestionField
              question={question}
              value={value}
              error={errors?.[question.question_id]}
              onChange={(next) => onChange?.(question.question_id, next)}
            />
          )}
          {children.length > 0 && <View style={styles.children}>{renderNodes(children)}</View>}
        </View>
      );
    });

  return (
    <View style={styles.form}>
      {sections.map((section) => (
        <View key={section.section_id} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {renderNodes(buildQuestionTree(section.questions))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 24 },
  section: { gap: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '700' },
  question: { gap: 12 },
  children: { gap: 12, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: '#d6e4ff' },
});
