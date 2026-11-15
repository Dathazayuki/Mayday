import { LESION_CONTEXT_TAG_SUGGESTIONS } from '@drmayday/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FormField } from '@/components/form-field';
import { PrimaryButton } from '@/components/primary-button';

interface ContextTagsInputProps {
  tags: readonly string[];
  onChange: (tags: string[]) => void;
}

/** Chip gợi ý (MT-94) cộng ô thêm thẻ tự do; chạm chip để chọn hoặc bỏ chọn. */
export function ContextTagsInput({ tags, onChange }: ContextTagsInputProps) {
  const [draft, setDraft] = useState('');
  // Gợi ý trước, rồi các thẻ tự do đã thêm.
  const chips = [...LESION_CONTEXT_TAG_SUGGESTIONS, ...tags.filter((tag) => !isSuggestion(tag))];

  function toggle(tag: string) {
    onChange(tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag]);
  }

  function addDraft() {
    const tag = draft.trim();
    if (tag === '') return;
    if (!tags.includes(tag)) onChange([...tags, tag]);
    setDraft('');
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Bối cảnh xuất hiện</Text>
      <View style={styles.chips}>
        {chips.map((tag) => {
          const selected = tags.includes(tag);
          return (
            <Pressable
              key={tag}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => toggle(tag)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{tag}</Text>
            </Pressable>
          );
        })}
      </View>
      <FormField
        label="Thêm bối cảnh khác"
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={addDraft}
        onBlur={addDraft}
        returnKeyType="done"
        maxLength={100}
      />
      <PrimaryButton title="Thêm" variant="secondary" onPress={addDraft} />
    </View>
  );
}

function isSuggestion(tag: string): boolean {
  return (LESION_CONTEXT_TAG_SUGGESTIONS as readonly string[]).includes(tag);
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { fontSize: 18, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 56,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { borderColor: '#2f54eb', backgroundColor: '#f0f5ff' },
  chipText: { fontSize: 18, color: '#262626' },
  chipTextSelected: { color: '#1d39c4', fontWeight: '700' },
});
