import { IMAGE_QUESTION_TYPES, type AnswerValue, type QuestionData } from '@drmayday/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FormField } from '@/components/form-field';
import { OptionPicker } from '@/components/option-picker';

interface QuestionFieldProps {
  question: QuestionData;
  value: AnswerValue;
  error?: string | null;
  onChange: (value: AnswerValue) => void;
}

/** Ô nhập cho một câu hỏi, theo kiểu câu hỏi. */
export function QuestionField({ question, value, error, onChange }: QuestionFieldProps) {
  const label =
    question.is_required === '1' ? `${question.question_text} *` : question.question_text;
  const help = question.help_text ? <Text style={styles.help}>{question.help_text}</Text> : null;
  const errorText = error ? <Text style={styles.error}>{error}</Text> : null;

  if (IMAGE_QUESTION_TYPES.includes(question.type_question)) {
    return (
      <View style={styles.block}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.placeholderBox}>Tải ảnh sẽ có ở giai đoạn 5</Text>
      </View>
    );
  }

  switch (question.type_question) {
    case 'radio': {
      const options = question.options.map((o) => ({
        value: o.option_value,
        label: o.option_text,
      }));
      return (
        <View style={styles.block}>
          <OptionPicker
            label={label}
            options={options}
            value={typeof value === 'string' ? value : null}
            onChange={onChange}
          />
          {help}
          {errorText}
        </View>
      );
    }
    case 'checkbox': {
      const selected = Array.isArray(value) ? (value as readonly string[]) : [];
      const toggle = (optionValue: string) =>
        onChange(
          selected.includes(optionValue)
            ? selected.filter((v) => v !== optionValue)
            : [...selected, optionValue],
        );
      return (
        <View style={styles.block}>
          <Text style={styles.label}>{label}</Text>
          <View style={styles.chips}>
            {question.options.map((option) => {
              const checked = selected.includes(option.option_value);
              return (
                <Pressable
                  key={option.id}
                  style={[styles.chip, checked && styles.chipChecked]}
                  onPress={() => toggle(option.option_value)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                >
                  <Text style={[styles.chipText, checked && styles.chipTextChecked]}>
                    {option.option_text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {help}
          {errorText}
        </View>
      );
    }
    case 'image_upload':
    case 'mix_text_image':
      return null; // đã xử lý ở trên
    case 'group_questions':
      return <Text style={styles.group}>{question.question_text}</Text>;
    case 'number':
    case 'date':
    case 'text':
      return (
        <View style={styles.block}>
          <FormField
            label={label}
            value={typeof value === 'string' ? value : ''}
            onChangeText={onChange}
            error={error}
            placeholder={
              question.placeholder ?? (question.type_question === 'date' ? 'YYYY-MM-DD' : undefined)
            }
            keyboardType={question.type_question === 'number' ? 'numeric' : 'default'}
            maxLength={question.type_question === 'date' ? 10 : undefined}
          />
          {help}
        </View>
      );
  }
}

const styles = StyleSheet.create({
  block: { gap: 6 },
  label: { fontSize: 18, fontWeight: '600' },
  help: { fontSize: 18, color: '#595959' },
  error: { fontSize: 18, color: '#cf1322' },
  group: { fontSize: 18, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 56,
    minWidth: 96,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipChecked: { borderColor: '#2f54eb', backgroundColor: '#f0f5ff' },
  chipText: { fontSize: 18, color: '#262626' },
  chipTextChecked: { color: '#1d39c4', fontWeight: '700' },
  placeholderBox: {
    fontSize: 18,
    color: '#595959',
    padding: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d9d9d9',
    borderRadius: 12,
    backgroundColor: '#fafafa',
  },
});
