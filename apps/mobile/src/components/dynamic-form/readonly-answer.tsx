import type { AnswerValue, QuestionData } from '@drmayday/shared';
import { StyleSheet, Text, View } from 'react-native';

/** Giá trị trả lời dạng chữ để hiển thị (option_value → option_text); null nếu chưa trả lời. */
function formatAnswer(question: QuestionData, value: AnswerValue): string | null {
  const labelOf = (v: string) =>
    question.options.find((o) => o.option_value === v)?.option_text ?? v;
  if (Array.isArray(value)) return value.length > 0 ? value.map(labelOf).join(', ') : null;
  if (typeof value === 'string' && value !== '') {
    return question.type_question === 'radio' ? labelOf(value) : value;
  }
  return null;
}

export function ReadonlyAnswer({
  question,
  value,
}: {
  question: QuestionData;
  value: AnswerValue;
}) {
  if (question.type_question === 'group_questions') {
    return <Text style={styles.group}>{question.question_text}</Text>;
  }
  return (
    <View style={styles.row}>
      <Text style={styles.question}>{question.question_text}</Text>
      <Text style={styles.answer}>{formatAnswer(question, value) ?? 'Chưa trả lời'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 2 },
  question: { fontSize: 16, color: '#595959' },
  answer: { fontSize: 18, fontWeight: '600' },
  group: { fontSize: 18, fontWeight: '700' },
});
